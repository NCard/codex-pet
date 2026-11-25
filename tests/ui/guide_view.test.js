/**
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');

describe('Onboarding Guide & Feature Showcase UI Tests', () => {
  let mockIpcRenderer;
  let mockShell;
  let mockClipboard;
  let savedStateStr;
  let htmlContent;

  beforeAll(() => {
    const htmlPath = path.resolve(__dirname, '../../src/views/guide/guide.html');
    htmlContent = fs.readFileSync(htmlPath, 'utf8');
  });

  beforeEach(() => {
    jest.resetModules();
    savedStateStr = null;

    // Extract body HTML cleanly for jsdom
    const bodyMatch = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    document.body.innerHTML = bodyMatch ? bodyMatch[1] : htmlContent;
    window.close = jest.fn();
    window.alert = jest.fn();

    mockIpcRenderer = {
      send: jest.fn(),
      on: jest.fn()
    };
    mockShell = {
      openExternal: jest.fn()
    };
    mockClipboard = {
      writeText: jest.fn()
    };

    jest.mock('electron', () => ({
      ipcRenderer: mockIpcRenderer,
      shell: mockShell,
      clipboard: mockClipboard
    }));

    jest.mock('@google/genai', () => ({
      GoogleGenAI: jest.fn().mockImplementation(() => ({
        models: {
          generateContent: jest.fn(),
          list: jest.fn()
        }
      }))
    }));

    jest.spyOn(fs, 'existsSync').mockImplementation((p) => {
      if (String(p).includes('pet_state.json')) return false;
      return true;
    });
    jest.spyOn(fs, 'writeFileSync').mockImplementation((p, data) => {
      if (String(p).includes('pet_state.json')) {
        savedStateStr = data;
      }
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('renders both Onboarding Wizard and Feature Showcase tabs with all core sections', () => {
    expect(document.querySelector('#tab-btn-onboarding')).not.toBeNull();
    expect(document.querySelector('#tab-btn-features')).not.toBeNull();
    expect(document.querySelectorAll('.step-pane').length).toBe(4);
    expect(document.querySelectorAll('.feature-card').length).toBe(6);
    expect(document.querySelectorAll('.shortcut-item').length).toBe(6);

    const providerValues = Array.from(document.querySelectorAll('#guide-provider option')).map(o => o.value);
    expect(providerValues).toEqual(expect.arrayContaining([
      'gemini', 'groq', 'openrouter', 'openai', 'deepseek', 'anthropic', 'ollama', 'custom'
    ]));
  });

  test('steps through 4 onboarding panes, switches mode tabs, and saves wizard settings on finish', () => {
    require('../../src/views/guide/guide');

    // Step 1 active by default
    expect(document.getElementById('step-pane-1').classList.contains('active')).toBe(true);
    expect(document.getElementById('btn-step-prev').style.display).toBe('none');

    // Advance to Step 2 and configure Groq
    document.getElementById('btn-step-next').click();
    expect(document.getElementById('step-pane-2').classList.contains('active')).toBe(true);

    const providerSelect = document.getElementById('guide-provider');
    providerSelect.value = 'groq';
    providerSelect.dispatchEvent(new Event('change'));
    document.getElementById('guide-apikey').value = 'gsk_demo_key_123';

    // Advance to Step 3 and pick Developer scenario + clipboard toggle
    document.getElementById('btn-step-next').click();
    expect(document.getElementById('step-pane-3').classList.contains('active')).toBe(true);
    document.querySelector('.guide-scenario-card[data-scenario="developer"]').click();
    document.getElementById('guide-enable-clipboard').checked = true;

    // Advance to Step 4 -> Finish button visible and summary chips populated
    document.getElementById('btn-step-next').click();
    expect(document.getElementById('step-pane-4').classList.contains('active')).toBe(true);
    expect(document.getElementById('btn-step-finish').style.display).toBe('inline-block');
    expect(document.getElementById('guide-summary-chips').textContent).toContain('程式開發');

    // Finish onboarding -> persists state & notifies main process
    document.getElementById('btn-step-finish').click();
    expect(savedStateStr).not.toBeNull();
    const parsed = JSON.parse(savedStateStr);
    expect(parsed.onboardingCompleted).toBe(true);
    expect(parsed.settings.aiProvider).toBe('groq');
    expect(parsed.settings.apiKey).toBe('gsk_demo_key_123');
    expect(parsed.settings.aiScenario).toBe('developer');
    expect(parsed.settings.enableClipboard).toBe(true);
    expect(parsed.settings.enableClipboardSmartWatch).toBe(true);
    expect(mockIpcRenderer.send).toHaveBeenCalledWith('settings-changed', expect.any(Object));
    expect(mockIpcRenderer.send).toHaveBeenCalledWith('onboarding-completed', { saved: true });
    expect(window.close).toHaveBeenCalled();
  });

  test('switching to Features tab shows feature showcase and allows opening settings', () => {
    require('../../src/views/guide/guide');

    document.getElementById('tab-btn-features').click();
    expect(document.getElementById('panel-features').classList.contains('active')).toBe(true);
    expect(document.getElementById('panel-onboarding').classList.contains('active')).toBe(false);

    document.getElementById('btn-features-open-settings').click();
    expect(mockIpcRenderer.send).toHaveBeenCalledWith('open-settings');
  });

  test('context menu and settings About tab expose entry points to open Guide & Features', () => {
    const menuHtml = fs.readFileSync(path.resolve(__dirname, '../../src/views/context_menu/menu.html'), 'utf8');
    expect(menuHtml).toContain('data-action="guide"');

    const settingsHtml = fs.readFileSync(path.resolve(__dirname, '../../src/views/settings/settings.html'), 'utf8');
    expect(settingsHtml).toContain('id="btn-open-onboarding"');
    expect(settingsHtml).toContain('id="btn-open-features"');
  });
});
