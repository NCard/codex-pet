const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const paths = require('../src/utils/paths');

describe('Paths Utils Unit Tests', () => {
  test('should provide valid directory paths', () => {
    assert.strictEqual(typeof paths.dataDir, 'string');
    assert.strictEqual(typeof paths.logDir, 'string');
    assert.ok(fs.existsSync(paths.dataDir));
    assert.ok(fs.existsSync(paths.logDir));
  });

  test('should generate correct json and dat file paths', () => {
    assert.ok(paths.petStatePath.endsWith('pet_state.json'));
    assert.ok(paths.alarmsPath.endsWith('alarms.json'));
    assert.ok(paths.historyPath.endsWith('chat_history.dat'));
  });
});
