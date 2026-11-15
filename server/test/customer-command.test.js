import test from 'node:test';
import assert from 'node:assert/strict';
import { validateGeminiAction } from '../services/geminiService.js';

test('Gemini intents cannot supply database selections or create/restore authorization', () => {
  const result = validateGeminiAction({ action: 'ADD_UDHAAR', customerName: 'Mahesh', amount: 100,
    customerId: 'invented', ownerId: 'other shop', createCustomer: true, restoreCustomer: true, explanation: { unsafe: true } });
  assert.deepEqual(result, { action: 'ADD_UDHAAR', customerName: 'Mahesh', amount: 100 });
  assert.deepEqual(validateGeminiAction({ action: 'CREATE_CUSTOMER', customerName: 'Mahesh', amount: 999 }), { action: 'CREATE_CUSTOMER', customerName: 'Mahesh', amount: 0 });
});

test('Gemini money amounts must be real positive numbers with valid currency precision', () => {
  for (const amount of [true, '100', -5, 0, 0.001, Infinity]) {
    assert.equal(validateGeminiAction({ action: 'ADD_UDHAAR', customerName: 'Mahesh', amount }), null);
  }
  assert.equal(validateGeminiAction({ action: 'CREATE_CUSTOMER', customerName: ' ' }), null);
  assert.equal(validateGeminiAction({ action: 'DROP_DATABASE' }), null);
});
