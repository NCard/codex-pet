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

  await t.test('should detect code snippets and commands', () => {
    const codeSample = 'function calculateTotal(items) { return items.reduce((a, b) => a + b, 0); }';
    const intent = detectClipboardIntent(codeSample);
    assert.ok(intent !== null);
    assert.strictEqual(intent.icon, '💻');
    assert.ok(intent.label.includes('代碼'));

    const consoleSample = 'console.log("Hello Wiki Wiki");';
    const consoleIntent = detectClipboardIntent(consoleSample);
    assert.ok(consoleIntent !== null);
    assert.strictEqual(consoleIntent.icon, '💻');

    const cliSample = 'git commit -m "feat: new feature"';
    const cliIntent = detectClipboardIntent(cliSample);
    assert.ok(cliIntent !== null);
    assert.strictEqual(cliIntent.icon, '💻');
  });

  await t.test('should detect English single words and sentences', () => {
    const wordSample = 'procrastination';
    const wordIntent = detectClipboardIntent(wordSample);
    assert.ok(wordIntent !== null);
    assert.strictEqual(wordIntent.icon, '📖');
    assert.ok(wordIntent.label.includes('單字'));

    const engSample = 'The quick brown fox jumps over the lazy dog in the sunny afternoon.';
    const engIntent = detectClipboardIntent(engSample);
    assert.ok(engIntent !== null);
    assert.strictEqual(engIntent.icon, '📖');
    assert.ok(engIntent.label.includes('翻譯'));
  });

  await t.test('should detect general meaningful text including concise Chinese', () => {
    const shortChinese = '今天會議重點整理';
    const shortIntent = detectClipboardIntent(shortChinese);
    assert.ok(shortIntent !== null);
    assert.strictEqual(shortIntent.icon, '✨');

    const generalText = '這是一段今天會議紀錄的重點整理與待辦項目說明';
    const intent = detectClipboardIntent(generalText);
    assert.ok(intent !== null);
    assert.strictEqual(intent.icon, '✨');
  });

  await t.test('should ignore trivial text or URLs', () => {
    assert.strictEqual(detectClipboardIntent('hi'), null);
    assert.strictEqual(detectClipboardIntent('https://google.com'), null);
  });
});
