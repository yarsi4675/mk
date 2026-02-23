// ===== MAIN.JS - Core application logic =====

// State
const State = {
  token: localStorage.getItem('access_token') || null,
  projectId: parseInt(localStorage.getItem('selectedProjectId')) || null,
  menuItemId: parseInt(localStorage.getItem('selectedMenuItemId')) || null,
  articleId: parseInt(localStorage.getItem('selectedArticleId')) || null,
  projects: [],
  menuItems: [],
  articles: [],
  tags: [],
  prefixes: [],
  suffixes: [],
  icons: [],
  images: [],
  editingProjectId: null,
  deletingArticleId: null,
};

// ===== API HELPERS =====
async function apiFetch(url, options = {}) {
  const token = State.token || localStorage.getItem('access_token');
  const headers = {
    ...(options.headers || {}),
  };
  if (token && !options._noAuth) {
    headers['Authorization'] = 'Bearer ' + token;
  }
  if (options.json) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.json);
    delete options.json;
  }
  const resp = await fetch(url, { ...options, headers });
  if (resp.status === 401) {
    window.location.href = '/login';
    return null;
  }
  return resp;
}

// ===== AUTH =====
async function logout() {
  await apiFetch('/api/auth/logout', { method: 'POST' });
  localStorage.removeItem('access_token');
  window.location.href = '/login';
}

// ===== PANEL COLLAPSE =====
function togglePanel(panelId) {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  panel.classList.toggle('collapsed');
  const key = 'panel_' + panelId;
  localStorage.setItem(key, panel.classList.contains('collapsed') ? '1' : '0');
}

function restorePanels() {
  ['panelProjects', 'panelMenu', 'panelArticles', 'panelEditor'].forEach(id => {
    const collapsed = localStorage.getItem('panel_' + id);
    if (collapsed === '1') {
      const p = document.getElementById(id);
      if (p) p.classList.add('collapsed');
    }
  });
}

// ===== PROJECTS =====
async function loadProjects() {
  const resp = await apiFetch('/api/projects');
  if (!resp || !resp.ok) return;
  State.projects = await resp.json();
  renderProjects();
  if (State.projectId) {
    const proj = State.projects.find(p => p.id === State.projectId);
    if (proj) selectProject(State.projectId, false);
  }
}

function renderProjects() {
  const container = document.getElementById('projectsList');
  if (!container) return;
  if (!State.projects.length) {
    container.innerHTML = '<div style="padding:12px;color:#718096;font-size:13px;">No projects yet</div>';
    return;
  }
  container.innerHTML = State.projects.map(p => `
    <div class="project-item ${p.id === State.projectId ? 'active' : ''}" 
         onclick="selectProject(${p.id})" data-id="${p.id}">
      <span class="project-item-name">📁 ${escHtml(p.name)}</span>
      <div class="project-actions">
        <button class="btn btn-xs" onclick="event.stopPropagation();openGitModal(${p.id})" title="Git">🔀</button>
        <button class="btn btn-xs" onclick="event.stopPropagation();editProject(${p.id})" title="Settings">⚙️</button>
        <button class="btn btn-xs btn-danger" onclick="event.stopPropagation();deleteProject(${p.id})" title="Delete">🗑️</button>
      </div>
    </div>
  `).join('');
}

async function selectProject(id, save = true) {
  State.projectId = id;
  if (save) {
    localStorage.setItem('selectedProjectId', id);
    localStorage.removeItem('selectedMenuItemId');
    localStorage.removeItem('selectedArticleId');
    State.menuItemId = null;
    State.articleId = null;
  }
  renderProjects();
  document.getElementById('addMenuBtn').disabled = false;
  document.getElementById('addArticleBtn').disabled = false;
  await Promise.all([
    loadMenu(),
    loadTags(),
    loadPrefixes(),
    loadSuffixes(),
    loadIcons(),
  ]);
  updateBreadcrumbs();
  if (State.menuItemId) {
    await loadArticles();
    if (State.articleId) {
      await openArticle(State.articleId, false);
    }
  }
}

function showAddProject() {
  State.editingProjectId = null;
  document.getElementById('projectModalTitle').textContent = 'Add Project';
  document.getElementById('projName').value = '';
  document.getElementById('projSlug').value = '';
  document.getElementById('projDesc').value = '';
  openModal('projectModal');
}

function editProject(id) {
  const p = State.projects.find(x => x.id === id);
  if (!p) return;
  State.editingProjectId = id;
  document.getElementById('projectModalTitle').textContent = 'Edit Project';
  document.getElementById('projName').value = p.name;
  document.getElementById('projSlug').value = p.slug;
  document.getElementById('projDesc').value = p.description || '';
  openModal('projectModal');
}

async function saveProject() {
  const name = document.getElementById('projName').value.trim();
  const slug = document.getElementById('projSlug').value.trim() || slugify(name);
  const description = document.getElementById('projDesc').value.trim();
  if (!name) return alert('Name is required');

  const data = { name, slug, description };
  let resp;
  if (State.editingProjectId) {
    resp = await apiFetch(`/api/projects/${State.editingProjectId}`, { method: 'PUT', json: data });
  } else {
    resp = await apiFetch('/api/projects', { method: 'POST', json: data });
  }
  if (resp && resp.ok) {
    closeModal('projectModal');
    await loadProjects();
  } else if (resp) {
    const err = await resp.json();
    alert(err.detail || 'Error saving project');
  }
}

async function deleteProject(id) {
  if (!confirm('Delete this project and all its content?')) return;
  const resp = await apiFetch(`/api/projects/${id}`, { method: 'DELETE' });
  if (resp && resp.ok) {
    if (State.projectId === id) {
      State.projectId = null;
      State.menuItemId = null;
      State.articleId = null;
      localStorage.removeItem('selectedProjectId');
      clearMenu();
      clearArticles();
      clearEditor();
    }
    await loadProjects();
  }
}

// Auto-generate slug from name
document.addEventListener('DOMContentLoaded', () => {
  const nameInput = document.getElementById('projName');
  if (nameInput) {
    nameInput.addEventListener('input', () => {
      const slugInput = document.getElementById('projSlug');
      if (slugInput && !slugInput.dataset.manual) {
        slugInput.value = slugify(nameInput.value);
      }
    });
  }
  const slugInput = document.getElementById('projSlug');
  if (slugInput) {
    slugInput.addEventListener('input', () => { slugInput.dataset.manual = '1'; });
  }
});

// ===== MENU =====
async function loadMenu() {
  if (!State.projectId) return;
  const resp = await apiFetch(`/api/projects/${State.projectId}/menu`);
  if (!resp || !resp.ok) return;
  State.menuItems = await resp.json();
  renderMenu(State.menuItems);
  updateMenuItemParentSelect();
}

function renderMenu(items, container = null, level = 0) {
  const root = container || document.getElementById('menuTree');
  if (!root) return;
  if (!container) root.innerHTML = '';

  items.forEach(item => {
    const node = document.createElement('div');
    node.className = 'menu-node';
    node.dataset.id = item.id;

    const hasChildren = item.children && item.children.length > 0;
    const isCollapsed = localStorage.getItem('menu_' + item.id) === '1';

    node.innerHTML = `
      <div class="menu-item-row ${item.id === State.menuItemId ? 'active' : ''}"
           draggable="true"
           onclick="selectMenuItem(${item.id})"
           data-id="${item.id}">
        <span class="menu-item-toggle" onclick="event.stopPropagation();toggleMenuNode(${item.id})">
          ${hasChildren ? (isCollapsed ? '▶' : '▼') : ''}
        </span>
        <span class="menu-item-name">📂 ${escHtml(item.name)}</span>
        <div class="menu-item-actions">
          <button class="btn btn-xs" onclick="event.stopPropagation();editMenuItem(${item.id})" title="Edit">✏️</button>
          <button class="btn btn-xs btn-danger" onclick="event.stopPropagation();deleteMenuItemPrompt(${item.id})" title="Delete">🗑️</button>
        </div>
      </div>
    `;

    const childContainer = document.createElement('div');
    childContainer.className = 'menu-children';
    childContainer.id = 'menu-children-' + item.id;
    if (isCollapsed) childContainer.style.display = 'none';

    if (hasChildren) {
      renderMenu(item.children, childContainer, level + 1);
    }
    node.appendChild(childContainer);
    root.appendChild(node);
  });
}

function toggleMenuNode(id) {
  const children = document.getElementById('menu-children-' + id);
  if (!children) return;
  const isHidden = children.style.display === 'none';
  children.style.display = isHidden ? '' : 'none';
  localStorage.setItem('menu_' + id, isHidden ? '0' : '1');
  const toggle = document.querySelector(`[data-id="${id}"] .menu-item-toggle`);
  if (toggle) toggle.textContent = isHidden ? '▼' : '▶';
}

async function selectMenuItem(id) {
  State.menuItemId = id;
  localStorage.setItem('selectedMenuItemId', id);
  State.articleId = null;
  localStorage.removeItem('selectedArticleId');
  // Update active class
  document.querySelectorAll('.menu-item-row').forEach(r => r.classList.remove('active'));
  const row = document.querySelector(`.menu-item-row[data-id="${id}"]`);
  if (row) row.classList.add('active');
  await loadArticles();
  clearEditor();
  updateBreadcrumbs();
}

function showAddMenuItem() {
  document.getElementById('menuItemName').value = '';
  document.getElementById('menuItemSlug').value = '';
  updateMenuItemParentSelect();
  openModal('menuItemModal');
}

function editMenuItem(id) {
  const item = flatMenuItems().find(x => x.id === id);
  if (!item) return;
  document.getElementById('menuItemName').value = item.name;
  document.getElementById('menuItemSlug').value = item.slug;
  updateMenuItemParentSelect(item.parent_id);
  State._editingMenuItemId = id;
  openModal('menuItemModal');
}

async function saveMenuItem() {
  const name = document.getElementById('menuItemName').value.trim();
  const slug = document.getElementById('menuItemSlug').value.trim() || slugify(name);
  const parentId = document.getElementById('menuItemParent').value || null;
  if (!name) return alert('Name is required');

  const id = State._editingMenuItemId;
  let resp;
  if (id) {
    resp = await apiFetch(`/api/menu/${id}`, {
      method: 'PUT',
      json: { name, slug, parent_id: parentId ? parseInt(parentId) : null },
    });
  } else {
    resp = await apiFetch(`/api/projects/${State.projectId}/menu`, {
      method: 'POST',
      json: { name, slug, project_id: State.projectId, parent_id: parentId ? parseInt(parentId) : null },
    });
  }
  State._editingMenuItemId = null;
  if (resp && resp.ok) {
    closeModal('menuItemModal');
    await loadMenu();
  } else if (resp) {
    const err = await resp.json();
    alert(err.detail || 'Error saving menu item');
  }
}

function deleteMenuItemPrompt(id) {
  if (confirm('Delete this menu item? Articles will be unassigned (not deleted).')) {
    apiFetch(`/api/menu/${id}`, { method: 'DELETE' }).then(r => {
      if (r && r.ok) {
        if (State.menuItemId === id) { State.menuItemId = null; clearArticles(); }
        loadMenu();
      }
    });
  }
}

function updateMenuItemParentSelect(selectedId = null) {
  const sel = document.getElementById('menuItemParent');
  if (!sel) return;
  const flat = flatMenuItems();
  sel.innerHTML = '<option value="">None (root)</option>' +
    flat.map(i => `<option value="${i.id}" ${i.id === selectedId ? 'selected' : ''}>${escHtml(i.name)}</option>`).join('');
}

function flatMenuItems(items = State.menuItems, result = []) {
  items.forEach(i => { result.push(i); if (i.children) flatMenuItems(i.children, result); });
  return result;
}

function clearMenu() {
  State.menuItems = [];
  const t = document.getElementById('menuTree');
  if (t) t.innerHTML = '';
}

// ===== ARTICLES =====
async function loadArticles() {
  if (!State.projectId || !State.menuItemId) return;
  const resp = await apiFetch(`/api/projects/${State.projectId}/articles?menu_item_id=${State.menuItemId}`);
  if (!resp || !resp.ok) return;
  State.articles = await resp.json();
  renderArticles();
}

function renderArticles() {
  const container = document.getElementById('articlesList');
  if (!container) return;
  if (!State.articles.length) {
    container.innerHTML = '<div style="padding:12px;color:#718096;font-size:13px;">No articles yet</div>';
    return;
  }
  container.innerHTML = State.articles.map(a => {
    const prefix = a.prefix ? `[${escHtml(a.prefix.value)}] ` : '';
    const suffix = a.suffix ? ` [${escHtml(a.suffix.value)}]` : '';
    const icon = a.icon ? `<img src="/static/uploads/icons/${escHtml(a.icon.filename)}" style="width:16px;height:16px;object-fit:contain;"> ` : '';
    const tags = (a.tags || []).map(t =>
      `<span class="tag-chip" style="background:${t.color}">${escHtml(t.name)}</span>`
    ).join('');
    return `
      <div class="article-item ${a.id === State.articleId ? 'active' : ''}" onclick="openArticle(${a.id})" data-id="${a.id}">
        <div class="article-item-title">${icon}${prefix}${escHtml(a.title)}${suffix}</div>
        <div class="article-tags">${tags}</div>
        <div class="article-item-actions">
          <button class="btn btn-xs btn-danger" onclick="event.stopPropagation();promptDeleteArticle(${a.id})">🗑️</button>
        </div>
      </div>
    `;
  }).join('');
}

async function showAddArticle() {
  if (!State.projectId) return;
  const title = prompt('Article title:');
  if (!title) return;
  const slug = slugify(title);
  const resp = await apiFetch(`/api/projects/${State.projectId}/articles`, {
    method: 'POST',
    json: {
      title, slug,
      project_id: State.projectId,
      menu_item_id: State.menuItemId,
    },
  });
  if (resp && resp.ok) {
    const article = await resp.json();
    await loadArticles();
    await openArticle(article.id);
  }
}

async function openArticle(id, save = true) {
  const resp = await apiFetch(`/api/articles/${id}`);
  if (!resp || !resp.ok) return;
  const article = await resp.json();
  State.articleId = id;
  if (save) localStorage.setItem('selectedArticleId', id);

  // Update active state
  document.querySelectorAll('.article-item').forEach(r => r.classList.remove('active'));
  const row = document.querySelector(`.article-item[data-id="${id}"]`);
  if (row) row.classList.add('active');

  // Populate editor
  document.getElementById('articleTitle').value = article.title;
  document.getElementById('markdownEditor').value = article.content || '';
  document.getElementById('prefixSelect').value = article.prefix_id || '';
  document.getElementById('suffixSelect').value = article.suffix_id || '';
  document.getElementById('iconSelect').value = article.icon_id || '';

  // Set tags
  State._currentArticleTags = article.tags || [];
  renderTagChips(article.tags || []);

  updateTitlePreview();
  updateIconPreview();

  // Show editor
  document.getElementById('editorContainer').style.display = 'flex';
  document.getElementById('editorContainer').style.flexDirection = 'column';
  document.getElementById('editorPlaceholder').style.display = 'none';

  // Draft
  const draft = localStorage.getItem('draft_' + id);
  if (draft && draft !== article.content) {
    if (confirm('You have an unsaved draft. Restore it?')) {
      document.getElementById('markdownEditor').value = draft;
    }
  }

  updatePreview();
  updateBreadcrumbs();
}

async function saveArticle() {
  if (!State.articleId) return;
  const title = document.getElementById('articleTitle').value.trim();
  const content = document.getElementById('markdownEditor').value;
  const prefix_id = document.getElementById('prefixSelect').value || null;
  const suffix_id = document.getElementById('suffixSelect').value || null;
  const icon_id = document.getElementById('iconSelect').value || null;
  const tag_ids = (State._currentArticleTags || []).map(t => t.id);

  const resp = await apiFetch(`/api/articles/${State.articleId}`, {
    method: 'PUT',
    json: {
      title,
      slug: slugify(title),
      content,
      prefix_id: prefix_id ? parseInt(prefix_id) : null,
      suffix_id: suffix_id ? parseInt(suffix_id) : null,
      icon_id: icon_id ? parseInt(icon_id) : null,
      tag_ids,
    },
  });
  if (resp && resp.ok) {
    localStorage.removeItem('draft_' + State.articleId);
    await loadArticles();
    showToast('Article saved!');
  } else if (resp) {
    const err = await resp.json();
    alert(err.detail || 'Error saving');
  }
}

function cancelEdit() {
  clearEditor();
}

function clearEditor() {
  State.articleId = null;
  localStorage.removeItem('selectedArticleId');
  document.getElementById('editorContainer').style.display = 'none';
  document.getElementById('editorPlaceholder').style.display = 'flex';
  document.querySelectorAll('.article-item').forEach(r => r.classList.remove('active'));
}

function clearArticles() {
  State.articles = [];
  const c = document.getElementById('articlesList');
  if (c) c.innerHTML = '';
  clearEditor();
}

function promptDeleteArticle(id) {
  State.deletingArticleId = id;
  openModal('deleteArticleModal');
}

async function confirmDeleteArticle(withImages) {
  const id = State.deletingArticleId;
  if (!id) return;
  const resp = await apiFetch(`/api/articles/${id}?delete_images=${withImages}`, { method: 'DELETE' });
  closeModal('deleteArticleModal');
  if (resp && resp.ok) {
    if (State.articleId === id) clearEditor();
    await loadArticles();
  }
}

// ===== TAGS =====
async function loadTags() {
  if (!State.projectId) return;
  const resp = await apiFetch(`/api/projects/${State.projectId}/tags`);
  if (resp && resp.ok) {
    State.tags = await resp.json();
    populateTagSelect();
  }
}

function populateTagSelect() {
  const sel = document.getElementById('tagSelect');
  if (!sel) return;
  sel.innerHTML = State.tags.map(t =>
    `<option value="${t.id}" style="background:${t.color}">${t.name}</option>`
  ).join('');
}

function toggleTagSelector() {
  const sel = document.getElementById('tagSelect');
  if (!sel) return;
  sel.style.display = sel.style.display === 'none' ? 'block' : 'none';
  if (sel.style.display === 'block') {
    // Pre-select current tags
    const currentIds = (State._currentArticleTags || []).map(t => t.id);
    Array.from(sel.options).forEach(o => {
      o.selected = currentIds.includes(parseInt(o.value));
    });
    sel.onchange = () => {
      const selected = Array.from(sel.selectedOptions).map(o => parseInt(o.value));
      State._currentArticleTags = State.tags.filter(t => selected.includes(t.id));
      renderTagChips(State._currentArticleTags);
    };
  }
}

function renderTagChips(tags) {
  const container = document.getElementById('tagChips');
  if (!container) return;
  container.innerHTML = tags.map(t =>
    `<span class="tag-chip" style="background:${t.color}">
      ${escHtml(t.name)}
      <span class="remove-tag" onclick="removeTag(${t.id})">✕</span>
    </span>`
  ).join('');
}

function removeTag(tagId) {
  State._currentArticleTags = (State._currentArticleTags || []).filter(t => t.id !== tagId);
  renderTagChips(State._currentArticleTags);
}

async function addNewTag() {
  const name = document.getElementById('newTagName').value.trim();
  const color = document.getElementById('newTagColor').value;
  if (!name || !State.projectId) return;
  const resp = await apiFetch(`/api/projects/${State.projectId}/tags`, {
    method: 'POST',
    json: { name, color },
  });
  if (resp && resp.ok) {
    document.getElementById('newTagName').value = '';
    await loadTags();
    renderTagManager();
  }
}

async function renderTagManager() {
  await loadTags();
  const list = document.getElementById('tagManagerList');
  if (!list) return;
  list.innerHTML = State.tags.map(t => `
    <div class="tag-manager-item">
      <span class="tag-chip" style="background:${t.color}">${escHtml(t.name)}</span>
      <button class="btn btn-xs btn-danger" onclick="deleteTag(${t.id})">Delete</button>
    </div>
  `).join('');
}

async function deleteTag(id) {
  const resp = await apiFetch(`/api/tags/${id}`, { method: 'DELETE' });
  if (resp && resp.ok) renderTagManager();
}

// ===== PREFIXES =====
async function loadPrefixes() {
  if (!State.projectId) return;
  const resp = await apiFetch(`/api/projects/${State.projectId}/prefixes`);
  if (resp && resp.ok) {
    State.prefixes = await resp.json();
    populatePrefixSelect();
  }
}

function populatePrefixSelect() {
  const sel = document.getElementById('prefixSelect');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">None</option>' +
    State.prefixes.map(p => `<option value="${p.id}">[${escHtml(p.value)}]</option>`).join('');
  if (current) sel.value = current;
}

function showAddPrefix() {
  document.getElementById('prefixValue').value = '';
  openModal('prefixModal');
}

async function saveNewPrefix() {
  const value = document.getElementById('prefixValue').value.trim();
  if (!value || !State.projectId) return;
  const resp = await apiFetch(`/api/projects/${State.projectId}/prefixes`, {
    method: 'POST',
    json: { value },
  });
  if (resp && resp.ok) {
    closeModal('prefixModal');
    await loadPrefixes();
  }
}

// ===== SUFFIXES =====
async function loadSuffixes() {
  if (!State.projectId) return;
  const resp = await apiFetch(`/api/projects/${State.projectId}/suffixes`);
  if (resp && resp.ok) {
    State.suffixes = await resp.json();
    populateSuffixSelect();
  }
}

function populateSuffixSelect() {
  const sel = document.getElementById('suffixSelect');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">None</option>' +
    State.suffixes.map(s => `<option value="${s.id}">[${escHtml(s.value)}]</option>`).join('');
  if (current) sel.value = current;
}

function showAddSuffix() {
  document.getElementById('suffixValue').value = '';
  openModal('suffixModal');
}

async function saveNewSuffix() {
  const value = document.getElementById('suffixValue').value.trim();
  if (!value || !State.projectId) return;
  const resp = await apiFetch(`/api/projects/${State.projectId}/suffixes`, {
    method: 'POST',
    json: { value },
  });
  if (resp && resp.ok) {
    closeModal('suffixModal');
    await loadSuffixes();
  }
}

// ===== ICONS =====
async function loadIcons() {
  if (!State.projectId) return;
  const resp = await apiFetch(`/api/projects/${State.projectId}/icons`);
  if (resp && resp.ok) {
    State.icons = await resp.json();
    populateIconSelect();
  }
}

function populateIconSelect() {
  const sel = document.getElementById('iconSelect');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">None</option>' +
    State.icons.map(i => `<option value="${i.id}">${escHtml(i.name)}</option>`).join('');
  if (current) sel.value = current;
}

function updateIconPreview() {
  const sel = document.getElementById('iconSelect');
  const preview = document.getElementById('iconPreview');
  if (!sel || !preview) return;
  const id = parseInt(sel.value);
  if (id) {
    const icon = State.icons.find(i => i.id === id);
    if (icon) {
      preview.src = `/static/uploads/icons/${icon.filename}`;
      preview.style.display = 'inline';
      return;
    }
  }
  preview.style.display = 'none';
}

async function uploadIcon() {
  const name = document.getElementById('iconUploadName').value.trim();
  const file = document.getElementById('iconUploadFile').files[0];
  if (!name || !file || !State.projectId) return alert('Name and file required');

  const fd = new FormData();
  fd.append('name', name);
  fd.append('file', file);

  const resp = await apiFetch(`/api/projects/${State.projectId}/icons`, {
    method: 'POST',
    body: fd,
  });
  if (resp && resp.ok) {
    closeModal('iconModal');
    await loadIcons();
  }
}

// ===== TITLE PREVIEW =====
function updateTitlePreview() {
  const title = document.getElementById('articleTitle')?.value || '';
  const prefixSel = document.getElementById('prefixSelect');
  const suffixSel = document.getElementById('suffixSelect');
  const iconSel = document.getElementById('iconSelect');

  const prefixId = prefixSel?.value;
  const suffixId = suffixSel?.value;
  const iconId = iconSel?.value;

  const prefix = prefixId ? State.prefixes.find(p => p.id == prefixId) : null;
  const suffix = suffixId ? State.suffixes.find(s => s.id == suffixId) : null;
  const icon = iconId ? State.icons.find(i => i.id == iconId) : null;

  let preview = '';
  if (icon) preview += `<img src="/static/uploads/icons/${escHtml(icon.filename)}" style="width:20px;height:20px;object-fit:contain;margin-right:4px;"> `;
  if (prefix) preview += `[${escHtml(prefix.value)}] `;
  preview += escHtml(title);
  if (suffix) preview += ` [${escHtml(suffix.value)}]`;

  const el = document.getElementById('titlePreview');
  if (el) el.innerHTML = preview || '—';
}

// ===== LIVE PREVIEW =====
let previewDebounce = null;
function updatePreview() {
  clearTimeout(previewDebounce);
  previewDebounce = setTimeout(async () => {
    const content = document.getElementById('markdownEditor')?.value || '';
    if (State.articleId) {
      localStorage.setItem('draft_' + State.articleId, content);
    }
    try {
      const resp = await apiFetch('/api/preview', { method: 'POST', json: { content } });
      if (resp && resp.ok) {
        const data = await resp.json();
        const preview = document.getElementById('markdownPreview');
        if (preview) {
          preview.innerHTML = data.html;
          // Add copy buttons to code blocks
          preview.querySelectorAll('pre').forEach(pre => {
            if (!pre.querySelector('.copy-code-btn')) {
              const btn = document.createElement('button');
              btn.className = 'copy-code-btn';
              btn.textContent = '📋 Copy';
              btn.onclick = () => {
                navigator.clipboard.writeText(pre.querySelector('code')?.textContent || pre.textContent);
                btn.textContent = '✅ Copied!';
                setTimeout(() => btn.textContent = '📋 Copy', 2000);
              };
              pre.style.position = 'relative';
              pre.appendChild(btn);
            }
          });
          // Lightbox for images
          preview.querySelectorAll('img').forEach(img => {
            img.onclick = () => openLightbox(img.src, img.alt);
          });
        }
      }
    } catch(e) {}
  }, 300);
}

// ===== IMAGE GALLERY =====
let imageGalleryTab = 'article';

async function openImageGallery() {
  imageGalleryTab = 'article';
  await loadGalleryImages();
  openModal('imageModal');
}

async function loadGalleryImages() {
  if (!State.projectId) return;
  let url = `/api/projects/${State.projectId}/images`;
  if (imageGalleryTab === 'article' && State.articleId) {
    url += `?article_id=${State.articleId}`;
  }
  const resp = await apiFetch(url);
  if (!resp || !resp.ok) return;
  State.images = await resp.json();
  renderImageGallery();
}

function renderImageGallery() {
  const grid = document.getElementById('imageGalleryGrid');
  if (!grid) return;
  if (!State.images.length) {
    grid.innerHTML = '<p style="padding:20px;color:#718096;">No images yet. Upload one!</p>';
    return;
  }
  grid.innerHTML = State.images.map(img => `
    <div class="image-thumb" onclick="insertImageToEditor(${img.id})">
      <img src="/static/uploads/images/${escHtml(img.filename)}" alt="${escHtml(img.alt_text || img.original_filename)}" loading="lazy">
      <div class="img-overlay">${escHtml(img.original_filename)}</div>
    </div>
  `).join('');
}

function switchImageTab(tab) {
  imageGalleryTab = tab;
  document.getElementById('tabArticle').classList.toggle('active', tab === 'article');
  document.getElementById('tabAll').classList.toggle('active', tab === 'all');
  loadGalleryImages();
}

async function uploadImageFromGallery(input) {
  const file = input.files[0];
  if (!file || !State.projectId) return;
  const fd = new FormData();
  fd.append('file', file);
  fd.append('alt_text', file.name);
  if (State.articleId) fd.append('article_id', State.articleId);

  const resp = await apiFetch(`/api/projects/${State.projectId}/images`, {
    method: 'POST',
    body: fd,
  });
  if (resp && resp.ok) {
    input.value = '';
    await loadGalleryImages();
  }
}

function insertImageToEditor(imageId) {
  const img = State.images.find(i => i.id === imageId);
  if (!img) return;
  const md = `![${img.alt_text || img.original_filename}](/static/uploads/images/${img.filename})`;
  insertAtCursor(document.getElementById('markdownEditor'), md);
  closeModal('imageModal');
  updatePreview();
}

// ===== GIT =====
function openGitModal(projectId) {
  State._gitProjectId = projectId;
  document.getElementById('gitOutput').textContent = '';
  openModal('gitModal');
  gitStatus();
}

async function gitPush() {
  const id = State._gitProjectId || State.projectId;
  if (!id) return;
  document.getElementById('gitOutput').textContent = 'Pushing...';
  const resp = await apiFetch(`/api/projects/${id}/git/push`, { method: 'POST' });
  if (resp) {
    const data = await resp.json();
    document.getElementById('gitOutput').textContent = JSON.stringify(data, null, 2);
  }
}

async function gitPull() {
  const id = State._gitProjectId || State.projectId;
  if (!id) return;
  document.getElementById('gitOutput').textContent = 'Pulling...';
  const resp = await apiFetch(`/api/projects/${id}/git/pull`, { method: 'POST' });
  if (resp) {
    const data = await resp.json();
    document.getElementById('gitOutput').textContent = JSON.stringify(data, null, 2);
  }
}

async function gitStatus() {
  const id = State._gitProjectId || State.projectId;
  if (!id) return;
  const resp = await apiFetch(`/api/projects/${id}/git/status`);
  if (resp) {
    const data = await resp.json();
    document.getElementById('gitOutput').textContent = JSON.stringify(data, null, 2);
  }
}

async function gitHistory() {
  const id = State._gitProjectId || State.projectId;
  if (!id) return;
  const resp = await apiFetch(`/api/projects/${id}/git/history`);
  if (resp) {
    const data = await resp.json();
    document.getElementById('gitOutput').textContent = JSON.stringify(data, null, 2);
  }
}

// ===== SEARCH =====
let searchDebounce = null;
function initSearch() {
  const input = document.getElementById('searchInput');
  if (!input) return;
  input.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => performSearch(input.value), 300);
  });
  input.addEventListener('blur', () => {
    setTimeout(() => { const d = document.getElementById('searchResults'); if(d) d.style.display='none'; }, 200);
  });
  input.addEventListener('focus', () => {
    if (input.value) performSearch(input.value);
  });
}

async function performSearch(q) {
  if (!q.trim()) { document.getElementById('searchResults').style.display = 'none'; return; }
  let url = `/api/search?q=${encodeURIComponent(q)}`;
  if (State.projectId) url += `&project_id=${State.projectId}`;
  const resp = await apiFetch(url);
  if (!resp || !resp.ok) return;
  const results = await resp.json();
  const container = document.getElementById('searchResults');
  if (!results.length) {
    container.innerHTML = '<div style="padding:10px;color:#718096;font-size:13px;">No results</div>';
  } else {
    container.innerHTML = results.map(a => `
      <div class="search-result-item" onclick="openSearchResult(${a.id}, ${a.project_id})">
        <div class="search-result-title">${escHtml(a.title)}</div>
        <div class="search-result-meta">Project ID: ${a.project_id} &middot; ${escHtml(a.content.substring(0, 80))}...</div>
      </div>
    `).join('');
  }
  container.style.display = 'block';
}

async function openSearchResult(articleId, projectId) {
  document.getElementById('searchResults').style.display = 'none';
  if (State.projectId !== projectId) await selectProject(projectId);
  const article = (await apiFetch(`/api/articles/${articleId}`).then(r => r?.json())) || null;
  if (article && article.menu_item_id) {
    await selectMenuItem(article.menu_item_id);
  }
  await openArticle(articleId);
}

// ===== BREADCRUMBS =====
function updateBreadcrumbs() {
  const el = document.getElementById('breadcrumbs');
  if (!el) return;
  const parts = [];
  if (State.projectId) {
    const p = State.projects.find(x => x.id === State.projectId);
    if (p) parts.push(`<span onclick="selectProject(${p.id})">${escHtml(p.name)}</span>`);
  }
  if (State.menuItemId) {
    const flat = flatMenuItems();
    const m = flat.find(x => x.id === State.menuItemId);
    if (m) parts.push(`<span onclick="selectMenuItem(${m.id})">${escHtml(m.name)}</span>`);
  }
  if (State.articleId) {
    const a = State.articles.find(x => x.id === State.articleId);
    if (a) parts.push(`<span>${escHtml(a.title)}</span>`);
  }
  el.innerHTML = parts.join('<span class="sep"> › </span>');
}

// ===== MODALS =====
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'flex';
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

// Close modal on background click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal')) {
    e.target.style.display = 'none';
  }
});

// ===== UTILS =====
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugify(text) {
  return (text || '').toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim() || 'untitled';
}

function showToast(msg) {
  const toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;bottom:20px;right:20px;background:#48bb78;color:white;padding:10px 18px;border-radius:8px;font-size:14px;z-index:9999;animation:fadeIn .2s ease;';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

function insertAtCursor(textarea, text) {
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const before = textarea.value.substring(0, start);
  const after = textarea.value.substring(end);
  textarea.value = before + text + after;
  textarea.selectionStart = textarea.selectionEnd = start + text.length;
  textarea.focus();
}

// ===== EVENT LISTENERS =====
document.addEventListener('DOMContentLoaded', () => {
  restorePanels();
  loadProjects();
  initSearch();

  // Editor events
  const editor = document.getElementById('markdownEditor');
  if (editor) {
    editor.addEventListener('input', updatePreview);
    editor.addEventListener('keydown', handleEditorKeydown);
    editor.addEventListener('paste', handleEditorPaste);
  }

  const titleInput = document.getElementById('articleTitle');
  if (titleInput) titleInput.addEventListener('input', updateTitlePreview);

  const prefixSel = document.getElementById('prefixSelect');
  if (prefixSel) prefixSel.addEventListener('change', updateTitlePreview);

  const suffixSel = document.getElementById('suffixSelect');
  if (suffixSel) suffixSel.addEventListener('change', updateTitlePreview);

  const iconSel = document.getElementById('iconSelect');
  if (iconSel) {
    iconSel.addEventListener('change', () => { updateTitlePreview(); updateIconPreview(); });
  }
});

function handleEditorKeydown(e) {
  const textarea = e.target;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const currentLine = value.substring(lineStart, start);

  if (e.key === 'Tab') {
    e.preventDefault();
    document.execCommand('insertText', false, '    ');
    return;
  }

  if (e.key === 'Enter' && !e.shiftKey) {
    // Detect list continuation
    const listMatch = currentLine.match(/^(\s*)([-*+]|\d+\.)\s/);
    if (listMatch) {
      const indent = listMatch[1];
      const marker = listMatch[2];
      // If current line is empty list item, exit list
      if (currentLine.trim() === marker || currentLine.trim() === marker + ' ') {
        e.preventDefault();
        const newVal = value.substring(0, lineStart) + '\n' + value.substring(end);
        textarea.value = newVal;
        textarea.selectionStart = textarea.selectionEnd = lineStart + 1;
        updatePreview();
        return;
      }
      e.preventDefault();
      let nextMarker;
      if (/^\d+\./.test(marker)) {
        nextMarker = (parseInt(marker) + 1) + '.';
      } else {
        nextMarker = marker;
      }
      const insert = '\n' + indent + nextMarker + ' ';
      document.execCommand('insertText', false, insert);
      updatePreview();
      return;
    }

    // Preserve indentation
    const indentMatch = currentLine.match(/^(\s+)/);
    if (indentMatch) {
      e.preventDefault();
      document.execCommand('insertText', false, '\n' + indentMatch[1]);
      updatePreview();
    }
  }
}

function handleEditorPaste(e) {
  const textarea = e.target;
  const start = textarea.selectionStart;
  const value = textarea.value;
  const lineStart = value.lastIndexOf('\n', start - 1) + 1;
  const currentLine = value.substring(lineStart, start);
  const baseIndent = currentLine.match(/^(\s*)/)?.[1] || '';

  if (baseIndent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text/plain');
    const lines = pasted.split('\n');
    const indented = lines.map((l, i) => i === 0 ? l : baseIndent + l).join('\n');
    document.execCommand('insertText', false, indented);
    updatePreview();
  }
}
