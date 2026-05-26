import test from 'node:test';
import assert from 'node:assert/strict';
import { createUnlockCodeSession } from '../src/create-session.js';

function createFakeStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
  };
}

test('createUnlockCodeSession keeps the same code until explicitly regenerated', () => {
  const generated = ['AAAAA-AAAAA-AAAAA-AAAAA-AAAAA-AAAAA', 'BBBBB-BBBBB-BBBBB-BBBBB-BBBBB-BBBBB'];
  const session = createUnlockCodeSession({ generator: () => generated.shift(), storage: null });

  assert.equal(session.getUnlockCode(), 'AAAAA-AAAAA-AAAAA-AAAAA-AAAAA-AAAAA');
  assert.equal(session.getUnlockCode(), 'AAAAA-AAAAA-AAAAA-AAAAA-AAAAA-AAAAA');
  assert.equal(session.regenerateUnlockCode(), 'BBBBB-BBBBB-BBBBB-BBBBB-BBBBB-BBBBB');
  assert.equal(session.getUnlockCode(), 'BBBBB-BBBBB-BBBBB-BBBBB-BBBBB-BBBBB');
});

test('createUnlockCodeSession restores the draft code from storage after reload', () => {
  const storage = createFakeStorage();
  const storageKey = 'test:unlockCode';
  const generated = ['AAAAA-AAAAA-AAAAA-AAAAA-AAAAA-AAAAA', 'SHOULD-NOT-BE-USED'];

  const firstLoad = createUnlockCodeSession({ generator: () => generated.shift(), storage, storageKey });
  assert.equal(firstLoad.getUnlockCode(), 'AAAAA-AAAAA-AAAAA-AAAAA-AAAAA-AAAAA');

  const afterReload = createUnlockCodeSession({ generator: () => generated.shift(), storage, storageKey });
  assert.equal(afterReload.getUnlockCode(), 'AAAAA-AAAAA-AAAAA-AAAAA-AAAAA-AAAAA');
});

test('regenerating the unlock code updates storage for later reloads', () => {
  const storage = createFakeStorage();
  const storageKey = 'test:unlockCode';
  const generated = ['AAAAA-AAAAA-AAAAA-AAAAA-AAAAA-AAAAA', 'BBBBB-BBBBB-BBBBB-BBBBB-BBBBB-BBBBB', 'SHOULD-NOT-BE-USED'];

  const firstLoad = createUnlockCodeSession({ generator: () => generated.shift(), storage, storageKey });
  assert.equal(firstLoad.regenerateUnlockCode(), 'BBBBB-BBBBB-BBBBB-BBBBB-BBBBB-BBBBB');

  const afterReload = createUnlockCodeSession({ generator: () => generated.shift(), storage, storageKey });
  assert.equal(afterReload.getUnlockCode(), 'BBBBB-BBBBB-BBBBB-BBBBB-BBBBB-BBBBB');
});
