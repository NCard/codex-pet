const test = require('node:test');
const assert = require('node:assert');
const { DIALOGUES, getRandomItem, getDialogue } = require('../src/utils/dialogues');

test('Dialogues Management Module Unit Tests', async (t) => {
  await t.test('getRandomItem should handle empty or invalid lists gracefully', () => {
    assert.strictEqual(getRandomItem([]), '');
    assert.strictEqual(getRandomItem(null), '');
    assert.strictEqual(getRandomItem(undefined), '');
    const items = ['A'];
    assert.strictEqual(getRandomItem(items), 'A');
  });

  await t.test('getDialogue should fetch summon phrases', () => {
    const phrase = getDialogue('summon');
    assert.ok(typeof phrase === 'string' && phrase.length > 0);
    assert.ok(DIALOGUES.summon.includes(phrase));
  });

  await t.test('getDialogue should fetch interaction phrases correctly', () => {
    const feed = getDialogue('interactions', 'feed');
    assert.ok(DIALOGUES.interactions.feed.includes(feed));

    const pet = getDialogue('interactions', 'petComfort');
    assert.ok(DIALOGUES.interactions.petComfort.includes(pet));

    const sleep = getDialogue('interactions', 'sleep');
    assert.ok(DIALOGUES.interactions.sleep.includes(sleep));
  });

  await t.test('getDialogue should evaluate functions with dynamic parameters', () => {
    const laserCatch = getDialogue('laser', 'catch', 5);
    assert.ok(laserCatch.includes('5'));

    const laserEndSuccess = getDialogue('laser', 'endSuccess', 10);
    assert.ok(laserEndSuccess.includes('10'));

    const pomodoro = getDialogue('system', 'pomodoro', 25);
    assert.ok(pomodoro.includes('25'));

    const customPrompt = getDialogue('personalityPrompts', 'custom', '講話喜歡加喵~');
    assert.ok(customPrompt.includes('講話喜歡加喵~'));
  });

  await t.test('getDialogue should support multi-stage alarm messages', () => {
    const stage1 = getDialogue('alarm', 'stage1', '開會時間');
    assert.strictEqual(stage1, '開會時間');

    const stage1Default = getDialogue('alarm', 'stage1', '');
    assert.strictEqual(stage1Default, '時間到囉！');

    const stage2 = getDialogue('alarm', 'stage2');
    assert.ok(DIALOGUES.alarm.stage2.includes(stage2));

    const stage3 = getDialogue('alarm', 'stage3');
    assert.ok(DIALOGUES.alarm.stage3.includes(stage3));

    const jump = getDialogue('alarm', 'jump');
    assert.ok(DIALOGUES.alarm.jump.includes(jump));

    const snooze = getDialogue('alarm', 'snooze');
    assert.ok(DIALOGUES.alarm.snooze.includes(snooze));

    const enabledFull = getDialogue('alarm', 'enabled', '喝水', '每天 10:00');
    assert.ok(enabledFull.includes('喝水') && enabledFull.includes('每天 10:00') && enabledFull.includes('已啟用'));

    const enabledTimeOnly = getDialogue('alarm', 'enabled', '', '10:00');
    assert.ok(enabledTimeOnly.includes('10:00') && enabledTimeOnly.includes('已啟用'));

    const enabledDefault = getDialogue('alarm', 'enabled');
    assert.ok(enabledDefault.includes('已啟用'));
  });

  await t.test('getDialogue should handle unknown category or key gracefully', () => {
    assert.strictEqual(getDialogue('nonExistent'), '');
    assert.strictEqual(getDialogue('interactions', 'nonExistent'), '');
  });
});

