const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { VALID_TOPICS, getAppInfo, loadPackageInfo } = require('../src/utils/app_info');

describe('App Info Self-Inspection Tool Unit Tests', () => {
  test('getAppInfo(version) should dynamically match package.json version and repository', () => {
    const pkg = loadPackageInfo();
    const info = getAppInfo('version');
    assert.ok(info.includes(`v${pkg.version}`));
    assert.ok(info.includes('Wiki Wiki'));
    assert.ok(info.includes('github.com/NCard/codex-pet'));
  });

  test('getAppInfo(settings) and getAppInfo(all) must NEVER leak API keys', () => {
    const fakeState = {
      settings: {
        aiProvider: 'gemini',
        apiKey: 'AIzaSySUPER_SECRET_DO_NOT_LEAK_12345',
        aiModel: 'gemini-3.5-flash-lite',
        aiScenario: 'developer',
        aiPersonality: 'grumpy',
        chatSizeMode: 'manual',
        chatWidth: 420,
        chatHeight: 300,
        chatAutoHideSeconds: 30,
        enableMonologue: true,
        monologueFrequency: 'chatty',
        providerConfigs: {
          openai: { apiKey: 'sk-ANOTHER_SECRET_KEY_99999', model: 'gpt-4o-mini' }
        }
      }
    };

    const settingsText = getAppInfo('settings', { state: fakeState });
    const allText = getAppInfo('all', { state: fakeState });

    assert.ok(!settingsText.includes('SUPER_SECRET_DO_NOT_LEAK'));
    assert.ok(!settingsText.includes('ANOTHER_SECRET_KEY'));
    assert.ok(!allText.includes('SUPER_SECRET_DO_NOT_LEAK'));
    assert.ok(!allText.includes('ANOTHER_SECRET_KEY'));

    assert.ok(settingsText.includes('已設定'));
    assert.ok(settingsText.includes('gemini-3.5-flash-lite'));
    assert.ok(settingsText.includes('程式開發'));
    assert.ok(settingsText.includes('傲嬌模式'));
    assert.ok(settingsText.includes('30 秒'));
  });

  test('getAppInfo should support all topics and fall back safely on unknown topic', () => {
    for (const topic of VALID_TOPICS) {
      const text = getAppInfo(topic, { state: {} });
      assert.strictEqual(typeof text, 'string');
      assert.ok(text.length > 40, `Expected rich content for topic: ${topic}`);
    }

    assert.ok(getAppInfo('commands').includes('/pomodoro'));
    assert.ok(getAppInfo('commands').includes('/quota'));
    assert.ok(getAppInfo('shortcuts').includes('Ctrl+Shift+K'));
    assert.ok(getAppInfo('usage').includes('Ctrl+F'));
    assert.ok(getAppInfo('features').includes('自言自語'));
    assert.ok(getAppInfo('paths').includes('.ai-pet-data'));

    const fallback = getAppInfo('NON_EXISTENT_TOPIC', { state: {} });
    assert.ok(fallback.includes('【版本與應用程式資訊】'));
    assert.ok(fallback.includes('【基本使用方法】'));
  });

  test('mcp-server.js should declare and handle get_app_info tool', () => {
    const mcpSrc = fs.readFileSync(path.resolve(__dirname, '../src/mcp/mcp-server.js'), 'utf8');
    assert.ok(mcpSrc.includes('name: "get_app_info"'));
    assert.ok(mcpSrc.includes('if (name === "get_app_info")'));
  });
});
