/**
 * 輕量級 Markdown 渲染器 (Zero Dependency)
 * 支援標題、粗體、行內代碼、代碼區塊、有序/無序列表、段落與換行
 */

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderMarkdown(rawText) {
  if (!rawText) return '';

  const codeBlocks = [];
  // 1. 抽出代碼區塊以保護代碼內容不被後續正則替換
  let text = rawText.replace(/```([a-zA-Z0-9_\-]*)?\r?\n([\s\S]*?)```/g, (_, lang, code) => {
    const placeholder = `__MD_CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push({ lang: (lang || 'code').trim(), code: code.trim() });
    return placeholder;
  });

  // 2. HTML 實體轉義
  text = escapeHtml(text);

  // 3. 標題
  text = text.replace(/^### (.*$)/gim, '<div class="md-h3">$1</div>');
  text = text.replace(/^## (.*$)/gim, '<div class="md-h2">$1</div>');
  text = text.replace(/^# (.*$)/gim, '<div class="md-h1">$1</div>');

  // 4. 粗體
  text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // 5. 行內代碼
  text = text.replace(/`([^`\n]+)`/g, '<code class="md-inline-code">$1</code>');

  // 6. 清單解析 (無序清單與有序清單)
  const lines = text.split('\n');
  const renderedLines = [];
  let inUl = false;
  let inOl = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const ulMatch = line.match(/^[\*\-]\s+(.*)/);
    const olMatch = line.match(/^\d+\.\s+(.*)/);

    if (ulMatch) {
      if (inOl) { renderedLines.push('</ol>'); inOl = false; }
      if (!inUl) { renderedLines.push('<ul class="md-ul">'); inUl = true; }
      renderedLines.push(`<li class="md-li">${ulMatch[1]}</li>`);
    } else if (olMatch) {
      if (inUl) { renderedLines.push('</ul>'); inUl = false; }
      if (!inOl) { renderedLines.push('<ol class="md-ol">'); inOl = true; }
      renderedLines.push(`<li class="md-li">${olMatch[1]}</li>`);
    } else {
      if (inUl) { renderedLines.push('</ul>'); inUl = false; }
      if (inOl) { renderedLines.push('</ol>'); inOl = false; }
      renderedLines.push(line);
    }
  }
  if (inUl) renderedLines.push('</ul>');
  if (inOl) renderedLines.push('</ol>');

  text = renderedLines.join('\n');

  // 7. 段落與換行
  text = text.replace(/\r?\n\r?\n+/g, '</p><p class="md-p">');
  text = text.replace(/(?<!<\/ul>|<\/ol>|<\/div>)\r?\n/g, '<br>');
  text = `<p class="md-p">${text}</p>`;
  text = text.replace(/<p class="md-p">\s*<\/p>/g, '');

  // 8. 還原代碼區塊
  for (let i = 0; i < codeBlocks.length; i++) {
    const { lang, code } = codeBlocks[i];
    const escapedCode = escapeHtml(code);
    const rawAttr = encodeURIComponent(code);
    const html = `
<div class="md-code-container">
  <div class="md-code-bar">
    <span class="md-code-lang">${escapeHtml(lang)}</span>
    <button class="md-code-copy-btn" data-code="${rawAttr}" title="複製代碼">📋 複製</button>
  </div>
  <pre class="md-code-body"><code>${escapedCode}</code></pre>
</div>`;
    text = text.replace(`__MD_CODE_BLOCK_${i}__`, html);
  }

  return text;
}

module.exports = { renderMarkdown, escapeHtml };

