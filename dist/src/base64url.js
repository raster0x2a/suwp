export function bytesToBase64url(bytes) {
  const base64 = bytesToBase64(bytes);
  return base64.replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

export function base64urlToBytes(value) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error('base64url value is required');
  }
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) {
    throw new Error('invalid base64url value');
  }
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return base64ToBytes(base64);
}

export function textToBytes(value) {
  return new TextEncoder().encode(value);
}

export function bytesToText(bytes) {
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

function bytesToBase64(bytes) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function base64ToBytes(base64) {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
