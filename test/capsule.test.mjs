import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEncryptedCapsule,
  decodeCapsuleHash,
  decryptCapsuleWithCandidateUnlockCodes,
  decryptCapsuleWithKey,
  decryptCapsuleWithUnlockCode,
  encodeCapsuleHash,
  makeShareUrl,
} from '../src/capsule.js';

test('capsule round-trips with the generated unlock code', async () => {
  const { capsule, unlockCode, payload } = await createEncryptedCapsule({
    url: 'https://example.com/private?x=1',
    label: 'private link',
  });

  const decrypted = await decryptCapsuleWithUnlockCode(capsule, unlockCode);
  assert.equal(decrypted.payload.url, payload.url);
  assert.equal(decrypted.payload.label, 'private link');
});



test('createEncryptedCapsule uses the supplied unlock code instead of generating a new one', async () => {
  const unlockCode = 'ABCDE-FGHJK-MNPQR-STUVW-XYZ23-45678';
  const { capsule, unlockCode: returnedUnlockCode } = await createEncryptedCapsule({
    url: 'https://example.com/stable-code',
    unlockCode,
  });

  assert.equal(returnedUnlockCode, unlockCode);
  const decrypted = await decryptCapsuleWithUnlockCode(capsule, unlockCode);
  assert.equal(decrypted.payload.url, 'https://example.com/stable-code');
});
test('capsule can be encoded into and decoded from URL hash', async () => {
  const { capsule } = await createEncryptedCapsule({ url: 'https://example.com/' });
  const hash = encodeCapsuleHash(capsule);
  assert.match(hash, /^#v1\.[A-Za-z0-9_-]+$/u);
  assert.deepEqual(decodeCapsuleHash(hash), capsule);

  const url = makeShareUrl('https://share.example/#create', capsule);
  assert.ok(url.startsWith('https://share.example/#v1.'));
});

test('capsule ciphertext does not contain the plaintext URL', async () => {
  const { capsule } = await createEncryptedCapsule({ url: 'https://example.com/super-secret' });
  assert.equal(JSON.stringify(capsule).includes('super-secret'), false);
});



test('capsule can be decrypted by trying all locally saved unlock codes', async () => {
  const correctCode = 'BBBBB-BBBBB-BBBBB-BBBBB-BBBBB-BBBBB';
  const { capsule } = await createEncryptedCapsule({
    url: 'https://example.com/team-link',
    unlockCode: correctCode,
  });

  const result = await decryptCapsuleWithCandidateUnlockCodes(capsule, [
    { unlockCode: 'AAAAA-AAAAA-AAAAA-AAAAA-AAAAA-AAAAA' },
    { unlockCode: correctCode },
  ]);

  assert.equal(result.payload.url, 'https://example.com/team-link');
  assert.equal(result.unlockCode, correctCode);
});

test('wrong unlock code cannot decrypt the capsule', async () => {
  const { capsule } = await createEncryptedCapsule({ url: 'https://example.com/' });
  await assert.rejects(
    () => decryptCapsuleWithUnlockCode(capsule, 'ABCDE-FGHJK-MNPQR-STUVW-XYZ23-45678'),
    /operation failed|decrypt|unsupported|characters|length/i,
  );
});

test('stored CryptoKey can decrypt without asking for the unlock code again', async () => {
  const { capsule, key } = await createEncryptedCapsule({ url: 'https://example.com/again' });
  const payload = await decryptCapsuleWithKey(capsule, key);
  assert.equal(payload.url, 'https://example.com/again');
});

test('expired payload is rejected after decrypt', async () => {
  const { capsule, unlockCode } = await createEncryptedCapsule({
    url: 'https://example.com/expired',
    expiresAt: '2000-01-01T00:00:00.000Z',
  });

  await assert.rejects(() => decryptCapsuleWithUnlockCode(capsule, unlockCode), /期限切れ/u);
});
