import test from 'node:test';
import assert from 'node:assert/strict';
import { createEncryptedCapsule } from '../src/capsule.js';
import { MemoryKeyStore } from '../src/key-store.js';

const CODE_A = 'AAAAA-AAAAA-AAAAA-AAAAA-AAAAA-AAAAA';
const CODE_B = 'BBBBB-BBBBB-BBBBB-BBBBB-BBBBB-BBBBB';

test('MemoryKeyStore saves, reads, and deletes keys', async () => {
  const store = new MemoryKeyStore();
  const { capsule, key } = await createEncryptedCapsule({ url: 'https://example.com/' });

  assert.equal(await store.get(capsule.kid), null);
  await store.set(capsule.kid, key);
  assert.equal(await store.get(capsule.kid), key);
  await store.delete(capsule.kid);
  assert.equal(await store.get(capsule.kid), null);
});

test('MemoryKeyStore stores all known unlock codes and tracks the default code', async () => {
  const store = new MemoryKeyStore();

  const first = await store.saveUnlockCode(CODE_A, { makeDefault: true });
  const second = await store.saveUnlockCode(CODE_B, { makeDefault: false });

  assert.equal((await store.getDefaultUnlockCode()).codeId, first.codeId);
  assert.deepEqual((await store.listUnlockCodes()).map((record) => record.codeId), [first.codeId, second.codeId]);

  await store.saveUnlockCode(CODE_B, { makeDefault: true });
  assert.equal((await store.getDefaultUnlockCode()).codeId, second.codeId);
  assert.deepEqual((await store.listUnlockCodes()).map((record) => record.codeId), [second.codeId, first.codeId]);
});
