const test = require('node:test');
const assert = require('node:assert');
const { getThinkingStepLimit } = require('../src/views/main/modules/chat');

test('Thinking Level & Agent Iterations Unit Tests', async (t) => {
  await t.test('getThinkingStepLimit should map low to 3 steps', () => {
    assert.strictEqual(getThinkingStepLimit('low'), 3);
  });

  await t.test('getThinkingStepLimit should map medium to 5 steps (default)', () => {
    assert.strictEqual(getThinkingStepLimit('medium'), 5);
  });

  await t.test('getThinkingStepLimit should map high to 10 steps', () => {
    assert.strictEqual(getThinkingStepLimit('high'), 10);
  });

  await t.test('getThinkingStepLimit should handle invalid or undefined input gracefully with medium (5)', () => {
    assert.strictEqual(getThinkingStepLimit(undefined), 5);
    assert.strictEqual(getThinkingStepLimit(null), 5);
    assert.strictEqual(getThinkingStepLimit(''), 5);
    assert.strictEqual(getThinkingStepLimit('unknown'), 5);
  });

  await t.test('should gracefully remove thinkingConfig when model rejects it', async () => {
    let callCount = 0;
    const receivedConfigs = [];

    const mockAI = {
      async generateContent(payload) {
        callCount++;
        receivedConfigs.push({ ...payload.config });
        if (payload?.config?.thinkingConfig && callCount === 1) {
          throw new Error('thinkingConfig is not supported for this model');
        }
        return { text: '成功回答' };
      }
    };

    async function callWithFallback(payload) {
      try {
        return await mockAI.generateContent(payload);
      } catch (err) {
        if (payload?.config?.thinkingConfig && err && err.message && /thinking/i.test(err.message)) {
          const fallbackPayload = {
            ...payload,
            config: { ...payload.config }
          };
          delete fallbackPayload.config.thinkingConfig;
          return await mockAI.generateContent(fallbackPayload);
        }
        throw err;
      }
    }

    const payload = {
      model: 'older-model',
      contents: [{ role: 'user', parts: [{ text: '哈囉' }] }],
      config: {
        systemInstruction: '系統指令',
        thinkingConfig: { thinkingLevel: 'high' }
      }
    };

    const result = await callWithFallback(payload);
    assert.strictEqual(callCount, 2);
    assert.strictEqual(result.text, '成功回答');
    assert.deepStrictEqual(receivedConfigs[0].thinkingConfig, { thinkingLevel: 'high' });
    assert.strictEqual(receivedConfigs[1].thinkingConfig, undefined);
  });
});

