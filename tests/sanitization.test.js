const { test, describe } = require('node:test');
const assert = require('node:assert');

function sanitizeCoordinate(input) {
  const target = parseInt(input, 10);
  if (Number.isInteger(target) && Math.abs(target) < 100000) {
    return target;
  }
  return null;
}

describe('Coordinate Sanitization Unit Tests', () => {
  test('should accept valid integer coordinates', () => {
    assert.strictEqual(sanitizeCoordinate(100), 100);
    assert.strictEqual(sanitizeCoordinate(-330), -330);
    assert.strictEqual(sanitizeCoordinate(0), 0);
  });

  test('should parse string representations of integers', () => {
    assert.strictEqual(sanitizeCoordinate('450'), 450);
    assert.strictEqual(sanitizeCoordinate('-120.5'), -120);
  });

  test('should reject invalid values (NaN, Infinity, null, undefined, extreme values)', () => {
    assert.strictEqual(sanitizeCoordinate(NaN), null);
    assert.strictEqual(sanitizeCoordinate(Infinity), null);
    assert.strictEqual(sanitizeCoordinate(-Infinity), null);
    assert.strictEqual(sanitizeCoordinate(null), null);
    assert.strictEqual(sanitizeCoordinate(undefined), null);
    assert.strictEqual(sanitizeCoordinate(99999999), null);
  });
});
