// =============================================================================
// deck-editor.js — Atlas Present Canvas Mode deck editor
// -----------------------------------------------------------------------------
// 3-pane layout:
//   LEFT — waypoint rail (numbered list + select + drag-reorder + [+W] capture)
//   CENTER — 3D canvas viewport (full size, free orbit via compositor controls)
//   RIGHT — inspector pane: selected waypoint + subjects list + add subject + deck settings
//
// User flow:
//   1. New deck has empty canvas + no waypoints
//   2. Add subject via right-pane form (type + xyz) → mutates deck.canvas.subjects
//      → recompile + re-render canvas
//   3. Orbit camera in viewport (free)
//   4. + Waypoint button → captures current camera as a new waypoint
//   5. Click waypoint → camera tweens (200ms) to preview that framing
//   6. ▶ Present → switch to present mode (separate URL flag)
//
// Calls Layer 1 via compositor-api.js. Does NOT touch compositor internals.
// =============================================================================

import * as deckModel from './deck-model.js';
import {
  camStateToSpherical,
  createRendererForId,
  compileScene,
  sphericalToCamState,
} from '../compositor-api.js';
import { ATOM_PALETTE } from './atom-palette.js';
import { tweenCamera, easeInOut } from './waypoint-tween.js';

// Module-scope editor state.
let currentDeck = null;
let currentWaypointId = null;
let renderer = null;
let canvas = null;
let activeTween = null;

const FALLBACK_CAMERA = {
  yaw: 0.3,
  pitch: -0.15,
  distance: 8,
  focal: 1.5,
  targetX: 0,
  targetY: 0.5,
  targetZ: 0,
};

export async function mountDeckEditor(target, deckId) {
  const deck = deckModel.loadDeckFromStorage(deckId);
  if (!deck) {
    target.innerHTML = `<div class="page-pad">Deck not found: ${deckId}<br><a href="./">← Library</a></div>`;
    return;
  }
  currentDeck = deck;
  currentWaypointId = deck.waypoints[0]?.id ?? null;

  target.innerHTML = `
    <div class="topbar">
      <a href="./" class="btn-back">← Library</a>
      <div class="brand" style="margin-left: 16px;">${escapeHtml(deck.title)}</div>
      <div class="spacer"></div>
      <button id="btn-present-current">▶ Present</button>
    </div>
    <div class="editor-body canvas-mode">
      <aside class="waypoint-rail" id="waypoint-rail"></aside>
      <main class="canvas-viewport" id="canvas-viewport">
        <canvas id="canvas-3d"></canvas>
        <div class="viewport-meta" id="viewport-meta"></div>
      </main>
      <aside class="inspector-pane" id="inspector-pane"></aside>
    </div>
  `;
  document.getElementById('btn-present-current').addEventListener('click', () => {
    location.search = `?deck=${deck.id}&present=1`;
  });

  await mountRenderer();
  renderWaypointRail();
  renderInspectorPane();
  fitAndRender();

  window.addEventListener('resize', fitAndRender);
}

async function mountRenderer() {
  canvas = document.getElementById('canvas-3d');
  fitCanvasToContainer();
  try {
    renderer = createRendererForId(currentDeck.theme.renderer, canvas);
  } catch (e) {
    console.error('[deck-editor] renderer create failed:', e);
    document.getElementById('viewport-meta').textContent = `Renderer error: ${e.message}`;
  }
}

function fitCanvasToContainer() {
  if (!canvas) return;
  const container = canvas.parentElement;
  const w = container.clientWidth;
  const h = container.clientHeight;
  if (w > 0 && h > 0) {
    canvas.width = w;
    canvas.height = h;
  }
}

function fitAndRender() {
  fitCanvasToContainer();
  renderCanvas();
}

function renderCanvas() {
  if (!renderer || !canvas || !currentDeck) return;
  try {
    const compiled = compileScene(currentDeck.canvas);
    if (currentDeck.theme.renderer === 'silhouette') {
      renderer.render([{ sdf: compiled.sdf, color: [200, 200, 200], stroke: 0 }], {
        background: [13, 13, 13],
      });
    } else {
      const cam = currentWaypointId
        ? cameraForWaypoint(currentWaypointId)
        : fallbackCamera();
      if (cam && renderer.setCamState) {
        renderer.setCamState(sphericalToCamState(cam));
      }
      renderer.render(compiled.sdf);
    }
    updateViewportMeta();
  } catch (e) {
    console.error('[deck-editor] render failed:', e);
    document.getElementById('viewport-meta').textContent = `Render error: ${e.message}`;
  }
}

function updateViewportMeta() {
  const meta = document.getElementById('viewport-meta');
  if (!meta) return;
  const wpCount = currentDeck.waypoints.length;
  const subjCount = currentDeck.canvas.subjects.length;
  meta.textContent = `${subjCount} subject${subjCount === 1 ? '' : 's'} · ${wpCount} waypoint${wpCount === 1 ? '' : 's'} · ${currentDeck.theme.renderer}`;
}

// ---- Waypoint rail ----------------------------------------------------------

function renderWaypointRail() {
  const rail = document.getElementById('waypoint-rail');
  rail.innerHTML = `
    ${currentDeck.waypoints
      .map(
        (w, i) => `
      <div class="waypoint-thumb ${w.id === currentWaypointId ? 'selected' : ''}" data-id="${w.id}" draggable="true">
        <div class="thumb-num">${i + 1}</div>
        <div class="thumb-title">${escapeHtml(w.title || `Waypoint ${i + 1}`)}</div>
      </div>
    `,
      )
      .join('')}
    <button class="btn-add-waypoint" id="btn-add-waypoint">+ Capture current view</button>
  `;

  rail.querySelectorAll('.waypoint-thumb').forEach((el) => {
    el.addEventListener('click', () => {
      selectWaypointAndTween(el.dataset.id);
    });
    el.addEventListener('dragstart', (e) => {
      el.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', el.dataset.id);
    });
    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      rail.querySelectorAll('.waypoint-thumb').forEach((t) => t.classList.remove('drop-target'));
    });
    el.addEventListener('dragover', (e) => {
      e.preventDefault();
      el.classList.add('drop-target');
    });
    el.addEventListener('dragleave', () => el.classList.remove('drop-target'));
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('drop-target');
      const fromId = e.dataTransfer.getData('text/plain');
      const toId = el.dataset.id;
      if (fromId !== toId) {
        const fromIdx = currentDeck.waypoints.findIndex((w) => w.id === fromId);
        const toIdx = currentDeck.waypoints.findIndex((w) => w.id === toId);
        deckModel.moveWaypoint(currentDeck, fromIdx, toIdx);
        deckModel.saveDeckToStorage(currentDeck);
        renderWaypointRail();
      }
    });
  });

  document.getElementById('btn-add-waypoint').addEventListener('click', handleAddWaypoint);
}

function selectWaypointAndTween(waypointId) {
  const wp = currentDeck.waypoints.find((w) => w.id === waypointId);
  if (!wp) return;

  if (activeTween) {
    activeTween.cancel();
    activeTween = null;
  }

  const fromCam =
    readCurrentCamera() ||
    (currentWaypointId ? cameraForWaypoint(currentWaypointId) : fallbackCamera());
  const toCam = isSphericalCamera(wp.camera) ? wp.camera : fallbackCamera();

  activeTween = tweenCamera(fromCam, toCam, {
    durationMs: 200,
    easing: easeInOut,
    onFrame: (cam) => {
      if (renderer && renderer.setCamState) {
        renderer.setCamState(sphericalToCamState(cam));
      }
    },
    onComplete: () => {
      activeTween = null;
    },
  });

  currentWaypointId = waypointId;
  renderWaypointRail();
  renderInspectorPane();
}

function readCurrentCamera() {
  if (!renderer) return null;
  const referenceCam = currentWaypointId ? cameraForWaypoint(currentWaypointId) : fallbackCamera();
  if (typeof renderer.getCamState === 'function') {
    try {
      return camStateToSpherical(renderer.getCamState(), referenceCam);
    } catch (e) {
      console.warn('[deck-editor] current renderer camera is invalid:', e.message);
    }
  }
  return referenceCam;
}

function handleAddWaypoint() {
  const cam = readCurrentCamera() || fallbackCamera();
  const title = prompt('Waypoint title:', `Waypoint ${currentDeck.waypoints.length + 1}`);
  if (title === null) return;
  const wp = deckModel.addWaypoint(currentDeck, {
    title: title || `Waypoint ${currentDeck.waypoints.length + 1}`,
    camera: { ...cam },
  });
  deckModel.saveDeckToStorage(currentDeck);
  currentWaypointId = wp.id;
  renderWaypointRail();
  renderInspectorPane();
  updateViewportMeta();
}

// ---- Inspector pane ---------------------------------------------------------

function renderInspectorPane() {
  const pane = document.getElementById('inspector-pane');
  const wp = currentWaypointId
    ? currentDeck.waypoints.find((w) => w.id === currentWaypointId)
    : null;
  const RENDERERS = ['studio', 'fly3d', 'silhouette'];
  pane.innerHTML = `
    ${
      wp
        ? `
      <h3>Waypoint ${currentDeck.waypoints.findIndex((w) => w.id === wp.id) + 1}</h3>
      <div class="settings-row">
        <label>Title</label>
        <input type="text" id="input-waypoint-title" value="${escapeHtml(wp.title || '')}" placeholder="(no title)" />
      </div>
      <div class="settings-row meta">
        Camera: yaw=${formatCameraNumber(wp.camera?.yaw)} pitch=${formatCameraNumber(wp.camera?.pitch)} dist=${formatCameraNumber(wp.camera?.distance)}<br>
        Target: ${formatCameraNumber(wp.camera?.targetX)}, ${formatCameraNumber(wp.camera?.targetY)}, ${formatCameraNumber(wp.camera?.targetZ)}
      </div>
      <div class="settings-row">
        <button id="btn-recapture-waypoint">Re-capture from current view</button>
      </div>
      <div class="settings-row">
        <button id="btn-delete-waypoint">Delete waypoint</button>
      </div>
    `
        : '<div class="settings-row meta">No waypoint selected. Capture one with the [+ Capture] button on the left.</div>'
    }

    <h3 style="margin-top: 24px;">Subjects (${currentDeck.canvas.subjects.length})</h3>
    ${currentDeck.canvas.subjects.length === 0 ? '<div class="settings-row meta">Empty canvas. Add a subject below.</div>' : ''}
    ${currentDeck.canvas.subjects
      .map(
        (s) => `
      <div class="subject-row" data-id="${s.id}">
        <span class="subject-type">${escapeHtml(s.type)}</span>
        <span class="subject-pos">at ${formatTranslate(s.transform?.translate)}</span>
        <button class="btn-remove-subject" data-id="${s.id}">×</button>
      </div>
    `,
      )
      .join('')}
    <div class="settings-row">
      <button id="btn-add-subject">+ Add subject</button>
    </div>

    <h3 style="margin-top: 24px;">Deck</h3>
    <div class="settings-row">
      <label>Renderer</label>
      <select id="select-renderer">
        ${RENDERERS.map((r) => `<option value="${r}" ${r === currentDeck.theme.renderer ? 'selected' : ''}>${r}</option>`).join('')}
      </select>
    </div>
    <div class="settings-row meta">
      Tween: ${currentDeck.tween.durationMs}ms ${currentDeck.tween.easing}
    </div>
  `;

  document
    .getElementById('input-waypoint-title')
    ?.addEventListener('change', handleWaypointTitleChange);
  document
    .getElementById('btn-recapture-waypoint')
    ?.addEventListener('click', handleRecaptureWaypoint);
  document.getElementById('btn-delete-waypoint')?.addEventListener('click', handleDeleteWaypoint);
  document.getElementById('btn-add-subject').addEventListener('click', handleAddSubjectFlow);
  document.getElementById('select-renderer').addEventListener('change', handleRendererChange);
  pane.querySelectorAll('.btn-remove-subject').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleRemoveSubject(btn.dataset.id);
    });
  });
}

function formatTranslate(t) {
  if (!t || t.length !== 3) return '[0,0,0]';
  return `[${t.map((n) => n.toFixed(1)).join(',')}]`;
}

function formatCameraNumber(n) {
  return typeof n === 'number' && Number.isFinite(n) ? n.toFixed(2) : 'n/a';
}

function isSphericalCamera(cam) {
  return (
    cam &&
    ['yaw', 'pitch', 'distance', 'targetX', 'targetY', 'targetZ'].every(
      (k) => typeof cam[k] === 'number' && Number.isFinite(cam[k]),
    )
  );
}

function fallbackCamera() {
  const cam = currentDeck?.canvas?.defaults?.camera;
  return isSphericalCamera(cam) ? cam : FALLBACK_CAMERA;
}

function cameraForWaypoint(waypointId) {
  const wp = currentDeck?.waypoints.find((w) => w.id === waypointId);
  return isSphericalCamera(wp?.camera) ? wp.camera : fallbackCamera();
}

// ---- Handlers ---------------------------------------------------------------

function handleWaypointTitleChange(e) {
  const wp = currentDeck.waypoints.find((w) => w.id === currentWaypointId);
  if (!wp) return;
  wp.title = e.target.value;
  currentDeck.updatedAt = Date.now();
  deckModel.saveDeckToStorage(currentDeck);
  renderWaypointRail();
}

function handleRecaptureWaypoint() {
  const wp = currentDeck.waypoints.find((w) => w.id === currentWaypointId);
  if (!wp) return;
  const cam = readCurrentCamera() || wp.camera;
  deckModel.updateWaypointCamera(currentDeck, currentWaypointId, cam);
  deckModel.saveDeckToStorage(currentDeck);
  renderInspectorPane();
}

function handleDeleteWaypoint() {
  if (!currentWaypointId) return;
  if (!confirm('Delete this waypoint?')) return;
  deckModel.removeWaypoint(currentDeck, currentWaypointId);
  deckModel.saveDeckToStorage(currentDeck);
  currentWaypointId = currentDeck.waypoints[0]?.id ?? null;
  renderWaypointRail();
  renderInspectorPane();
  updateViewportMeta();
}

function handleAddSubjectFlow() {
  const types = ATOM_PALETTE.map((p, i) => `${i + 1}: ${p.type} — ${p.displayName}`).join('\n');
  const choice = prompt(`Pick atom type (1-${ATOM_PALETTE.length}):\n${types}`);
  if (!choice) return;
  const n = parseInt(choice, 10);
  if (!Number.isFinite(n) || n < 1 || n > ATOM_PALETTE.length) {
    alert('Invalid choice');
    return;
  }
  const entry = ATOM_PALETTE[n - 1];
  const xyz = prompt(`Position [x,y,z] for ${entry.type} (e.g. "0,0.5,0"):`, '0,0.5,0');
  if (!xyz) return;
  const parts = xyz.split(',').map((s) => parseFloat(s.trim()));
  if (parts.length !== 3 || parts.some((p) => !Number.isFinite(p))) {
    alert('Invalid position');
    return;
  }
  deckModel.addSubjectToCanvas(currentDeck, {
    type: entry.type,
    args: { ...entry.defaultArgs },
    transform: { translate: parts },
    material: 'silver',
  });
  deckModel.saveDeckToStorage(currentDeck);
  renderInspectorPane();
  renderCanvas();
}

function handleRemoveSubject(subjectId) {
  if (!confirm('Remove this subject?')) return;
  deckModel.removeSubjectFromCanvas(currentDeck, subjectId);
  deckModel.saveDeckToStorage(currentDeck);
  renderInspectorPane();
  renderCanvas();
}

function handleRendererChange(e) {
  currentDeck.theme.renderer = e.target.value;
  currentDeck.updatedAt = Date.now();
  deckModel.saveDeckToStorage(currentDeck);
  if (renderer) {
    try {
      renderer.unmount();
    } catch (err) {
      console.warn('[deck-editor] previous renderer unmount failed:', err);
    }
  }
  mountRenderer().then(fitAndRender);
}

// ---- Helpers ----------------------------------------------------------------

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
