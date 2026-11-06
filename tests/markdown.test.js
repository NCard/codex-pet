const test = require('node:test');
const assert = require('node:assert');
const { renderMarkdown } = require('../src/utils/markdown');

test('Markdown Utility Unit Tests', async (t) => {
  await t.test('should escape HTML characters safely', () => {
    const raw = '<script>alert("xss")</script>';
    const html = renderMarkdown(raw);
    assert.ok(!html.includes('<script>'));
    assert.ok(html.includes('&lt;script&gt;'));
  });

  await t.test('should format bold and inline code', () => {
    const raw = '這是 **重點** 以及 `const a = 1` 說明';
    const html = renderMarkdown(raw);
    assert.ok(html.includes('<strong>重點</strong>'));
    assert.ok(html.includes('<code class="md-inline-code">const a = 1</code>'));
  });

  await t.test('should format headings', () => {
    const raw = '### 三級標題\n## 二級標題';
    const html = renderMarkdown(raw);
    assert.ok(html.includes('<div class="md-h3">三級標題</div>'));
    assert.ok(html.includes('<div class="md-h2">二級標題</div>'));
  });

  await t.test('should format unordered and ordered lists', () => {
    const raw = '- 項目一\n- 項目二\n1. 第一步\n2. 第二步';
    const html = renderMarkdown(raw);
    assert.ok(html.includes('<ul class="md-ul">'));
    assert.ok(html.includes('<li class="md-li">項目一</li>'));
    assert.ok(html.includes('<ol class="md-ol">'));
    assert.ok(html.includes('<li class="md-li">第一步</li>'));
  });

  await t.test('should format code blocks with copy attribute', () => {
    const raw = '代碼如下：\n```javascript\nfunction test() {\n  return 42;\n}\n```\n結束';
    const html = renderMarkdown(raw);
    assert.ok(html.includes('md-code-container'));
    assert.ok(html.includes('md-code-copy-btn'));
    assert.ok(html.includes('javascript'));
    assert.ok(html.includes('return 42;'));
  });
});
