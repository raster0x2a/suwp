import { bytesToBase64url, textToBytes } from './base64url.js';
import { sanitizeUnlockCode } from './password.js';

const INFO = textToBytes('secure-url-share:v1:aes-gcm');

export function randomBytes(length) {
  const crypto = getCrypto();
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export async function deriveAesKeyFromUnlockCode(unlockCode, salt) {
  const crypto = getCrypto();
  const normalized = sanitizeUnlockCode(unlockCode);
  const material = await crypto.subtle.importKey(
    'raw',
    textToBytes(normalized),
    'HKDF',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt,
      info: INFO,
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptBytes(key, iv, plaintext, aad) {
  const crypto = getCrypto();
  const ciphertext = await crypto.subtle.encrypt(
    aesGcmParams(iv, aad),
    key,
    plaintext,
  );
  return new Uint8Array(ciphertext);
}

export async function decryptBytes(key, iv, ciphertext, aad) {
  const crypto = getCrypto();
  const plaintext = await crypto.subtle.decrypt(
    aesGcmParams(iv, aad),
    key,
    ciphertext,
  );
  return new Uint8Array(plaintext);
}

export async function sha256Base64url(value) {
  const crypto = getCrypto();
  const bytes = typeof value === 'string' ? textToBytes(value) : value;
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return bytesToBase64url(new Uint8Array(digest));
}

export function aadForCapsule(kid) {
  return textToBytes(`secure-url-share:v1:${kid}`);
}

function aesGcmParams(iv, aad) {
  const params = { name: 'AES-GCM', iv };
  if (aad) params.additionalData = aad;
  return params;
}

function getCrypto() {
  if (!globalThis.crypto?.subtle || !globalThis.crypto?.getRandomValues) {
    throw new Error('Web Crypto API is not available');
  }
  return globalThis.crypto;
}
