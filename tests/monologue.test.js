const { test, describe } = require('node:test');
const assert = require('node:assert');
const {
  FREQUENCY_PRESETS,
  MonologuePicker,
  getTimeSlot,
  getWeekdaySlot,
  getNextDelayMs,
  buildAIMonologuePrompt
} = require('../src/utils/monologue');

describe('Monologue Richness & Anti-Repetition Unit Tests', () => {
  test('should produce 40 consecutive unique lines (0 duplicates) across personalities', () => {
    for (const personality of ['default', 'grumpy', 'bard']) {
      const picker = new MonologuePicker({ historyLimit: 40 });
      const seen = new Set();
      const categories = [];

      for (let i = 0; i < 40; i++) {
        const res = picker.pick({
          now: new Date(2026, 10, 27, 15, 0, 0), // Friday afternoon
          personality,
          scenario: 'developer',
          hunger: 25,
          mood: 30,
          cpuUsage: 80,
          todos: [{ id: '1', text: '完成週報整理', done: false }],
          outfits: ['🕶️', '🎩', '🎧']
        });
        assert.ok(res && res.text && res.text.length > 0);
        assert.strictEqual(seen.has(res.text), false, `Duplicate found for ${personality} at draw #${i + 1}: ${res.text}`);
        seen.add(res.text);
        categories.push(res.category);
      }

      assert.strictEqual(seen.size, 40);
      // Consecutive categories should never repeat when multiple buckets are active
      for (let i = 1; i < categories.length; i++) {
        assert.notStrictEqual(categories[i], categories[i - 1], `Repeated category back-to-back: ${categories[i]}`);
      }
    }
  });

  test('should pick dream lines when sleeping without repeating within pool size', () => {
    const picker = new MonologuePicker({ historyLimit: 40 });
    const seen = new Set();
    for (let i = 0; i < 12; i++) {
      const res = picker.pick({ isSleeping: true });
      assert.strictEqual(res.isDream, true);
      assert.strictEqual(res.category, 'dream');
      assert.strictEqual(seen.has(res.text), false);
      seen.add(res.text);
    }
  });

  test('should detect time slots, weekday slots, and frequency delay ranges accurately', () => {
    assert.strictEqual(getTimeSlot(new Date(2026, 0, 1, 8, 0)), 'morning');
    assert.strictEqual(getTimeSlot(new Date(2026, 0, 1, 12, 30)), 'noon');
    assert.strictEqual(getTimeSlot(new Date(2026, 0, 1, 16, 0)), 'afternoon');
    assert.strictEqual(getTimeSlot(new Date(2026, 0, 1, 20, 0)), 'evening');
    assert.strictEqual(getTimeSlot(new Date(2026, 0, 1, 23, 30)), 'lateNight');

    assert.strictEqual(getWeekdaySlot(new Date(2026, 10, 23)), 'monday');
    assert.strictEqual(getWeekdaySlot(new Date(2026, 10, 25)), 'wednesday');
    assert.strictEqual(getWeekdaySlot(new Date(2026, 10, 27)), 'friday');
    assert.strictEqual(getWeekdaySlot(new Date(2026, 10, 28)), 'weekend');

    for (const key of ['quiet', 'normal', 'chatty']) {
      const preset = FREQUENCY_PRESETS[key];
      const delay = getNextDelayMs(key, () => 0.5);
      assert.ok(delay >= preset.minMs && delay <= preset.maxMs);
    }
  });

  test('buildAIMonologuePrompt should include custom personality, context, and recent exclusion list', () => {
    const prompt = buildAIMonologuePrompt({
      now: new Date(2026, 10, 27, 21, 0),
      personality: 'custom',
      customPrompt: '講話喜歡加喵~',
      scenario: 'developer',
      hunger: 20,
      outfits: ['🕶️'],
      recentTexts: ['測試句子一', '測試句子二']
    });
    assert.ok(prompt.includes('講話喜歡加喵~'));
    assert.ok(prompt.includes('肚子餓'));
    assert.ok(prompt.includes('🕶️'));
    assert.ok(prompt.includes('測試句子一'));
    assert.ok(prompt.includes('不要唸出模式名稱'));
  });
});
