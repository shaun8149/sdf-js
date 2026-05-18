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
import { generateSceneData, randomSceneTypeData, SCENE_NAMES_DATA } from '../sdf/autoscope-scenes-data.js';
import { compile as compileSceneData } from '../../src/scene/index.js';
import { Random, generateHash, readHashFromURL, writeHashToURL, isValidHash } from '../sdf/autoscope-rng.js';
import { createBobShaderRenderer } from '../../src/render/bobShader.js';
import { createFly3DRenderer } from '../../src/render/flyLambert.js';
import { union as sdfUnion } from '../../src/sdf/dn.js';

const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

// =============================================================================
// Central state
// =============================================================================

const state = {
  activeTab: 'scenes',
  activeRenderer: 'silhouette',
  scene: null,                         // SceneData v1 — set by tabs that emit it (generator-tab)
  layers: null,                        // [{ sdf, color }, ...] — set by text-tab (legacy MVP-style)
  lastRenderOpts: null,                // remember view/etc. for re-render on pill switch
  history: [],                         // [{ id, prompt, code, usage, timestamp }, ...] most-recent-first
  selectedHistoryId: null,
  // generator-tab state
  genHash: null,                       // current hash hex string
  genSceneTypeChoice: 'random',        // 'random' | '0'..'5'
  bobRenderer: null,                   // lazy createBobShaderRenderer instance — stylized autoscope-style
  fly3dRenderer: null,                 // lazy createFly3DRenderer instance — clean Lambert + WASD fly
  genScene: null,                      // generator-tab compiled scene
  genSdf: null,                        // generator-tab final SDF (subjects ∪ ground)
  // text-tab lift state
  textLiftScene: null,                 // compiled SceneData from 3D lift
  textLiftSdf: null,                   // text-tab lift final SDF
  textLiftSceneJSON: null,             // raw SceneData JSON (for the 3D code pane + export)
  textLiftSourcePrompt: null,          // original prompt that was lifted
  liftMode: false,                     // true when text-tab showing 3D lift (canvas swap)
};

const GPU_RENDERERS = new Set(['fly3d', 'bob-gpu']);
const isGpuRenderer = (name) => GPU_RENDERERS.has(name);

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
// Scenes browser — bundled Demos (read-only) + user's Saved Scenes (localStorage)
// =============================================================================

let DEMO_MANIFEST = null;
let activeDemoId = null;      // currently-loaded bundled-demo id, if any
let activeSavedId = null;     // currently-loaded saved-scene id, if any

const SAVED_SCENES_KEY = 'atlas-saved-scenes';
const SAVED_SCENES_CAP = 50;

function loadSavedScenes() {
  try {
    return JSON.parse(localStorage.getItem(SAVED_SCENES_KEY) || '[]');
  } catch { return []; }
}

function persistSavedScenes(arr) {
  try {
    localStorage.setItem(SAVED_SCENES_KEY, JSON.stringify(arr.slice(0, SAVED_SCENES_CAP)));
  } catch (e) {
    console.warn('saved-scenes persist failed (localStorage full?)', e);
  }
}

function saveCurrentScene() {
  if (!state.liftMode || !state.textLiftSceneJSON) {
    setStatus('✗ no active 3D scene to save', true);
    return;
  }
  const prompt = state.textLiftSourcePrompt || '';
  const defaultName = (prompt || 'untitled').slice(0, 40);
  const name = window.prompt('Save scene as:', defaultName);
  if (!name) return;
  const code2d = $('code-display').value || '';
  const sceneJSON = $('scene-display').value || JSON.stringify(state.textLiftSceneJSON);

  const id = `scn-${Date.now()}`;
  const entry = {
    id,
    name: name.trim().slice(0, 80),
    prompt,
    code2d,
    sceneData: JSON.parse(sceneJSON),
    savedAt: Date.now(),
  };
  const all = loadSavedScenes();
  all.unshift(entry);
  persistSavedScenes(all);
  activeSavedId = id;
  activeDemoId = null;
  renderDemoGallery();
  renderScenesPopover();
  setStatus(`✓ saved "${entry.name}"`);
}

function deleteSavedScene(id) {
  if (!confirm('Delete this saved scene?')) return;
  const all = loadSavedScenes().filter(s => s.id !== id);
  persistSavedScenes(all);
  if (activeSavedId === id) {
    activeSavedId = null;
    if (state.liftMode) exitLiftMode();
  }
  renderDemoGallery();
  renderScenesPopover();
}

function downloadSavedScene(id) {
  const entry = loadSavedScenes().find(s => s.id === id);
  if (!entry) return;
  const slug = entry.name.toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40) || 'untitled';
  const blob = new Blob([JSON.stringify(entry, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${slug}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setStatus(`↓ downloaded "${entry.name}"`);
}

// ----- URL-encoded shareable scene (no backend) -----
// Pack the entire scene record into a base64url chunk in the URL hash so the
// link is fully self-contained — paste anywhere, opens to that scene.
// 30KB SceneData ≈ 40KB encoded; well within modern URL limits (Chrome ~100KB).
function encodeSceneForUrl(entry) {
  const json = JSON.stringify({
    name: entry.name,
    prompt: entry.prompt,
    code2d: entry.code2d,
    sceneData: entry.sceneData,
    savedAt: entry.savedAt,
  });
  const utf8 = new TextEncoder().encode(json);
  let binary = '';
  for (let i = 0; i < utf8.length; i++) binary += String.fromCharCode(utf8[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeSceneFromUrl(s) {
  let padded = s.replace(/-/g, '+').replace(/_/g, '/');
  while (padded.length % 4) padded += '=';
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return JSON.parse(new TextDecoder().decode(bytes));
}

function buildShareUrl(entry) {
  const encoded = encodeSceneForUrl(entry);
  const base = window.location.href.split('#')[0];
  return `${base}#scene=${encoded}`;
}

function shareSavedScene(id) {
  const entry = loadSavedScenes().find(s => s.id === id);
  if (!entry) return;
  const url = buildShareUrl(entry);
  navigator.clipboard.writeText(url).then(
    () => setStatus(`✓ shareable URL copied (${(url.length / 1024).toFixed(1)} KB) — paste anywhere`),
    () => {
      // Clipboard might be blocked — fall back to prompt for manual copy
      window.prompt('Copy this URL:', url);
    },
  );
}

// Pending shared-scene reference: when a #scene= URL loads, we hold the decoded
// scene here until the user dismisses or saves it. Lets us offer "Save to library?"
// without auto-polluting their localStorage.
let pendingSharedScene = null;

function checkSharedSceneInUrl() {
  const m = window.location.hash.match(/^#scene=(.+)$/);
  if (!m) return;
  let scene;
  try {
    scene = decodeSceneFromUrl(m[1]);
  } catch (e) {
    console.error('shared-scene decode failed:', e);
    setStatus('✗ shared scene URL is malformed', true);
    return;
  }
  pendingSharedScene = {
    id: `shared-${Date.now()}`,
    name: scene.name || 'Shared scene',
    prompt: scene.prompt || '',
    code2d: scene.code2d || '',
    sceneData: scene.sceneData,
    savedAt: scene.savedAt || Date.now(),
  };
  try {
    renderLiftedSceneData(
      pendingSharedScene.sceneData,
      pendingSharedScene.prompt || pendingSharedScene.name,
      `🔗 shared scene · "${escapeHtml(pendingSharedScene.name)}"`,
    );
    setCodeDisplay(
      pendingSharedScene.code2d,
      pendingSharedScene.prompt || pendingSharedScene.name,
      `shared · "${pendingSharedScene.name}"`,
      pendingSharedScene.sceneData,
    );
    $('shared-banner').classList.add('open');
    setStatus(`✓ shared scene loaded — save to add to your library`);
  } catch (e) {
    setStatus(`✗ shared scene render failed: ${e.message}`, true);
    console.error(e);
    pendingSharedScene = null;
  }
}

function saveSharedScene() {
  if (!pendingSharedScene) return;
  const defaultName = pendingSharedScene.name || pendingSharedScene.prompt || 'Shared scene';
  const name = window.prompt('Save as:', defaultName);
  if (!name) return;
  const entry = { ...pendingSharedScene, id: `scn-${Date.now()}`, name: name.trim() };
  const all = loadSavedScenes();
  all.unshift(entry);
  persistSavedScenes(all);
  activeSavedId = entry.id;
  pendingSharedScene = null;
  $('shared-banner').classList.remove('open');
  renderDemoGallery();
  renderScenesPopover();
  setStatus(`✓ saved "${entry.name}" to your library`);
}

function dismissSharedBanner() {
  pendingSharedScene = null;
  $('shared-banner').classList.remove('open');
}

// Back-compat shim — older code calls renderScenesPopover; route to the tab grids.
function renderScenesPopover() { renderScenesTab(); }

function loadSavedSceneById(id) {
  const entry = loadSavedScenes().find(s => s.id === id);
  if (!entry) { setStatus('✗ saved scene not found', true); return; }
  setStatus(`⋯ loading saved: ${entry.name}`);
  try {
    state.selectedHistoryId = null;
    activeDemoId = null;
    activeSavedId = id;
    renderHistoryList();
    renderLiftedSceneData(
      entry.sceneData,
      entry.prompt || entry.name,
      `▶ saved scene · "${escapeHtml(entry.name)}"`,
    );
    // Also populate the 2D code pane so user sees both panels
    setCodeDisplay(entry.code2d || '', entry.prompt || entry.name, `saved · "${entry.name}"`, entry.sceneData);
    renderDemoGallery();
    setStatus(`✓ loaded saved: ${entry.name} — click canvas to fly`);
  } catch (e) {
    setStatus(`✗ load failed: ${e.message}`, true);
    console.error(e);
  }
}

async function loadDemoManifest() {
  try {
    const res = await fetch('./demo-lifts/index.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    DEMO_MANIFEST = await res.json();
  } catch (e) {
    console.warn('demo manifest load failed:', e);
    DEMO_MANIFEST = { demos: [] };
  }
}

function renderScenesTab() {
  const bundledEl = $('scenes-bundled-grid');
  const savedEl = $('scenes-saved-grid');
  if (!bundledEl || !savedEl) return;

  const bundled = DEMO_MANIFEST?.demos ?? [];
  const saved = loadSavedScenes();

  $('scenes-bundled-count').textContent = bundled.length;
  $('scenes-saved-count').textContent = saved.length;

  // Bundled cards
  bundledEl.innerHTML = bundled.length === 0
    ? `<div class="scenes-empty" style="grid-column: 1 / -1;">No bundled scenes available.</div>`
    : bundled.map(d => `
        <div class="scene-card-big ${d.status} ${d.id === activeDemoId ? 'active' : ''}" data-bundled="${d.id}">
          <div class="scene-emoji">${sceneEmoji(d)}</div>
          <div class="scene-footer">
            <div class="scene-title">${escapeHtml(d.title)}</div>
            <div class="scene-sub">${escapeHtml(d.thesisPoint || '')}</div>
          </div>
        </div>
      `).join('');

  // Saved cards
  savedEl.innerHTML = saved.length === 0
    ? `<div class="scenes-empty" style="grid-column: 1 / -1;">No saved scenes yet.<br>Lift a 2D prompt to 3D in the Text tab, then click ✨ Save Scene.</div>`
    : saved.map(s => `
        <div class="scene-card-big saved ${s.id === activeSavedId ? 'active' : ''}" data-saved="${s.id}">
          <div class="scene-emoji">${sceneEmoji(s)}</div>
          <div class="scene-actions">
            <button class="scene-act-btn" data-act="share" data-id="${s.id}" title="Copy shareable URL">🔗</button>
            <button class="scene-act-btn" data-act="download" data-id="${s.id}" title="Download JSON">↓</button>
            <button class="scene-act-btn" data-act="delete" data-id="${s.id}" title="Delete">×</button>
          </div>
          <div class="scene-footer">
            <div class="scene-title">${escapeHtml(s.name)}</div>
            <div class="scene-sub">${formatTime(s.savedAt)} · ${escapeHtml(s.prompt?.slice(0, 28) || '')}</div>
          </div>
        </div>
      `).join('');

  // Wire bundled clicks
  bundledEl.querySelectorAll('.scene-card-big[data-bundled]').forEach(card => {
    card.addEventListener('click', () => {
      const demo = bundled.find(x => x.id === card.dataset.bundled);
      if (!demo) return;
      if (demo.status === 'ready') {
        loadDemoScene(demo);
        switchToTab('text');
      } else {
        autofillDemoPrompt(demo);
        switchToTab('text');
      }
    });
  });

  // Wire saved clicks
  savedEl.querySelectorAll('.scene-card-big[data-saved]').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.scene-act-btn')) return;
      loadSavedSceneById(card.dataset.saved);
      switchToTab('text');
    });
  });
  savedEl.querySelectorAll('.scene-act-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (btn.dataset.act === 'share') shareSavedScene(id);
      else if (btn.dataset.act === 'download') downloadSavedScene(id);
      else if (btn.dataset.act === 'delete') deleteSavedScene(id);
    });
  });

  // Hero CTA: jump to Text tab
  const cta = $('scenes-cta-text');
  if (cta) cta.addEventListener('click', () => switchToTab('text'));
}

// Back-compat shim: code in many places still calls renderDemoGallery().
// Route them all to renderScenesTab now that the grids live in the Scenes tab.
function renderDemoGallery() { renderScenesTab(); }

function switchToTab(tabName) {
  const btn = document.querySelector(`.tab[data-tab="${tabName}"]`);
  if (btn && !btn.classList.contains('stub') && !btn.classList.contains('active')) {
    btn.click();
  }
}

async function loadDemoScene(demo) {
  setStatus(`⋯ loading demo: ${demo.title}`);
  try {
    const res = await fetch(`./demo-lifts/${demo.file}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    let compiled;
    try {
      compiled = compileSceneData(data.sceneData);
    } catch (e) {
      throw new Error(`compile failed: ${e.message}`);
    }

    const renderSdf = (compiled.groundSdf && compiled.sdf)
      ? sdfUnion(compiled.sdf, compiled.groundSdf)
      : (compiled.sdf || compiled.groundSdf);
    if (!renderSdf) throw new Error('empty SDF');

    state.textLiftScene = compiled;
    state.textLiftSdf = renderSdf;
    state.textLiftSourcePrompt = data.prompt;
    state.liftMode = true;
    state.selectedHistoryId = null;
    activeDemoId = demo.id;
    gpuSceneStartTime = performance.now();
    userTookCam = false;

    ensureGpuRendererActive();
    refreshLiftButtonState();
    renderDemoGallery();
    renderHistoryList();
    const { bytes } = updateCanvasVisibility();

    setCodeDisplay(data.code2d || '', data.prompt, `demo · pre-lifted · ${(bytes / 1024).toFixed(1)} KB GLSL`, data.sceneData || null);
    $('scene-info').textContent = `demo · ${data.title}`;
    if ($('lift-info')) {
      $('lift-info').innerHTML = `demo loaded · click canvas to fly (WASD + mouse)`;
    }
    setStatus(`✓ demo loaded: ${demo.title} — click canvas to fly`);
  } catch (e) {
    setStatus(`✗ demo load failed: ${e.message}`, true);
    console.error(e);
  }
}

function autofillDemoPrompt(demo) {
  const promptInput = $('prompt-input');
  if (!promptInput) return;
  promptInput.value = demo.prompt || `(see demo-lifts/prompts.md for "${demo.title}")`;
  promptInput.focus();
  promptInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setStatus(`✎ prompt autofilled: ${demo.title} — add API key and ✨ Generate`);
}

// =============================================================================
// Anthropic API call infrastructure
// =============================================================================

const STORAGE_KEY = 'atlas-anthropic-key';
const DEFAULT_MODEL = 'claude-sonnet-4-6';
let SYSTEM_PROMPT = '';
let SYSTEM_PROMPT_LIFT = '';

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

async function loadLiftSystemPrompt() {
  try {
    const res = await fetch('./system-prompt-lift-3d.md');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    SYSTEM_PROMPT_LIFT = await res.text();
    return SYSTEM_PROMPT_LIFT.length;
  } catch (e) {
    console.warn(`Lift system prompt load failed: ${e.message}`);
    return 0;
  }
}

/**
 * Resolve which compiled scene + sdf the BOB GPU renderer should display
 * given the current tab + lift state. Used by camera loop and renderer
 * controls so both text-tab lift mode and generator-tab share the same
 * BOB GPU canvas without state leakage.
 */
function getActiveGpuScene() {
  if (state.activeTab === 'text' && state.liftMode) {
    return { scene: state.textLiftScene, sdf: state.textLiftSdf };
  }
  if (state.activeTab === 'generator') {
    return { scene: state.genScene, sdf: state.genSdf };
  }
  return { scene: null, sdf: null };
}

async function callLiftLLM(originalPrompt, code2d, apiKey, model = DEFAULT_MODEL) {
  if (!SYSTEM_PROMPT_LIFT) {
    await loadLiftSystemPrompt();
  }
  if (!SYSTEM_PROMPT_LIFT) throw new Error('Lift system prompt not loaded');
  if (!apiKey) throw new Error('Anthropic API key required');

  const userMessage = `## Original user prompt\n\n${originalPrompt}\n\n## 2D SDF code\n\n\`\`\`js\n${code2d}\n\`\`\``;

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
      system: SYSTEM_PROMPT_LIFT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API ${response.status}: ${errText.slice(0, 300)}`);
  }

  const data = await response.json();
  return { text: data.content[0].text, usage: data.usage };
}

function parseLiftResponse(text) {
  // LLM may wrap JSON in ```json ... ``` fence, or emit prose around it.
  const fenceMatch = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  let jsonStr = fenceMatch ? fenceMatch[1] : text.trim();

  // If no fence, try to find the first { and matching } at end
  if (!fenceMatch && !jsonStr.startsWith('{')) {
    const firstBrace = jsonStr.indexOf('{');
    const lastBrace = jsonStr.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      jsonStr = jsonStr.slice(firstBrace, lastBrace + 1);
    }
  }

  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    throw new Error(`Failed to parse lift JSON: ${e.message}\n\nRaw LLM output (first 500 chars):\n${text.slice(0, 500)}`);
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
  } catch (e) {
    // Dump the rewritten code on parse / runtime failure so the user can
    // diagnose via DevTools (most common cause: LLM emitted invalid JS, or
    // strip-fence regex missed a prose preamble).
    console.group('%c❌ executeGeneratedCode failed', 'color:#d9afaf; font-weight:600');
    console.error(e);
    console.log('Raw LLM output (first 300):', rawCode.slice(0, 300));
    console.log('Rewritten code being imported:');
    console.log(rewritten);
    console.log('Blob URL:', url);
    console.groupEnd();
    throw e;
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

  // Dispatch by activeRenderer. GPU pills (fly3d / bob-gpu) have no 2D path;
  // fall back to silhouette so 2D code execution still produces output when
  // a GPU pill is selected but there's no 3D content yet.
  try {
    const name = isGpuRenderer(state.activeRenderer) ? 'silhouette' : state.activeRenderer;
    const fn = renderModule[name];
    if (fn) {
      fn(ctx, layers, opts);
    } else {
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

// Emoji glyphs for the big card grid — by demo id, then by category fallback.
// Keeps the gallery visually scannable without pre-baked thumbnails.
const DEMO_EMOJI_BY_ID = {
  'china-carrier':     '⚓',
  'gothic-cathedral':  '⛪',
  'spiral-vase':       '🏺',
  'mountain-village':  '⛰️',
  'clock-915':         '🕘',
  'vintage-bicycle':   '🚲',
  'dining-setting':    '🍽️',
  'coastal-lighthouse':'🗼',
};
function sceneEmoji(entry) {
  if (entry.id && DEMO_EMOJI_BY_ID[entry.id]) return DEMO_EMOJI_BY_ID[entry.id];
  if (entry.category === 'revolution') return '🏺';
  if (entry.category === 'diorama-topdown') return '⛰️';
  if (entry.category === 'model') return '◆';
  return '💾';
}

const TAB_CONTENT = {
  'scenes': () => `
    <div class="scenes-hero">
      <h1>Atlas Scene Gallery</h1>
      <p>LLM-generated, editable 3D scenes you can fly through. Click any to open. <span class="cta" id="scenes-cta-text">Or write your own → Text tab</span></p>
    </div>

    <div class="scenes-section">
      <h2 class="scenes-section-title">Featured <span class="count" id="scenes-bundled-count">0</span></h2>
      <div class="scenes-grid-big" id="scenes-bundled-grid"></div>
    </div>

    <div class="scenes-section">
      <h2 class="scenes-section-title">My saved <span class="count" id="scenes-saved-count">0</span> <span style="color:#666; font-size:10px; font-weight:400; text-transform:none; letter-spacing:0; margin-left:auto;">localStorage · this browser only</span></h2>
      <div class="scenes-grid-big" id="scenes-saved-grid"></div>
    </div>
  `,

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
    <textarea id="prompt-input" rows="8" placeholder="e.g. a tall wine bottle on a wooden table"
              style="width:100%; min-height:140px; padding:10px;
                     background:#0d0d0d; color:#ddd;
                     border:1px solid #3a3a3a; border-radius:3px;
                     font-family:inherit; font-size:13px; line-height:1.5;
                     resize:vertical;"></textarea>

    <button id="btn-generate" class="primary-btn" style="
      padding: 8px 14px; background: #ffd070; color: #1a1a1a;
      border: none; border-radius: 3px; cursor: pointer;
      font-size: 13px; font-weight: 600; margin-top: 6px;">
      ✨ Generate
    </button>

    <p id="usage-info" style="font-size:10px; color:#666; margin-top:4px;"></p>

    <h3>3D Lift</h3>
    <p style="font-size:11px; color:#999; line-height:1.5; margin-bottom:6px;">
      Take the current 2D scene and lift it into a 3D world you can fly through.
      Same prompt + 2D code → LLM outputs SceneData v1 (3D primitives + camera + light + shadow).
    </p>
    <button id="btn-lift-3d" disabled style="
      padding: 7px 12px; background: #2a2a2a; color: #aaa;
      border: 1px solid #3a3a3a; border-radius: 3px; cursor: pointer;
      font-size: 12px; width: 100%;">
      ✨ Lift to 3D
    </button>
    <button id="btn-back-to-2d" style="
      padding: 7px 12px; background: #2a2a2a; color: #aaa;
      border: 1px solid #3a3a3a; border-radius: 3px; cursor: pointer;
      font-size: 12px; width: 100%; margin-top: 4px; display: none;">
      ← Back to 2D
    </button>
    <button id="btn-relift" style="
      padding: 5px 8px; background: none; color: #888;
      border: none; cursor: pointer; font-size: 10px;
      width: 100%; margin-top: 2px; display: none;
      text-align: center; text-decoration: underline;">
      ↻ regenerate (force LLM, ~$0.20)
    </button>
    <button id="btn-save-scene" style="
      padding: 8px 12px; background: #7fa97f; color: #0d0d0d;
      border: none; border-radius: 3px; cursor: pointer;
      font-size: 12px; font-weight: 600; width: 100%; margin-top: 4px; display: none;">
      ✨ Save Scene
    </button>
    <p id="lift-info" style="font-size:10px; color:#666; margin-top:4px;"></p>

    <h3>History
      <button class="history-clear" id="btn-clear-history">clear all</button>
    </h3>
    <div id="history-list"></div>
  `,

  'generator': () => `
    <h2>Generator → SceneData</h2>
    <p>Pick a generator template + hash → SceneData v1 → BOB GPU render. Same hash always produces the same scene (URL-shareable, zero token cost for variants — thesis Point #10).</p>

    <h3>Generator template</h3>
    <select id="gen-template" disabled
            style="width:100%; padding:6px 8px; background:#0d0d0d; color:#aaa;
                   border:1px solid #3a3a3a; border-radius:3px; font-size:12px;">
      <option value="autoscope">Autoscope (6 scene types, Erik Swahn idiom)</option>
    </select>
    <p style="font-size:10px; color:#666;">M3 will add more generator templates (creature lattice / plant garden / abstract pattern / ...) and allow promoting LLM-lifted 3D scenes into generators.</p>

    <h3>Scene type (within Autoscope)</h3>
    <select id="gen-scene-type"
            style="width:100%; padding:6px 8px; background:#0d0d0d; color:#aaa;
                   border:1px solid #3a3a3a; border-radius:3px; font-size:12px;">
      <option value="random">Random (weighted)</option>
      <option value="0">0 · City</option>
      <option value="1">1 · Sea</option>
      <option value="2">2 · Forest</option>
      <option value="3">3 · Village</option>
      <option value="4">4 · City axis</option>
      <option value="5">5 · Abstract</option>
    </select>

    <div style="display:flex; gap:6px; margin-top:8px;">
      <button id="btn-gen-new" class="primary-btn" style="
        flex:1; padding:8px 12px; background:#ffd070; color:#1a1a1a;
        border:none; border-radius:3px; cursor:pointer;
        font-size:13px; font-weight:600;">🎲 New scene</button>
      <button id="btn-gen-share" class="icon-btn">📋 Share</button>
      <button id="btn-gen-shuffle" class="icon-btn">🎨 Shuffle palette</button>
    </div>

    <h3>Hash</h3>
    <input id="gen-hash-input" type="text" placeholder="0x..." spellcheck="false"
           style="width:100%; padding:6px 8px; background:#0d0d0d; color:#aaa;
                  border:1px solid #3a3a3a; border-radius:3px;
                  font-family:ui-monospace, monospace; font-size:10px;">
    <p style="font-size:10px; color:#666;">Edit hash + ↵ to load specific scene. Hash uniquely determines the scene composition.</p>

    <h3>Scene info</h3>
    <div id="gen-info" style="font-family:ui-monospace, monospace; font-size:11px;
                              color:#888; padding:8px 10px; background:#0d0d0d;
                              border:1px solid #2a2a2a; border-radius:3px;
                              line-height:1.6;">
      (no scene yet — click 🎲 New scene)
    </div>
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

  // Scenes tab uses a full-width gallery layout (canvas + code panel hidden).
  // All other tabs use the standard sidebar + canvas split.
  document.body.classList.toggle('scenes-mode', state.activeTab === 'scenes');

  updateCanvasVisibility();

  if (state.activeTab === 'scenes') {
    renderScenesTab();
  } else if (state.activeTab === 'text') {
    wireTextTab();
  } else if (state.activeTab === 'generator') {
    wireGeneratorTab();
  }
}

/**
 * Single source of truth for "what should the canvas show right now":
 *   - have3D content (lift mode or generator) + GPU pill active → #c-gpu, then render
 *   - otherwise → #c, no render (2D paths trigger their own re-render)
 * Returns the active renderer's { bytes } so callers building lift-info / scene-info
 * strings can read the GLSL size.
 */
function updateCanvasVisibility(opts = {}) {
  const have3D = state.activeTab === 'generator' ||
                 (state.activeTab === 'text' && state.liftMode);
  const showGpu = have3D && isGpuRenderer(state.activeRenderer);
  $('c').style.display = showGpu ? 'none' : 'block';
  $('c-gpu').style.display = showGpu ? 'block' : 'none';
  const fsBtn = $('btn-fullscreen');
  const shuffleBtn = $('btn-shuffle-palette');
  if (fsBtn) fsBtn.style.display = showGpu ? 'inline-flex' : 'none';
  // Shuffle only meaningful for BOB GPU (FLY 3D doesn't have a palette concept)
  if (shuffleBtn) shuffleBtn.style.display = (showGpu && state.activeRenderer === 'bob-gpu') ? 'inline-flex' : 'none';
  return showGpu ? runActiveGpuRenderer(opts) : { bytes: 0 };
}

/**
 * Force activeRenderer to a GPU renderer if it's currently 2D. Default 3D
 * renderer is BOB GPU (matches v1 visual identity / preserves existing
 * autoscope-style first impression). Updates the pill UI to match.
 */
function ensureGpuRendererActive() {
  if (isGpuRenderer(state.activeRenderer)) return;
  state.activeRenderer = 'bob-gpu';
  $$('#renderer-pills .pill').forEach(b =>
    b.classList.toggle('active', b.dataset.renderer === state.activeRenderer)
  );
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

  const generateBtn = $('btn-generate');
  const origGenerateLabel = generateBtn.innerHTML;
  function setGenerateBusy(label) {
    if (label) {
      generateBtn.disabled = true;
      generateBtn.style.background = '#3a3a3a';
      generateBtn.style.color = '#aaa';
      generateBtn.style.cursor = 'wait';
      generateBtn.textContent = label;
    } else {
      generateBtn.disabled = false;
      generateBtn.style.background = '#ffd070';
      generateBtn.style.color = '#1a1a1a';
      generateBtn.style.cursor = 'pointer';
      generateBtn.innerHTML = origGenerateLabel;
    }
  }

  generateBtn.addEventListener('click', async () => {
    const userPrompt = promptInput.value.trim();
    if (!userPrompt) {
      usageInfo.style.color = '#d9afaf';
      usageInfo.textContent = '✗ enter a prompt first';
      setStatus('✗ enter a prompt first', true);
      return;
    }
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      usageInfo.style.color = '#d9afaf';
      usageInfo.textContent = '✗ Anthropic API key required';
      setStatus('✗ Anthropic API key required', true);
      apiKeyInput.focus();
      return;
    }
    localStorage.setItem(STORAGE_KEY, apiKey);

    setGenerateBusy('⋯ Calling Claude…');
    usageInfo.style.color = '#ffd070';
    usageInfo.textContent = `⋯ POST api.anthropic.com  (model=${DEFAULT_MODEL})`;
    setStatus('⋯ calling Anthropic Claude…');

    try {
      const t0 = performance.now();
      const result = await callLLM(userPrompt, apiKey);
      const elapsed = ((performance.now() - t0) / 1000).toFixed(1);
      const usageStr = `↑ ${result.usage.input_tokens} in · ↓ ${result.usage.output_tokens} out · ${elapsed}s`;

      // Save to history + select it + show in code panel
      addHistoryEntry({ prompt: userPrompt, code: result.text, usage: result.usage, elapsed });
      const newest = state.history[0];
      state.selectedHistoryId = newest.id;
      activeDemoId = null;
      setCodeDisplay(result.text, userPrompt, usageStr);
      renderHistoryList();
      renderDemoGallery();
      // Exit lift mode if in it, refresh Lift button to enabled state
      if (state.liftMode) exitLiftMode();
      refreshLiftButtonState();

      setGenerateBusy('⋯ Rendering…');
      usageInfo.style.color = '#ffd070';
      usageInfo.textContent = `${usageStr} · executing code…`;
      setStatus('⋯ executing generated code…');

      try {
        await executeGeneratedCode(result.text);
        usageInfo.style.color = '#afd9af';
        usageInfo.textContent = `✓ ${usageStr} · model=${DEFAULT_MODEL}`;
        setStatus(`✓ rendered in ${elapsed}s`);
      } catch (execErr) {
        usageInfo.style.color = '#d9afaf';
        usageInfo.textContent = `✗ exec error: ${execErr.message.slice(0, 80)}`;
        setStatus(`✗ exec error: ${execErr.message}`, true);
        console.error(execErr);
        const ctx = $('c').getContext('2d');
        ctx.fillStyle = '#f4efdc';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        drawErrorOverlay(ctx, `exec error: ${execErr.message}`);
      }
    } catch (e) {
      usageInfo.style.color = '#d9afaf';
      usageInfo.textContent = `✗ ${e.message.slice(0, 100)}`;
      setStatus(`✗ ${e.message}`, true);
      console.error(e);
    } finally {
      setGenerateBusy(null);
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

  // Lift to 3D handlers
  $('btn-lift-3d').addEventListener('click', () => liftCurrent2DTo3D());
  $('btn-relift').addEventListener('click', () => {
    if (!confirm('Force a fresh LLM lift? This costs ~$0.20 and overwrites the cached scene.')) return;
    liftCurrent2DTo3D({ forceFresh: true });
  });
  $('btn-back-to-2d').addEventListener('click', exitLiftMode);
  $('btn-save-scene').addEventListener('click', saveCurrentScene);

  // Enable lift button if there's a current 2D code + selected history entry
  // (i.e., we know the original prompt and code to feed the lift LLM).
  refreshLiftButtonState();

  renderHistoryList();
  renderDemoGallery();
}

function refreshLiftButtonState() {
  const liftBtn = $('btn-lift-3d');
  const backBtn = $('btn-back-to-2d');
  const saveBtn = $('btn-save-scene');
  const regenBtn = $('btn-relift');
  if (!liftBtn) return;

  const code = $('code-display').value;
  const selected = state.history.find(h => h.id === state.selectedHistoryId);
  const haveBoth = code && selected;
  const hasCachedLift = !!selected?.lift?.sceneData;
  // Save button shows whenever we have a 3D scene actively displayed —
  // covers fresh lifts, cached lifts, demos, and edited JSON re-renders.
  const canSave = state.liftMode && state.textLiftSceneJSON;

  if (state.liftMode) {
    liftBtn.disabled = true;
    liftBtn.style.background = '#2a2a2a';
    liftBtn.style.color = '#666';
    liftBtn.textContent = '✓ Lifted to 3D';
    backBtn.style.display = 'block';
    if (regenBtn) regenBtn.style.display = 'none';
  } else if (hasCachedLift) {
    // Cached lift available → instant load, zero token cost
    liftBtn.disabled = false;
    liftBtn.style.background = '#7fa97f';
    liftBtn.style.color = '#0d0d0d';
    liftBtn.style.cursor = 'pointer';
    liftBtn.style.fontWeight = '600';
    liftBtn.textContent = '▶ Load cached 3D';
    backBtn.style.display = 'none';
    if (regenBtn) regenBtn.style.display = 'block';
  } else {
    liftBtn.disabled = !haveBoth;
    liftBtn.style.background = haveBoth ? '#ffd070' : '#2a2a2a';
    liftBtn.style.color = haveBoth ? '#1a1a1a' : '#666';
    liftBtn.style.cursor = haveBoth ? 'pointer' : 'not-allowed';
    liftBtn.style.fontWeight = haveBoth ? '600' : 'normal';
    liftBtn.textContent = '✨ Lift to 3D';
    backBtn.style.display = 'none';
    if (regenBtn) regenBtn.style.display = 'none';
  }

  if (saveBtn) {
    saveBtn.style.display = canSave ? 'block' : 'none';
  }
}

function renderLiftedSceneData(sceneData, originalPrompt, infoLineHtml, { shufflePalette = true } = {}) {
  const liftInfo = $('lift-info');
  let compiled;
  try {
    compiled = compileSceneData(sceneData);
  } catch (compileErr) {
    throw new Error(`SceneData compile failed: ${compileErr.message}`);
  }

  const renderSdf = (compiled.groundSdf && compiled.sdf)
    ? sdfUnion(compiled.sdf, compiled.groundSdf)
    : (compiled.sdf || compiled.groundSdf);
  if (!renderSdf) throw new Error('empty SDF — no subjects + no ground');

  state.textLiftScene = compiled;
  state.textLiftSdf = renderSdf;
  state.textLiftSceneJSON = sceneData;
  state.textLiftSourcePrompt = originalPrompt;
  state.liftMode = true;
  gpuSceneStartTime = performance.now();
  userTookCam = false;

  ensureGpuRendererActive();
  refreshLiftButtonState();
  const { bytes } = updateCanvasVisibility();

  // Auto-shuffle palette on every NEW scene load so the gallery feels varied
  // — without this, BOB GPU's once-baked palette would make every scene share
  // the same sky/ground colors for the whole session. Skip when caller opts
  // out (e.g. re-render after a JSON edit shouldn't randomly recolor).
  if (shufflePalette && state.bobRenderer && state.activeRenderer === 'bob-gpu') {
    state.bobRenderer.shufflePalette();
  }

  // Populate 3D pane with the raw SceneData JSON (the code panel's right half)
  const sceneEl = $('scene-display');
  const sceneMeta = $('code-3d-meta');
  if (sceneEl) {
    const txt = JSON.stringify(sceneData, null, 2);
    sceneEl.value = txt;
    if (sceneMeta) {
      sceneMeta.textContent = `${(txt.length / 1024).toFixed(1)} KB · ${compiled.subjects.length} subjects`;
    }
  }

  const subjects = compiled.subjects.length;
  const shadowMode = compiled.shadowStatic?.mode ?? 'off';
  const ground = compiled.ground ? `y=${compiled.ground.y}` : 'none';
  if (liftInfo) {
    liftInfo.style.color = '#afd9af';
    liftInfo.innerHTML = `${infoLineHtml}<br>
      <span style="color:#888;">${subjects} subjects · shadow=${shadowMode} · ground=${ground} · ${(bytes / 1024).toFixed(1)} KB GLSL</span>`;
  }
  $('scene-info').textContent = `3D lift · ${sceneData.name || originalPrompt.slice(0, 30)}`;
}

async function liftCurrent2DTo3D({ forceFresh = false } = {}) {
  const code = $('code-display').value;
  const selected = state.history.find(h => h.id === state.selectedHistoryId);
  const liftBtn = $('btn-lift-3d');
  const liftInfo = $('lift-info');
  if (!code || !selected) {
    if (liftInfo) { liftInfo.style.color = '#d9afaf'; liftInfo.textContent = '✗ no 2D scene to lift'; }
    setStatus('✗ no 2D scene to lift', true);
    return;
  }

  // Cache hit: history entry already has a previously-lifted SceneData.
  // Render it directly — zero token cost, instant load.
  if (!forceFresh && selected.lift?.sceneData) {
    try {
      renderLiftedSceneData(
        selected.lift.sceneData,
        selected.prompt,
        `▶ cached lift loaded · 0 tokens · ${selected.lift.elapsed ?? '?'}s original`,
      );
      setStatus(`✓ cached 3D loaded — click canvas to fly`);
      return;
    } catch (e) {
      // Cache might be incompatible with current spec — fall through to fresh lift
      console.warn('cached lift failed to render, falling back to fresh LLM call:', e);
      if (liftInfo) { liftInfo.style.color = '#d9afaf'; liftInfo.textContent = `✗ cached scene failed: ${e.message}. Will re-lift.`; }
    }
  }

  const apiKey = ($('api-key')?.value || localStorage.getItem(STORAGE_KEY) || '').trim();
  if (!apiKey) {
    if (liftInfo) { liftInfo.style.color = '#d9afaf'; liftInfo.textContent = '✗ Anthropic API key required'; }
    setStatus('✗ Anthropic API key required', true);
    return;
  }

  // Lift button busy state
  liftBtn.disabled = true;
  liftBtn.style.background = '#3a3a3a';
  liftBtn.style.color = '#aaa';
  liftBtn.style.cursor = 'wait';
  liftBtn.textContent = '⋯ Lifting to 3D…';
  if (liftInfo) {
    liftInfo.style.color = '#ffd070';
    liftInfo.textContent = `⋯ POST api.anthropic.com (lift prompt)`;
  }
  setStatus('⋯ lifting 2D scene to 3D…');

  try {
    const t0 = performance.now();
    const result = await callLiftLLM(selected.prompt, code, apiKey);
    const elapsed = ((performance.now() - t0) / 1000).toFixed(1);

    let sceneData;
    try {
      sceneData = parseLiftResponse(result.text);
    } catch (parseErr) {
      throw new Error(`JSON parse failed (${parseErr.message.slice(0, 100)})`);
    }

    renderLiftedSceneData(
      sceneData,
      selected.prompt,
      `✓ ↑ ${result.usage.input_tokens} in · ↓ ${result.usage.output_tokens} out · ${elapsed}s`,
    );
    setStatus(`✓ 3D scene rendered (${elapsed}s) — click canvas to fly`);

    // Save lift to history entry alongside the 2D code (cache hit on next visit)
    selected.lift = { sceneData, elapsed, usage: result.usage };
    saveHistory();
  } catch (e) {
    liftInfo.style.color = '#d9afaf';
    liftInfo.textContent = `✗ ${e.message}`;
    setStatus(`✗ lift error: ${e.message}`, true);
    console.error(e);
    // Restore lift button to "✨ Lift to 3D" if we never made it into lift mode
    if (!state.liftMode) refreshLiftButtonState();
  }
}

function exitLiftMode() {
  state.liftMode = false;
  activeDemoId = null;
  updateCanvasVisibility();
  refreshLiftButtonState();
  renderDemoGallery();
  $('scene-info').textContent = state.selectedHistoryId
    ? state.history.find(h => h.id === state.selectedHistoryId)?.prompt?.slice(0, 40) || 'No scene'
    : 'No scene';
  setStatus('back to 2D');
}

// =============================================================================
// generator-tab wire-up
// =============================================================================

function ensureFly3dRenderer() {
  if (state.fly3dRenderer) return state.fly3dRenderer;
  const canvas = $('c-gpu');
  state.fly3dRenderer = createFly3DRenderer({
    canvas,
    getControls: () => {
      const { scene } = getActiveGpuScene();
      const light = scene?.lightStatic || { azimuth: 0.5, altitude: 0.7, distance: 30 };
      const cam = scene?.cameraStatic;
      return {
        lightAzim: light.azimuth,
        lightAlt: light.altitude,
        lightDist: light.distance,
        fov: cam?.focal || 1.5,
        shadowsOn: true,
        groundOn: false, // ground is unioned into the SDF tree at compile time
        checkerOn: false,
      };
    },
    onFps: (fps) => { $('fps').textContent = `FPS: ${fps.toFixed(0)}`; },
  });
  return state.fly3dRenderer;
}

/**
 * Render the active 3D scene (from getActiveGpuScene) using whichever
 * GPU renderer the active pill selects. Unmounts the inactive one so
 * pointer-lock doesn't leak and RAF loops don't compete for the canvas.
 */
function runActiveGpuRenderer({ keepCamera = false } = {}) {
  const { sdf, scene } = getActiveGpuScene();
  if (!sdf || !scene) return { bytes: 0 };

  if (state.activeRenderer === 'fly3d') {
    if (state.bobRenderer) state.bobRenderer.unmount();
    const fly = ensureFly3dRenderer();
    if (!keepCamera && scene.cameraStatic) fly.setCamState(sphericalToCamState(scene.cameraStatic));
    try {
      return fly.render(sdf);
    } catch (e) {
      setStatus(`✗ fly3d render: ${e.message}`, true);
      console.error(e);
      return { bytes: 0 };
    }
  } else {
    // default to bob-gpu
    if (state.fly3dRenderer) state.fly3dRenderer.unmount();
    const bob = ensureBobRenderer();
    if (!keepCamera && scene.cameraStatic) bob.setCamState(sphericalToCamState(scene.cameraStatic));
    try {
      const r = bob.render(sdf);
      gpuSceneStartTime = performance.now();
      userTookCam = false;
      return r;
    } catch (e) {
      setStatus(`✗ bob-gpu render: ${e.message}`, true);
      console.error(e);
      return { bytes: 0 };
    }
  }
}

function ensureBobRenderer() {
  if (state.bobRenderer) return state.bobRenderer;
  const canvas = $('c-gpu');
  state.bobRenderer = createBobShaderRenderer({
    canvas,
    twoPass: true,
    bufferResolution: 320,
    getControls: () => {
      const { scene } = getActiveGpuScene();
      const t = (performance.now() - gpuSceneStartTime) / 1000;
      if (!scene) return defaultBobControls();
      const cam = scene.evalCamera ? scene.evalCamera(t) : scene.cameraStatic;
      const light = scene.evalLight ? scene.evalLight(t) : scene.lightStatic;
      const shadow = scene.evalShadow ? scene.evalShadow(t) : scene.shadowStatic;
      return {
        lightAzim: light.azimuth,
        lightAlt:  light.altitude,
        lightDist: light.distance,
        fov:       cam.focal || 1.5,
        coldiv: 1.1, coloration: 0,
        shadowMode:    shadowModeNameToInt(shadow?.mode ?? 'channelSwap'),
        shadowStrength: shadow?.strength ?? 0.35,
        shadowsOn:     shadow?.enabled !== false,
        groundOn:      false,                  // ground union'd into SDF tree instead
        noiseSpeed:    0.00016,
        exposure:      1.05, saturation: 1.0, worldScale: 0.5,
        postNoise: 1.0, postNFactor: 1.0, postNoiseCap: 0.5,
        mirrorX: false, mirrorZ: false, twist: 0, twistType: 0, gridRot: [0, 0, 0],
      };
    },
    onFps: (fps) => { $('fps').textContent = `FPS: ${fps.toFixed(0)}`; },
  });
  return state.bobRenderer;
}

function defaultBobControls() {
  return {
    lightAzim: 0.5, lightAlt: 0.7, lightDist: 30, fov: 1.5,
    coldiv: 1.1, coloration: 0, shadowMode: 0, shadowStrength: 0.35,
    shadowsOn: true, groundOn: false, noiseSpeed: 0.00016,
    exposure: 1.05, saturation: 1.0, worldScale: 0.5,
    postNoise: 1.0, postNFactor: 1.0, postNoiseCap: 0.5,
    mirrorX: false, mirrorZ: false, twist: 0, twistType: 0, gridRot: [0, 0, 0],
  };
}

function shadowModeNameToInt(mode) {
  return { channelSwap: 0, hueRotate180: 1, hueRotate90: 2, darken: 3 }[mode] ?? 0;
}

function sphericalToCamState(cam) {
  return {
    position: [
      cam.targetX - cam.distance * Math.sin(cam.yaw) * Math.cos(cam.pitch),
      cam.targetY + cam.distance * Math.sin(cam.pitch),
      cam.targetZ - cam.distance * Math.cos(cam.yaw) * Math.cos(cam.pitch),
    ],
    yaw: cam.yaw,
    pitch: cam.pitch,
  };
}

let gpuSceneStartTime = performance.now();
let userTookCam = false;

function gpuCameraLoop() {
  // Scene-driven camera animation only applies to BOB GPU (FLY 3D is WASD-driven).
  if (state.activeRenderer === 'bob-gpu' && state.bobRenderer && !userTookCam) {
    const { scene } = getActiveGpuScene();
    if (scene && scene.evalCamera) {
      const t = (performance.now() - gpuSceneStartTime) / 1000;
      const cam = scene.evalCamera(t);
      state.bobRenderer.setCamState(sphericalToCamState(cam));
    }
  }
  requestAnimationFrame(gpuCameraLoop);
}
gpuCameraLoop();

function generateGeneratorScene({ keepCamera = false } = {}) {
  if (!state.genHash || !isValidHash(state.genHash)) {
    state.genHash = generateHash();
  }
  writeHashToURL(state.genHash);
  $('gen-hash-input').value = state.genHash;

  const rng = new Random(state.genHash);
  const choice = state.genSceneTypeChoice;
  const sceneType = choice === 'random' ? randomSceneTypeData(rng) : (+choice);

  const sceneData = generateSceneData(sceneType, rng);
  let compiled;
  try {
    compiled = compileSceneData(sceneData);
  } catch (e) {
    setStatus(`✗ compile error: ${e.message}`, true);
    console.error(e);
    return;
  }

  // Union ground into the SDF tree (compile returns it separately)
  const renderSdf = (compiled.groundSdf && compiled.sdf)
    ? sdfUnion(compiled.sdf, compiled.groundSdf)
    : (compiled.sdf || compiled.groundSdf);

  if (!renderSdf) {
    setStatus('✗ empty scene', true);
    return;
  }

  state.genScene = compiled;
  state.genSdf = renderSdf;
  gpuSceneStartTime = performance.now();
  userTookCam = false;

  ensureGpuRendererActive();

  try {
    const { bytes } = updateCanvasVisibility({ keepCamera });
    const camAnim = sceneData.defaults.camera.animation?.length || 0;
    const lightAnim = sceneData.defaults.light.animation?.length || 0;
    $('gen-info').innerHTML = `
      scene: <b style="color:#ffd070;">${SCENE_NAMES_DATA[sceneType]}</b><br>
      subjects: ${compiled.subjects.length}<br>
      shadow: ${compiled.shadowStatic?.mode ?? 'off'} · strength ${compiled.shadowStatic?.strength?.toFixed(2) ?? '-'}<br>
      ground: ${compiled.ground ? `y=${compiled.ground.y}` : 'none'}<br>
      anims: cam=${camAnim} light=${lightAnim}<br>
      shader: ${(bytes / 1024).toFixed(1)} KB GLSL
    `;
    $('scene-info').textContent = `${SCENE_NAMES_DATA[sceneType]} · hash ${state.genHash.slice(0, 8)}…`;
    setStatus(`✓ rendered: ${SCENE_NAMES_DATA[sceneType]}`);
  } catch (e) {
    setStatus(`✗ render error: ${e.message}`, true);
    console.error(e);
  }
}

function wireGeneratorTab() {
  // Init hash from URL or generate fresh
  if (!state.genHash) {
    const urlHash = readHashFromURL();
    state.genHash = (urlHash && isValidHash(urlHash)) ? urlHash : generateHash();
  }
  $('gen-hash-input').value = state.genHash;
  $('gen-scene-type').value = state.genSceneTypeChoice;

  $('btn-gen-new').addEventListener('click', () => {
    state.genHash = generateHash();
    generateGeneratorScene();
  });

  $('btn-gen-share').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setStatus(`✓ URL copied (hash ${state.genHash.slice(0, 10)}…)`);
    } catch {
      prompt('Copy URL:', window.location.href);
    }
  });

  $('btn-gen-shuffle').addEventListener('click', () => {
    if (state.bobRenderer) {
      state.bobRenderer.shufflePalette();
      setStatus('🎨 palette shuffled');
    }
  });

  $('gen-scene-type').addEventListener('change', (e) => {
    state.genSceneTypeChoice = e.target.value;
    generateGeneratorScene({ keepCamera: true });
  });

  $('gen-hash-input').addEventListener('change', (e) => {
    const v = e.target.value.trim();
    if (isValidHash(v)) {
      state.genHash = v;
      generateGeneratorScene();
    } else {
      setStatus('✗ invalid hash (need 0x + 64 hex)', true);
      e.target.value = state.genHash;
    }
  });

  // Initial render if no scene yet (canvas pointerdown listener is global, see init)
  if (!state.genScene) {
    generateGeneratorScene();
  }
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
  activeDemoId = null;
  renderDemoGallery();
  const usageStr = entry.usage
    ? `↑ ${entry.usage.input_tokens} in · ↓ ${entry.usage.output_tokens} out · ${entry.elapsed}s`
    : null;
  setCodeDisplay(entry.code, entry.prompt, usageStr, entry.lift?.sceneData || null);
  renderHistoryList();
  if (state.liftMode) exitLiftMode();
  refreshLiftButtonState();
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

function setCodeDisplay(code, prompt, meta, sceneJSON) {
  $('code-display').value = code || '';
  $('selected-prompt').textContent = prompt ? `"${prompt}"` : '';
  $('code-meta').textContent = meta || '';
  // 2D pane meta: size of the code
  const code2dMeta = $('code-2d-meta');
  if (code2dMeta) code2dMeta.textContent = code ? `${(code.length / 1024).toFixed(1)} KB` : '';
  // 3D pane: pretty-print SceneData JSON if provided
  const sceneEl = $('scene-display');
  const sceneMeta = $('code-3d-meta');
  if (sceneEl) {
    if (sceneJSON) {
      const txt = typeof sceneJSON === 'string' ? sceneJSON : JSON.stringify(sceneJSON, null, 2);
      sceneEl.value = txt;
      if (sceneMeta) {
        const sceneObj = typeof sceneJSON === 'string' ? null : sceneJSON;
        const subjects = sceneObj?.subjects?.length ?? '?';
        sceneMeta.textContent = `${(txt.length / 1024).toFixed(1)} KB · ${subjects} subjects`;
      }
    } else {
      sceneEl.value = '';
      if (sceneMeta) sceneMeta.textContent = '';
    }
  }
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
    const newR = btn.dataset.renderer;
    state.activeRenderer = newR;
    $$('#renderer-pills .pill').forEach(b => b.classList.toggle('active', b === btn));

    if (!isGpuRenderer(newR)) {
      // 2D pill: release any GPU renderer first (cancels its RAF + pointer lock).
      if (state.bobRenderer) state.bobRenderer.unmount();
      if (state.fly3dRenderer) state.fly3dRenderer.unmount();
    }
    updateCanvasVisibility();
    if (!isGpuRenderer(newR)) reRenderStored();
    setStatus(`renderer → ${state.activeRenderer}`);
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
// Scenes is the landing tab — gallery-first product positioning, like Shadertoy.
// Canvas placeholder is still drawn so the Text tab has content when user navigates there.
document.body.classList.add('scenes-mode');
renderActiveTab();
drawPlaceholder();
updateSceneInfo();

// Global GPU canvas pointerdown: signal to gpuCameraLoop that user has
// taken manual camera control (so scene.evalCamera animation stops fighting
// WASD/mouse input). Applies to both text-tab lift mode and generator-tab.
$('c-gpu').addEventListener('pointerdown', () => { userTookCam = true; });

// ----- Shared-scene URL banner handlers -----
$('btn-save-shared')?.addEventListener('click', saveSharedScene);
$('btn-dismiss-shared')?.addEventListener('click', dismissSharedBanner);

// ----- Fullscreen toggle (BOB GPU + FLY 3D) -----
function toggleFullscreen() {
  const wrap = $('canvas-wrap');
  if (!document.fullscreenElement && !document.webkitFullscreenElement) {
    const fn = wrap.requestFullscreen || wrap.webkitRequestFullscreen;
    if (fn) fn.call(wrap).catch(e => setStatus(`✗ fullscreen failed: ${e.message}`, true));
  } else {
    const fn = document.exitFullscreen || document.webkitExitFullscreen;
    if (fn) fn.call(document);
  }
}
$('btn-fullscreen')?.addEventListener('click', toggleFullscreen);

function shuffleBobPalette() {
  if (state.activeRenderer !== 'bob-gpu') {
    setStatus('🎨 Shuffle only applies to BOB GPU (switch renderer first)', true);
    return;
  }
  if (!state.bobRenderer) {
    setStatus('🎨 no BOB GPU renderer active', true);
    return;
  }
  state.bobRenderer.shufflePalette();
  setStatus('🎨 palette shuffled — new sky + ground colors');
}
$('btn-shuffle-palette')?.addEventListener('click', shuffleBobPalette);

window.addEventListener('keydown', (e) => {
  const target = e.target;
  const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
  if (typing) return;
  const gpuVisible = $('c-gpu').style.display !== 'none';
  if (!gpuVisible) return;
  if (e.key === 'f' || e.key === 'F') { e.preventDefault(); toggleFullscreen(); }
  else if (e.key === 's' || e.key === 'S') { e.preventDefault(); shuffleBobPalette(); }
});

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

// 3D SceneData pane: copy + re-render handlers
$('btn-copy-scene')?.addEventListener('click', () => {
  const txt = $('scene-display').value;
  if (!txt) { setStatus('no SceneData to copy', true); return; }
  navigator.clipboard.writeText(txt).then(
    () => setStatus('✓ SceneData JSON copied'),
    () => setStatus('✗ clipboard failed', true),
  );
});

async function rerenderCurrentScene() {
  const txt = $('scene-display').value.trim();
  if (!txt) { setStatus('no SceneData to render', true); return; }
  let sceneData;
  try {
    sceneData = JSON.parse(txt);
  } catch (e) {
    setStatus(`✗ invalid JSON: ${e.message}`, true);
    const meta = $('code-3d-meta');
    if (meta) { meta.textContent = `✗ ${e.message}`; meta.style.color = '#d9afaf'; }
    return;
  }
  const meta = $('code-3d-meta');
  if (meta) meta.style.color = '#666';
  try {
    const prompt = state.textLiftSourcePrompt || sceneData.name || 'edited scene';
    renderLiftedSceneData(sceneData, prompt, '✓ re-rendered from edited JSON', { shufflePalette: false });
    setStatus('✓ scene re-rendered from edited JSON');
  } catch (e) {
    setStatus(`✗ scene re-render: ${e.message}`, true);
    console.error(e);
  }
}

$('btn-rerun-scene')?.addEventListener('click', rerenderCurrentScene);

// Ctrl/Cmd+Enter inside scene-display = re-compile + render the JSON
$('scene-display')?.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    rerenderCurrentScene();
  }
});

Promise.all([loadSystemPrompt(), loadLiftSystemPrompt(), loadDemoManifest()]).then(([n2d, nLift]) => {
  renderScenesTab();
  const demoCount = DEMO_MANIFEST?.demos?.length ?? 0;
  const ready = DEMO_MANIFEST?.demos?.filter(d => d.status === 'ready').length ?? 0;
  setStatus(`✓ ready · demos: ${ready}/${demoCount} pre-lifted · prompts: 2D ${n2d}c, lift ${nLift}c`);

  // Auto-load shared scene from URL hash (runs after system prompts are ready
  // so any LLM-side machinery is available, though shared loads don't need it)
  checkSharedSceneInUrl();
});
