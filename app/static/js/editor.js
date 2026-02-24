// ===== EDITOR.JS - Toolbar actions =====

function insertFormat(type) {
  const editor = document.getElementById('markdownEditor');
  if (!editor) return;
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const selected = editor.value.substring(start, end);

  let before, after, placeholder;
  switch (type) {
    case 'bold':        before = '**'; after = '**'; placeholder = 'bold text'; break;
    case 'italic':      before = '*';  after = '*';  placeholder = 'italic text'; break;
    case 'underline':   before = '<u>'; after = '</u>'; placeholder = 'underlined text'; break;
    case 'strikethrough': before = '~~'; after = '~~'; placeholder = 'strikethrough'; break;
    default: return;
  }

  const text = selected || placeholder;
  const insertion = before + text + after;
  insertAtCursor(editor, insertion);
  if (!selected) {
    editor.selectionStart = start + before.length;
    editor.selectionEnd = start + before.length + text.length;
  }
  updatePreview();
}

function insertHeading(level) {
  if (!level) return;
  const editor = document.getElementById('markdownEditor');
  if (!editor) return;
  const prefix = '#'.repeat(parseInt(level)) + ' ';
  const start = editor.selectionStart;
  const value = editor.value;
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const lineEnd = value.indexOf('\n', start);
  const line = value.substring(lineStart, lineEnd === -1 ? value.length : lineEnd);
  const cleanLine = line.replace(/^#+\s*/, '');
  const newLine = prefix + cleanLine;

  editor.value = value.substring(0, lineStart) + newLine + value.substring(lineEnd === -1 ? value.length : lineEnd);
  editor.selectionStart = editor.selectionEnd = lineStart + newLine.length;
  editor.focus();
  document.getElementById('headingSelect').value = '';
  updatePreview();
}

function insertList(type) {
  const editor = document.getElementById('markdownEditor');
  if (!editor) return;
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const value = editor.value;

  let marker;
  switch (type) {
    case 'bullet':   marker = '- '; break;
    case 'numbered': marker = '1. '; break;
    case 'task':     marker = '- [ ] '; break;
    default: return;
  }

  const selectedText = value.substring(start, end);
  if (selectedText) {
    const lines = selectedText.split('\n');
    let counter = 1;
    const transformed = lines.map(l => {
      const m = type === 'numbered' ? (counter++) + '. ' : marker;
      return m + l;
    }).join('\n');
    insertAtCursorRange(editor, start, end, transformed);
  } else {
    insertAtCursor(editor, '\n' + marker);
  }
  updatePreview();
}

function insertLink() {
  const url = prompt('URL:', 'https://');
  if (url === null) return;
  const text = prompt('Link text:', 'link text');
  if (text === null) return;
  const editor = document.getElementById('markdownEditor');
  insertAtCursor(editor, `[${text}](${url})`);
  updatePreview();
}

function toggleCodeMenu() {
  const menu = document.getElementById('codeMenu');
  if (menu) menu.style.display = menu.style.display === 'none' ? 'flex' : 'none';
}

function insertCodeBlock() {
  const lang = document.getElementById('codeLangSelect').value;
  const editor = document.getElementById('markdownEditor');
  if (!editor) return;
  const fence = lang ? `\`\`\`${lang}` : '```';
  const block = `${fence}\n\n\`\`\``;
  const start = editor.selectionStart;
  insertAtCursor(editor, block);
  // Position cursor inside the block (after the first line)
  editor.selectionStart = editor.selectionEnd = start + fence.length + 1;
  editor.focus();
  document.getElementById('codeMenu').style.display = 'none';
  updatePreview();
}

function toggleSpoilerMenu() {
  const menu = document.getElementById('spoilerMenu');
  if (menu) menu.style.display = menu.style.display === 'none' ? 'flex' : 'none';
}

function insertSpoiler() {
  const title = document.getElementById('spoilerTitle').value || 'Details';
  const closed = document.getElementById('spoilerClosed').checked;
  const editor = document.getElementById('markdownEditor');
  if (!editor) return;

  const marker = closed ? '???' : '???+';
  const block = `${marker} note "${title}"\n    Content here\n`;
  insertAtCursor(editor, block);
  document.getElementById('spoilerMenu').style.display = 'none';
  updatePreview();
}

function toggleAdmonMenu() {
  const menu = document.getElementById('admonMenu');
  if (menu) menu.style.display = menu.style.display === 'none' ? 'flex' : 'none';
}

function insertAdmonition() {
  const type = document.getElementById('admonType').value;
  const title = document.getElementById('admonTitle').value;
  const editor = document.getElementById('markdownEditor');
  if (!editor) return;

  const titlePart = title ? ` "${title}"` : '';
  const block = `!!! ${type}${titlePart}\n    Content here\n`;
  insertAtCursor(editor, block);
  document.getElementById('admonMenu').style.display = 'none';
  updatePreview();
}

function insertTable() {
  const editor = document.getElementById('markdownEditor');
  if (!editor) return;
  const table = `
| Column 1 | Column 2 | Column 3 |
|----------|----------|----------|
| Row 1    | Data     | Data     |
| Row 2    | Data     | Data     |
`;
  insertAtCursor(editor, table);
  updatePreview();
}

function insertHRule() {
  const editor = document.getElementById('markdownEditor');
  if (!editor) return;
  insertAtCursor(editor, '\n---\n');
  updatePreview();
}

function insertAtCursorRange(textarea, start, end, text) {
  const before = textarea.value.substring(0, start);
  const after = textarea.value.substring(end);
  textarea.value = before + text + after;
  textarea.selectionStart = start;
  textarea.selectionEnd = start + text.length;
  textarea.focus();
}

// Close dropdowns when clicking outside
document.addEventListener('click', e => {
  if (!e.target.closest('.tb-dropdown')) {
    ['codeMenu', 'spoilerMenu', 'admonMenu'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
  }
});
