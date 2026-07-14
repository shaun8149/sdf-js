// figure.js — standalone live "figure" viewer. ?ir=<name> renders one structure
// from scenes/ir/<name>.json; ?deck=<name> assembles a multi-IR deck (one
// continuous world, stations along the deck axis). ?env=alpine swaps the studio
// room for the open snow-mountain world. Mounting lives in figure-core.js
// (shared with the author page).
import { renderIR } from '../../src/scene/render-ir.js';
import { assembleDeck } from '../../src/scene/assemble-deck.js';
import { getTheme } from '../../src/present/themes.js';
import { resolveDeckPalette } from '../../src/scene/mount-palette.js';
import { applyWhiteTone } from '../../src/scene/tone.js';
import { createFigure } from './figure-core.js';
import { attachPresenter } from './presenter.js';

const params = new URLSearchParams(location.search);
const env = params.get('env') || 'studio';
const stage = params.get('stage') === '1'; // ?stage=1 → fighting-game stage preset
const present = params.get('present') === '1'; // ?present=1 → space steps the beats
const renderMode = ['rich', 'stone'].includes(params.get('mode')) ? params.get('mode') : 'analytic'; // analytic = zero-march default; ?mode=stone|rich opts out

const deckName = params.get('deck');
// line | radial | grid | courtyard | theater — RADIAL is the deck default
// (2026-07-13 user verdict: courtyard's far-side geometry interferes with data
// labels; radial expresses a complete world since the total-continuity waves).
const layout = params.get('layout') || 'radial';
// theater 一字排开跨 ±90:默认 30 距离的原点灯罩不住,换高位远灯(均匀照明)
const lightRig =
  deckName && layout === 'theater' ? { lightAzim: 0.9, lightAlt: 1.05, lightDist: 160 } : null;
const tone = params.get('tone');
const { show } = createFigure({
  outdoor: env !== 'studio',
  stage,
  present,
  renderMode,
  lightRig,
  cleanFloor: tone === 'white', // 白世界配裸地板 —— 棋盘格是黑石时代的试验场纹理
});
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
// ?dressing=nature — Layer C 装饰换 nature 语汇(聚簇石群+背风林分;OPT-IN)
const dressing = params.get('dressing') === 'nature' ? 'nature' : undefined;
const scene = deckName
  ? assembleDeck(ir, { env, layout, stage, palette, decorSeed, horizon, dressing })
  : renderIR(ir, { env, stage });
// ?tone=white — 黑石语汇整体换白石/白塑料试验(OPT-IN;accent 色与发光体不动)
if (tone === 'white') applyWhiteTone(scene);
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
