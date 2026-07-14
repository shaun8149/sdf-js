// figure.js — standalone live "figure" viewer. ?ir=<name> renders one structure
// from scenes/ir/<name>.json; ?deck=<name> assembles a multi-IR deck (one
// continuous world, stations along the deck axis). ?env=alpine swaps the studio
// room for the open snow-mountain world. Mounting lives in figure-core.js
// (shared with the author page).
import { renderIR } from '../../src/scene/render-ir.js';
import { assembleDeck } from '../../src/scene/assemble-deck.js';
import { getTheme } from '../../src/present/themes.js';
import { resolveDeckPalette } from '../../src/scene/mount-palette.js';
import { createFigure } from './figure-core.js';
import { attachPresenter } from './presenter.js';

const params = new URLSearchParams(location.search);
const env = params.get('env') || 'studio';
const stage = params.get('stage') === '1'; // ?stage=1 → fighting-game stage preset
const present = params.get('present') === '1'; // ?present=1 → space steps the beats
const renderMode = ['rich', 'stone'].includes(params.get('mode')) ? params.get('mode') : 'analytic'; // analytic = zero-march default; ?mode=stone|rich opts out
const { show } = createFigure({ outdoor: env !== 'studio', stage, present, renderMode });

const deckName = params.get('deck');
// line | radial | grid | courtyard — RADIAL is the deck default (2026-07-13
// user verdict: courtyard's far-side geometry interferes with data labels;
// radial expresses a complete world since the total-continuity waves).
const layout = params.get('layout') || 'radial';
const name = params.get('ir') || 'funnel-sales';
const ir = await (await fetch(`../../scenes/ir/${deckName || name}.json`)).json();
// Section color program: the SAME palette the 2D end ships. §9.6 配合点 #1:
// deck 契约携带 artMount(真迹装裱,§3.5)时优先穿它的预烘焙 palette ——
// 同一份 deck.json,纸上 PDF 和 3D 飞行穿同一件真迹的颜色。URL 参数保留为
// 显式覆盖:?palette=<theme-id> 换主题,?palette=0 关。
const { palette, attribution } = resolveDeckPalette({
  artMount: ir.artMount || null,
  paletteParam: params.get('palette'),
  themeOf: (id) => (id ? getTheme(id) : getTheme('pitch-spectrum')),
});
// ?seed=<hash> — Layer C deck decor (seeded art identity, same lanes as the
// 2D decor engine). DEFAULT ON for decks since W6: the deck's own name is its
// art identity (same deck → same world, forever — the 2D mint-hash covenant).
// ?seed=0 turns decor off; any other value overrides the identity.
const seedParam = params.get('seed');
const decorSeed = seedParam === '0' ? undefined : seedParam || deckName || undefined;
// ?horizon=boulders — Infinigen 研读第三课的混林天际线(OPT-IN;默认黑石板)
const horizon = params.get('horizon') === 'boulders' ? 'boulders' : undefined;
const scene = deckName
  ? assembleDeck(ir, { env, layout, stage, palette, decorSeed, horizon })
  : renderIR(ir, { env, stage });
show(scene);
// §9.6 配合点 #1 加分项:真迹溯源角标(装裱是非商用铸造,license 随行是纪律)。
// 常驻小元素,不进 stage 时间线 —— 溯源不该随章节隐现。
if (attribution && (attribution.name || attribution.artist)) {
  const d = document.createElement('div');
  d.className = 'stage-attribution';
  d.textContent = [attribution.name, attribution.artist].filter(Boolean).join(' — ');
  if (attribution.license) d.textContent += ` (${attribution.license})`;
  document.body.appendChild(d);
}
// script spans may ride in the deck fixture (teleprompter); presenter uses them
if (present) attachPresenter({ studio: window.__figStudio, scene, script: ir.script || null });
