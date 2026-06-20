// =============================================================================
// floating-toolbar.js — Atlas Present Sprint 2 selection-positioned ⚡
// -----------------------------------------------------------------------------
// Mounts a floating toolbar that follows browser selection. When user selects
// non-empty text inside a scoped container, ⚡ button appears above the
// selection. Click ⚡ → calls onTrigger(textAnchor) with {startOffset,
// endOffset, text} relative to the scoped container's text content.
//
// Spec: docs/superpowers/specs/2026-06-20-atlas-present-sprint-2-napkin-paragraph-design.md §6
// =============================================================================

/**
 * @param {HTMLElement} container — the scope element (e.g. document-view's
 *   text container). Selections outside this element are ignored.
 * @param {Function} onTrigger — called with {startOffset, endOffset, text}
 *   when user clicks ⚡. Offsets are relative to container.textContent.
 * @returns {{destroy: Function}}
 */
export function mountFloatingToolbar(container, onTrigger) {
  const toolbar = document.createElement('div');
  toolbar.className = 'floating-toolbar';
  toolbar.style.display = 'none';
  toolbar.innerHTML = `<button class="floating-trigger" type="button">⚡ Generate</button>`;
  document.body.appendChild(toolbar);

  const button = toolbar.querySelector('.floating-trigger');
  let currentAnchor = null;

  function handleSelectionChange() {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      hide();
      return;
    }
    const range = sel.getRangeAt(0);
    if (!container.contains(range.commonAncestorContainer)) {
      hide();
      return;
    }
    const text = sel.toString().trim();
    if (text.length === 0) {
      hide();
      return;
    }
    const anchor = computeAnchor(container, range, text);
    if (!anchor) {
      hide();
      return;
    }
    currentAnchor = anchor;
    positionToolbar(range);
    show();
  }

  function computeAnchor(rootEl, range, selectedText) {
    const containerText = rootEl.textContent || '';
    const preText = textContentBeforeRange(rootEl, range);
    const startOffset = preText.length;
    const endOffset = startOffset + selectedText.length;
    if (startOffset < 0 || endOffset > containerText.length) return null;
    return { startOffset, endOffset, text: selectedText };
  }

  function textContentBeforeRange(rootEl, range) {
    const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, null);
    let text = '';
    while (walker.nextNode()) {
      const node = walker.currentNode;
      if (node === range.startContainer) {
        text += node.textContent.slice(0, range.startOffset);
        break;
      }
      text += node.textContent;
    }
    return text;
  }

  function positionToolbar(range) {
    const rect = range.getBoundingClientRect();
    const tbWidth = 130;
    const tbHeight = 36;
    const top = window.scrollY + rect.top - tbHeight - 8;
    const left = window.scrollX + rect.left + rect.width / 2 - tbWidth / 2;
    toolbar.style.top = `${Math.max(0, top)}px`;
    toolbar.style.left = `${Math.max(8, left)}px`;
  }

  function show() {
    toolbar.style.display = 'block';
  }

  function hide() {
    toolbar.style.display = 'none';
    currentAnchor = null;
  }

  button.addEventListener('mousedown', (e) => {
    // mousedown (not click) prevents losing selection
    e.preventDefault();
  });
  button.addEventListener('click', () => {
    if (currentAnchor) {
      onTrigger(currentAnchor);
      hide();
      window.getSelection()?.removeAllRanges();
    }
  });

  document.addEventListener('selectionchange', handleSelectionChange);

  return {
    destroy() {
      document.removeEventListener('selectionchange', handleSelectionChange);
      toolbar.remove();
    },
  };
}
