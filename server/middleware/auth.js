import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import Session from '../models/Session.js';
import User from '../models/User.js';
import RateLimit from '../models/RateLimit.js';
import { fail } from '../utils/validation.js';

const digest = (value) => createHash('sha256').update(value).digest('hex');
const hosted = () => process.env.NODE_ENV === 'production' || Boolean(process.env.VERCEL);
const cookieName = () => hosted() ? '__Host-dukaansaathi' : 'dukaansaathi';
const sameSite = () => process.env.COOKIE_SAME_SITE === 'none' && hosted() ? 'none' : 'lax';
const cookieOptions = () => ({ httpOnly: true, secure: hosted(), sameSite: sameSite(), path: '/' });
export function sessionToken(req) {
  const cookie = (req.headers.cookie || '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${cookieName()}=`));
  return cookie?.slice(cookieName().length + 1) || '';
}
export const publicUser = (user) => ({ id: user._id, name: user.name, shopName: user.shopName, email: user.email });
export async function issueSession(req, res, user) {
  const token = randomBytes(32).toString('hex');
  const csrfToken = randomBytes(32).toString('hex');
  const maxAge = 8 * 60 * 60 * 1000;
  await Session.create({ tokenHash: digest(token), ownerId: user._id, csrfToken, expiresAt: new Date(Date.now() + maxAge) });
  const oldToken = sessionToken(req);
  if (oldToken) await Session.deleteOne({ tokenHash: digest(oldToken) });
  res.cookie(cookieName(), token, { ...cookieOptions(), maxAge });
  return { user: publicUser(user), csrfToken };
}
export async function requireAuth(req, _res, next) {
  try {
    const token = sessionToken(req);
    if (!/^[a-f0-9]{64}$/.test(token)) fail('Please log in to continue.', 401);
    const session = await Session.findOne({ tokenHash: digest(token), expiresAt: { $gt: new Date() } });
    if (!session) fail('Your session has expired. Please log in.', 401);
    const user = await User.findById(session.ownerId);
    if (!user) fail('Please log in to continue.', 401);
    req.user = user;
    req.authSession = session;
    next();
  } catch (error) { next(error); }
}
export function csrfProtection(req, _res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const provided = Buffer.from(req.get('X-CSRF-Token') || '');
  const expected = Buffer.from(req.authSession.csrfToken);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return next(Object.assign(new Error('Session verification failed. Refresh and try again.'), { statusCode: 403 }));
  next();
}
export async function logout(req, res) {
  await Session.deleteOne({ _id: req.authSession._id, ownerId: req.user._id });
  res.clearCookie(cookieName(), cookieOptions());
  res.json({ success: true, message: 'Logged out successfully.' });
}
export async function authRateLimit(req, res, next) {
  try {
    const windowMs = 15 * 60 * 1000;
    const ip = process.env.VERCEL ? req.get('x-vercel-forwarded-for') || req.socket.remoteAddress : req.socket.remoteAddress;
    const bucket = Math.floor(Date.now() / windowMs);
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const keys = [[`ip:${ip}`, req.path === '/register' ? 10 : 30]];
    if (email) keys.push([`email:${email}`, 15]);
    for (const [key, maximum] of keys) {
      const id = digest(`${req.path}:${key}:${bucket}`);
      let record;
      try {
        record = await RateLimit.findOneAndUpdate({ _id: id }, { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date((bucket + 1) * windowMs) } }, { upsert: true, new: true });
      } catch (error) {
        if (error.code !== 11000) throw error;
        record = await RateLimit.findOneAndUpdate({ _id: id }, { $inc: { count: 1 } }, { new: true });
      }
      if (record.count > maximum) {
        res.set('Retry-After', String(Math.ceil(((bucket + 1) * windowMs - Date.now()) / 1000)));
        fail('Too many authentication attempts. Please try again later.', 429);
      }
    }
    next();
  } catch (error) { next(error); }
}
