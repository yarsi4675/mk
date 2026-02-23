// ===== DRAG-DROP.JS - Menu item drag and drop =====

let dragSrcId = null;
let dragOverId = null;

function initDragDrop() {
  const tree = document.getElementById('menuTree');
  if (!tree) return;

  tree.addEventListener('dragstart', e => {
    const row = e.target.closest('.menu-item-row');
    if (!row) return;
    dragSrcId = parseInt(row.dataset.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragSrcId);
    row.style.opacity = '0.5';
  });

  tree.addEventListener('dragend', e => {
    const row = e.target.closest('.menu-item-row');
    if (row) row.style.opacity = '';
    // Remove all drag-over highlights
    tree.querySelectorAll('.menu-drag-over').forEach(el => el.classList.remove('menu-drag-over'));
    dragSrcId = null;
    dragOverId = null;
  });

  tree.addEventListener('dragover', e => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const row = e.target.closest('.menu-item-row');
    if (row && parseInt(row.dataset.id) !== dragSrcId) {
      tree.querySelectorAll('.menu-drag-over').forEach(el => el.classList.remove('menu-drag-over'));
      row.classList.add('menu-drag-over');
      dragOverId = parseInt(row.dataset.id);
    }
  });

  tree.addEventListener('dragleave', e => {
    const row = e.target.closest('.menu-item-row');
    if (row) row.classList.remove('menu-drag-over');
  });

  tree.addEventListener('drop', async e => {
    e.preventDefault();
    const row = e.target.closest('.menu-item-row');
    if (row) row.classList.remove('menu-drag-over');

    if (dragSrcId === null || dragOverId === null || dragSrcId === dragOverId) return;

    // Move dragSrc to be a sibling after dragOver, or child if dropped on item
    const flatItems = flatMenuItems(State.menuItems);
    const srcItem = flatItems.find(i => i.id === dragSrcId);
    const targetItem = flatItems.find(i => i.id === dragOverId);

    if (!srcItem || !targetItem) return;

    // Check if we're dropping on own child (prevent circular)
    if (isAncestor(dragSrcId, dragOverId)) return;

    // Update: make src a sibling of target (same parent, order after target)
    const newParentId = targetItem.parent_id;
    const newOrder = (targetItem.order || 0) + 1;

    const resp = await apiFetch(`/api/menu/${dragSrcId}`, {
      method: 'PUT',
      json: { parent_id: newParentId, order: newOrder },
    });

    if (resp && resp.ok) {
      await loadMenu();
    }
  });
}

function isAncestor(ancestorId, descendantId) {
  const flat = flatMenuItems(State.menuItems);
  let current = flat.find(i => i.id === descendantId);
  while (current && current.parent_id) {
    if (current.parent_id === ancestorId) return true;
    current = flat.find(i => i.id === current.parent_id);
  }
  return false;
}

// Re-initialize drag-drop after every menu render
const origRenderMenu = window.renderMenu;
document.addEventListener('DOMContentLoaded', () => {
  // Initialize drag-drop
  setTimeout(initDragDrop, 500);

  // Re-init after menu loads
  const origLoad = window.loadMenu;
  if (origLoad) {
    window.loadMenu = async function(...args) {
      await origLoad.apply(this, args);
      initDragDrop();
    };
  }
});
