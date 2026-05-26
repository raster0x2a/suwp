import { base64urlToBytes, bytesToBase64url, bytesToText, textToBytes } from './base64url.js';
import { gzip, gunzip } from './compression.js';
import {
  aadForCapsule,
  decryptBytes,
  deriveAesKeyFromUnlockCode,
  encryptBytes,
  randomBytes,
} from './crypto.js';
import { generateUnlockCode } from './password.js';
import { assertRedirectableUrl, normalizeTargetUrl } from './url.js';

export async function createEncryptedCapsule(input) {
  const unlockCode = input.unlockCode ?? generateUnlockCode();
  const allowHttp = input.allowHttp === true;
  const payload = {
    url: normalizeTargetUrl(input.url, { allowHttp }),
    label: input.label?.trim() || undefined,
    createdAt: new Date().toISOString(),
    expiresAt: input.expiresAt || undefined,
    allowHttp,
  };

  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const kid = bytesToBase64url(randomBytes(16));
  const key = await deriveAesKeyFromUnlockCode(unlockCode, salt);
  const compressed = await gzip(textToBytes(JSON.stringify(payload)));
  const ciphertext = await encryptBytes(key, iv, compressed, aadForCapsule(kid));

  const capsule = {
    v: 1,
    alg: 'A256GCM',
    zip: 'gzip',
    kdf: {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: bytesToBase64url(salt),
      info: 'secure-url-share:v1:aes-gcm',
    },
    kid,
    iv: bytesToBase64url(iv),
    ct: bytesToBase64url(ciphertext),
  };

  return { capsule, unlockCode, key, payload };
}

export async function decryptCapsuleWithUnlockCode(capsule, unlockCode) {
  assertCapsuleV1(capsule);
  const key = await deriveAesKeyFromUnlockCode(unlockCode, base64urlToBytes(capsule.kdf.salt));
  const payload = await decryptCapsuleWithKey(capsule, key);
  return { payload, key };
}


export async function decryptCapsuleWithCandidateUnlockCodes(capsule, candidates) {
  assertCapsuleV1(capsule);
  let lastError = null;
  for (const candidate of candidates ?? []) {
    const unlockCode = typeof candidate === 'string' ? candidate : candidate?.unlockCode;
    if (!unlockCode) continue;
    try {
      const result = await decryptCapsuleWithUnlockCode(capsule, unlockCode);
      return { ...result, unlockCode, candidate };
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(lastError ? '保存済みの解除コードでは復号できません' : '保存済みの解除コードがありません');
}

export async function decryptCapsuleWithKey(capsule, key) {
  assertCapsuleV1(capsule);
  const iv = base64urlToBytes(capsule.iv);
  const ciphertext = base64urlToBytes(capsule.ct);
  const compressed = await decryptBytes(key, iv, ciphertext, aadForCapsule(capsule.kid));
  const plaintext = await gunzip(compressed);
  const payload = JSON.parse(bytesToText(plaintext));
  return validatePlainPayload(payload);
}

export function encodeCapsuleHash(capsule) {
  assertCapsuleV1(capsule);
  return `#v1.${bytesToBase64url(textToBytes(JSON.stringify(capsule)))}`;
}

export function decodeCapsuleHash(hash) {
  const value = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!value.startsWith('v1.')) {
    throw new Error('共有URLのhashが見つかりません');
  }
  const json = bytesToText(base64urlToBytes(value.slice(3)));
  const capsule = JSON.parse(json);
  assertCapsuleV1(capsule);
  return capsule;
}

export function makeShareUrl(baseUrl, capsule) {
  const cleanBaseUrl = baseUrl.split('#')[0];
  return `${cleanBaseUrl}${encodeCapsuleHash(capsule)}`;
}

export function assertCapsuleV1(capsule) {
  if (!capsule || typeof capsule !== 'object') throw new Error('capsule is required');
  if (capsule.v !== 1) throw new Error('unsupported capsule version');
  if (capsule.alg !== 'A256GCM') throw new Error('unsupported encryption algorithm');
  if (capsule.zip !== 'gzip') throw new Error('unsupported compression algorithm');
  if (!capsule.kdf || capsule.kdf.name !== 'HKDF' || capsule.kdf.hash !== 'SHA-256') {
    throw new Error('unsupported key derivation');
  }
  for (const [name, value] of [
    ['kid', capsule.kid],
    ['salt', capsule.kdf.salt],
    ['iv', capsule.iv],
    ['ct', capsule.ct],
  ]) {
    if (typeof value !== 'string' || value.length === 0) {
      throw new Error(`capsule.${name} is required`);
    }
    base64urlToBytes(value);
  }
}

function validatePlainPayload(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('payload is required');
  const allowHttp = payload.allowHttp === true;
  const normalizedUrl = assertRedirectableUrl(payload.url, { allowHttp });

  if (payload.expiresAt) {
    const expiresAt = new Date(payload.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) {
      throw new Error('expiresAt is invalid');
    }
    if (expiresAt.getTime() <= Date.now()) {
      throw new Error('この共有URLは期限切れです');
    }
  }

  return {
    url: normalizedUrl,
    label: typeof payload.label === 'string' ? payload.label : undefined,
    createdAt: payload.createdAt,
    expiresAt: payload.expiresAt,
    allowHttp,
  };
}
