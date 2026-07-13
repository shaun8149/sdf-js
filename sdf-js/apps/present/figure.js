// figure.js — standalone live "figure" viewer. ?ir=<name> renders one structure
// from scenes/ir/<name>.json; ?deck=<name> assembles a multi-IR deck (one
// continuous world, stations along the deck axis). ?env=alpine swaps the studio
// room for the open snow-mountain world. Mounting lives in figure-core.js
// (shared with the author page).
import { renderIR } from '../../src/scene/render-ir.js';
import { assembleDeck } from '../../src/scene/assemble-deck.js';
import { getTheme } from '../../src/present/themes.js';
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
// Section color program: the SAME palette the 2D end ships (pitch-spectrum,
// chromotome kov_06 — ink ground + vermilion anchor). One content, two
// mediums, one visual system. ?palette=<theme-id> to swap, ?palette=0 off.
const paletteId = params.get('palette');
const theme = paletteId === '0' ? null : getTheme(paletteId || 'pitch-spectrum');
const palette = theme ? { anchor: theme.accent, colors: theme.colors } : null;
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
// script spans may ride in the deck fixture (teleprompter); presenter uses them
if (present) attachPresenter({ studio: window.__figStudio, scene, script: ir.script || null });
