import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTargetUrl } from '../src/url.js';

test('normalizeTargetUrl accepts https URLs', () => {
  assert.equal(normalizeTargetUrl('https://example.com/a?b=1'), 'https://example.com/a?b=1');
});

test('normalizeTargetUrl rejects dangerous schemes', () => {
  assert.throws(() => normalizeTargetUrl('javascript:alert(1)'), /https/u);
  assert.throws(() => normalizeTargetUrl('data:text/html,hi'), /https/u);
  assert.throws(() => normalizeTargetUrl('file:///etc/passwd'), /https/u);
});

test('normalizeTargetUrl handles http policy', () => {
  assert.throws(() => normalizeTargetUrl('http://example.com'), /https/u);
  assert.equal(normalizeTargetUrl('http://example.com', { allowHttp: true }), 'http://example.com/');
  assert.equal(normalizeTargetUrl('http://localhost:3000/a'), 'http://localhost:3000/a');
});
