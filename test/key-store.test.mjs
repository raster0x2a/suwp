import test from 'node:test';
import assert from 'node:assert/strict';
import { createEncryptedCapsule } from '../src/capsule.js';
import { MemoryKeyStore } from '../src/key-store.js';

test('MemoryKeyStore saves, reads, and deletes keys', async () => {
  const store = new MemoryKeyStore();
  const { capsule, key } = await createEncryptedCapsule({ url: 'https://example.com/' });

  assert.equal(await store.get(capsule.kid), null);
  await store.set(capsule.kid, key);
  assert.equal(await store.get(capsule.kid), key);
  await store.delete(capsule.kid);
  assert.equal(await store.get(capsule.kid), null);
});
