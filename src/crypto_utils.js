const crypto = require('crypto');

const ENCRYPTION_KEY = Buffer.from('AI_PET_SECRET_KEY_1234567890ABCD', 'utf8'); // 32 bytes
const IV = Buffer.from('AI_PET_IV_123456', 'utf8'); // 16 bytes

function encryptData(text) {
  try {
    const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, IV);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  } catch (e) {
    console.error('Encrypt error:', e);
    return '';
  }
}

function decryptData(encryptedHex) {
  try {
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, IV);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (e) {
    throw new Error('Decrypt failed');
  }
}

module.exports = { encryptData, decryptData };
