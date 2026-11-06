const test = require('node:test');
const assert = require('node:assert');
const { detectClipboardIntent } = require('../src/views/main/modules/clipboard_watcher');

test('Clipboard Watcher - Intent Detection Unit Tests', async (t) => {
  await t.test('should detect stack traces and errors correctly', () => {
    const errorSample = 'TypeError: Cannot read properties of undefined (reading "version")\n    at Object.<anonymous> (/app/index.js:10:5)';
    const intent = detectClipboardIntent(errorSample);
    assert.ok(intent !== null);
    assert.strictEqual(intent.icon, '🐞');
    assert.ok(intent.label.includes('報錯'));
    assert.ok(intent.prompt.includes('TypeError'));
  });

  await t.test('should detect valid JSON strings', () => {
    const jsonSample = JSON.stringify({ user: 'Wiki', mood: 100, active: true }, null, 2);
    const intent = detectClipboardIntent(jsonSample);
    assert.ok(intent !== null);
    assert.strictEqual(intent.icon, '💡');
    assert.ok(intent.label.includes('JSON'));
  });

  await t.test('should detect English sentences for translation', () => {
    const engSample = 'The quick brown fox jumps over the lazy dog in the sunny afternoon.';
    const intent = detectClipboardIntent(engSample);
    assert.ok(intent !== null);
    assert.strictEqual(intent.icon, '📖');
    assert.ok(intent.label.includes('翻譯'));
  });

  await t.test('should ignore trivial text or URLs', () => {
    assert.strictEqual(detectClipboardIntent('hi'), null);
    assert.strictEqual(detectClipboardIntent('https://google.com'), null);
    assert.strictEqual(detectClipboardIntent('短中文'), null);
  });
});
