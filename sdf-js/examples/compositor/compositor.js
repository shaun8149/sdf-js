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
import {
  generateSceneData,
  randomSceneTypeData,
  SCENE_NAMES_DATA,
} from '../sdf/autoscope-scenes-data.js';
import { compile as compileSceneData } from '../../src/scene/index.js';

// Sprint 12 (Rune erosion / NFT): read tokenHash from URL once at module load.
// Used by compile() to seed any hash-driven primitives (terrain-eroded-rune).
// Precedence: ?tokenHash= URL param > scene.defaults.seed > compile fallback.
function getUrlTokenHash() {
  try {
    const p = new URLSearchParams(window.location.search);
    return p.get('tokenHash') || null;
  } catch (_) {
    return null;
  }
}
let URL_TOKEN_HASH = getUrlTokenHash(); // mutable — #btn-new-hash reroll updates this
import { expandVariants } from '../../src/scene/generator-s.js';
import {
  sphericalToCamState,
  parseLiftResponse,
  callLiftLLM,
  loadSystemPromptLift,
} from '../../src/compositor-api.js';
import {
  Random,
  generateHash,
  readHashFromURL,
  writeHashToURL,
  isValidHash,
} from '../sdf/autoscope-rng.js';
import { createBobShaderRenderer } from '../../src/render/bobShader.js';
import { createSynth } from '../../src/audio/index.js';
// Generator-V: BOB GPU style randomizer (palette / chess / render params per styleHash).
// Imported here so compositor's BOB GPU mode shares the same Generator-V layer
// as the standalone autoscope-clone — keeps Atlas thesis Point #10 unified.
import {
  DEFAULT_STYLE,
  randomizeBobStyle,
  applyStyleGate,
  describeStyle,
} from '../../src/render/bobShader-style.js';
import { createFly3DRenderer } from '../../src/render/flyLambert.js';
import { createStudioRenderer } from '../../src/render/studio.js';
// W12 auto-framing (IQ-shader bounds library): bbox(SDF) → camera fit.
import { bbox3FromSDF, cameraFitFromBBox } from '../../src/sdf/bounds.js';
import { createBlueprintRenderer } from '../../src/render/blueprint.js';
import { createCrayonRenderer } from '../../src/render/crayonRenderer.js';
import { createStreamlineRenderer } from '../../src/render/streamlineRenderer.js';
import * as edit2d from './edit2d.js';
import { union as sdfUnion } from '../../src/sdf/dn.js';

const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

// =============================================================================
// Central state
// =============================================================================

const state = {
  activeTab: 'scenes',
  activeRenderer: 'silhouette',
  scene: null, // SceneData v1 — set by tabs that emit it (generator-tab)
  layers: null, // [{ sdf, color }, ...] — set by text-tab (legacy MVP-style)
  lastRenderOpts: null, // remember view/etc. for re-render on pill switch
  history: [], // [{ id, prompt, code, usage, timestamp }, ...] most-recent-first
  selectedHistoryId: null,
  // generator-tab state
  genHash: null, // current hash hex string
  genSceneTypeChoice: 'random', // 'random' | '0'..'5'
  bobRenderer: null, // lazy createBobShaderRenderer instance — stylized autoscope-style
  blueprintRenderer: null, // lazy createBlueprintRenderer — 4-view engineering drawing
  fly3dRenderer: null, // lazy createFly3DRenderer instance — clean Lambert + WASD fly
  studioRenderer: null, // lazy createStudioRenderer — clean test stage (checker floor, no sky/fog)
  crayonRenderer: null, // lazy createCrayonRenderer — Sprint 12-3d Canvas2D physics-pen
  topoRenderer: null, // lazy createStreamlineRenderer — Sprint 12-3c downhill pen-strokes
  genScene: null, // generator-tab compiled scene
  genSdf: null, // generator-tab final SDF (subjects ∪ ground)
  // text-tab lift state
  textLiftScene: null, // compiled SceneData from 3D lift
  textLiftSdf: null, // text-tab lift final SDF
  textLiftSceneJSON: null, // raw SceneData JSON (for the 3D code pane + export)
  textLiftSourcePrompt: null, // original prompt that was lifted
  liftMode: false, // true when text-tab showing 3D lift (canvas swap)

  // Light UI override — when non-null, the user has moved a slider and these
  // values take precedence over scene.lightStatic. Reset to null when user
  // clicks "Reset to scene default" or loads a new scene.
  lightOverride: null, // { azimuth, altitude, distance } | null

  // Generator-V (BOB GPU style) — per-styleHash randomized palette / chess /
  // render uniforms. Independent from scene (orthogonal axis per thesis #10).
  // Only consumed when activeRenderer === 'bob-gpu'. Initialized from URL
  // ?styleHash= on bootstrap; "🎲 New style" button generates new hash.
  styleHash: null, // 0x... hex string
  bobStyle: { ...DEFAULT_STYLE }, // current Generator-V output

  // Generator-S (scene variant expansion) — per-sceneHash deterministic
  // scatter/array/etc. Independent from style (orthogonal axis #10).
  // Drives expandVariants() in scene/generator-s.js. Default hash is constant
  // so demo lifts render identically across reloads; user can override via
  // ?sceneHash= URL param to roll a new variant ordering.
  sceneHash: null, // 0x... hex string
};

const GPU_RENDERERS = new Set(['fly3d', 'bob-gpu', 'blueprint', 'crayon', 'topo', 'studio']);
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
  state.history = state.history.filter((h) => h.id !== id);
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
let activeDemoId = null; // currently-loaded bundled-demo id, if any
let activeSavedId = null; // currently-loaded saved-scene id, if any

const SAVED_SCENES_KEY = 'atlas-saved-scenes';
const SAVED_SCENES_CAP = 50;

function loadSavedScenes() {
  try {
    return JSON.parse(localStorage.getItem(SAVED_SCENES_KEY) || '[]');
  } catch {
    return [];
  }
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
  const all = loadSavedScenes().filter((s) => s.id !== id);
  persistSavedScenes(all);
  if (activeSavedId === id) {
    activeSavedId = null;
    if (state.liftMode) exitLiftMode();
  }
  renderDemoGallery();
  renderScenesPopover();
}

function exportAllSavedScenes() {
  const all = loadSavedScenes();
  if (all.length === 0) {
    setStatus('no saved scenes to export', true);
    return;
  }
  const date = new Date().toISOString().slice(0, 10);
  const filename = `atlas-saved-scenes-${date}.json`;
  const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setStatus(`📦 exported ${all.length} scenes to ${filename}`);
}

/**
 * Re-lift a single saved scene with the current LIVE lift prompt (v2.3).
 * Preserves id/name/prompt/code2d, replaces sceneData. Stamps upgradedAt.
 *
 * Uses the user's stored Anthropic API key. ~$0.15 per call.
 */
async function upgradeSavedScene(id) {
  const apiKey = localStorage.getItem(STORAGE_KEY);
  if (!apiKey) {
    setStatus('✗ no API key — set it in the Text tab first', true);
    return;
  }
  const all = loadSavedScenes();
  const idx = all.findIndex((s) => s.id === id);
  if (idx < 0) return;
  const entry = all[idx];
  if (!entry.prompt || !entry.code2d) {
    setStatus(`✗ "${entry.name}" missing prompt or code2d — can't re-lift`, true);
    return;
  }
  setStatus(`🔄 upgrading "${entry.name}"…`);
  try {
    const { text } = await callLiftLLM(entry.prompt, entry.code2d, apiKey);
    const newSceneData = parseLiftResponse(text);
    // Sanity check the parsed scene before saving
    if (!newSceneData || !Array.isArray(newSceneData.subjects)) {
      throw new Error('parsed scene missing subjects array');
    }
    all[idx] = {
      ...entry,
      sceneData: newSceneData,
      upgradedAt: Date.now(),
    };
    persistSavedScenes(all);
    setStatus(`✓ "${entry.name}" upgraded to v2.3 (${newSceneData.subjects.length} subjects)`);
    renderDemoGallery();
    // If this scene is currently loaded, reload it to show new render
    if (activeSavedId === id) loadSavedSceneById(id);
  } catch (e) {
    setStatus(`✗ upgrade "${entry.name}": ${e.message}`, true);
    console.error(e);
  }
}

/**
 * Re-lift ALL saved scenes sequentially. Stops on first error so user can
 * see what broke. ~$1.20 for 8 scenes at sonnet pricing.
 */
async function upgradeAllSavedScenes() {
  const apiKey = localStorage.getItem(STORAGE_KEY);
  if (!apiKey) {
    setStatus('✗ no API key — set it in the Text tab first', true);
    return;
  }
  const all = loadSavedScenes();
  if (all.length === 0) {
    setStatus('no saved scenes to upgrade', true);
    return;
  }
  if (
    !confirm(
      `Re-lift all ${all.length} saved scenes with the current v2.3 prompt? Uses ~${(all.length * 0.15).toFixed(2)} USD of API credit.`,
    )
  )
    return;

  let okCount = 0,
    failCount = 0;
  for (let i = 0; i < all.length; i++) {
    const entry = all[i];
    if (!entry.prompt || !entry.code2d) {
      console.warn(`skip ${entry.name}: missing prompt/code2d`);
      failCount++;
      continue;
    }
    setStatus(`🔄 upgrading ${i + 1}/${all.length}: "${entry.name}"…`);
    try {
      const { text } = await callLiftLLM(entry.prompt, entry.code2d, apiKey);
      const newSceneData = parseLiftResponse(text);
      if (!newSceneData || !Array.isArray(newSceneData.subjects)) {
        throw new Error('parsed scene missing subjects array');
      }
      // Reload fresh — other tabs may have mutated localStorage between iterations
      const current = loadSavedScenes();
      const idx = current.findIndex((s) => s.id === entry.id);
      if (idx < 0) {
        failCount++;
        continue;
      }
      current[idx] = { ...entry, sceneData: newSceneData, upgradedAt: Date.now() };
      persistSavedScenes(current);
      okCount++;
    } catch (e) {
      console.error(`upgrade "${entry.name}":`, e);
      failCount++;
    }
  }
  setStatus(`✓ upgrade-all done · ${okCount} ok · ${failCount} failed`);
  renderDemoGallery();
}

function downloadSavedScene(id) {
  const entry = loadSavedScenes().find((s) => s.id === id);
  if (!entry) return;
  const slug =
    entry.name
      .toLowerCase()
      .replace(/[^a-z0-9 -]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 40) || 'untitled';
  const blob = new Blob([JSON.stringify(entry, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slug}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
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
  const entry = loadSavedScenes().find((s) => s.id === id);
  if (!entry) return;
  const url = buildShareUrl(entry);
  navigator.clipboard.writeText(url).then(
    () =>
      setStatus(`✓ shareable URL copied (${(url.length / 1024).toFixed(1)} KB) — paste anywhere`),
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
function renderScenesPopover() {
  renderScenesTab();
}

function loadSavedSceneById(id) {
  const entry = loadSavedScenes().find((s) => s.id === id);
  if (!entry) {
    setStatus('✗ saved scene not found', true);
    return;
  }
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
    setCodeDisplay(
      entry.code2d || '',
      entry.prompt || entry.name,
      `saved · "${entry.name}"`,
      entry.sceneData,
    );
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

  // Export All button: only meaningful when there's something to export
  const exportAllBtn = $('btn-export-all-saved');
  if (exportAllBtn) {
    exportAllBtn.style.display = saved.length > 0 ? 'inline-flex' : 'none';
    exportAllBtn.onclick = exportAllSavedScenes;
  }
  // Upgrade All button: re-lift each saved scene with current v2.3 prompt
  const upgradeAllBtn = $('btn-upgrade-all-saved');
  if (upgradeAllBtn) {
    upgradeAllBtn.style.display = saved.length > 0 ? 'inline-flex' : 'none';
    upgradeAllBtn.onclick = upgradeAllSavedScenes;
  }

  // Bundled cards
  bundledEl.innerHTML =
    bundled.length === 0
      ? `<div class="scenes-empty" style="grid-column: 1 / -1;">No bundled scenes available.</div>`
      : bundled
          .map(
            (d) => `
        <div class="scene-card-big ${d.status} ${d.id === activeDemoId ? 'active' : ''}" data-bundled="${d.id}">
          <div class="scene-emoji">${sceneEmoji(d)}</div>
          <div class="scene-footer">
            <div class="scene-title">${escapeHtml(d.title)}</div>
            <div class="scene-sub">${escapeHtml(d.thesisPoint || '')}</div>
          </div>
        </div>
      `,
          )
          .join('');

  // Saved cards
  savedEl.innerHTML =
    saved.length === 0
      ? `<div class="scenes-empty" style="grid-column: 1 / -1;">No saved scenes yet.<br>Lift a 2D prompt to 3D in the Text tab, then click ✨ Save Scene.</div>`
      : saved
          .map(
            (s) => `
        <div class="scene-card-big saved ${s.id === activeSavedId ? 'active' : ''}" data-saved="${s.id}">
          <div class="scene-emoji">${sceneEmoji(s)}</div>
          <div class="scene-actions">
            <button class="scene-act-btn" data-act="upgrade" data-id="${s.id}" title="Re-lift with current v2.3 prompt">🔄</button>
            <button class="scene-act-btn" data-act="share" data-id="${s.id}" title="Copy shareable URL">🔗</button>
            <button class="scene-act-btn" data-act="download" data-id="${s.id}" title="Download JSON">↓</button>
            <button class="scene-act-btn" data-act="delete" data-id="${s.id}" title="Delete">×</button>
          </div>
          <div class="scene-footer">
            <div class="scene-title">${escapeHtml(s.name)}</div>
            <div class="scene-sub">${s.upgradedAt ? '<span style="color:#7fa97f;">⚡ v2.3</span> · ' : ''}${formatTime(s.savedAt)} · ${escapeHtml(s.prompt?.slice(0, 28) || '')}</div>
          </div>
        </div>
      `,
          )
          .join('');

  // Wire bundled clicks
  bundledEl.querySelectorAll('.scene-card-big[data-bundled]').forEach((card) => {
    card.addEventListener('click', (e) => {
      e.stopPropagation(); // don't trigger the click-outside deselect below
      const demo = bundled.find((x) => x.id === card.dataset.bundled);
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

  // 2026-05-24: click on grid background (not on a card) → clear active
  // highlight. Visual state of the gallery becomes "nothing focused" so the
  // user can browse without a previous selection visually anchoring them.
  // Does NOT unload the scene — fly3d / bob renderers are unaffected.
  const clearSelectionOnBgClick = (el) => {
    if (!el) return;
    el.addEventListener('click', () => {
      if (activeDemoId == null && activeSavedId == null) return;
      activeDemoId = null;
      activeSavedId = null;
      renderScenesTab();
    });
  };
  clearSelectionOnBgClick(bundledEl);
  clearSelectionOnBgClick(savedEl);

  // Wire saved clicks
  savedEl.querySelectorAll('.scene-card-big[data-saved]').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.scene-act-btn')) return;
      loadSavedSceneById(card.dataset.saved);
      switchToTab('text');
    });
  });
  savedEl.querySelectorAll('.scene-act-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      if (btn.dataset.act === 'share') shareSavedScene(id);
      else if (btn.dataset.act === 'download') downloadSavedScene(id);
      else if (btn.dataset.act === 'delete') deleteSavedScene(id);
      else if (btn.dataset.act === 'upgrade') upgradeSavedScene(id);
    });
  });

  // Hero CTA: jump to Text tab
  const cta = $('scenes-cta-text');
  if (cta) cta.addEventListener('click', () => switchToTab('text'));
}

// Back-compat shim: code in many places still calls renderDemoGallery().
// Route them all to renderScenesTab now that the grids live in the Scenes tab.
function renderDemoGallery() {
  renderScenesTab();
}

function switchToTab(tabName) {
  const btn = document.querySelector(`.tab[data-tab="${tabName}"]`);
  if (btn && !btn.classList.contains('stub') && !btn.classList.contains('active')) {
    btn.click();
  }
}

async function loadDemoScene(demo) {
  setStatus(`⋯ loading demo: ${demo.title}`);
  // Stop the previous scene's RAF + clear its framebuffer immediately so the
  // old scene doesn't linger on canvas during fetch + shader compile. The
  // new render() call below will restart the loop with the new SDF.
  if (state.bobRenderer) state.bobRenderer.unmount();
  if (state.fly3dRenderer) state.fly3dRenderer.unmount();
  if (state.studioRenderer) state.studioRenderer.unmount();
  // 2026-05-24: clear stale active-scene state BEFORE awaiting fetch.
  // Why: card click does `loadDemoScene(demo); switchToTab('text');` — the
  // sync switchToTab triggers updateCanvasVisibility → runActiveGpuRenderer,
  // which reads state.textLiftSdf. Without this clear, that reads the PRIOR
  // demo's SDF and re-renders it (user sees old scene "residue" for the entire
  // fetch + compile window). Also update activeDemoId NOW so the Scenes-tab
  // demo gallery shows the new selection immediately instead of staying
  // highlighted on the previous demo.
  state.textLiftScene = null;
  state.textLiftSdf = null;
  state.textLiftSceneJSON = null;
  activeDemoId = demo.id;
  try {
    const res = await fetch(`./demo-lifts/${demo.file}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    let compiled;
    try {
      // Generator-S: expand `subjects[i].variants[]` into N flat subjects.
      // No-op (zero rng draws) if no subject has variants. Uses state.sceneHash
      // → SFC32 PRNG so the same hash always yields the same expansion.
      const sceneRng = new Random(state.sceneHash);
      const variantScene = expandVariants(data.sceneData, sceneRng);
      compiled = compileSceneData(variantScene, { tokenHash: URL_TOKEN_HASH });
    } catch (e) {
      throw new Error(`compile failed: ${e.message}`);
    }

    const renderSdf =
      compiled.groundSdf && compiled.sdf
        ? sdfUnion(compiled.sdf, compiled.groundSdf)
        : compiled.sdf || compiled.groundSdf;
    if (!renderSdf) throw new Error('empty SDF');

    state.textLiftScene = compiled;
    state.textLiftSdf = renderSdf;
    state.textLiftSceneJSON = data.sceneData; // raw — keeps cameraSequence / defaults.postFx alive past compile
    state.textLiftSourcePrompt = data.prompt;
    state.liftMode = true;
    state.selectedHistoryId = null;
    activeDemoId = demo.id;
    gpuSceneStartTime = performance.now();
    userTookCam = false;

    // Per-demo renderer preference. A demo manifest entry may set
    // `"renderer": "studio"` (or any GPU renderer) to open in that renderer
    // instead of the bob-gpu default — e.g. atom-showcase scenes use the clean
    // studio test stage. ensureGpuRendererActive() then keeps it (studio is a
    // GPU renderer) rather than forcing bob-gpu.
    if (demo.renderer && GPU_RENDERERS.has(demo.renderer)) {
      state.activeRenderer = demo.renderer;
      $$('#renderer-pills .pill').forEach((b) =>
        b.classList.toggle('active', b.dataset.renderer === state.activeRenderer),
      );
    }

    ensureGpuRendererActive();
    refreshLiftButtonState();
    renderDemoGallery();
    renderHistoryList();
    const { bytes } = updateCanvasVisibility();

    setCodeDisplay(
      data.code2d || '',
      data.prompt,
      `demo · pre-lifted · ${(bytes / 1024).toFixed(1)} KB GLSL`,
      data.sceneData || null,
    );
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

/**
 * Resolve which compiled scene + sdf the BOB GPU renderer should display
 * given the current tab + lift state. Used by camera loop and renderer
 * controls so both text-tab lift mode and generator-tab share the same
 * BOB GPU canvas without state leakage.
 */
function getActiveGpuScene() {
  if (state.activeTab === 'text' && state.liftMode) {
    return {
      scene: state.textLiftScene,
      sdf: state.textLiftSdf,
      rawScene: state.textLiftSceneJSON,
    };
  }
  if (state.activeTab === 'generator') {
    return { scene: state.genScene, sdf: state.genSdf, rawScene: state.genSceneJSON || null };
  }
  return { scene: null, sdf: null, rawScene: null };
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
    setTimeout(() => URL.revokeObjectURL(url), 5000); // allow async finishing
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
  const w = ctx.canvas.width,
    h = ctx.canvas.height;
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
// ---------------------------------------------------------------------------
// Path A — subject-as-layers for CPU renderers on lifted 3D scenes
// ---------------------------------------------------------------------------
// bobStipple and hatch were designed for layered 2D input where each
// `{sdf, color}` is a distinct region. When fed a single union SDF (entire
// lifted scene), the multi-region BOB two-palette aesthetic collapses.
//
// Path A: expose the scene's compiled.subjects array as N layers, each
// with its own SDF and a color derived from the subject's resolved
// material. groundSdf becomes layer 0 (back-most). The renderer algorithm
// is UNCHANGED — only the input shape changes.
// ---------------------------------------------------------------------------

function hsvToRgb(h, s, v) {
  // h, s, v in [0, 1]; returns [r, g, b] in [0, 255]
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let r = 0,
    g = 0,
    b = 0;
  switch (i % 6) {
    case 0:
      r = v;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = v;
      b = p;
      break;
    case 2:
      r = p;
      g = v;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = v;
      break;
    case 4:
      r = t;
      g = p;
      b = v;
      break;
    case 5:
      r = v;
      g = p;
      b = q;
      break;
  }
  return [(r * 255) | 0, (g * 255) | 0, (b * 255) | 0];
}

function materialToRgb(mat, fallback = [205, 95, 87]) {
  if (!mat) return fallback;
  // Resolved material is {hue, sat, value, metal, glow, kind}. v1 ignores
  // kind/metal — just HSV → RGB. v2 (future) routes kinds to specialized
  // brush idioms.
  const h = mat.hue ?? 0;
  const s = mat.sat ?? 0;
  const v = mat.value ?? 1;
  return hsvToRgb(h, s, v);
}

function buildLiftSceneLayers(gpuScene, cameraOpts) {
  // gpuScene.scene = compiled SceneData ({sdf, groundSdf, subjects:[{id,sdf,...}], ...})
  const compiled = gpuScene.scene;
  if (!compiled)
    return [{ sdf: gpuScene.sdf, color: [205, 95, 87], ...(cameraOpts ? { cameraOpts } : {}) }];

  const layers = [];

  // Ground first (back-most) so subjects paint over it
  if (compiled.groundSdf) {
    layers.push({
      sdf: compiled.groundSdf,
      color: materialToRgb(compiled.groundSdf._subjectMaterial, [180, 165, 140]),
      ...(cameraOpts ? { cameraOpts } : {}),
    });
  }

  // BACKGROUND FILL LAYER (compile.js line 781 workaround):
  // compile.js drops union-children's leaf SDFs from subjectInfos (passes []
  // for regionInfos). For unions like "rocket" (20+ children: stage tanks,
  // fairings, engines), this means NONE of those children show up in
  // compiled.subjects, so the per-subject layer loop misses the entire
  // rocket. BOB GPU sees the rocket because it uses the full compiled.sdf
  // (post-union); Path A's per-subject coloring scheme alone misses it.
  //
  // Fix: add the FULL gpuScene.sdf as the FIRST (back-most) layer with a
  // neutral fallback color. Subject-level layers paint over it with their
  // own colors. Geometry never gets lost; subjects with explicit material
  // still get their own brush palette.
  if (gpuScene.sdf) {
    layers.push({
      sdf: gpuScene.sdf,
      color: [180, 175, 165], // neutral warm gray
      ...(cameraOpts ? { cameraOpts } : {}),
    });
  }

  // Subjects in authored order (later subjects paint on top in BOB's
  // brush-stack loop). compiled.subjects contains BOTH leaf primitives
  // AND wrapping BooleanGroup SDFs — render only the entries with a
  // material set. This filters out group-level SDFs (which cover the
  // full union area and would otherwise paint over every leaf with the
  // fallback color when group.material is null).
  for (const info of compiled.subjects || []) {
    if (!info || !info.sdf) continue;
    const mat = info.sdf._subjectMaterial;
    if (!mat) continue; // skip group / unionless leaf without explicit material
    layers.push({
      sdf: info.sdf,
      color: materialToRgb(mat),
      ...(cameraOpts ? { cameraOpts } : {}),
    });
  }

  return layers.length > 0
    ? layers
    : [{ sdf: gpuScene.sdf, color: [205, 95, 87], ...(cameraOpts ? { cameraOpts } : {}) }];
}

function reRenderStored() {
  const ctx = $('c').getContext('2d');
  const active = state.activeRenderer;
  if (!isGpuRenderer(active)) {
    const gpuScene = getActiveGpuScene();
    if (gpuScene && gpuScene.sdf) {
      const cs = gpuScene.scene?.cameraStatic;
      const cameraOpts = cs
        ? {
            yaw: cs.yaw,
            pitch: cs.pitch,
            distance: cs.distance,
            target: [cs.targetX, cs.targetY, cs.targetZ],
          }
        : null;
      // Ortho view = world half-width the perspective camera frames at
      // distance d with focal F (= d / F). Strict parity with BOB GPU's
      // perspective framing — if BOB GPU doesn't render something (e.g.,
      // rocket-launch's rocket is hidden inside gantry at t=0 because the
      // animation hasn't fired), BOB CPU + Lines shouldn't render it
      // either. Slight pad (× 1.05) for a hair of margin.
      const focal = cs?.focal || 1.5;
      const view = cs ? Math.max(1, (cs.distance / focal) * 1.05) : 1.0;
      const synthLayers = buildLiftSceneLayers(gpuScene, cameraOpts);
      // Hash → numeric seed for CPU renderers (bobStipple picks 2-of-20
      // pigments from this). Same hash → same palette pair (deterministic).
      // 🎲 New Style button rolls a new tokenHash, so palette rerolls too.
      const hashSeed = URL_TOKEN_HASH
        ? Array.from(URL_TOKEN_HASH).reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0)
        : 42;
      const opts = {
        ...(state.lastRenderOpts || {}),
        ...(cameraOpts || {}),
        view,
        background: [240, 235, 225],
        seed: hashSeed,
      };
      doRender(ctx, synthLayers, opts);
      return;
    }
  }
  if (state.layers) {
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
  'china-carrier': '⚓',
  'gothic-cathedral': '⛪',
  'spiral-vase': '🏺',
  'mountain-village': '⛰️',
  'clock-915': '🕘',
  'vintage-bicycle': '🚲',
  'dining-setting': '🍽️',
  'coastal-lighthouse': '🗼',
};
function sceneEmoji(entry) {
  if (entry.id && DEMO_EMOJI_BY_ID[entry.id]) return DEMO_EMOJI_BY_ID[entry.id];
  if (entry.category === 'revolution') return '🏺';
  if (entry.category === 'diorama-topdown') return '⛰️';
  if (entry.category === 'model') return '◆';
  return '💾';
}

const TAB_CONTENT = {
  scenes: () => `
    <div class="scenes-hero">
      <h1>Atlas Scene Gallery</h1>
      <p>LLM-generated, editable 3D scenes you can fly through. Click any to open. <span class="cta" id="scenes-cta-text">Or write your own → Text tab</span></p>
    </div>

    <div class="scenes-section">
      <h2 class="scenes-section-title">Featured <span class="count" id="scenes-bundled-count">0</span></h2>
      <div class="scenes-grid-big" id="scenes-bundled-grid"></div>
    </div>

    <div class="scenes-section">
      <h2 class="scenes-section-title">
        My saved <span class="count" id="scenes-saved-count">0</span>
        <button class="header-btn" id="btn-upgrade-all-saved" style="display:none;" title="Re-lift each saved scene with the current v2.3 prompt (uses API credits)">🔄 Upgrade All to v2.3</button>
        <button class="header-btn" id="btn-export-all-saved" style="display:none;">📦 Export All</button>
        <span style="color:#666; font-size:10px; font-weight:400; text-transform:none; letter-spacing:0; margin-left:auto;">localStorage · this browser only</span>
      </h2>
      <div class="scenes-grid-big" id="scenes-saved-grid"></div>
    </div>
  `,

  text: () => `
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

  generator: () => `
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

  // 2D Editor — Pencil-style. Sidebar (Agent / Layers / Inspector tabs +
  // chat + layers + inspector content) mounts into #tab-content; canvas
  // viewport with floating tool palette mounts into #render-area. Wired
  // up in renderActiveTab → edit2d.init({...}).
  '2d-edit': () => '', // edit2d.init() writes its own markup into both containers

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
  // 2D Edit tab uses Pencil-style sidebar (left) + canvas viewport (right).
  // All other tabs use the standard sidebar + canvas split.
  document.body.classList.toggle('scenes-mode', state.activeTab === 'scenes');
  document.body.classList.toggle('editmode-2d', state.activeTab === '2d-edit');

  // edit2d module owns its own DOM; tear down if we're leaving the tab.
  if (state.activeTab !== '2d-edit' && edit2d.getInstance()) {
    edit2d.destroy();
  }

  updateCanvasVisibility();

  if (state.activeTab === 'scenes') {
    renderScenesTab();
  } else if (state.activeTab === 'text') {
    wireTextTab();
  } else if (state.activeTab === 'generator') {
    wireGeneratorTab();
  } else if (state.activeTab === '2d-edit') {
    edit2d.init({
      sidebarEl: $('tab-content'),
      viewportEl: $('render-area'),
    });
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
  const have3D = state.activeTab === 'generator' || (state.activeTab === 'text' && state.liftMode);
  const showGpu = have3D && isGpuRenderer(state.activeRenderer);
  // Canvas2D renderers (crayon / topo) use their own sibling <canvas> elements.
  // Hide c-gpu when one of them is active; show the matching one.
  const isCrayon = state.activeRenderer === 'crayon';
  const isTopo = state.activeRenderer === 'topo';
  const showWebgl = showGpu && !isCrayon && !isTopo;
  $('c').style.display = showGpu ? 'none' : 'block';
  $('c-gpu').style.display = showWebgl ? 'block' : 'none';
  const crayonCv = document.getElementById('c-crayon');
  if (crayonCv) crayonCv.style.display = showGpu && isCrayon ? 'block' : 'none';
  const topoCv = document.getElementById('c-topo');
  if (topoCv) topoCv.style.display = showGpu && isTopo ? 'block' : 'none';
  const fsBtn = $('btn-fullscreen');
  const shuffleBtn = $('btn-shuffle-palette');
  const lightPanel = $('light-panel');
  if (fsBtn) fsBtn.style.display = showGpu ? 'inline-flex' : 'none';
  // Shuffle only meaningful for BOB GPU (FLY 3D doesn't have a palette concept)
  if (shuffleBtn)
    shuffleBtn.style.display =
      showGpu && state.activeRenderer === 'bob-gpu' ? 'inline-flex' : 'none';
  const newStyleBtn = $('btn-new-style');
  if (newStyleBtn)
    newStyleBtn.style.display =
      showGpu && state.activeRenderer === 'bob-gpu' ? 'inline-flex' : 'none';
  if (lightPanel) lightPanel.style.display = showGpu ? 'block' : 'none';
  // 2026-05-24: when canvas becomes hidden (e.g. switch to Scenes tab),
  // unmount any active GPU renderer so its RAF loop stops. Without this the
  // FLY 3D / BOB GPU keeps doing 60fps shader work on an invisible canvas
  // (visible in the FPS counter staying high in Scenes mode). Wakeful re-mount
  // happens automatically the next time c-gpu becomes visible.
  // ALSO reset the bottom-left status texts + gallery selection so the user
  // returning to Scenes sees a clean "No scene · FPS: --" state instead of
  // stale "demo · 火箭发射 · FPS: 80" text from before they navigated away.
  if (!showGpu) {
    if (state.fly3dRenderer) state.fly3dRenderer.unmount();
    if (state.studioRenderer) state.studioRenderer.unmount();
    if (state.bobRenderer) state.bobRenderer.unmount();
    const fpsEl = $('fps');
    if (fpsEl) fpsEl.textContent = 'FPS: --';
    const sceneInfoEl = $('scene-info');
    if (sceneInfoEl) sceneInfoEl.textContent = 'No scene';
    activeDemoId = null;
    activeSavedId = null;
  }
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
  $$('#renderer-pills .pill').forEach((b) =>
    b.classList.toggle('active', b.dataset.renderer === state.activeRenderer),
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
    if (!confirm('Force a fresh LLM lift? This costs ~$0.20 and overwrites the cached scene.'))
      return;
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
  const selected = state.history.find((h) => h.id === state.selectedHistoryId);
  // A history entry is considered "matched" only when its 2D code still
  // matches what's in the textarea. If the user pasted/edited code, drop the
  // implied prompt-from-history binding — lift will fall back to prompting.
  const matchedHistory = selected && selected.code2d === code ? selected : null;
  const haveBoth = !!code; // code is enough; missing prompt is handled at lift time
  const hasCachedLift = !!matchedHistory?.lift?.sceneData;
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

function renderLiftedSceneData(
  sceneData,
  originalPrompt,
  infoLineHtml,
  { shufflePalette = true } = {},
) {
  const liftInfo = $('lift-info');
  let compiled;
  try {
    compiled = compileSceneData(sceneData, { tokenHash: URL_TOKEN_HASH });
  } catch (compileErr) {
    throw new Error(`SceneData compile failed: ${compileErr.message}`);
  }

  const renderSdf =
    compiled.groundSdf && compiled.sdf
      ? sdfUnion(compiled.sdf, compiled.groundSdf)
      : compiled.sdf || compiled.groundSdf;
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
  // Make Save Scene unambiguously visible whenever we have a rendered 3D
  // scene — covers cached lifts, fresh lifts, pasted-code lifts, and JSON
  // re-renders. Don't rely solely on refreshLiftButtonState's combined
  // condition, which historically has been brittle (paste-flow regression).
  const saveBtn = $('btn-save-scene');
  if (saveBtn) saveBtn.style.display = 'block';
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
  const selected = state.history.find((h) => h.id === state.selectedHistoryId);
  // A history entry is "matched" only when its stored code matches the
  // textarea. Pasted/edited code → unmatched → prompt-from-user path.
  const matchedHistory = selected && selected.code2d === code ? selected : null;
  const liftBtn = $('btn-lift-3d');
  const liftInfo = $('lift-info');
  if (!code) {
    if (liftInfo) {
      liftInfo.style.color = '#d9afaf';
      liftInfo.textContent = '✗ no 2D scene to lift';
    }
    setStatus('✗ no 2D scene to lift', true);
    return;
  }

  // For unmatched code (paste / edit), ask the user for a 1-line scene
  // description. The lift LLM uses it as cultural context (e.g. "lighthouse"
  // implies sailboats/gulls via the prompt's augmentation table). Short noun
  // phrases work best — verbose prompts hurt (see feedback_prompts_stay_short).
  let promptText = matchedHistory?.prompt;
  if (!matchedHistory) {
    promptText = window.prompt(
      'Describe this scene in a short noun phrase (used as context for the lift LLM):',
      'pasted 2D SDF scene',
    );
    if (promptText == null) {
      setStatus('lift cancelled');
      return;
    }
    promptText = promptText.trim() || 'pasted 2D SDF scene';
  }

  // Cache hit: history entry already has a previously-lifted SceneData.
  // Render it directly — zero token cost, instant load.
  if (!forceFresh && matchedHistory?.lift?.sceneData) {
    try {
      renderLiftedSceneData(
        matchedHistory.lift.sceneData,
        matchedHistory.prompt,
        `▶ cached lift loaded · 0 tokens · ${matchedHistory.lift.elapsed ?? '?'}s original`,
      );
      setStatus(`✓ cached 3D loaded — click canvas to fly`);
      return;
    } catch (e) {
      // Cache might be incompatible with current spec — fall through to fresh lift
      console.warn('cached lift failed to render, falling back to fresh LLM call:', e);
      if (liftInfo) {
        liftInfo.style.color = '#d9afaf';
        liftInfo.textContent = `✗ cached scene failed: ${e.message}. Will re-lift.`;
      }
    }
  }

  const apiKey = ($('api-key')?.value || localStorage.getItem(STORAGE_KEY) || '').trim();
  if (!apiKey) {
    if (liftInfo) {
      liftInfo.style.color = '#d9afaf';
      liftInfo.textContent = '✗ Anthropic API key required';
    }
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
    const result = await callLiftLLM(promptText, code, apiKey);
    const elapsed = ((performance.now() - t0) / 1000).toFixed(1);

    let sceneData;
    try {
      sceneData = parseLiftResponse(result.text);
    } catch (parseErr) {
      throw new Error(`JSON parse failed (${parseErr.message.slice(0, 100)})`);
    }

    renderLiftedSceneData(
      sceneData,
      promptText,
      `✓ ↑ ${result.usage.input_tokens} in · ↓ ${result.usage.output_tokens} out · ${elapsed}s`,
    );
    setStatus(`✓ 3D scene rendered (${elapsed}s) — click canvas to fly`);

    // Save lift to history entry alongside the 2D code (cache hit on next visit).
    // Only persist when we have a matched history entry — pasted code has no
    // entry to attach to, so we skip persistence rather than fabricate one.
    if (matchedHistory) {
      matchedHistory.lift = { sceneData, elapsed, usage: result.usage };
      saveHistory();
    }
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
  // Stop the GPU RAF loops + clear canvas so nothing keeps rendering against
  // a hidden canvas, and the next scene won't show stale pixels.
  if (state.bobRenderer) state.bobRenderer.unmount();
  if (state.fly3dRenderer) state.fly3dRenderer.unmount();
  if (state.studioRenderer) state.studioRenderer.unmount();
  updateCanvasVisibility();
  refreshLiftButtonState();
  const saveBtn = $('btn-save-scene');
  if (saveBtn) saveBtn.style.display = 'none';
  renderDemoGallery();
  $('scene-info').textContent = state.selectedHistoryId
    ? state.history.find((h) => h.id === state.selectedHistoryId)?.prompt?.slice(0, 40) ||
      'No scene'
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
      const sceneLight = scene?.lightStatic || { azimuth: 0.5, altitude: 0.7, distance: 30 };
      // User-controlled slider override > scene's saved light
      const light = state.lightOverride ?? sceneLight;
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
    onFps: (fps) => {
      $('fps').textContent = `FPS: ${fps.toFixed(0)}`;
    },
  });
  return state.fly3dRenderer;
}

// Studio: stripped-down FLY 3D sibling — neutral grey bg + checker floor + no
// fog / clouds / lens flares / volumes. Atom test stage for inspecting
// individual subjects in a clean environment.
function ensureStudioRenderer() {
  if (state.studioRenderer) return state.studioRenderer;
  const canvas = $('c-gpu');
  state.studioRenderer = createStudioRenderer({
    canvas,
    getControls: () => {
      const { scene } = getActiveGpuScene();
      const sceneLight = scene?.lightStatic || { azimuth: 0.5, altitude: 0.7, distance: 30 };
      const light = state.lightOverride ?? sceneLight;
      const cam = scene?.cameraStatic;
      return {
        lightAzim: light.azimuth,
        lightAlt: light.altitude,
        lightDist: light.distance,
        fov: cam?.focal || 1.5,
        shadowsOn: true,
        // Studio's whole point: render a built-in checker ground plane so the
        // atom has a visible "stage". groundOn unions a y=GROUND_Y plane into
        // mapWithGround; checkerOn picks the grey-checker shading branch.
        groundOn: true,
        checkerOn: true,
      };
    },
    onFps: (fps) => {
      $('fps').textContent = `FPS: ${fps.toFixed(0)}`;
    },
  });
  return state.studioRenderer;
}

/**
 * Render the active 3D scene (from getActiveGpuScene) using whichever
 * GPU renderer the active pill selects. Unmounts the inactive one so
 * pointer-lock doesn't leak and RAF loops don't compete for the canvas.
 */
let _lastRenderedScene = null;
let _lastStudioFramedScene = null; // W12: studio auto-frames each scene once
function runActiveGpuRenderer({ keepCamera = false } = {}) {
  const { sdf, scene, rawScene } = getActiveGpuScene();
  if (!sdf || !scene) return { bytes: 0 };

  // Scene change → clear light override so the new scene's saved lighting
  // takes effect. (Renderer pill switch on same scene does NOT clear.)
  if (scene !== _lastRenderedScene) {
    state.lightOverride = null;
    _lastRenderedScene = scene;
    // Defer slider sync to after the scene is actually compiled+rendered
    setTimeout(updateLightSliders, 0);
  }

  if (state.activeRenderer === 'fly3d') {
    if (state.bobRenderer) state.bobRenderer.unmount();
    if (state.blueprintRenderer) state.blueprintRenderer.unmount();
    if (state.crayonRenderer) state.crayonRenderer.unmount();
    if (state.topoRenderer) state.topoRenderer.unmount();
    const fly = ensureFly3dRenderer();
    if (!keepCamera && scene.cameraStatic) fly.setCamState(sphericalToCamState(scene.cameraStatic));
    // Sprint 1: per-scene post-FX overrides (exposure / vignette / bloom /
    // aperture+DoF). scene.defaults.postFx is optional — undefined fields fall
    // back to postfx.js DEFAULT_POSTFX so even pre-Sprint-1 scenes get the
    // baseline cinematic look without JSON changes.
    // NOTE: `scene` is the compiled SceneData (sdf/cameraStatic/lightStatic
    // tuples) — NOT the raw JSON. defaults.postFx + cameraSequence live on the
    // raw sceneData JSON, accessible via rawScene.
    if (fly.setPostFx) {
      fly.setPostFx(
        rawScene || {},
        (rawScene && rawScene.defaults && rawScene.defaults.camera) || null,
      );
    }
    // Sprint 2: cameraSequence drives the camera if present. Show timeline UI.
    if (fly.setSequence) {
      const seq = rawScene && rawScene.cameraSequence ? rawScene.cameraSequence : null;
      fly.setSequence(seq);
      window._lastSceneForTimeline = rawScene; // loop toggle reads/writes seq.loop
      // Defer UI update to next tick — timeline UI helpers haven't been
      // function-hoisted on first compositor load. After bootstrap they
      // exist; setTimeout(0) guarantees they're reachable.
      setTimeout(() => {
        if (typeof updateTimelineUI === 'function') updateTimelineUI();
      }, 0);
    }
    // Sprint 3: volumetric primitives (smoke / flame / fog / god-rays).
    if (fly.setVolumes) {
      fly.setVolumes(rawScene && Array.isArray(rawScene.volumes) ? rawScene.volumes : []);
    }
    // Sprint A7: voxel-walk for procedural-city primitive. Walks subject tree
    // for any 'procedural-city' type — enables u_cityActive in shader so
    // raymarch clamps step to block boundaries (otherwise sphere trace
    // overshoots discontinuous SDF).
    if (fly.setCityMode && rawScene && Array.isArray(rawScene.subjects)) {
      const hasCity = JSON.stringify(rawScene.subjects).includes('"procedural-city"');
      fly.setCityMode(hasCity);
    }
    // Sprint 12: Rune erosion heightmap. compile() already baked into
    // scene.bakedHeightmap if the scene has terrain-eroded-rune. Push to
    // renderer; pass null when scene has none (clears any prior texture).
    if (fly.setRuneHeightmap) {
      fly.setRuneHeightmap(scene.bakedHeightmap || null);
    }
    // Sprint 4: register motion slots + subject base positions so the camera
    // sequence evaluator can compute subject-anchored shake / target / volume
    // offset every frame.
    if (fly.setMotionSlots && scene.motionSlots) {
      fly.setMotionSlots(scene.motionSlots);
    }
    if (fly.setSubjectBaseTargets && rawScene && Array.isArray(rawScene.subjects)) {
      const baseTargets = {};
      for (const s of rawScene.subjects) {
        if (s.id && s.transform && Array.isArray(s.transform.translate)) {
          const t = s.transform.translate;
          // Skip if any axis was already wrapped in a time-expr (motion subject's
          // base goes through anyway — the uniform fills in the dynamic delta).
          const nums = t.slice(0, 3).map((x) => (typeof x === 'number' ? x : 0));
          baseTargets[s.id] = nums;
        }
      }
      fly.setSubjectBaseTargets(baseTargets);
    }
    try {
      return fly.render(sdf);
    } catch (e) {
      setStatus(`✗ fly3d render: ${e.message}`, true);
      console.error(e);
      return { bytes: 0 };
    }
  } else if (state.activeRenderer === 'studio') {
    // Studio: clean atom test stage (neutral bg + checker floor + no fog).
    // Same SDF compile path as fly3d; the difference is the renderer's own
    // shader template (sky/fog/clouds/lens-flares stripped, ground+checker on).
    // Don't unmount self — ensureStudioRenderer() reuses the existing instance.
    if (state.fly3dRenderer) state.fly3dRenderer.unmount();
    if (state.bobRenderer) state.bobRenderer.unmount();
    if (state.blueprintRenderer) state.blueprintRenderer.unmount();
    if (state.crayonRenderer) state.crayonRenderer.unmount();
    if (state.topoRenderer) state.topoRenderer.unmount();
    const st = ensureStudioRenderer();
    // W12 auto-framing: instead of a fixed pose (which forced atoms to be hand-
    // scaled to fit), compute the SDF's bounding box and fit the camera to it —
    // once per scene. The camera is placed at target − forward·distance for a
    // fixed 3/4 elevated angle, so it always looks at the subject. Skipped for
    // re-renders of the same scene, and for unbounded/huge SDFs (e.g. an
    // in-SDF ground plane or terrain → bbox hits the search radius), which keep
    // studio's neutral default pose.
    if (
      !keepCamera &&
      scene !== _lastStudioFramedScene &&
      sdf &&
      sdf.f &&
      !(rawScene && rawScene.cameraSequence)
    ) {
      _lastStudioFramedScene = scene;
      const framedScene = scene;
      // Auto-framing is a CPU bbox sweep (tens of thousands of sdf.f evals) — at
      // the old radius:10/res:56 it cost ~95ms and froze scene entry, which read
      // as "slow load vs Shadertoy". Fix: (1) DEFER off the critical path so the
      // first studio frame paints immediately (≈1ms below), bbox + camera fit run
      // next frame then re-render; (2) cheaper sweep — a smaller search radius
      // gives FINER cells (better thin-atom capture) at far fewer evals.
      requestAnimationFrame(() => {
        if (framedScene !== _lastStudioFramedScene) return; // a newer scene loaded; abort
        try {
          // radius 6 (covers translated atoms) × res 36 → cell ~0.33; iso 0.2 so
          // THIN atoms (flat rings / arrow shafts / gear teeth) still register.
          const bb = bbox3FromSDF((p) => sdf.f(p), { radius: 6, res: 36, iso: 0.2 });
          const maxDim = Math.max(bb.size[0], bb.size[1], bb.size[2]);
          // maxDim ≥ ~11 means the sweep hit its boundary (unbounded SDF / ground
          // plane) → keep studio's neutral default pose.
          if (!bb.empty && maxDim > 0.05 && maxDim < 11) {
            const fit = cameraFitFromBBox(bb.min, bb.max, 1.1, 1.3);
            const yaw = 0.5;
            const pitch = 0.32; // downward in studio's convention (fwd.y = −sin pitch)
            const cp = Math.cos(pitch),
              sp = Math.sin(pitch),
              cy = Math.cos(yaw),
              sy = Math.sin(yaw);
            const fwd = [sy * cp, -sp, cy * cp];
            st.setCamState({
              position: [
                fit.target[0] - fwd[0] * fit.distance,
                fit.target[1] - fwd[1] * fit.distance,
                fit.target[2] - fwd[2] * fit.distance,
              ],
              yaw,
              pitch,
            });
            st.render(sdf); // re-render with the fitted camera (studio is on-demand)
          }
        } catch (e) {
          /* unbounded SDF / eval error → keep studio's default pose */
        }
      });
    }
    if (st.setPostFx) {
      st.setPostFx(
        rawScene || {},
        (rawScene && rawScene.defaults && rawScene.defaults.camera) || null,
      );
    }
    // Sprint 12: Rune heightmap → studio texture (same data as FLY 3D).
    if (st.setRuneHeightmap) st.setRuneHeightmap(scene.bakedHeightmap || null);
    // Step 2 (spatial deck): a scene.cameraSequence flies the studio camera
    // through multiple slide-stations laid out in one 3D world. Studio already
    // plays it per-frame (draw loop) — just hand it the sequence (or null to
    // detach + fall back to WASD / auto-frame).
    if (st.setSequence) st.setSequence((rawScene && rawScene.cameraSequence) || null);
    try {
      return st.render(sdf);
    } catch (e) {
      setStatus(`✗ studio render: ${e.message}`, true);
      console.error(e);
      return { bytes: 0 };
    }
  } else if (state.activeRenderer === 'blueprint') {
    // Sprint 3: 4-view engineering drawing. Reuses sceneSDF compile path; needs
    // model bbox to frame the ortho views. Derive from scene.cameraStatic
    // (target XYZ + distance). FLY 3D + BOB GPU must be unmounted first.
    if (state.fly3dRenderer) state.fly3dRenderer.unmount();
    if (state.studioRenderer) state.studioRenderer.unmount();
    if (state.bobRenderer) state.bobRenderer.unmount();
    if (state.crayonRenderer) state.crayonRenderer.unmount();
    if (state.topoRenderer) state.topoRenderer.unmount();
    const bp = ensureBlueprintRenderer();
    if (scene.cameraStatic) {
      const cs = scene.cameraStatic;
      // Model half-extent the perspective camera frames at distance `d` with
      // focal `F` is d/F (because edge of normalized screen at distance d
      // lies at world half-width d/focal). Earlier `cs.distance * 0.6`
      // assumed default focal ~1.5 and shrank everything when focal was
      // higher (e.g., bonsai uses focal=5 → views were 3× too zoomed-out).
      const focal = cs.focal || 1.5;
      bp.setModelBounds([cs.targetX, cs.targetY, cs.targetZ], cs.distance / focal);
    }
    // Sprint 12: Rune heightmap → blueprint texture (same data as FLY 3D).
    if (bp.setRuneHeightmap) bp.setRuneHeightmap(scene.bakedHeightmap || null);
    try {
      return bp.render(sdf);
    } catch (e) {
      setStatus(`✗ blueprint render: ${e.message}`, true);
      console.error(e);
      return { bytes: 0 };
    }
  } else if (state.activeRenderer === 'crayon') {
    // 4th renderer (Sprint 12-3d): Canvas2D physics-pen scribble accumulator.
    if (state.fly3dRenderer) state.fly3dRenderer.unmount();
    if (state.studioRenderer) state.studioRenderer.unmount();
    if (state.bobRenderer) state.bobRenderer.unmount();
    if (state.blueprintRenderer) state.blueprintRenderer.unmount();
    if (state.topoRenderer) state.topoRenderer.unmount();
    const cr = ensureCrayonRenderer();
    if (cr.setRuneHeightmap) cr.setRuneHeightmap(scene.bakedHeightmap || null);
    try {
      return cr.render(sdf, scene);
    } catch (e) {
      setStatus(`✗ crayon render: ${e.message}`, true);
      console.error(e);
      return { bytes: 0 };
    }
  } else if (state.activeRenderer === 'topo') {
    // 5th renderer (Sprint 12-3c): Canvas2D streamline-hatching. Strokes
    // flow downhill following heightmap gradient; hash selects mono vs
    // multi-color palette mode.
    if (state.fly3dRenderer) state.fly3dRenderer.unmount();
    if (state.studioRenderer) state.studioRenderer.unmount();
    if (state.bobRenderer) state.bobRenderer.unmount();
    if (state.blueprintRenderer) state.blueprintRenderer.unmount();
    if (state.crayonRenderer) state.crayonRenderer.unmount();
    const tp = ensureTopoRenderer();
    if (tp.setRuneHeightmap) tp.setRuneHeightmap(scene.bakedHeightmap || null);
    try {
      return tp.render(sdf, scene);
    } catch (e) {
      setStatus(`✗ topo render: ${e.message}`, true);
      console.error(e);
      return { bytes: 0 };
    }
  } else {
    // default to bob-gpu
    if (state.fly3dRenderer) state.fly3dRenderer.unmount();
    if (state.studioRenderer) state.studioRenderer.unmount();
    if (state.blueprintRenderer) state.blueprintRenderer.unmount();
    if (state.crayonRenderer) state.crayonRenderer.unmount();
    if (state.topoRenderer) state.topoRenderer.unmount();
    const bob = ensureBobRenderer();
    if (!keepCamera && scene.cameraStatic) bob.setCamState(sphericalToCamState(scene.cameraStatic));
    // Sprint 12: Rune heightmap → BOB GPU texture (same data as FLY 3D).
    if (bob.setRuneHeightmap) bob.setRuneHeightmap(scene.bakedHeightmap || null);
    // Generator-V handoff: apply current style (palette / skip / bg variety)
    // before render. Style stays bound until "🎲 New style" button regenerates.
    bob.applyStyle(state.bobStyle);
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

function ensureTopoRenderer() {
  if (state.topoRenderer) return state.topoRenderer;
  // Sprint 12-3c: Canvas2D streamline-hatching renderer. Same sibling-canvas
  // pattern as crayon — uses #c-topo created on-demand.
  state.topoRenderer = createStreamlineRenderer({
    canvas: $('c-gpu'),
    getControls: () => {
      const { scene } = getActiveGpuScene();
      const cam = scene?.cameraStatic;
      const sceneLight = scene?.lightStatic || { azimuth: 0.5, altitude: 0.7, distance: 30 };
      const light = state.lightOverride ?? sceneLight;
      return {
        lightAzim: light.azimuth,
        lightAlt: light.altitude,
        lightDist: light.distance,
        fov: cam?.focal || 1.5,
      };
    },
    onFps: (fps) => {
      $('fps').textContent = `FPS: ${fps.toFixed(0)}`;
    },
  });
  return state.topoRenderer;
}

function ensureCrayonRenderer() {
  if (state.crayonRenderer) return state.crayonRenderer;
  // Sprint 12-3d: Canvas2D physics-pen renderer. Uses its own sibling <canvas>
  // (createCrayonRenderer creates #c-crayon on demand); the canvas arg is
  // passed but ignored — Canvas2D and WebGL2 can't coexist on the same element.
  state.crayonRenderer = createCrayonRenderer({
    canvas: $('c-gpu'),
    getControls: () => {
      const { scene } = getActiveGpuScene();
      const cam = scene?.cameraStatic;
      const sceneLight = scene?.lightStatic || { azimuth: 0.5, altitude: 0.7, distance: 30 };
      const light = state.lightOverride ?? sceneLight;
      return {
        lightAzim: light.azimuth,
        lightAlt: light.altitude,
        lightDist: light.distance,
        fov: cam?.focal || 1.5,
      };
    },
    onFps: (fps) => {
      $('fps').textContent = `FPS: ${fps.toFixed(0)}`;
    },
  });
  return state.crayonRenderer;
}

function ensureBlueprintRenderer() {
  if (state.blueprintRenderer) return state.blueprintRenderer;
  const canvas = $('c-gpu');
  state.blueprintRenderer = createBlueprintRenderer({
    canvas,
    getControls: () => {
      // Blueprint only needs light direction; reuse scene light or default.
      const { scene } = getActiveGpuScene();
      const sceneLight = scene?.lightStatic || { azimuth: 0.5, altitude: 0.7, distance: 30 };
      const light = state.lightOverride ?? sceneLight;
      return { lightAzim: light.azimuth, lightAlt: light.altitude, lightDist: light.distance };
    },
    onFps: (fps) => {
      $('fps').textContent = `FPS: ${fps.toFixed(0)}`;
    },
  });
  return state.blueprintRenderer;
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
      const sceneLight = scene.evalLight ? scene.evalLight(t) : scene.lightStatic;
      // User-controlled slider override > scene/anim-evaluated light
      const light = state.lightOverride ?? sceneLight;
      const shadow = scene.evalShadow ? scene.evalShadow(t) : scene.shadowStatic;
      // Spread Generator-V output (state.bobStyle) — all autoscope-style
      // randomization comes from here. shadow scene state still drives
      // shadowMode from SceneData (when present); rest is style-driven.
      const sceneShadowMode = shadow?.mode ? shadowModeNameToInt(shadow.mode) : null;
      return {
        ...state.bobStyle,
        // bobShader expects these renamed fields:
        shadowMode: sceneShadowMode ?? state.bobStyle.shadow ?? 0,
        postNFactor: state.bobStyle.nFactor,
        postNoiseCap: state.bobStyle.noiseCap,
        postColorLeak: state.bobStyle.colorLeak,
        // SceneData-driven (override style):
        lightAzim: light.azimuth,
        lightAlt: light.altitude,
        lightDist: light.distance,
        fov: cam.focal || 1.5,
        shadowStrength: shadow?.strength ?? state.bobStyle.shadowStrength,
        shadowsOn: shadow?.enabled !== false,
        // Compositor-specific defaults:
        groundOn: false,
        noiseSpeed: 0.00016,
        worldScale: 0.5,
      };
    },
    onFps: (fps) => {
      $('fps').textContent = `FPS: ${fps.toFixed(0)}`;
    },
  });
  return state.bobRenderer;
}

function defaultBobControls() {
  return {
    lightAzim: 0.5,
    lightAlt: 0.7,
    lightDist: 30,
    fov: 1.5,
    coldiv: 1.1,
    coloration: 0,
    shadowMode: 0,
    shadowStrength: 0.35,
    shadowsOn: true,
    groundOn: false,
    noiseSpeed: 0.00016,
    exposure: 1.05,
    saturation: 1.0,
    worldScale: 0.5,
    postNoise: 1.0,
    postNFactor: 1.0,
    postNoiseCap: 0.5,
    mirrorX: false,
    mirrorZ: false,
    twist: 0,
    twistType: 0,
    gridRot: [0, 0, 0],
  };
}

// ============================================================================
// Generator-V (BOB GPU style) — bootstrap + regenerate
// ----------------------------------------------------------------------------
// styleHash → randomizeBobStyle(rng) → BobStyle pure JSON → bob.applyStyle()
// Independent of scene (orthogonal axis). compositor's BOB GPU mode uses the
// same Generator-V layer as autoscope-clone.
// ============================================================================

function bootstrapBobStyle() {
  // Read styleHash from URL, generate if absent / invalid.
  const urlStyleHash = new URLSearchParams(window.location.search).get('styleHash');
  state.styleHash = isValidHash(urlStyleHash) ? urlStyleHash : generateHash();
  writeStyleHashToURL(state.styleHash);
  state.bobStyle = randomizeBobStyle(new Random(state.styleHash));
}

function bootstrapSceneHash() {
  // Read sceneHash from URL, generate if absent / invalid. Drives Generator-S
  // variant expansion. Stable default so demos render deterministically across
  // reloads; user can shift+S equivalent to roll a new scatter ordering.
  const urlSceneHash = new URLSearchParams(window.location.search).get('sceneHash');
  state.sceneHash = isValidHash(urlSceneHash) ? urlSceneHash : generateHash();
}

function regenerateSceneHash() {
  state.sceneHash = generateHash();
  // Re-load active demo to pick up the new expansion.
  if (state.activeDemoId) {
    const demo = state.demos?.find((d) => d.id === state.activeDemoId);
    if (demo) loadDemoScene(demo);
  }
}

function regenerateBobStyle() {
  state.styleHash = generateHash();
  writeStyleHashToURL(state.styleHash);
  state.bobStyle = randomizeBobStyle(new Random(state.styleHash));
  if (state.bobRenderer && state.activeRenderer === 'bob-gpu') {
    state.bobRenderer.applyStyle(state.bobStyle);
  }
}

function writeStyleHashToURL(hash) {
  const url = new URL(window.location);
  url.searchParams.set('styleHash', hash);
  window.history.replaceState(null, '', url);
}

function shadowModeNameToInt(mode) {
  return { channelSwap: 0, hueRotate180: 1, hueRotate90: 2, darken: 3 }[mode] ?? 0;
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
  const sceneType = choice === 'random' ? randomSceneTypeData(rng) : +choice;

  const sceneData = generateSceneData(sceneType, rng);
  let compiled;
  try {
    compiled = compileSceneData(sceneData, { tokenHash: URL_TOKEN_HASH });
  } catch (e) {
    setStatus(`✗ compile error: ${e.message}`, true);
    console.error(e);
    return;
  }

  // Union ground into the SDF tree (compile returns it separately)
  const renderSdf =
    compiled.groundSdf && compiled.sdf
      ? sdfUnion(compiled.sdf, compiled.groundSdf)
      : compiled.sdf || compiled.groundSdf;

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
    $('scene-info').textContent =
      `${SCENE_NAMES_DATA[sceneType]} · hash ${state.genHash.slice(0, 8)}…`;
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
    state.genHash = urlHash && isValidHash(urlHash) ? urlHash : generateHash();
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
  list.innerHTML = state.history
    .map(
      (h) => `
    <div class="history-item ${h.id === state.selectedHistoryId ? 'active' : ''}" data-id="${h.id}">
      <span class="history-prompt">${escapeHtml(h.prompt)}</span>
      <span class="history-time">${formatTime(h.timestamp)}</span>
      <button class="history-del" data-id="${h.id}" title="Delete">×</button>
    </div>
  `,
    )
    .join('');

  list.querySelectorAll('.history-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('history-del')) return; // delegated below
      loadHistoryEntry(item.dataset.id);
    });
  });
  list.querySelectorAll('.history-del').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteHistoryEntry(btn.dataset.id);
    });
  });
}

async function loadHistoryEntry(id) {
  const entry = state.history.find((h) => h.id === id);
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
  return s.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
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

$$('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    if (btn.classList.contains('stub')) return;
    const tab = btn.dataset.tab;
    state.activeTab = tab;
    $$('.tab').forEach((b) => b.classList.toggle('active', b === btn));
    renderActiveTab();
    setStatus(`tab → ${tab}`);
  });
});

$$('#renderer-pills .pill').forEach((btn) => {
  btn.addEventListener('click', () => {
    const newR = btn.dataset.renderer;
    state.activeRenderer = newR;
    $$('#renderer-pills .pill').forEach((b) => b.classList.toggle('active', b === btn));

    if (!isGpuRenderer(newR)) {
      // 2D pill: release any GPU renderer first (cancels its RAF + pointer lock).
      if (state.bobRenderer) state.bobRenderer.unmount();
      if (state.fly3dRenderer) state.fly3dRenderer.unmount();
      if (state.studioRenderer) state.studioRenderer.unmount();
    }
    updateCanvasVisibility();
    if (!isGpuRenderer(newR)) reRenderStored();
    setStatus(`renderer → ${state.activeRenderer}`);
  });
});

// 🎲 New Style — reroll tokenHash. For hash-driven scenes (bonsai-mountain etc)
// this changes both the mountain SHAPE (via terrain-eroded-rune bake) and the
// renderer styling (Topo style/treatment, Crayon palette, etc).
//
// reRenderStored alone uses the cached `compiled` so the bonsai bake doesn't
// re-run — we must call renderLiftedSceneData(stored JSON) to force recompile
// with the new tokenHash, then re-issue the CPU draw.
(function wireNewHashButton() {
  const btn = document.getElementById('btn-new-hash');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const newHash =
      '0x' + [...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
    URL_TOKEN_HASH = newHash;
    try {
      const url = new URL(window.location);
      url.searchParams.set('tokenHash', newHash);
      window.history.replaceState(null, '', url);
    } catch (_) {}
    setStatus(`🎲 new tokenHash → ${newHash.slice(0, 10)}…`);

    // Recompile lifted scene with new hash → re-bake hash-driven primitives
    // (terrain-eroded-rune, future ones). Without this only renderers that
    // read URL at draw-time (Topo, Crayon) would change.
    if (state.textLiftSceneJSON) {
      try {
        renderLiftedSceneData(
          state.textLiftSceneJSON,
          state.textLiftSourcePrompt || '',
          '🎲 new tokenHash',
          { shufflePalette: false },
        );
      } catch (e) {
        console.error('[new-hash] recompile failed', e);
      }
    }
    // CPU renderers need an explicit re-draw — GPU is already redrawing
    // continuously via RAF.
    if (!isGpuRenderer(state.activeRenderer)) reRenderStored();
  });
})();

// =============================================================================
// Placeholder canvas (when no scene loaded)
// =============================================================================

function drawPlaceholder() {
  const canvas = $('c');
  const ctx = canvas.getContext('2d');
  const w = canvas.width,
    h = canvas.height;

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
  ctx.moveTo(20, 20 + c);
  ctx.lineTo(20, 20);
  ctx.lineTo(20 + c, 20);
  ctx.moveTo(w - 20 - c, 20);
  ctx.lineTo(w - 20, 20);
  ctx.lineTo(w - 20, 20 + c);
  ctx.moveTo(w - 20, h - 20 - c);
  ctx.lineTo(w - 20, h - 20);
  ctx.lineTo(w - 20 - c, h - 20);
  ctx.moveTo(20 + c, h - 20);
  ctx.lineTo(20, h - 20);
  ctx.lineTo(20, h - 20 - c);
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
  statusTimer = setTimeout(() => {
    el.textContent = 'ready';
    el.className = '';
  }, 4000);
}

function updateSceneInfo() {
  if (state.scene) {
    const n = state.scene.subjects?.length ?? 0;
    $('scene-info').textContent = `${state.scene.name ?? 'scene'} · ${n} subjects`;
  } else if (state.layers) {
    $('scene-info').textContent =
      `${state.layers.length} layer${state.layers.length === 1 ? '' : 's'}`;
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
$('c-gpu').addEventListener('pointerdown', () => {
  userTookCam = true;
});

// ----- Shared-scene URL banner handlers -----
$('btn-save-shared')?.addEventListener('click', saveSharedScene);
$('btn-dismiss-shared')?.addEventListener('click', dismissSharedBanner);

// ----- Sprint 2: Camera sequence timeline scrubber -----
// Show / hide + drive the playback UI for FLY 3D cameraSequence demos.
// State machine: fly.isSequenceActive() decides visibility every loadDemoScene
// call AND every 200ms tick (so user-pause / sequence-end states update).
function updateTimelineUI() {
  const bar = document.getElementById('timeline-bar');
  if (!bar) return;
  const fly = state.fly3dRenderer;
  const hasSeq =
    state.activeRenderer === 'fly3d' &&
    fly &&
    fly.getSequenceDuration &&
    fly.getSequenceDuration() > 0;
  bar.style.display = hasSeq ? 'flex' : 'none';
  if (!hasSeq) return;
  const dur = fly.getSequenceDuration();
  const t = Math.min(fly.getSequenceTime(), dur);
  const scrubber = document.getElementById('timeline-scrubber');
  if (scrubber && document.activeElement !== scrubber) {
    scrubber.value = String(Math.round((t / dur) * 1000));
  }
  const fmt = (s) => {
    const m = Math.floor(s / 60),
      sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };
  const timeEl = document.getElementById('timeline-time');
  if (timeEl) timeEl.textContent = `${fmt(t)} / ${fmt(dur)}`;
}
// Periodic tick to keep time display + scrubber thumb in sync with playback.
setInterval(updateTimelineUI, 200);

document.getElementById('timeline-play')?.addEventListener('click', () => {
  const fly = state.fly3dRenderer;
  if (!fly || !fly.isSequenceActive) return;
  // Toggle pause. setSequencePaused inverts internal flag.
  const wasPlaying = fly.isSequenceActive();
  fly.setSequencePaused(wasPlaying);
  const btn = document.getElementById('timeline-play');
  if (btn) btn.textContent = wasPlaying ? '▶' : '⏸';
});

document.getElementById('timeline-scrubber')?.addEventListener('input', (e) => {
  const fly = state.fly3dRenderer;
  if (!fly || !fly.setSequenceTime) return;
  const dur = fly.getSequenceDuration();
  const t = (Number(e.target.value) / 1000) * dur;
  fly.setSequenceTime(t);
});

document.getElementById('timeline-loop')?.addEventListener('click', (e) => {
  // Toggle loop in the active scene's cameraSequence object directly.
  // (Visual-only — the evaluator reads seq.loop on each frame.)
  const lastScene = window._lastSceneForTimeline;
  if (!lastScene || !lastScene.cameraSequence) return;
  lastScene.cameraSequence.loop = !lastScene.cameraSequence.loop;
  e.currentTarget.classList.toggle('active', lastScene.cameraSequence.loop);
});

// ----- Generator-A: Oxygene Pt.4 synth toggle (Phase 2) -----
// Lazily instantiate the synth on first ▶ click. Web Audio AudioContext can't
// start without user gesture, so this must be inside the button handler.
let _oxygeneSynth = null;
document.getElementById('timeline-music')?.addEventListener('click', () => {
  const btn = document.getElementById('timeline-music');
  if (!btn) return;
  if (!_oxygeneSynth) _oxygeneSynth = createSynth('oxygene');
  if (!_oxygeneSynth) {
    setStatus('✗ audio: synth init failed', true);
    return;
  }
  if (_oxygeneSynth.isOn()) {
    _oxygeneSynth.stop();
    btn.textContent = '♪';
    btn.style.color = '';
    setStatus('♪ Oxygene stopped');
  } else {
    _oxygeneSynth.start();
    btn.textContent = '♫';
    btn.style.color = '#ffd070';
    setStatus('♫ Oxygene Pt.4 playing');
  }
});
// Expose for video recorder so it can capture audio track too (Phase 3).
window._getOxygeneSynth = () => _oxygeneSynth;

// ----- Sprint 8.5: Record current cameraSequence to .webm video -----
// MediaRecorder on the FLY 3D canvas stream. Records exactly one loop of the
// active sequence (loop temporarily disabled during recording so it stops at
// the natural end). Downloads as <scene-name>-<timestamp>.webm.
//
// WebM is the only universally available container for MediaRecorder; convert
// to MP4 client-side via ffmpeg.wasm if needed (not in this commit).
document.getElementById('timeline-record')?.addEventListener('click', async () => {
  const btn = document.getElementById('timeline-record');
  if (!btn || btn.disabled) return;
  const fly = state.fly3dRenderer;
  if (!fly || !fly.getSequenceDuration) {
    setStatus('✗ record: switch to FLY 3D with a cameraSequence first', true);
    return;
  }
  const dur = fly.getSequenceDuration();
  if (dur <= 0) {
    setStatus('✗ record: active scene has no cameraSequence', true);
    return;
  }
  const canvas = $('c-gpu');
  if (!canvas || typeof canvas.captureStream !== 'function') {
    setStatus('✗ record: canvas.captureStream not supported in this browser', true);
    return;
  }
  if (typeof MediaRecorder === 'undefined') {
    setStatus('✗ record: MediaRecorder API not available', true);
    return;
  }

  // MP4 (H.264) first — universal playback (WeChat / Douyin / WhatsApp / iOS
  // Photos all accept it). Falls back to WebM (VP9/VP8) when browser can't
  // record MP4 (Firefox + older Chrome). Both formats carry audio when the
  // Oxygene synth is playing (audio track added below).
  const FORMAT_CANDIDATES = [
    'video/mp4;codecs=avc1.42E01F,mp4a.40.2', // H.264 baseline + AAC
    'video/mp4;codecs=avc1.42E01F', // H.264 video only
    'video/mp4', // generic mp4
    'video/webm;codecs=vp9,opus', // WebM VP9 + Opus audio
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp8',
    'video/webm',
  ];
  let mimeType = null;
  for (const f of FORMAT_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(f)) {
      mimeType = f;
      break;
    }
  }
  if (!mimeType) {
    setStatus('✗ record: no supported video format in this browser', true);
    return;
  }
  const isMp4 = mimeType.startsWith('video/mp4');
  const ext = isMp4 ? 'mp4' : 'webm';
  const blobType = isMp4 ? 'video/mp4' : 'video/webm';

  // Disable loop during recording so the sequence stops at its natural end.
  const sceneRef = window._lastSceneForTimeline;
  const wasLooping = sceneRef?.cameraSequence?.loop ?? true;
  if (sceneRef?.cameraSequence) sceneRef.cameraSequence.loop = false;

  // Reset to t=0 and resume playback
  fly.setSequenceTime(0);
  if (fly.setSequencePaused) fly.setSequencePaused(false);

  btn.disabled = true;
  btn.textContent = '⏹';
  btn.style.color = '#ff5050';

  // Sprint A-Phase-3: combine canvas video stream + Oxygene audio stream into
  // one MediaStream so the recorded .webm has BOTH video and audio tracks.
  // The synth must already be playing for its audio track to be present —
  // recorder.start() snapshots tracks at that instant. Caller can either:
  //   (a) start ♪ music first, then click ⏺ — synth audio captured
  //   (b) click ⏺ without starting music — silent video
  // We do NOT auto-start music: the user might want a silent shot, and
  // AudioContext start needs its own gesture flow.
  const videoStream = canvas.captureStream(30);
  const tracks = [...videoStream.getVideoTracks()];
  const synth = typeof window._getOxygeneSynth === 'function' ? window._getOxygeneSynth() : null;
  if (synth && synth.isOn()) {
    const audioStream = synth.getMediaStream();
    tracks.push(...audioStream.getAudioTracks());
  }
  const stream = new MediaStream(tracks);
  const chunks = [];
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 12_000_000 });
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: blobType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const baseName = (sceneRef?.name || sceneRef?.id || 'atlas-scene')
      .toString()
      .replace(/[^a-zA-Z0-9-_]+/g, '-')
      .slice(0, 60);
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    a.href = url;
    a.download = `${baseName}-${stamp}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    if (sceneRef?.cameraSequence) sceneRef.cameraSequence.loop = wasLooping;
    btn.disabled = false;
    btn.textContent = '⏺';
    btn.style.color = '';
    setStatus(`✓ saved ${a.download} (${(blob.size / 1024 / 1024).toFixed(2)} MB)`);
  };
  recorder.onerror = (e) => {
    setStatus(`✗ record error: ${e.error?.message || 'unknown'}`, true);
    if (sceneRef?.cameraSequence) sceneRef.cameraSequence.loop = wasLooping;
    btn.disabled = false;
    btn.textContent = '⏺';
    btn.style.color = '';
  };

  recorder.start(100); // emit a chunk every 100ms
  setStatus(
    `⏺ recording ${dur.toFixed(1)}s of ${sceneRef?.name || 'scene'}… (${ext.toUpperCase()})`,
  );

  // Stop at sequence end + 0.3s buffer so the final fade-to-black is captured.
  setTimeout(
    () => {
      if (recorder.state === 'recording') recorder.stop();
      // Only stop video tracks. Audio tracks come from the synth's shared
      // MediaStreamDestination — stopping them would break future recordings.
      videoStream.getTracks().forEach((t) => t.stop());
    },
    (dur + 0.3) * 1000,
  );
});

// Space-bar play/pause shortcut when fly3d active + sequence present
window.addEventListener('keydown', (e) => {
  if (e.code !== 'Space') return;
  if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA')
    return;
  const fly = state.fly3dRenderer;
  if (!fly || !fly.getSequenceDuration || fly.getSequenceDuration() === 0) return;
  if (state.activeRenderer !== 'fly3d') return;
  e.preventDefault();
  document.getElementById('timeline-play')?.click();
});

// ----- Fullscreen toggle (BOB GPU + FLY 3D) -----
function toggleFullscreen() {
  const wrap = $('canvas-wrap');
  if (!document.fullscreenElement && !document.webkitFullscreenElement) {
    const fn = wrap.requestFullscreen || wrap.webkitRequestFullscreen;
    if (fn) fn.call(wrap).catch((e) => setStatus(`✗ fullscreen failed: ${e.message}`, true));
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

// Generator-V: "🎲 New style" — regenerate styleHash, re-derive bobStyle,
// re-bake palette via bob.applyStyle. Visible only when activeRenderer=bob-gpu.
$('btn-new-style')?.addEventListener('click', () => {
  regenerateBobStyle();
  setStatus(`✓ New BOB style — styleHash ${state.styleHash.slice(0, 10)}…`, false);
});

// Shift+S keyboard shortcut for New Style (BOB GPU only)
window.addEventListener('keydown', (e) => {
  if (
    e.key === 'S' &&
    e.shiftKey &&
    state.activeRenderer === 'bob-gpu' &&
    document.activeElement?.tagName !== 'INPUT' &&
    document.activeElement?.tagName !== 'TEXTAREA'
  ) {
    e.preventDefault();
    $('btn-new-style')?.click();
  }
});

// ----- Light control panel (GPU renderers only) -----
const LIGHT_PRESETS = {
  goldenHour: { azimuth: 0.6, altitude: 0.25, distance: 35 }, // low warm sun
  midday: { azimuth: 0.5, altitude: 0.95, distance: 30 }, // high cool sun
  sideLight: { azimuth: 1.1, altitude: 0.55, distance: 32 }, // 3/4 dramatic
  dusk: { azimuth: -1.0, altitude: 0.18, distance: 38 }, // sun behind — silhouette
};

function getCurrentLight() {
  // Get effective light values (override or scene default)
  const { scene } = getActiveGpuScene();
  const sceneLight = scene?.lightStatic || { azimuth: 0.5, altitude: 0.7, distance: 30 };
  return state.lightOverride ?? sceneLight;
}

function updateLightSliders() {
  const light = getCurrentLight();
  const azimEl = $('light-azim'),
    altEl = $('light-alt'),
    distEl = $('light-dist');
  if (!azimEl) return;
  azimEl.value = light.azimuth;
  altEl.value = light.altitude;
  distEl.value = light.distance;
  $('light-azim-val').textContent = (+light.azimuth).toFixed(2);
  $('light-alt-val').textContent = (+light.altitude).toFixed(2);
  $('light-dist-val').textContent = Math.round(+light.distance);
}

function applyLightOverride(partial) {
  const current = getCurrentLight();
  state.lightOverride = {
    azimuth: partial.azimuth ?? current.azimuth,
    altitude: partial.altitude ?? current.altitude,
    distance: partial.distance ?? current.distance,
  };
  updateLightSliders();
  // BOB GPU + FLY 3D both re-read getControls() every frame via RAF, so the
  // change applies on the next frame — no explicit re-render needed.
}

// Header click — collapse/expand panel
$('light-panel-header')?.addEventListener('click', () => {
  $('light-panel').classList.toggle('open');
});

// Sliders
$('light-azim')?.addEventListener('input', (e) =>
  applyLightOverride({ azimuth: parseFloat(e.target.value) }),
);
$('light-alt')?.addEventListener('input', (e) =>
  applyLightOverride({ altitude: parseFloat(e.target.value) }),
);
$('light-dist')?.addEventListener('input', (e) =>
  applyLightOverride({ distance: parseFloat(e.target.value) }),
);

// Preset chips
document.querySelectorAll('.light-preset-chip').forEach((btn) => {
  btn.addEventListener('click', () => {
    const preset = LIGHT_PRESETS[btn.dataset.preset];
    if (preset) applyLightOverride(preset);
  });
});

// Reset to scene default
$('light-reset')?.addEventListener('click', () => {
  state.lightOverride = null;
  updateLightSliders();
});

window.addEventListener('keydown', (e) => {
  const target = e.target;
  const typing =
    target &&
    (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
  if (typing) return;
  const gpuVisible = $('c-gpu').style.display !== 'none';
  if (!gpuVisible) return;
  if (e.key === 'f' || e.key === 'F') {
    e.preventDefault();
    toggleFullscreen();
  } else if (e.key === 's' || e.key === 'S') {
    e.preventDefault();
    shuffleBobPalette();
  }
});

// Wire code-screen elements (they exist on initial page load, before any tab content renders)
$('btn-copy-code')?.addEventListener('click', () => {
  const code = $('code-display').value;
  if (!code) {
    setStatus('no code to copy', true);
    return;
  }
  navigator.clipboard.writeText(code).then(
    () => setStatus('✓ code copied'),
    () => setStatus('✗ clipboard failed', true),
  );
});

async function runCurrentCode() {
  const code = $('code-display').value;
  if (!code) {
    setStatus('no code to re-run', true);
    return;
  }
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

// Refresh Lift-to-3D button state whenever the textarea content changes —
// covers paste, typing, cut, delete. Without this, pasted code never enables
// the lift button until something else (history selection, etc.) re-runs the
// refresh logic.
$('code-display')?.addEventListener('input', () => refreshLiftButtonState());

// 3D SceneData pane: copy + re-render handlers
$('btn-copy-scene')?.addEventListener('click', () => {
  const txt = $('scene-display').value;
  if (!txt) {
    setStatus('no SceneData to copy', true);
    return;
  }
  navigator.clipboard.writeText(txt).then(
    () => setStatus('✓ SceneData JSON copied'),
    () => setStatus('✗ clipboard failed', true),
  );
});

async function rerenderCurrentScene() {
  const txt = $('scene-display').value.trim();
  if (!txt) {
    setStatus('no SceneData to render', true);
    return;
  }
  let sceneData;
  try {
    sceneData = JSON.parse(txt);
  } catch (e) {
    setStatus(`✗ invalid JSON: ${e.message}`, true);
    const meta = $('code-3d-meta');
    if (meta) {
      meta.textContent = `✗ ${e.message}`;
      meta.style.color = '#d9afaf';
    }
    return;
  }
  const meta = $('code-3d-meta');
  if (meta) meta.style.color = '#666';
  try {
    const prompt = state.textLiftSourcePrompt || sceneData.name || 'edited scene';
    renderLiftedSceneData(sceneData, prompt, '✓ re-rendered from edited JSON', {
      shufflePalette: false,
    });
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

// Bootstrap Generator-V (BOB GPU style) BEFORE any BOB render — reads styleHash
// from URL or generates one. state.bobStyle is now ready for first BOB render.
bootstrapBobStyle();
// Bootstrap Generator-S (scene variant) — provides state.sceneHash for
// expandVariants() at every scene load. URL ?sceneHash= override supported.
bootstrapSceneHash();

Promise.all([
  loadSystemPrompt(),
  loadSystemPromptLift('./system-prompt-lift-3d.md'),
  loadDemoManifest(),
]).then(([n2d, nLift]) => {
  renderScenesTab();
  const demoCount = DEMO_MANIFEST?.demos?.length ?? 0;
  const ready = DEMO_MANIFEST?.demos?.filter((d) => d.status === 'ready').length ?? 0;
  setStatus(
    `✓ ready · demos: ${ready}/${demoCount} pre-lifted · prompts: 2D ${n2d}c, lift ${nLift}c · styleHash ${state.styleHash.slice(0, 8)}…`,
  );

  // Auto-load shared scene from URL hash (runs after system prompts are ready
  // so any LLM-side machinery is available, though shared loads don't need it)
  checkSharedSceneInUrl();
});
