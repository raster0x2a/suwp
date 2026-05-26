import test from 'node:test';
import assert from 'node:assert/strict';
import { createUnlockCodeSession } from '../src/create-session.js';

test('createUnlockCodeSession keeps the same code until explicitly regenerated', () => {
  const generated = ['AAAAA-AAAAA-AAAAA-AAAAA-AAAAA-AAAAA', 'BBBBB-BBBBB-BBBBB-BBBBB-BBBBB-BBBBB'];
  const session = createUnlockCodeSession(() => generated.shift());

  assert.equal(session.getUnlockCode(), 'AAAAA-AAAAA-AAAAA-AAAAA-AAAAA-AAAAA');
  assert.equal(session.getUnlockCode(), 'AAAAA-AAAAA-AAAAA-AAAAA-AAAAA-AAAAA');
  assert.equal(session.regenerateUnlockCode(), 'BBBBB-BBBBB-BBBBB-BBBBB-BBBBB-BBBBB');
  assert.equal(session.getUnlockCode(), 'BBBBB-BBBBB-BBBBB-BBBBB-BBBBB-BBBBB');
});
