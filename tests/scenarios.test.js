const { test, describe } = require('node:test');
const assert = require('node:assert');
const {
  SCENARIO_PRESETS,
  getScenarioPreset,
  getAllScenarioPresets,
  buildScenarioPrompt
} = require('../src/utils/scenarios');
const { analyzeClipboardText } = require('../src/utils/clipboard_analyzer');

describe('Usage Scenario Presets & Adaptation Unit Tests', () => {
  test('should expose all 7 built-in scenario presets with complete metadata', () => {
    const all = getAllScenarioPresets();
    assert.strictEqual(all.length, 7);

    const ids = all.map(s => s.id);
    for (const expected of ['general', 'developer', 'office', 'study', 'creative', 'companion', 'custom']) {
      assert.ok(ids.includes(expected), `Missing scenario: ${expected}`);
      const preset = SCENARIO_PRESETS[expected];
      assert.ok(preset.icon && preset.name && preset.shortDesc && preset.responseStyle && preset.clipboardFocus);
    }
  });

  test('getScenarioPreset should fall back to general on unknown or empty input', () => {
    assert.strictEqual(getScenarioPreset('developer').id, 'developer');
    assert.strictEqual(getScenarioPreset('UNKNOWN_MODE').id, 'general');
    assert.strictEqual(getScenarioPreset('').id, 'general');
  });

  test('buildScenarioPrompt should build distinct system instructions and handle custom mode', () => {
    const devPrompt = buildScenarioPrompt('developer');
    assert.ok(devPrompt.includes('程式開發助手'));
    assert.ok(devPrompt.includes('根本原因'));

    const officePrompt = buildScenarioPrompt('office');
    assert.ok(officePrompt.includes('辦公行政效率助理'));
    assert.ok(officePrompt.includes('Action Items'));

    const customPrompt = buildScenarioPrompt('custom', '我是 Vue 3 前端工程師，請優先附程式碼');
    assert.ok(customPrompt.includes('使用者自訂專屬模式'));
    assert.ok(customPrompt.includes('Vue 3 前端工程師'));

    // Empty custom text gracefully falls back to general prompt
    const emptyCustom = buildScenarioPrompt('custom', '   ');
    assert.ok(emptyCustom.includes('全能日常助理'));
  });

  test('analyzeClipboardText should adapt intent prompts when a focused scenario is active', () => {
    const errText = 'TypeError: Cannot read properties of undefined (reading "map")\n    at App.js:42:10';
    const generalErr = analyzeClipboardText(errText, 'general');
    const devErr = analyzeClipboardText(errText, 'developer');
    assert.strictEqual(generalErr.category, 'ERROR');
    assert.strictEqual(devErr.category, 'ERROR');
    assert.ok(devErr.label.includes('開發除錯'));
    assert.ok(devErr.prompt.includes('資深工程師'));

    const noteText = '今天下午三點要和客戶確認第三季產品上線時程與預算分配';
    const officeNote = analyzeClipboardText(noteText, 'office');
    assert.strictEqual(officeNote.category, 'GENERAL_TEXT');
    assert.ok(officeNote.label.includes('條列重點摘要'));
    assert.ok(officeNote.prompt.includes('Action Items'));

    const creativeNote = analyzeClipboardText(noteText, 'creative');
    assert.ok(creativeNote.label.includes('多風格改寫'));

    const wordIntent = analyzeClipboardText('resilience', 'study');
    assert.strictEqual(wordIntent.category, 'ENGLISH_WORD');
    assert.ok(wordIntent.prompt.includes('collocations'));
  });
});
