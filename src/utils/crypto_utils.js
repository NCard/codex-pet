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

function computeHash(text, algorithm = 'md5') {
  const str = String(text ?? '');
  const algo = (algorithm || 'md5').toLowerCase();
  switch (algo) {
    case 'md5':
      return crypto.createHash('md5').update(str, 'utf8').digest('hex');
    case 'sha256':
      return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
    case 'sha1':
      return crypto.createHash('sha1').update(str, 'utf8').digest('hex');
    case 'base64_encode':
      return Buffer.from(str, 'utf8').toString('base64');
    case 'base64_decode':
      return Buffer.from(str, 'base64').toString('utf8');
    default:
      return crypto.createHash('md5').update(str, 'utf8').digest('hex');
  }
}

module.exports = { encryptData, decryptData, computeHash };
