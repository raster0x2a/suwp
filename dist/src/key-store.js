const DB_NAME = 'secure-url-share-keys';
const DB_VERSION = 1;
const STORE_NAME = 'keys';

export class IndexedDbKeyStore {
  async get(kid) {
    const db = await openDb();
    const record = await requestToPromise(db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).get(kid));
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
    await requestToPromise(db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(record));
  }

  async delete(kid) {
    const db = await openDb();
    await requestToPromise(db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(kid));
  }
}

export class MemoryKeyStore {
  #keys = new Map();

  async get(kid) {
    return this.#keys.get(kid) ?? null;
  }

  async set(kid, key) {
    this.#keys.set(kid, key);
  }

  async delete(kid) {
    this.#keys.delete(kid);
  }
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
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'kid' });
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
