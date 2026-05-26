import { generateUnlockCode } from './password.js';

export function createUnlockCodeSession(generator = generateUnlockCode) {
  if (typeof generator !== 'function') {
    throw new Error('unlock code generator must be a function');
  }

  let unlockCode = generator();

  return {
    getUnlockCode() {
      return unlockCode;
    },

    regenerateUnlockCode() {
      unlockCode = generator();
      return unlockCode;
    },
  };
}
