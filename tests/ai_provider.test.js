const { test, describe } = require('node:test');
const assert = require('node:assert');
const { AIProviderFactory, GeminiProvider } = require('../src/services/ai_provider');

describe('AI Provider & Model Metadata Unit Tests', () => {
  test('AIProviderFactory should create GeminiProvider instance', () => {
    const provider = AIProviderFactory.create('gemini', 'fake-key', 'gemini-2.5-flash');
    assert.ok(provider instanceof GeminiProvider);
  });

  test('GeminiProvider should extract metadata properly from models list', async () => {
    const provider = new GeminiProvider('fake-key', 'gemini-2.5-flash');

    // Mock client.models.list
    provider.client = {
      models: {
        list: async () => ({
          data: [
            {
              name: 'models/gemini-2.5-flash',
              displayName: 'Gemini 2.5 Flash',
              description: 'Fast and versatile model for general tasks',
              inputTokenLimit: 1048576,
              outputTokenLimit: 8192,
              supportedGenerationMethods: ['generateContent']
            },
            {
              name: 'models/gemini-1.5-pro',
              displayName: 'Gemini 1.5 Pro',
              description: 'Complex reasoning model',
              inputTokenLimit: 2097152,
              outputTokenLimit: 8192,
              supportedGenerationMethods: ['generateContent']
            },
            {
              name: 'models/text-embedding-004',
              displayName: 'Embedding Model',
              supportedGenerationMethods: ['embedContent']
            }
          ]
        })
      }
    };

    const models = await provider.getAvailableModels();
    assert.strictEqual(models.length, 2);

    const flash = models.find(m => m.id === 'gemini-2.5-flash');
    assert.ok(flash);
    assert.strictEqual(flash.tier, 'flash');
    assert.strictEqual(flash.isRecommended, true);
    assert.strictEqual(flash.supportsTools, true);
    assert.strictEqual(flash.contextStr, '1M Tokens');
    assert.strictEqual(flash.outputTokenLimit, 8192);
    assert.ok(flash.badge.includes('推薦免費使用'));

    const pro = models.find(m => m.id === 'gemini-1.5-pro');
    assert.ok(pro);
    assert.strictEqual(pro.tier, 'pro');
    assert.strictEqual(pro.isRecommended, false);
    assert.strictEqual(pro.supportsTools, true);
    assert.strictEqual(pro.contextStr, '2M Tokens');
    assert.ok(pro.badge.includes('深度旗艦'));
  });

  test('testModelAvailability should handle successful responses with tool support', async () => {
    const provider = new GeminiProvider('fake-key', 'gemini-2.5-flash');
    provider.client = {
      models: {
        generateContent: async () => ({
          text: 'Pong'
        })
      }
    };

    const result = await provider.testModelAvailability('gemini-2.5-flash');
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.supportsTools, true);
    assert.strictEqual(result.reply, 'Pong');
    assert.ok(result.latencyMs >= 0);
  });

  test('testModelAvailability should detect tool calling unsupported errors', async () => {
    const provider = new GeminiProvider('fake-key', 'gemini-1.0-pro');
    provider.client = {
      models: {
        generateContent: async () => {
          throw new Error('400 Bad Request: Tool calling is not supported for this model');
        }
      }
    };

    const result = await provider.testModelAvailability('gemini-1.0-pro');
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.supportsTools, false);
    assert.ok(result.error.includes('不支援 Agent 工具呼叫'));
  });

  test('testModelAvailability should detect quota 429 errors', async () => {
    const provider = new GeminiProvider('fake-key', 'gemini-1.5-pro');
    provider.client = {
      models: {
        generateContent: async () => {
          throw new Error('429 RESOURCE_EXHAUSTED: quota exceeded');
        }
      }
    };

    const result = await provider.testModelAvailability('gemini-1.5-pro');
    assert.strictEqual(result.success, false);
    assert.ok(result.error.includes('429 Rate Limit'));
  });
});
