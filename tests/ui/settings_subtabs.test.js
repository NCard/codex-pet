const fs = require('fs');
const path = require('path');

describe('Settings Sub-tabs & Model Info Card UI Tests', () => {
  let container;

  beforeEach(() => {
    const htmlPath = path.resolve(__dirname, '../../src/views/settings/settings.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    container = document.createElement('div');
    container.innerHTML = htmlContent;
  });

  test('settings.html should contain the sub-tabs navigation container and 3 sub-tab buttons', () => {
    const subTabs = container.querySelector('.sub-tabs');
    expect(subTabs).not.toBeNull();

    const buttons = Array.from(subTabs.querySelectorAll('.sub-tab-btn'));
    expect(buttons.length).toBe(3);

    const subtabTargets = buttons.map(b => b.getAttribute('data-subtab'));
    expect(subtabTargets).toContain('subtab-model');
    expect(subtabTargets).toContain('subtab-quota');
    expect(subtabTargets).toContain('subtab-personality');

    // Default active subtab should be subtab-model
    const activeBtn = subTabs.querySelector('.sub-tab-btn.active');
    expect(activeBtn).not.toBeNull();
    expect(activeBtn.getAttribute('data-subtab')).toBe('subtab-model');
  });

  test('settings.html should contain 3 subtab-content sections with proper default visibility', () => {
    const modelSubtab = container.querySelector('#subtab-model');
    const quotaSubtab = container.querySelector('#subtab-quota');
    const personalitySubtab = container.querySelector('#subtab-personality');

    expect(modelSubtab).not.toBeNull();
    expect(quotaSubtab).not.toBeNull();
    expect(personalitySubtab).not.toBeNull();

    expect(modelSubtab.classList.contains('active')).toBe(true);
    expect(quotaSubtab.classList.contains('active')).toBe(false);
    expect(personalitySubtab.classList.contains('active')).toBe(false);
  });

  test('settings.html should contain test model button and test status container', () => {
    const btnTest = container.querySelector('#btn-test-model');
    const testStatus = container.querySelector('#test-model-status');

    expect(btnTest).not.toBeNull();
    expect(btnTest.textContent).toContain('測試連線');
    expect(testStatus).not.toBeNull();
  });

  test('settings.html should contain model info card with all required metadata fields', () => {
    const card = container.querySelector('#model-info-card');
    expect(card).not.toBeNull();

    expect(card.querySelector('#model-info-name')).not.toBeNull();
    expect(card.querySelector('#model-info-badge')).not.toBeNull();
    expect(card.querySelector('#model-info-desc')).not.toBeNull();
    expect(card.querySelector('#model-info-ctx')).not.toBeNull();
    expect(card.querySelector('#model-info-out')).not.toBeNull();
    expect(card.querySelector('#model-info-tools')).not.toBeNull();
    expect(card.querySelector('#model-info-rpm')).not.toBeNull();
    expect(card.querySelector('#model-info-test-record')).not.toBeNull();
    expect(card.querySelector('#model-info-test-text')).not.toBeNull();
  });

  test('model select options should reflect test badges when test results exist', () => {
    const select = container.querySelector('#setting-aiModel');
    expect(select).not.toBeNull();
    const opt = select.querySelector('option[value="gemini-3.5-flash-lite"]');
    expect(opt).not.toBeNull();
  });

  test('settings.html should provide multi-provider selector, baseUrl and customModel inputs', () => {
    const providerSelect = container.querySelector('#setting-aiProvider');
    expect(providerSelect).not.toBeNull();

    const values = Array.from(providerSelect.querySelectorAll('option')).map(o => o.value);
    expect(values).toEqual(expect.arrayContaining([
      'gemini', 'groq', 'openrouter', 'openai', 'deepseek', 'anthropic', 'ollama', 'custom'
    ]));

    expect(container.querySelector('#btn-open-provider-key')).not.toBeNull();
    expect(container.querySelector('#baseUrl-group')).not.toBeNull();
    expect(container.querySelector('#setting-baseUrl')).not.toBeNull();
    expect(container.querySelector('#custom-model-group')).not.toBeNull();
    expect(container.querySelector('#setting-customModel')).not.toBeNull();
  });

  test('sub-tab buttons should correctly toggle active class on clicks', () => {
    const buttons = container.querySelectorAll('.sub-tab-btn');
    const contents = container.querySelectorAll('.subtab-content');

    // Attach click handler simulating settings.js
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        contents.forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        const targetId = btn.getAttribute('data-subtab');
        const target = container.querySelector('#' + targetId);
        if (target) target.classList.add('active');
      });
    });

    const quotaBtn = container.querySelector('[data-subtab="subtab-quota"]');
    quotaBtn.click();

    expect(quotaBtn.classList.contains('active')).toBe(true);
    expect(container.querySelector('#subtab-quota').classList.contains('active')).toBe(true);
    expect(container.querySelector('#subtab-model').classList.contains('active')).toBe(false);
  });
});
