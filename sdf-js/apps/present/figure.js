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
const renderMode = ['rich', 'stone'].includes(params.get('mode'))
  ? params.get('mode')
  : 'analytic'; // analytic = zero-march default; ?mode=stone|rich opts out
const { show } = createFigure({ outdoor: env !== 'studio', stage, present, renderMode });

const deckName = params.get('deck');
const layout = params.get('layout') || undefined; // line | radial | grid
const name = params.get('ir') || 'funnel-sales';
const ir = await (await fetch(`../../scenes/ir/${deckName || name}.json`)).json();
// Section color program: the SAME palette the 2D end ships (pitch-spectrum,
// chromotome kov_06 — ink ground + vermilion anchor). One content, two
// mediums, one visual system. ?palette=<theme-id> to swap, ?palette=0 off.
const paletteId = params.get('palette');
const theme = paletteId === '0' ? null : getTheme(paletteId || 'pitch-spectrum');
const palette = theme ? { anchor: theme.accent, colors: theme.colors } : null;
const scene = deckName
  ? assembleDeck(ir, { env, layout, stage, palette })
  : renderIR(ir, { env, stage });
show(scene);
// script spans may ride in the deck fixture (teleprompter); presenter uses them
if (present) attachPresenter({ studio: window.__figStudio, scene, script: ir.script || null });
