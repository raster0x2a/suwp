import { sha256Base64url } from './crypto.js';
import { formatUnlockCode, sanitizeUnlockCode } from './password.js';

const DB_NAME = 'secure-url-share-keys';
const DB_VERSION = 2;
const KEYS_STORE = 'keys';
const UNLOCK_CODES_STORE = 'unlockCodes';
const SETTINGS_STORE = 'settings';
const DEFAULT_UNLOCK_CODE_SETTING = 'defaultUnlockCodeId';

export class IndexedDbKeyStore {
  async get(kid) {
    const db = await openDb();
    const record = await requestToPromise(db.transaction(KEYS_STORE, 'readwrite').objectStore(KEYS_STORE).get(kid));
    if (!record?.key) return null;
    record.lastUsedAt = new Date().toISOString();
    await this.set(kid, record.key, record);
    return record.key;
  }

  async set(kid, key, metadata = {}) {
    const db = await openDb();
    const record = {
      kid,
      key,
      createdAt: metadata.createdAt ?? new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
      capsuleVersion: 1,
    };
    await requestToPromise(db.transaction(KEYS_STORE, 'readwrite').objectStore(KEYS_STORE).put(record));
  }

  async delete(kid) {
    const db = await openDb();
    await requestToPromise(db.transaction(KEYS_STORE, 'readwrite').objectStore(KEYS_STORE).delete(kid));
  }

  async saveUnlockCode(unlockCode, options = {}) {
    const db = await openDb();
    const record = await buildUnlockCodeRecord(unlockCode);
    const existing = await requestToPromise(
      db.transaction(UNLOCK_CODES_STORE, 'readonly').objectStore(UNLOCK_CODES_STORE).get(record.codeId),
    );

    const savedRecord = {
      ...record,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
    };

    await requestToPromise(
      db.transaction(UNLOCK_CODES_STORE, 'readwrite').objectStore(UNLOCK_CODES_STORE).put(savedRecord),
    );

    if (options.makeDefault === true) {
      await requestToPromise(
        db.transaction(SETTINGS_STORE, 'readwrite')
          .objectStore(SETTINGS_STORE)
          .put({ name: DEFAULT_UNLOCK_CODE_SETTING, value: savedRecord.codeId }),
      );
    }

    return savedRecord;
  }

  async getDefaultUnlockCode() {
    const db = await openDb();
    const setting = await requestToPromise(
      db.transaction(SETTINGS_STORE, 'readonly')
        .objectStore(SETTINGS_STORE)
        .get(DEFAULT_UNLOCK_CODE_SETTING),
    );

    if (setting?.value) {
      const record = await requestToPromise(
        db.transaction(UNLOCK_CODES_STORE, 'readonly')
          .objectStore(UNLOCK_CODES_STORE)
          .get(setting.value),
      );
      if (record?.unlockCode) return record;
    }

    const [fallback] = await this.listUnlockCodes();
    return fallback ?? null;
  }

  async listUnlockCodes() {
    const db = await openDb();
    const records = await requestToPromise(
      db.transaction(UNLOCK_CODES_STORE, 'readonly').objectStore(UNLOCK_CODES_STORE).getAll(),
    );
    const defaultRecord = await this.getDefaultUnlockCodeWithoutFallback(db);
    return records
      .filter((record) => record?.unlockCode)
      .sort((a, b) => {
        if (a.codeId === defaultRecord?.codeId) return -1;
        if (b.codeId === defaultRecord?.codeId) return 1;
        return String(b.lastUsedAt ?? '').localeCompare(String(a.lastUsedAt ?? ''));
      });
  }

  async getDefaultUnlockCodeWithoutFallback(db) {
    const setting = await requestToPromise(
      db.transaction(SETTINGS_STORE, 'readonly')
        .objectStore(SETTINGS_STORE)
        .get(DEFAULT_UNLOCK_CODE_SETTING),
    );
    if (!setting?.value) return null;
    return requestToPromise(
      db.transaction(UNLOCK_CODES_STORE, 'readonly')
        .objectStore(UNLOCK_CODES_STORE)
        .get(setting.value),
    );
  }
}

export class MemoryKeyStore {
  #keys = new Map();
  #unlockCodes = new Map();
  #defaultUnlockCodeId = null;

  async get(kid) {
    return this.#keys.get(kid) ?? null;
  }

  async set(kid, key) {
    this.#keys.set(kid, key);
  }

  async delete(kid) {
    this.#keys.delete(kid);
  }

  async saveUnlockCode(unlockCode, options = {}) {
    const record = await buildUnlockCodeRecord(unlockCode);
    const existing = this.#unlockCodes.get(record.codeId);
    const savedRecord = {
      ...record,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      lastUsedAt: new Date().toISOString(),
    };
    this.#unlockCodes.set(savedRecord.codeId, savedRecord);
    if (options.makeDefault === true) {
      this.#defaultUnlockCodeId = savedRecord.codeId;
    }
    return savedRecord;
  }

  async getDefaultUnlockCode() {
    if (this.#defaultUnlockCodeId && this.#unlockCodes.has(this.#defaultUnlockCodeId)) {
      return this.#unlockCodes.get(this.#defaultUnlockCodeId);
    }
    const [fallback] = await this.listUnlockCodes();
    return fallback ?? null;
  }

  async listUnlockCodes() {
    return Array.from(this.#unlockCodes.values()).sort((a, b) => {
      if (a.codeId === this.#defaultUnlockCodeId) return -1;
      if (b.codeId === this.#defaultUnlockCodeId) return 1;
      return String(b.lastUsedAt ?? '').localeCompare(String(a.lastUsedAt ?? ''));
    });
  }
}

async function buildUnlockCodeRecord(unlockCode) {
  const normalized = sanitizeUnlockCode(unlockCode);
  return {
    codeId: await sha256Base64url(`suwp:unlock-code:v1:${normalized}`),
    unlockCode: formatUnlockCode(normalized),
  };
}

function openDb() {
  if (!globalThis.indexedDB) {
    return Promise.reject(new Error('IndexedDB is not available'));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(KEYS_STORE)) {
        db.createObjectStore(KEYS_STORE, { keyPath: 'kid' });
      }
      if (!db.objectStoreNames.contains(UNLOCK_CODES_STORE)) {
        db.createObjectStore(UNLOCK_CODES_STORE, { keyPath: 'codeId' });
      }
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: 'name' });
      }
    };
  });
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}
