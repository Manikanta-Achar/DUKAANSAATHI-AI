import express from 'express';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { authRateLimit, issueSession, requireAuth, csrfProtection, logout, publicUser } from '../middleware/auth.js';
import { fail, text } from '../utils/validation.js';

const router = express.Router();
const emailValue = (value) => {
  const email = text(value, 'Email address', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Enter a valid email address.');
  return email;
};
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res)).catch(next);
router.post('/register', authRateLimit, asyncRoute(async (req, res) => {
  await User.init();
  const name = text(req.body.name, 'Full name', 100);
  const shopName = text(req.body.shopName, 'Shop name', 120);
  const email = emailValue(req.body.email);
  const password = req.body.password;
  if (typeof password !== 'string' || password.length < 10 || Buffer.byteLength(password) > 72 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password)) fail('Use 10 or more characters with uppercase, lowercase, and a number (maximum 72 UTF-8 bytes).');
  if (password !== req.body.confirmPassword) fail('Passwords do not match.');
  if (await User.exists({ email })) fail('An account with this email already exists.', 409);
  const passwordHash = await bcrypt.hash(password, 12);
  let user;
  try { user = await User.create({ name, shopName, email, passwordHash }); }
  catch (error) { if (error.code === 11000) fail('An account with this email already exists.', 409); throw error; }
  res.status(201).json({ success: true, data: await issueSession(req, res, user) });
}));
router.post('/login', authRateLimit, asyncRoute(async (req, res) => {
  const email = emailValue(req.body.email);
  const password = req.body.password;
  if (typeof password !== 'string' || !password || Buffer.byteLength(password) > 72) fail('Email or password is incorrect.', 401);
  const user = await User.findOne({ email }).select('+passwordHash');
  const valid = await bcrypt.compare(password, user?.passwordHash || '$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW');
  if (!user || !valid) fail('Email or password is incorrect.', 401);
  res.json({ success: true, data: await issueSession(req, res, user) });
}));
router.get('/me', requireAuth, (req, res) => res.json({ success: true, data: { user: publicUser(req.user), csrfToken: req.authSession.csrfToken } }));
router.post('/logout', requireAuth, csrfProtection, asyncRoute(logout));
export default router;
