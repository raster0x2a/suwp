import test from 'node:test';
import assert from 'node:assert/strict';
import { formatUnlockCode, generateUnlockCode, sanitizeUnlockCode, unlockCodeAlphabet, unlockCodeLength } from '../src/password.js';

test('generateUnlockCode returns a grouped high-entropy token', () => {
  const code = generateUnlockCode();
  assert.match(code, /^[A-HJ-NP-Z2-9]{5}(?:-[A-HJ-NP-Z2-9]{5}){5}$/u);
  assert.equal(sanitizeUnlockCode(code).length, unlockCodeLength());
});

test('generateUnlockCode returns different values', () => {
  const first = generateUnlockCode();
  const second = generateUnlockCode();
  assert.notEqual(first, second);
});

test('sanitizeUnlockCode accepts spaces and hyphens, rejects unsupported characters', () => {
  const raw = unlockCodeAlphabet().slice(0, 30);
  assert.equal(sanitizeUnlockCode(formatUnlockCode(raw)), raw);
  assert.throws(() => sanitizeUnlockCode('00000-00000-00000-00000-00000-00000'), /unsupported/u);
});
