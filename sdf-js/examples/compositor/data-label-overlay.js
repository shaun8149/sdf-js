// =============================================================================
// data-label-overlay.js — Layer-2 overlay data labels (the CHEAP text path for
// LOOP chart atoms). bar-3d / line-3d / column-3d use a float[32] value loop and
// CANNOT carry SDF text-3d labels without overflowing the studio shader (even
// one label fails). The escape hatch from the two-text-systems plan: pin the
// labels as DOM annotations projected onto the 3D chart elements — zero shader
// cost, and they track the moving camera every frame.
//
// A scene file may carry  annotations: [{ pos:[x,y,z], text }]  (alongside
// sceneData). Launch:  ?labels=<sceneId>  →  loads the scene + pins the labels.
// Projection is done by the engine (window.atlasProjectPoint), so labels land
// exactly where the 3D point renders — no camera-convention duplication here.
// =============================================================================

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, timeoutMs) {
  const t0 = performance.now();
  while (!fn()) {
    if (performance.now() - t0 > timeoutMs)
      throw new Error('data-label-overlay: waitFor timed out');
    await sleep(60);
  }
}

async function run(id) {
  const res = await fetch(`./demo-lifts/${id}.json`);
  if (!res.ok) throw new Error(`labels scene ${id}: HTTP ${res.status}`);
  const data = await res.json();
  const annotations = Array.isArray(data.annotations) ? data.annotations : [];

  await waitFor(
    () =>
      typeof window.atlasLoadScene === 'function' && typeof window.atlasProjectPoint === 'function',
    10000,
  );
  await window.atlasLoadScene({
    id,
    title: data.title || id,
    file: `${id}.json`,
    renderer: 'studio',
  });

  const wrap = document.getElementById('canvas-wrap');
  if (getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';
  const layer = document.createElement('div');
  Object.assign(layer.style, {
    position: 'absolute',
    inset: '0',
    pointerEvents: 'none',
    zIndex: '35',
    overflow: 'hidden',
  });
  wrap.appendChild(layer);

  const els = annotations.map((an) => {
    const d = document.createElement('div');
    d.textContent = an.text;
    Object.assign(d.style, {
      position: 'absolute',
      transform: 'translate(-50%,-50%)',
      padding: '3px 9px',
      borderRadius: '7px',
      background: 'rgba(8,11,18,0.66)',
      border: '1px solid rgba(255,255,255,0.1)',
      color: '#f3f6fb',
      font: '600 13px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      whiteSpace: 'nowrap',
      textShadow: '0 1px 2px rgba(0,0,0,0.6)',
      willChange: 'left,top',
    });
    layer.appendChild(d);
    return d;
  });

  function tick() {
    for (let i = 0; i < annotations.length; i++) {
      const p = window.atlasProjectPoint(annotations[i].pos);
      const el = els[i];
      if (!p.visible) {
        el.style.display = 'none';
      } else {
        el.style.display = 'block';
        el.style.left = `${p.x * 100}%`;
        el.style.top = `${p.y * 100}%`;
      }
    }
    requestAnimationFrame(tick);
  }
  tick();
}

const labelsId = new URLSearchParams(location.search).get('labels');
if (labelsId) run(labelsId).catch((e) => console.error('[data-label-overlay]', e));
