const test = require('node:test');
const assert = require('node:assert');
const {
  analyzeClipboardText,
  isCliCommand,
  isFilePath,
  isStackTrace,
  isNaturalEnglish,
  isEnglishWord
} = require('../src/utils/clipboard_analyzer');

test('Clipboard Analyzer - Dedicated Engine Unit Tests', async (t) => {
  await t.test('should correctly identify python script command instead of English translation', () => {
    const pythonCmd = 'python C:\\Users\\2007016\\.gemini\\antigravity\\brain\\3e11d2c8-71c6-47f9-9ba1-09b8ddd980f9\\scratch\\inspect_pdfs.py';
    
    // 驗證子分析器
    assert.strictEqual(isCliCommand(pythonCmd), true);
    assert.strictEqual(isNaturalEnglish(pythonCmd), false); // 絕不能被判定為英文自然語言

    // 驗證整體意圖
    const result = analyzeClipboardText(pythonCmd);
    assert.ok(result !== null);
    assert.strictEqual(result.category, 'CLI_COMMAND');
    assert.strictEqual(result.icon, '💻');
    assert.ok(result.label.includes('python'));
    assert.ok(result.prompt.includes('bash'));
  });

  await t.test('should identify standalone file paths', () => {
    const winPath = 'C:\\Users\\Administrator\\AppData\\Local\\Temp\\error_dump.log';
    assert.strictEqual(isFilePath(winPath), true);
    assert.strictEqual(isNaturalEnglish(winPath), false);

    const result = analyzeClipboardText(winPath);
    assert.ok(result !== null);
    assert.strictEqual(result.category, 'FILE_PATH');
    assert.strictEqual(result.icon, '📁');

    const unixPath = '/usr/local/nginx/conf/nginx.conf';
    assert.strictEqual(isFilePath(unixPath), true);
    const unixResult = analyzeClipboardText(unixPath);
    assert.strictEqual(unixResult.category, 'FILE_PATH');
  });

  await t.test('should identify CLI commands with various runtimes', () => {
    const nodeCmd = 'node src/index.js --port 3000';
    assert.strictEqual(isCliCommand(nodeCmd), true);
    const nodeResult = analyzeClipboardText(nodeCmd);
    assert.strictEqual(nodeResult.category, 'CLI_COMMAND');

    const gitCmd = 'git push origin feature/agent-v1.3.0';
    assert.strictEqual(isCliCommand(gitCmd), true);
    const gitResult = analyzeClipboardText(gitCmd);
    assert.strictEqual(gitResult.category, 'CLI_COMMAND');

    const pipCmd = 'pip install -r requirements.txt';
    assert.strictEqual(isCliCommand(pipCmd), true);
    const pipResult = analyzeClipboardText(pipCmd);
    assert.strictEqual(pipResult.category, 'CLI_COMMAND');
  });

  await t.test('should disambiguate natural English from technical strings and hashes', () => {
    // 真正的英文句子 (有英文停用詞與文法標點)
    const naturalEnglish = 'Please summarize the main findings of this research paper for me.';
    assert.strictEqual(isNaturalEnglish(naturalEnglish), true);
    const engResult = analyzeClipboardText(naturalEnglish);
    assert.strictEqual(engResult.category, 'ENGLISH_TEXT');
    assert.strictEqual(engResult.icon, '📖');
    assert.ok(engResult.label.includes('翻譯'));

    // 單純的 UUID / Hash (即使全英文數字，也不應被判定為英文段落翻譯)
    const hashSample = '3e11d2c8-71c6-47f9-9ba1-09b8ddd980f9';
    assert.strictEqual(isNaturalEnglish(hashSample), false);
  });

  await t.test('should detect single English words for dictionary lookup', () => {
    const word = 'procrastination';
    assert.strictEqual(isEnglishWord(word), true);
    const wordResult = analyzeClipboardText(word);
    assert.strictEqual(wordResult.category, 'ENGLISH_WORD');
    assert.strictEqual(wordResult.icon, '📖');
    assert.ok(wordResult.label.includes('單字'));
  });

  await t.test('should detect code snippets accurately', () => {
    const code = 'const express = require("express");\nconst app = express();';
    const codeResult = analyzeClipboardText(code);
    assert.strictEqual(codeResult.category, 'CODE_SNIPPET');
    assert.strictEqual(codeResult.icon, '💻');
  });

  await t.test('should detect error stack traces', () => {
    const err = 'TypeError: Cannot read properties of null (reading "value")\n    at eval (test.js:1:1)';
    assert.strictEqual(isStackTrace(err), true);
    const errResult = analyzeClipboardText(err);
    assert.strictEqual(errResult.category, 'ERROR');
    assert.strictEqual(errResult.icon, '🐞');
  });

  await t.test('should detect JSON and structured objects', () => {
    const jsonStr = '{"status": "ok", "items": [1, 2, 3]}';
    const jsonResult = analyzeClipboardText(jsonStr);
    assert.strictEqual(jsonResult.category, 'STRUCTURED_DATA');
    assert.strictEqual(jsonResult.icon, '💡');
  });

  await t.test('should detect concise Chinese concepts', () => {
    const chinese = '今天會議重點整理';
    const zhResult = analyzeClipboardText(chinese);
    assert.strictEqual(zhResult.category, 'GENERAL_TEXT');
    assert.strictEqual(zhResult.icon, '✨');
  });
});
