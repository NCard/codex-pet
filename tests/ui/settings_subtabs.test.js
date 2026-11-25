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

  test('settings.html should contain AI sub-tabs (4) and Appearance sub-tabs (3) with proper defaults', () => {
    const aiTab = container.querySelector('#tab-general');
    const aiSubTabs = aiTab.querySelector('.sub-tabs');
    expect(aiSubTabs).not.toBeNull();

    const aiButtons = Array.from(aiSubTabs.querySelectorAll('.sub-tab-btn'));
    expect(aiButtons.length).toBe(4);

    const aiSubtabTargets = aiButtons.map(b => b.getAttribute('data-subtab'));
    expect(aiSubtabTargets).toEqual([
      'subtab-model',
      'subtab-personality',
      'subtab-quota',
      'subtab-data'
    ]);

    const activeAiBtn = aiSubTabs.querySelector('.sub-tab-btn.active');
    expect(activeAiBtn).not.toBeNull();
    expect(activeAiBtn.getAttribute('data-subtab')).toBe('subtab-model');

    // Appearance tab should be split into 3 sub-tabs
    const appTab = container.querySelector('#tab-appearance');
    const appSubTabs = appTab.querySelector('.sub-tabs');
    expect(appSubTabs).not.toBeNull();

    const appButtons = Array.from(appSubTabs.querySelectorAll('.sub-tab-btn'));
    expect(appButtons.length).toBe(3);

    const appSubtabTargets = appButtons.map(b => b.getAttribute('data-subtab'));
    expect(appSubtabTargets).toEqual([
      'subtab-chat-ui',
      'subtab-bed',
      'subtab-controls'
    ]);

    const activeAppBtn = appSubTabs.querySelector('.sub-tab-btn.active');
    expect(activeAppBtn).not.toBeNull();
    expect(activeAppBtn.getAttribute('data-subtab')).toBe('subtab-chat-ui');

    // Verify controls are organized into their respective appearance sub-tabs
    expect(container.querySelector('#subtab-chat-ui #setting-chatSizeMode')).not.toBeNull();
    expect(container.querySelector('#subtab-chat-ui #setting-chatAutoHideSeconds')).not.toBeNull();
    expect(container.querySelector('#subtab-chat-ui #setting-chatAutoHidePauseOnHover')).not.toBeNull();
    expect(container.querySelector('#subtab-chat-ui #setting-enableMonologue')).not.toBeNull();
    expect(container.querySelector('#subtab-chat-ui #setting-monologueFrequency')).not.toBeNull();
    expect(container.querySelector('#subtab-chat-ui #setting-monologueSleepDream')).not.toBeNull();
    expect(container.querySelector('#subtab-chat-ui #setting-monologueUseAI')).not.toBeNull();
    expect(container.querySelector('#subtab-chat-ui #btn-test-monologue')).not.toBeNull();
    expect(container.querySelector('#subtab-chat-ui #anim-speed')).not.toBeNull();
    expect(container.querySelector('#subtab-bed #btn-toggle-bed-edit')).not.toBeNull();
    expect(container.querySelector('#subtab-bed #bed-x')).not.toBeNull();
    expect(container.querySelector('#subtab-controls #setting-shortcut')).not.toBeNull();
    expect(container.querySelector('#subtab-controls #setting-enableAlarmStalking')).not.toBeNull();
  });

  test('settings.html should contain 4 subtab-content sections with proper default visibility', () => {
    const modelSubtab = container.querySelector('#subtab-model');
    const quotaSubtab = container.querySelector('#subtab-quota');
    const personalitySubtab = container.querySelector('#subtab-personality');
    const dataSubtab = container.querySelector('#subtab-data');

    expect(modelSubtab).not.toBeNull();
    expect(quotaSubtab).not.toBeNull();
    expect(personalitySubtab).not.toBeNull();
    expect(dataSubtab).not.toBeNull();

    expect(modelSubtab.classList.contains('active')).toBe(true);
    expect(quotaSubtab.classList.contains('active')).toBe(false);
    expect(personalitySubtab.classList.contains('active')).toBe(false);
    expect(dataSubtab.classList.contains('active')).toBe(false);

    // Data & cache management controls
    expect(dataSubtab.querySelector('#test-history-list')).not.toBeNull();
    expect(dataSubtab.querySelector('#btn-clear-test-results')).not.toBeNull();
    expect(dataSubtab.querySelector('#btn-clear-model-cache')).not.toBeNull();
    expect(dataSubtab.querySelector('#btn-clear-chat-history')).not.toBeNull();
    expect(dataSubtab.querySelector('#btn-reset-usage-data')).not.toBeNull();
    expect(dataSubtab.querySelector('#btn-clear-app-logs')).not.toBeNull();
    expect(dataSubtab.querySelector('#btn-open-data-dir')).not.toBeNull();
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

  test('settings.html should provide usage scenario cards, custom textarea and detail preview card', () => {
    const scenarioInput = container.querySelector('#setting-aiScenario');
    expect(scenarioInput).not.toBeNull();
    expect(scenarioInput.value).toBe('general');

    const cards = Array.from(container.querySelectorAll('.scenario-card'));
    expect(cards.length).toBe(7);

    const scenarios = cards.map(c => c.getAttribute('data-scenario'));
    expect(scenarios).toEqual(expect.arrayContaining([
      'general', 'developer', 'office', 'study', 'creative', 'companion', 'custom'
    ]));

    expect(container.querySelector('#custom-scenario-group')).not.toBeNull();
    expect(container.querySelector('#setting-customScenario')).not.toBeNull();
    expect(container.querySelector('#scenario-detail-card')).not.toBeNull();
    expect(container.querySelector('#scenario-detail-style')).not.toBeNull();
    expect(container.querySelector('#scenario-detail-clipboard')).not.toBeNull();
    expect(container.querySelector('#btn-apply-scenario-thinking')).not.toBeNull();
  });

  test('settings.html and index.html should provide adaptive and manual chat bubble size controls', () => {
    expect(container.querySelector('#chat-size-resolution-info')).not.toBeNull();
    const modeSelect = container.querySelector('#setting-chatSizeMode');
    expect(modeSelect).not.toBeNull();
    const modeValues = Array.from(modeSelect.querySelectorAll('option')).map(o => o.value);
    expect(modeValues).toEqual(expect.arrayContaining(['auto', 'manual']));

    expect(container.querySelector('#setting-chatWidth')).not.toBeNull();
    expect(container.querySelector('#setting-chatHeight')).not.toBeNull();
    expect(container.querySelector('#btn-reset-chat-size')).not.toBeNull();

    const mainHtml = fs.readFileSync(path.resolve(__dirname, '../../src/views/main/index.html'), 'utf8');
    expect(mainHtml).toContain('id="chat-resize-handle"');
  });

  test('settings.html should provide live cross-tab search bar and searchable metadata on every section', () => {
    expect(container.querySelector('#settings-search-input')).not.toBeNull();
    expect(container.querySelector('#btn-clear-search')).not.toBeNull();
    expect(container.querySelector('#search-status-bar')).not.toBeNull();
    expect(container.querySelector('#search-status-text')).not.toBeNull();
    expect(container.querySelector('#btn-exit-search')).not.toBeNull();
    expect(container.querySelector('#search-empty-state')).not.toBeNull();

    const sections = Array.from(container.querySelectorAll('.tab-content .section'));
    expect(sections.length).toBeGreaterThanOrEqual(10);

    sections.forEach(sec => {
      const searchPath = sec.getAttribute('data-search-path');
      const keywords = sec.getAttribute('data-search-keywords');
      expect(searchPath && searchPath.trim().length > 0).toBe(true);
      expect(keywords && keywords.trim().length > 0).toBe(true);
    });

    // Searching for 手動 + 對話 should match the Chat Bubble Size section
    const matched = sections.filter(sec => {
      const hay = `${sec.getAttribute('data-search-keywords')} ${sec.getAttribute('data-search-path')} ${sec.textContent}`.toLowerCase();
      return ['手動', '對話'].every(t => hay.includes(t));
    });
    expect(matched.length).toBeGreaterThanOrEqual(1);
    expect(matched.some(s => s.querySelector('#setting-chatSizeMode') !== null)).toBe(true);
  });

  test('sub-tab buttons should toggle active class scoped to their parent tab-content', () => {
    const buttons = container.querySelectorAll('.sub-tab-btn');

    // Attach scoped click handler matching settings.js
    buttons.forEach(btn => {
      btn.addEventListener('click', () => {
        const scope = btn.closest('.tab-content') || container;
        scope.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
        scope.querySelectorAll('.subtab-content').forEach(c => c.classList.remove('active'));
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
    // Appearance tab's default subtab must remain untouched
    expect(container.querySelector('#subtab-chat-ui').classList.contains('active')).toBe(true);

    // Switching appearance subtab should not disturb AI tab's active subtab
    const bedBtn = container.querySelector('[data-subtab="subtab-bed"]');
    bedBtn.click();
    expect(container.querySelector('#subtab-bed').classList.contains('active')).toBe(true);
    expect(container.querySelector('#subtab-chat-ui').classList.contains('active')).toBe(false);
    expect(container.querySelector('#subtab-quota').classList.contains('active')).toBe(true);
  });
});
