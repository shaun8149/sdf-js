// =============================================================================
// Atlas Compositor v0 — M1 Day 1 shell
// -----------------------------------------------------------------------------
// 4-tab UI converging 4 input sources to SceneData → render via 5-renderer pool.
//
//                   text-tab     ─┐
//                   generator-tab ─┤
//                                  ├──→ SceneData ──→ compile() ──→ renderer pool
//                   2d-edit-tab   ─┤
//                   3d-edit-tab   ─┘
//
// Day 1 (this file): UI shell + central state + tab routing + renderer/pattern
//                    pill controls. Tab content panels are placeholders.
//                    Render canvas is wired to silhouette as initial mode.
//
// Day 2: text-tab absorbs MVP LLM-prompt → SDF code → SceneData flow
// Day 3: generator-tab absorbs autoscope-clone hash → SceneData flow
// Day 4: shared palette / camera / shadow control surface
// Day 5: 2d-edit / 3d-edit stub content, index entry, URL routing
// =============================================================================

const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

// =============================================================================
// Central state
// =============================================================================

const state = {
  activeTab: 'text',                   // 'text' | 'generator' | '2d-edit' | '3d-edit'
  activeRenderer: 'silhouette',        // 'silhouette' | 'stipple' | 'hatch' | 'lambert' | 'bob-gpu'
  activePattern: 'none',               // 'none' | 'truchet' | 'gosper' | 'motifs'
  scene: null,                         // SceneData v1 — populated by active tab
  compiled: null,                      // compile(scene) result — { sdf, evalCamera, ... }
};

// =============================================================================
// Tab content registry (Day 1: placeholders; Day 2-5: real content)
// =============================================================================

const TAB_CONTENT = {
  'text': () => `
    <h2>Text → SDF</h2>
    <p>Type a natural-language prompt → LLM writes SDF code → render via the renderer pool on the right.</p>
    <div class="placeholder">
      <b>M1 Day 2 coming:</b> absorb current MVP (<code>examples/mvp/</code>) into this tab. Anthropic Claude API call, prompt input, history sidebar, code editor view. Output is SceneData v1 routed through compile() → renderer pool.
    </div>
    <h3>Status</h3>
    <p>Until Day 2 integration ships, use the standalone <a href="../mvp/" style="color: #ffd070;">MVP page</a>.</p>
  `,

  'generator': () => `
    <h2>Generator → SDF</h2>
    <p>Pick a generator template + hash → SceneData → render. Same hash always produces the same scene (URL-shareable, no token cost for variants).</p>
    <div class="placeholder">
      <b>M1 Day 3 coming:</b> absorb current autoscope-clone (<code>examples/sdf/autoscope-clone.html</code>) into this tab. 6 scene templates, URL hash, BOB GPU shader. M2 will generalize to a Generator framework.
    </div>
    <h3>Status</h3>
    <p>Until Day 3 integration ships, use the standalone <a href="../sdf/autoscope-clone.html" style="color: #ffd070;">autoscope-clone page</a>.</p>
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
}

// =============================================================================
// Tab switching
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

// =============================================================================
// Renderer + pattern pill toggles
// =============================================================================

$$('#renderer-pills .pill').forEach(btn => {
  btn.addEventListener('click', () => {
    state.activeRenderer = btn.dataset.renderer;
    $$('#renderer-pills .pill').forEach(b => b.classList.toggle('active', b === btn));
    rerender();
    setStatus(`renderer → ${state.activeRenderer}`);
  });
});

$$('#pattern-pills .pill').forEach(btn => {
  btn.addEventListener('click', () => {
    state.activePattern = btn.dataset.pattern;
    $$('#pattern-pills .pill').forEach(b => b.classList.toggle('active', b === btn));
    rerender();
    setStatus(`pattern → ${state.activePattern}`);
  });
});

// =============================================================================
// Render dispatcher (Day 1: placeholder — clears canvas + draws "M1 Day 1 shell"
// text. Subsequent days wire actual renderer pool.)
// =============================================================================

function rerender() {
  const canvas = $('cv');
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;

  ctx.fillStyle = '#f4efdc';  // paper bg
  ctx.fillRect(0, 0, w, h);

  // Placeholder centerpiece
  ctx.fillStyle = '#1a1a1a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '600 32px -apple-system, system-ui, sans-serif';
  ctx.fillText('Atlas Compositor v0', w / 2, h / 2 - 80);

  ctx.fillStyle = '#888';
  ctx.font = '14px ui-monospace, monospace';
  ctx.fillText('M1 Day 1 shell — 4-tab UI ready', w / 2, h / 2 - 40);
  ctx.fillText(`active: tab=${state.activeTab} renderer=${state.activeRenderer} pattern=${state.activePattern}`, w / 2, h / 2 - 16);

  ctx.fillStyle = '#bbb';
  ctx.font = '13px -apple-system, system-ui, sans-serif';
  const lines = [
    'Day 2 → text-tab absorbs MVP',
    'Day 3 → generator-tab absorbs autoscope-clone',
    'Day 4 → shared palette / camera / shadow controls',
    'Day 5 → 2D/3D edit stubs + index entry',
  ];
  lines.forEach((line, i) => ctx.fillText(line, w / 2, h / 2 + 30 + i * 24));

  // Frame: orange brand accent corners
  ctx.strokeStyle = '#ffd070';
  ctx.lineWidth = 2;
  const corner = 30;
  ctx.beginPath();
  ctx.moveTo(20, 20 + corner); ctx.lineTo(20, 20); ctx.lineTo(20 + corner, 20);
  ctx.moveTo(w - 20 - corner, 20); ctx.lineTo(w - 20, 20); ctx.lineTo(w - 20, 20 + corner);
  ctx.moveTo(w - 20, h - 20 - corner); ctx.lineTo(w - 20, h - 20); ctx.lineTo(w - 20 - corner, h - 20);
  ctx.moveTo(20 + corner, h - 20); ctx.lineTo(20, h - 20); ctx.lineTo(20, h - 20 - corner);
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
  statusTimer = setTimeout(() => { el.textContent = 'ready'; el.className = ''; }, 3000);
}

function updateSceneInfo() {
  if (state.scene) {
    const n = state.scene.subjects?.length ?? 0;
    $('scene-info').textContent = `${state.scene.name ?? 'scene'} · ${n} subjects`;
  } else {
    $('scene-info').textContent = 'No scene';
  }
}

// =============================================================================
// Init
// =============================================================================

renderActiveTab();
rerender();
updateSceneInfo();
