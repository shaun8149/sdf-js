// =============================================================================
// Atlas Compositor v0 — M1 Day 2
// -----------------------------------------------------------------------------
// 4-tab UI converging 4 input sources to a shared render canvas.
//
//   text-tab     ─┐  Day 2 ✓ (this commit)
//   generator-tab ─┤  Day 3 pending
//                  ├─→ shared render canvas (silhouette renderer for now)
//   2d-edit-tab  ─┤  M3 pending
//   3d-edit-tab  ─┘  M4 pending
//
// Day 2 ships text-tab functionality: prompt → Anthropic Claude → SDF JS code
// → Blob-URL dynamic import → render.silhouette intercepted → draw to canvas.
// System prompt loaded from ../mvp/system-prompt.md (shared with MVP page).
// =============================================================================

import * as renderModule from '../../src/render/index.js';

const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

// =============================================================================
// Central state
// =============================================================================

const state = {
  activeTab: 'text',
  activeRenderer: 'silhouette',
  activePattern: 'none',
  scene: null,                         // SceneData v1 — set by tabs that emit it
  layers: null,                        // [{ sdf, color }, ...] — set by text-tab (legacy MVP-style)
  lastRenderOpts: null,                // remember view/etc. for re-render on pill switch
  history: [],                         // [{ id, prompt, code, usage, timestamp }, ...] most-recent-first
  selectedHistoryId: null,
};

// =============================================================================
// History storage (localStorage cap 30)
// =============================================================================

const HISTORY_KEY = 'atlas-history';
const HISTORY_CAP = 30;

function loadHistory() {
  try {
    state.history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    state.history = [];
  }
}

function saveHistory() {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history.slice(0, HISTORY_CAP)));
  } catch (e) {
    console.warn('history save failed (localStorage full?)', e);
  }
}

function addHistoryEntry(entry) {
  state.history.unshift({ id: `gen-${Date.now()}`, timestamp: Date.now(), ...entry });
  if (state.history.length > HISTORY_CAP) state.history = state.history.slice(0, HISTORY_CAP);
  saveHistory();
}

function deleteHistoryEntry(id) {
  state.history = state.history.filter(h => h.id !== id);
  saveHistory();
  if (state.selectedHistoryId === id) {
    state.selectedHistoryId = null;
    setCodeDisplay('', '', null);
  }
  renderHistoryList();
}

function clearHistory() {
  if (!confirm('Clear all history?')) return;
  state.history = [];
  state.selectedHistoryId = null;
  saveHistory();
  setCodeDisplay('', '', null);
  renderHistoryList();
}

function formatTime(ts) {
  const now = Date.now();
  const diff = (now - ts) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

// =============================================================================
// Anthropic API call infrastructure
// =============================================================================

const STORAGE_KEY = 'atlas-anthropic-key';
const DEFAULT_MODEL = 'claude-sonnet-4-6';
let SYSTEM_PROMPT = '';

async function loadSystemPrompt() {
  try {
    const res = await fetch('../mvp/system-prompt.md');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    SYSTEM_PROMPT = await res.text();
    return SYSTEM_PROMPT.length;
  } catch (e) {
    setStatus(`✗ system prompt load failed: ${e.message}`, true);
    throw e;
  }
}

async function callLLM(userPrompt, apiKey, model = DEFAULT_MODEL) {
  if (!SYSTEM_PROMPT) {
    await loadSystemPrompt();
  }
  if (!apiKey) throw new Error('Anthropic API key required');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API ${response.status}: ${errText.slice(0, 300)}`);
  }

  const data = await response.json();
  return {
    text: data.content[0].text,
    usage: data.usage,
  };
}

// =============================================================================
// Code execution — Blob URL dynamic import (matches MVP idiom)
// =============================================================================

function stripMarkdownFence(text) {
  // Strip ```javascript or ```js ... ``` markdown code fences
  const fenceMatch = text.match(/```(?:javascript|js)?\n([\s\S]*?)\n```/);
  return fenceMatch ? fenceMatch[1] : text;
}

function rewriteImports(code, baseUrl) {
  // Convert relative imports to absolute URLs so Blob URL can resolve them
  return code.replace(
    /(\bfrom\s+|^import\s*\(?\s*)['"](\.[^'"]*)['"]/gm,
    (match, prefix, relPath) => {
      const absUrl = new URL(relPath, baseUrl).href;
      return `${prefix}'${absUrl}'`;
    },
  );
}

function rewriteRenderCalls(code) {
  // Intercept render.silhouette(ctx, layers, opts) calls and route to our
  // dispatcher. Compositor renderer-pill state then picks the actual renderer.
  return code.replace(/\brender\.silhouette\s*\(/g, 'window.__atlasRenderDispatch(');
}

async function executeGeneratedCode(rawCode) {
  const code = stripMarkdownFence(rawCode);
  const baseUrl = window.location.href;
  const rewritten = rewriteRenderCalls(rewriteImports(code, baseUrl));

  // Provide ctx as a module-level global the generated code can use
  const blob = new Blob([rewritten], { type: 'application/javascript' });
  const url = URL.createObjectURL(blob);
  try {
    await import(/* @vite-ignore */ url);
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 5000);  // allow async finishing
  }
}

// =============================================================================
// Render dispatcher — called by generated code via window.__atlasRenderDispatch
// =============================================================================

window.__atlasRenderDispatch = function (ctx, layers, opts = {}) {
  // Generated code typically passes its own ctx; we override to use compositor canvas
  const cv = $('c');
  const realCtx = cv.getContext('2d');

  // Normalize layers to {sdf, color} objects
  state.layers = layers;
  state.lastRenderOpts = opts;

  doRender(realCtx, layers, opts);
};

function doRender(ctx, layers, opts) {
  // Clear canvas first
  ctx.fillStyle = '#f4efdc';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // Dispatch by activeRenderer
  try {
    const fn = renderModule[state.activeRenderer === 'bob-gpu' ? 'silhouette' : state.activeRenderer];
    if (fn) {
      fn(ctx, layers, opts);
    } else {
      // Fallback: silhouette
      renderModule.silhouette(ctx, layers, opts);
    }
  } catch (e) {
    setStatus(`✗ render error: ${e.message}`, true);
    console.error(e);
    drawErrorOverlay(ctx, `render error: ${e.message}`);
  }

  updateSceneInfo();
}

function drawErrorOverlay(ctx, msg) {
  const w = ctx.canvas.width, h = ctx.canvas.height;
  ctx.fillStyle = 'rgba(58, 31, 31, 0.92)';
  ctx.fillRect(40, h / 2 - 50, w - 80, 100);
  ctx.fillStyle = '#d9afaf';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '600 18px ui-monospace, monospace';
  ctx.fillText('Render Error', w / 2, h / 2 - 14);
  ctx.font = '12px ui-monospace, monospace';
  // Wrap long messages
  const maxChars = 80;
  const truncated = msg.length > maxChars ? msg.slice(0, maxChars - 3) + '...' : msg;
  ctx.fillText(truncated, w / 2, h / 2 + 14);
}

// Re-render with stored layers (called when renderer/pattern pill switches)
function reRenderStored() {
  if (state.layers) {
    const ctx = $('c').getContext('2d');
    doRender(ctx, state.layers, state.lastRenderOpts || {});
  } else {
    drawPlaceholder();
  }
}

// =============================================================================
// Tab content registry
// =============================================================================

const TAB_CONTENT = {
  'text': () => `
    <h2>Text → SDF</h2>
    <p>Type a scene description → Anthropic Claude writes sdf-js code → render via shared renderer pool. Full code shows in the panel below the canvas.</p>

    <h3>Anthropic API key</h3>
    <input id="api-key" type="password" placeholder="sk-ant-..." spellcheck="false"
           style="width:100%; padding:6px 8px; background:#0d0d0d; color:#aaa;
                  border:1px solid #3a3a3a; border-radius:3px;
                  font-family:ui-monospace, monospace; font-size:11px;">
    <p style="font-size:10px; color:#666;">Saved to localStorage; sent direct to api.anthropic.com (browser CORS via <code>anthropic-dangerous-direct-browser-access</code>). Your key never touches Atlas servers.</p>

    <h3>Prompt</h3>
    <textarea id="prompt-input" rows="4" placeholder="e.g. a tall wine bottle on a wooden table"
              style="width:100%; padding:8px; background:#0d0d0d; color:#ddd;
                     border:1px solid #3a3a3a; border-radius:3px;
                     font-family:inherit; font-size:12px; resize:vertical;"></textarea>

    <button id="btn-generate" class="primary-btn" style="
      padding: 8px 14px; background: #ffd070; color: #1a1a1a;
      border: none; border-radius: 3px; cursor: pointer;
      font-size: 13px; font-weight: 600; margin-top: 6px;">
      ✨ Generate
    </button>

    <p id="usage-info" style="font-size:10px; color:#666; margin-top:4px;"></p>

    <h3>History
      <button class="history-clear" id="btn-clear-history">clear all</button>
    </h3>
    <div id="history-list"></div>
  `,

  'generator': () => `
    <h2>Generator → SDF</h2>
    <p>Pick a generator template + hash → SceneData → render. Same hash always produces the same scene (URL-shareable, no token cost for variants).</p>
    <div class="placeholder">
      <b>M1 Day 3 coming:</b> absorb autoscope-clone hash flow into this tab. M2 will generalize to a Generator framework.
    </div>
    <p>Until Day 3 ships, use the standalone <a href="../sdf/autoscope-clone.html" style="color: #ffd070;">autoscope-clone page</a>.</p>
  `,

  '2d-edit': () => `
    <h2>2D Editor</h2>
    <p>Mini-DSL script editor + (later) node graph view, both editing the same SceneData.</p>
    <div class="placeholder">
      <b>M3 (2 weeks):</b> Mini-DSL parser (Python sdf compatible syntax with <code>|=</code> / <code>&=</code> / <code>-=</code>) + Monaco editor + live silhouette preview.
      <br><br>
      <b>M3.5 (2-3 weeks):</b> node graph view with AST↔script dual-sync.
    </div>
  `,

  '3d-edit': () => `
    <h2>3D Editor</h2>
    <p>three.js viewport + transform gizmos + 3D primitive panel → SceneData output.</p>
    <div class="placeholder">
      <b>M4 (3-4 weeks):</b> viewport-based 3D scene editor. Drag primitives in, gizmo-transform them, output SceneData consumed by the same renderer pool.
    </div>
  `,
};

function renderActiveTab() {
  $('tab-content').innerHTML = TAB_CONTENT[state.activeTab]();
  $('tab-content').dataset.activeTab = state.activeTab;

  if (state.activeTab === 'text') {
    wireTextTab();
  }
}

// =============================================================================
// text-tab wire-up
// =============================================================================

function wireTextTab() {
  const apiKeyInput = $('api-key');
  const promptInput = $('prompt-input');
  const usageInfo = $('usage-info');

  // Restore API key from localStorage
  apiKeyInput.value = localStorage.getItem(STORAGE_KEY) || '';
  apiKeyInput.addEventListener('change', () => {
    localStorage.setItem(STORAGE_KEY, apiKeyInput.value.trim());
  });

  $('btn-generate').addEventListener('click', async () => {
    const userPrompt = promptInput.value.trim();
    if (!userPrompt) {
      setStatus('✗ enter a prompt first', true);
      return;
    }
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      setStatus('✗ Anthropic API key required', true);
      apiKeyInput.focus();
      return;
    }
    localStorage.setItem(STORAGE_KEY, apiKey);

    setStatus('⋯ calling Anthropic Claude…');
    try {
      const t0 = performance.now();
      const result = await callLLM(userPrompt, apiKey);
      const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
      const usageStr = `↑ ${result.usage.input_tokens} in · ↓ ${result.usage.output_tokens} out · ${elapsed}s`;

      usageInfo.textContent = `${usageStr} · model=${DEFAULT_MODEL}`;

      // Save to history + select it + show in code panel
      addHistoryEntry({ prompt: userPrompt, code: result.text, usage: result.usage, elapsed });
      const newest = state.history[0];
      state.selectedHistoryId = newest.id;
      setCodeDisplay(result.text, userPrompt, usageStr);
      renderHistoryList();

      setStatus('⋯ executing generated code…');
      try {
        await executeGeneratedCode(result.text);
        setStatus(`✓ rendered in ${elapsed}s`);
      } catch (execErr) {
        setStatus(`✗ exec error: ${execErr.message}`, true);
        console.error(execErr);
        const ctx = $('c').getContext('2d');
        ctx.fillStyle = '#f4efdc';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        drawErrorOverlay(ctx, `exec error: ${execErr.message}`);
      }
    } catch (e) {
      setStatus(`✗ ${e.message}`, true);
      console.error(e);
    }
  });

  // Ctrl/Cmd+Enter shortcut for generate
  promptInput.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      $('btn-generate').click();
    }
  });

  $('btn-clear-history').addEventListener('click', clearHistory);

  renderHistoryList();
}

// =============================================================================
// History list rendering + click-to-load
// =============================================================================

function renderHistoryList() {
  const list = $('history-list');
  if (!list) return;
  if (state.history.length === 0) {
    list.innerHTML = `<div class="history-empty">No generations yet. Try a prompt!</div>`;
    return;
  }
  list.innerHTML = state.history.map(h => `
    <div class="history-item ${h.id === state.selectedHistoryId ? 'active' : ''}" data-id="${h.id}">
      <span class="history-prompt">${escapeHtml(h.prompt)}</span>
      <span class="history-time">${formatTime(h.timestamp)}</span>
      <button class="history-del" data-id="${h.id}" title="Delete">×</button>
    </div>
  `).join('');

  list.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', e => {
      if (e.target.classList.contains('history-del')) return;  // delegated below
      loadHistoryEntry(item.dataset.id);
    });
  });
  list.querySelectorAll('.history-del').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      deleteHistoryEntry(btn.dataset.id);
    });
  });
}

async function loadHistoryEntry(id) {
  const entry = state.history.find(h => h.id === id);
  if (!entry) return;
  state.selectedHistoryId = id;
  const usageStr = entry.usage
    ? `↑ ${entry.usage.input_tokens} in · ↓ ${entry.usage.output_tokens} out · ${entry.elapsed}s`
    : null;
  setCodeDisplay(entry.code, entry.prompt, usageStr);
  renderHistoryList();
  setStatus('⋯ re-executing history entry…');
  try {
    await executeGeneratedCode(entry.code);
    setStatus(`✓ replayed: ${entry.prompt.slice(0, 40)}`);
  } catch (e) {
    setStatus(`✗ replay error: ${e.message}`, true);
    const ctx = $('c').getContext('2d');
    ctx.fillStyle = '#f4efdc';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    drawErrorOverlay(ctx, `replay error: ${e.message}`);
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

// =============================================================================
// Code display (second screen) + copy / re-run buttons
// =============================================================================

function setCodeDisplay(code, prompt, meta) {
  $('code-display').value = code || '';
  $('selected-prompt').textContent = prompt ? `"${prompt}"` : '';
  $('code-meta').textContent = meta || '';
}

// (copy/rerender buttons wired in init below)

// =============================================================================
// Tab switching + pill controls
// =============================================================================

$$('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.classList.contains('stub')) return;
    const tab = btn.dataset.tab;
    state.activeTab = tab;
    $$('.tab').forEach(b => b.classList.toggle('active', b === btn));
    renderActiveTab();
    setStatus(`tab → ${tab}`);
  });
});

$$('#renderer-pills .pill').forEach(btn => {
  btn.addEventListener('click', () => {
    state.activeRenderer = btn.dataset.renderer;
    $$('#renderer-pills .pill').forEach(b => b.classList.toggle('active', b === btn));
    reRenderStored();
    setStatus(`renderer → ${state.activeRenderer}`);
  });
});

$$('#pattern-pills .pill').forEach(btn => {
  btn.addEventListener('click', () => {
    state.activePattern = btn.dataset.pattern;
    $$('#pattern-pills .pill').forEach(b => b.classList.toggle('active', b === btn));
    // pattern rendering Day 4 work; just visual toggle for now
    setStatus(`pattern → ${state.activePattern} (rendering pending Day 4)`);
  });
});

// =============================================================================
// Placeholder canvas (when no scene loaded)
// =============================================================================

function drawPlaceholder() {
  const canvas = $('c');
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;

  ctx.fillStyle = '#f4efdc';
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#1a1a1a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '600 28px -apple-system, system-ui, sans-serif';
  ctx.fillText('Atlas Compositor', w / 2, h / 2 - 50);

  ctx.fillStyle = '#888';
  ctx.font = '13px ui-monospace, monospace';
  ctx.fillText('M1 Day 2 · text-tab functional', w / 2, h / 2 - 20);
  ctx.fillText('type a prompt → ✨ Generate', w / 2, h / 2 + 8);

  ctx.fillStyle = '#bbb';
  ctx.font = '12px -apple-system, system-ui, sans-serif';
  const lines = [
    'Day 3 → generator-tab absorbs autoscope-clone',
    'Day 4 → renderer pills functional (5 paths)',
    'Day 5 → 2D/3D edit stubs + URL routing',
  ];
  lines.forEach((line, i) => ctx.fillText(line, w / 2, h / 2 + 44 + i * 22));

  // Brand corner accents
  ctx.strokeStyle = '#ffd070';
  ctx.lineWidth = 2;
  const c = 28;
  ctx.beginPath();
  ctx.moveTo(20, 20 + c); ctx.lineTo(20, 20); ctx.lineTo(20 + c, 20);
  ctx.moveTo(w - 20 - c, 20); ctx.lineTo(w - 20, 20); ctx.lineTo(w - 20, 20 + c);
  ctx.moveTo(w - 20, h - 20 - c); ctx.lineTo(w - 20, h - 20); ctx.lineTo(w - 20 - c, h - 20);
  ctx.moveTo(20 + c, h - 20); ctx.lineTo(20, h - 20); ctx.lineTo(20, h - 20 - c);
  ctx.stroke();
}

// =============================================================================
// Status / scene info
// =============================================================================

let statusTimer = null;
function setStatus(msg, isError = false) {
  const el = $('status');
  el.textContent = msg;
  el.className = isError ? 'err' : '';
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { el.textContent = 'ready'; el.className = ''; }, 4000);
}

function updateSceneInfo() {
  if (state.scene) {
    const n = state.scene.subjects?.length ?? 0;
    $('scene-info').textContent = `${state.scene.name ?? 'scene'} · ${n} subjects`;
  } else if (state.layers) {
    $('scene-info').textContent = `${state.layers.length} layer${state.layers.length === 1 ? '' : 's'}`;
  } else {
    $('scene-info').textContent = 'No scene';
  }
}

// =============================================================================
// Init
// =============================================================================

loadHistory();
renderActiveTab();
drawPlaceholder();
updateSceneInfo();

// Wire code-screen elements (they exist on initial page load, before any tab content renders)
$('btn-copy-code')?.addEventListener('click', () => {
  const code = $('code-display').value;
  if (!code) { setStatus('no code to copy', true); return; }
  navigator.clipboard.writeText(code).then(
    () => setStatus('✓ code copied'),
    () => setStatus('✗ clipboard failed', true),
  );
});

async function runCurrentCode() {
  const code = $('code-display').value;
  if (!code) { setStatus('no code to re-run', true); return; }
  setStatus('⋯ executing edited code…');
  try {
    await executeGeneratedCode(code);
    setStatus('✓ rendered');
  } catch (e) {
    setStatus(`✗ ${e.message}`, true);
    const ctx = $('c').getContext('2d');
    ctx.fillStyle = '#f4efdc';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    drawErrorOverlay(ctx, `exec error: ${e.message}`);
  }
}

$('btn-rerender')?.addEventListener('click', runCurrentCode);

// Ctrl/Cmd+Enter inside code-display textarea = re-execute current code (matches MVP behavior)
$('code-display')?.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    runCurrentCode();
  }
});

loadSystemPrompt().then(n => setStatus(`✓ system prompt loaded (${n} chars)`));
