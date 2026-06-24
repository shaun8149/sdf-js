// =============================================================================
// floating-toolbar.js — Atlas Present Sprint 2 selection-positioned ⚡
// -----------------------------------------------------------------------------
// Mounts a floating toolbar that follows browser selection. When user selects
// non-empty text inside a scoped container, ⚡ button appears above the
// selection. Click ⚡ → calls onTrigger(textAnchor) with {startOffset,
// endOffset, text} relative to document.flowingText offsets when rendered
// lines expose data-offset, falling back to container.textContent otherwise.
//
// Spec: docs/superpowers/specs/2026-06-20-atlas-present-sprint-2-napkin-paragraph-design.md §6
// =============================================================================

/**
 * @param {HTMLElement} container — the scope element (e.g. document-view's
 *   text container). Selections outside this element are ignored.
 * @param {Function} onTrigger — called with {startOffset, endOffset, text}
 *   when user clicks ⚡.
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
    if (sel.toString().trim().length === 0) {
      hide();
      return;
    }
    const anchor = computeTextAnchorForRange(container, range);
    if (!anchor) {
      hide();
      return;
    }
    currentAnchor = anchor;
    positionToolbar(range);
    show();
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

/**
 * Convert a DOM Range inside the document viewer back to model offsets.
 *
 * document-view renders document.flowingText as one DIV per newline with a
 * data-offset holding each line's original flowingText start. DOM textContent
 * omits the newline separators between DIVs, so a plain textContent walk stores
 * anchors in the wrong coordinate space for every multi-line document.
 *
 * @param {HTMLElement} rootEl
 * @param {Range} range
 * @returns {{startOffset:number,endOffset:number,text:string}|null}
 */
export function computeTextAnchorForRange(rootEl, range) {
  if (!rootEl || !range) return null;

  const modelText = reconstructModelText(rootEl);
  const startOffset = modelOffsetForDomPoint(rootEl, range.startContainer, range.startOffset);
  const endOffset = modelOffsetForDomPoint(rootEl, range.endContainer, range.endOffset);
  if (!Number.isFinite(startOffset) || !Number.isFinite(endOffset)) return null;
  if (startOffset < 0 || endOffset < startOffset || endOffset > modelText.length) return null;

  return trimAnchor(modelText, startOffset, endOffset);
}

function modelOffsetForDomPoint(rootEl, containerNode, containerOffset) {
  const lineEl = findOffsetLine(rootEl, containerNode);
  if (lineEl) {
    const lineOffset = Number.parseInt(lineEl.dataset.offset, 10);
    const localOffset = textOffsetWithin(lineEl, containerNode, containerOffset);
    if (Number.isFinite(lineOffset) && Number.isFinite(localOffset)) {
      return lineOffset + localOffset;
    }
  }
  return textContentBeforeDomPoint(rootEl, containerNode, containerOffset);
}

function findOffsetLine(rootEl, node) {
  let cur = isTextNode(node) ? node.parentElement || node.parentNode : node;
  while (cur) {
    if (cur.dataset && cur.dataset.offset !== undefined) return cur;
    if (cur === rootEl) return null;
    cur = cur.parentElement || cur.parentNode;
  }
  return null;
}

function textOffsetWithin(rootNode, containerNode, containerOffset) {
  let total = 0;
  let found = false;

  function walk(node) {
    if (!node || found) return;
    if (node === containerNode) {
      total += textLengthBeforeOffset(node, containerOffset);
      found = true;
      return;
    }
    if (isTextNode(node)) {
      total += textLength(node);
      return;
    }
    for (const child of Array.from(node.childNodes || [])) {
      walk(child);
      if (found) return;
    }
  }

  walk(rootNode);
  return found ? total : NaN;
}

function textContentBeforeDomPoint(rootNode, containerNode, containerOffset) {
  let total = 0;
  let found = false;

  function walk(node) {
    if (!node || found) return;
    if (node === containerNode) {
      total += textLengthBeforeOffset(node, containerOffset);
      found = true;
      return;
    }
    if (isTextNode(node)) {
      total += textLength(node);
      return;
    }
    for (const child of Array.from(node.childNodes || [])) {
      walk(child);
      if (found) return;
    }
  }

  walk(rootNode);
  return found ? total : NaN;
}

function textLengthBeforeOffset(node, offset) {
  if (isTextNode(node)) {
    const text = node.textContent || '';
    return text.slice(0, clampOffset(offset, text.length)).length;
  }
  const children = Array.from(node.childNodes || []);
  const limit = clampOffset(offset, children.length);
  let total = 0;
  for (let i = 0; i < limit; i++) total += textLength(children[i]);
  return total;
}

function reconstructModelText(rootEl) {
  const lines =
    typeof rootEl.querySelectorAll === 'function'
      ? Array.from(rootEl.querySelectorAll('[data-offset]'))
          .map((el) => ({
            offset: Number.parseInt(el.dataset.offset, 10),
            text: el.textContent || '',
          }))
          .filter((line) => Number.isFinite(line.offset))
          .sort((a, b) => a.offset - b.offset)
      : [];

  if (lines.length === 0) return rootEl.textContent || '';

  let text = '';
  let cursor = 0;
  for (const line of lines) {
    if (line.offset > cursor) text += '\n'.repeat(line.offset - cursor);
    text += line.text;
    cursor = line.offset + line.text.length;
  }
  return text;
}

function trimAnchor(modelText, startOffset, endOffset) {
  let start = startOffset;
  let end = endOffset;
  while (start < end && /\s/.test(modelText[start])) start++;
  while (end > start && /\s/.test(modelText[end - 1])) end--;
  if (start >= end) return null;
  return {
    startOffset: start,
    endOffset: end,
    text: modelText.slice(start, end),
  };
}

function textLength(node) {
  if (!node) return 0;
  if (isTextNode(node)) return (node.textContent || '').length;
  return Array.from(node.childNodes || []).reduce((sum, child) => sum + textLength(child), 0);
}

function clampOffset(offset, max) {
  if (!Number.isFinite(offset)) return 0;
  return Math.min(Math.max(0, offset), max);
}

function isTextNode(node) {
  return node?.nodeType === 3;
}
