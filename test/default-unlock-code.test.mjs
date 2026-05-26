import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultUnlockCodeManager } from '../src/default-unlock-code.js';
import { MemoryKeyStore } from '../src/key-store.js';

const CODE_A = 'AAAAA-AAAAA-AAAAA-AAAAA-AAAAA-AAAAA';
const CODE_B = 'BBBBB-BBBBB-BBBBB-BBBBB-BBBBB-BBBBB';
const LEGACY_CODE = 'CCCCC-CCCCC-CCCCC-CCCCC-CCCCC-CCCCC';

function createFakeStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
  };
}

test('default unlock code manager persists the same default code across reloads', async () => {
  const store = new MemoryKeyStore();
  const generated = [CODE_A, 'SHOULD-NOT-BE-USED'];

  const firstLoad = createDefaultUnlockCodeManager({ store, generator: () => generated.shift(), legacyStorage: null });
  assert.equal(await firstLoad.initialize(), CODE_A);
  assert.equal(firstLoad.getUnlockCode(), CODE_A);

  const afterReload = createDefaultUnlockCodeManager({ store, generator: () => generated.shift(), legacyStorage: null });
  assert.equal(await afterReload.initialize(), CODE_A);
  assert.equal(afterReload.getUnlockCode(), CODE_A);
});

test('regenerating the default unlock code is the only automatic way to change it', async () => {
  const store = new MemoryKeyStore();
  const generated = [CODE_A, CODE_B, 'SHOULD-NOT-BE-USED'];

  const firstLoad = createDefaultUnlockCodeManager({ store, generator: () => generated.shift(), legacyStorage: null });
  await firstLoad.initialize();
  assert.equal(await firstLoad.regenerateUnlockCode(), CODE_B);

  const afterReload = createDefaultUnlockCodeManager({ store, generator: () => generated.shift(), legacyStorage: null });
  assert.equal(await afterReload.initialize(), CODE_B);
});

test('manager migrates a legacy sessionStorage draft code when no persistent default exists', async () => {
  const store = new MemoryKeyStore();
  const storage = createFakeStorage({ 'suwp:create:v1:unlockCode': LEGACY_CODE });
  const manager = createDefaultUnlockCodeManager({ store, generator: () => CODE_A, legacyStorage: storage });

  assert.equal(await manager.initialize(), LEGACY_CODE);
  assert.equal((await store.getDefaultUnlockCode()).unlockCode, LEGACY_CODE);
});
