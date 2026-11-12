const { test, describe } = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { computeHash } = require('../src/utils/crypto_utils');

describe('Compute Hash & Crypto Utilities Unit Tests', () => {
  test('should compute correct MD5 hash for ascii and empty strings', () => {
    assert.strictEqual(computeHash('', 'md5'), 'd41d8cd98f00b204e9800998ecf8427e');
    assert.strictEqual(computeHash('123456', 'md5'), 'e10adc3949ba59abbe56e057f20f883e');
    assert.strictEqual(computeHash('hello world', 'md5'), '5eb63bbbe01eeed093cb22bb8f5acdc3');
  });

  test('should compute correct MD5 hash for Chinese and Unicode characters', () => {
    const text = '奇異鳥桌面小幫手 🥝✨';
    const expected = crypto.createHash('md5').update(text, 'utf8').digest('hex');
    assert.strictEqual(computeHash(text, 'md5'), expected);
  });

  test('should compute correct SHA256 and SHA1 hashes', () => {
    const text = '123456';
    assert.strictEqual(computeHash(text, 'sha256'), '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92');
    assert.strictEqual(computeHash(text, 'sha1'), '7c4a8d09ca3762af61e59520943dc26494f8941b');
  });

  test('should correctly encode and decode Base64', () => {
    const text = 'Wiki Wiki 桌面寵物';
    const encoded = computeHash(text, 'base64_encode');
    assert.strictEqual(encoded, Buffer.from(text, 'utf8').toString('base64'));

    const decoded = computeHash(encoded, 'base64_decode');
    assert.strictEqual(decoded, text);
  });

  test('should default to MD5 if algorithm is omitted or unknown', () => {
    const text = 'hello';
    const expected = crypto.createHash('md5').update(text, 'utf8').digest('hex');
    assert.strictEqual(computeHash(text), expected);
    assert.strictEqual(computeHash(text, 'unknown_algo'), expected);
  });
});

