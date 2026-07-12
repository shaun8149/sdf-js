// spike.js — dev-only raw-SceneData viewer for gate-week spikes (W0). Loads a
// pre-assembled scene from scenes/spikes/<name>.json (written by
// scripts/spike-w0.mjs) and mounts it on the shared figure core — same
// renderer, same deck-window switching, same FPS HUD as the product page, so
// spike screenshots and FPS pricing are measured on the real pipeline.
// ?scene=<name> · ?mode=stone|rich (default analytic) · ?outdoor=1 for env
// worlds (auto-on for landscape spikes) · ?fps=0 hides the HUD.
import { createFigure } from './figure-core.js';

const params = new URLSearchParams(location.search);
const name = params.get('scene') || 'w0-massing-radial';
const renderMode = ['rich', 'stone'].includes(params.get('mode')) ? params.get('mode') : 'analytic';
const outdoor = params.get('outdoor') === '1' || name.includes('landscape');
const { show } = createFigure({ outdoor, renderMode });

const scene = await (await fetch(`../../scenes/spikes/${name}.json`)).json();
// ?windows=0 — disable per-station shader switching (ONE full-world shader).
// Spike finding drove this: an env terrain re-compiles inside EVERY window
// shader (26× for alpine — minutes each on D3D), so terrain spikes must run
// single-shader. Also the honest way to price the one-giant-shader regime.
if (params.get('windows') === '0') delete scene.deckWindows;
window.__spikeScene = scene; // test hook: deckWindows drive screenshot time pins
show(scene);
