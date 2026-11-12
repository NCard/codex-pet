const fs = require('fs');
const path = require('path');
const { getThinkingStepLimit } = require('../../src/views/main/modules/chat');

describe('Thinking Level UI & Configuration Tests', () => {
  let container;

  beforeEach(() => {
    const htmlPath = path.resolve(__dirname, '../../src/views/settings/settings.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    container = document.createElement('div');
    container.innerHTML = htmlContent;
  });

  test('settings.html should contain the thinkingLevel select element', () => {
    const select = container.querySelector('#setting-thinkingLevel');
    expect(select).not.toBeNull();
  });

  test('thinkingLevel select should have low, medium, and high options with medium selected by default', () => {
    const select = container.querySelector('#setting-thinkingLevel');
    const options = Array.from(select.querySelectorAll('option'));
    const values = options.map(opt => opt.value);

    expect(values).toContain('low');
    expect(values).toContain('medium');
    expect(values).toContain('high');

    const defaultOption = select.querySelector('option[selected]');
    expect(defaultOption).not.toBeNull();
    expect(defaultOption.value).toBe('medium');
  });

  test('options text should clearly describe iterations and thinking depth', () => {
    const select = container.querySelector('#setting-thinkingLevel');
    const lowOpt = select.querySelector('option[value="low"]');
    const medOpt = select.querySelector('option[value="medium"]');
    const highOpt = select.querySelector('option[value="high"]');

    expect(lowOpt.textContent).toContain('3 輪');
    expect(medOpt.textContent).toContain('5 輪');
    expect(highOpt.textContent).toContain('10 輪');
  });

  test('chat module getThinkingStepLimit aligns with UI step values', () => {
    expect(getThinkingStepLimit('low')).toBe(3);
    expect(getThinkingStepLimit('medium')).toBe(5);
    expect(getThinkingStepLimit('high')).toBe(10);
  });

  test('inspector.html should contain reasoning inspection structure', () => {
    const inspectorHtmlPath = path.resolve(__dirname, '../../src/views/inspector/inspector.html');
    const inspectorHtml = fs.readFileSync(inspectorHtmlPath, 'utf8');
    const inspectorContainer = document.createElement('div');
    inspectorContainer.innerHTML = inspectorHtml;

    expect(inspectorContainer.querySelector('#inspector-reasoning')).not.toBeNull();
    expect(inspectorContainer.querySelector('#reasoning-details')).not.toBeNull();
    expect(inspectorContainer.querySelector('#reasoning-level-badge')).not.toBeNull();
    expect(inspectorContainer.querySelector('#reasoning-body')).not.toBeNull();
  });
});

