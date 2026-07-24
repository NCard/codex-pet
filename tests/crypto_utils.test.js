const { test, describe } = require('node:test');
const assert = require('node:assert');
const { encryptData, decryptData } = require('../src/utils/crypto_utils');

describe('Crypto Utils Unit Tests', () => {
  test('should correctly encrypt and decrypt normal text', () => {
    const originalText = 'Hello Wiki Wiki!';
    const encrypted = encryptData(originalText);
    assert.notStrictEqual(encrypted, originalText);
    assert.strictEqual(typeof encrypted, 'string');
    
    const decrypted = decryptData(encrypted);
    assert.strictEqual(decrypted, originalText);
  });

  test('should handle Chinese and Unicode characters properly', () => {
    const unicodeText = '奇異鳥桌面小幫手 🥝✨ 123456';
    const encrypted = encryptData(unicodeText);
    const decrypted = decryptData(encrypted);
    assert.strictEqual(decrypted, unicodeText);
  });

  test('should throw error when decrypting invalid hex ciphertext', () => {
    const invalidCipher = '1234567890abcdef_invalid';
    assert.throws(() => {
      decryptData(invalidCipher);
    }, /Decrypt failed/);
  });
});
