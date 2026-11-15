import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { connectDB, databaseFailureCategory } from '../config/db.js';

test('connection cache shares warm invocations and recovers from rejected promises', async (t) => {
  process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/isolated_mock';
  let calls = 0;
  let rejectAttempt;
  const stub = t.mock.method(mongoose, 'connect', () => {
    calls += 1;
    return new Promise((_resolve, reject) => { rejectAttempt = reject; });
  });
  const first = connectDB();
  const second = connectDB();
  await Promise.resolve();
  rejectAttempt(Object.assign(new Error('DNS failed'), { code: 'ENOTFOUND' }));
  await Promise.all([assert.rejects(first, { statusCode: 503 }), assert.rejects(second, { statusCode: 503 })]);
  assert.equal(calls, 1);
  stub.mock.mockImplementation(async () => { calls += 1; });
  await connectDB();
  assert.equal(calls, 2);
  stub.mock.mockImplementation(() => { throw new Error('Synchronous connection configuration failure'); });
  await assert.rejects(connectDB(), { statusCode: 503 });
  stub.mock.mockImplementation(async () => { calls += 1; });
  await connectDB();
  assert.equal(calls, 3);
  // Simulate a warm connected instance: no new connect call is permitted.
  const state = mongoose.connection.readyState;
  mongoose.connection.readyState = 1;
  try { await connectDB(); assert.equal(calls, 3); }
  finally { mongoose.connection.readyState = state; }
});

test('missing connection configuration fails closed in development too', async () => {
  process.env.MONGODB_URI = '';
  await assert.rejects(connectDB(), { statusCode: 503 });
});

test('connection errors have safe actionable categories', () => {
  assert.equal(databaseFailureCategory({ code: 18 }), 'authentication');
  assert.equal(databaseFailureCategory({ code: 'ENOTFOUND', message: 'querySrv failed' }), 'dns');
  assert.equal(databaseFailureCategory({ message: 'TLS certificate failed' }), 'tls');
  assert.equal(databaseFailureCategory({ message: 'Invalid URI scheme' }), 'configuration');
});
