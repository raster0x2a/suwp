import { generateUnlockCode } from './password.js';

export const DEFAULT_UNLOCK_CODE_STORAGE_KEY = 'suwp:create:v1:unlockCode';

export function createUnlockCodeSession(options = {}) {
  const normalized = typeof options === 'function' ? { generator: options } : options;
  const {
    generator = generateUnlockCode,
    storage = getDefaultStorage(),
    storageKey = DEFAULT_UNLOCK_CODE_STORAGE_KEY,
  } = normalized;

  if (typeof generator !== 'function') {
    throw new Error('unlock code generator must be a function');
  }

  let unlockCode = readStoredUnlockCode(storage, storageKey);
  if (!unlockCode) {
    unlockCode = generator();
    writeStoredUnlockCode(storage, storageKey, unlockCode);
  }

  return {
    getUnlockCode() {
      return unlockCode;
    },

    regenerateUnlockCode() {
      unlockCode = generator();
      writeStoredUnlockCode(storage, storageKey, unlockCode);
      return unlockCode;
    },
  };
}

function getDefaultStorage() {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

function readStoredUnlockCode(storage, storageKey) {
  if (!storage) return null;
  try {
    const stored = storage.getItem(storageKey);
    return typeof stored === 'string' && stored.length > 0 ? stored : null;
  } catch {
    return null;
  }
}

function writeStoredUnlockCode(storage, storageKey, unlockCode) {
  if (!storage) return;
  try {
    storage.setItem(storageKey, unlockCode);
  } catch {
    // Storage can be unavailable in private browsing or strict environments.
    // In that case, the in-memory code remains stable until the page unloads.
  }
}
