const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TOKEN_CHARS = 30;

export function generateUnlockCode(random = globalThis.crypto) {
  if (!random?.getRandomValues) {
    throw new Error('crypto.getRandomValues is not available');
  }
  const indexes = new Uint8Array(TOKEN_CHARS);
  random.getRandomValues(indexes);
  let raw = '';
  for (const value of indexes) {
    raw += ALPHABET[value & 31];
  }
  return formatUnlockCode(raw);
}

export function sanitizeUnlockCode(value) {
  if (typeof value !== 'string') {
    throw new Error('unlock code must be a string');
  }
  const normalized = value.toUpperCase().replace(/[\s-]+/gu, '');
  if (normalized.length !== TOKEN_CHARS) {
    throw new Error(`unlock code must contain ${TOKEN_CHARS} characters`);
  }
  for (const char of normalized) {
    if (!ALPHABET.includes(char)) {
      throw new Error('unlock code contains unsupported characters');
    }
  }
  return normalized;
}

export function formatUnlockCode(value) {
  const normalized = typeof value === 'string' ? value.toUpperCase().replace(/[\s-]+/gu, '') : '';
  return normalized.match(/.{1,5}/gu)?.join('-') ?? normalized;
}

export function unlockCodeAlphabet() {
  return ALPHABET;
}

export function unlockCodeLength() {
  return TOKEN_CHARS;
}
