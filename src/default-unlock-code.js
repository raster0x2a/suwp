import { generateUnlockCode } from './password.js';

const LEGACY_SESSION_STORAGE_KEY = 'suwp:create:v1:unlockCode';

export function createDefaultUnlockCodeManager(options) {
  const {
    store,
    generator = generateUnlockCode,
    legacyStorage = getLegacyStorage(),
  } = options ?? {};

  if (!store) throw new Error('store is required');
  if (typeof generator !== 'function') throw new Error('unlock code generator must be a function');

  let currentUnlockCode = null;

  return {
    async initialize() {
      const existing = await store.getDefaultUnlockCode();
      if (existing?.unlockCode) {
        currentUnlockCode = existing.unlockCode;
        return currentUnlockCode;
      }

      const legacyCode = readLegacyUnlockCode(legacyStorage);
      currentUnlockCode = legacyCode || generator();
      await store.saveUnlockCode(currentUnlockCode, { makeDefault: true });
      return currentUnlockCode;
    },

    getUnlockCode() {
      if (!currentUnlockCode) {
        throw new Error('unlock code manager is not initialized');
      }
      return currentUnlockCode;
    },

    async regenerateUnlockCode() {
      currentUnlockCode = generator();
      await store.saveUnlockCode(currentUnlockCode, { makeDefault: true });
      return currentUnlockCode;
    },

    async rememberUnlockCode(unlockCode, options = {}) {
      const record = await store.saveUnlockCode(unlockCode, {
        makeDefault: options.makeDefault === true,
      });
      if (options.makeDefault === true) {
        currentUnlockCode = record.unlockCode;
      }
      return record;
    },
  };
}

function getLegacyStorage() {
  try {
    return globalThis.sessionStorage ?? null;
  } catch {
    return null;
  }
}

function readLegacyUnlockCode(storage) {
  if (!storage) return null;
  try {
    const value = storage.getItem(LEGACY_SESSION_STORAGE_KEY);
    return typeof value === 'string' && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}
