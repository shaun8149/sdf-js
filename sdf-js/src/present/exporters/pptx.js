// =============================================================================
// exporters/pptx.js — Export assembled deck → PPTX file
// -----------------------------------------------------------------------------
// Sprint 17 — Atlas Present's canonical export path. Each baked slot becomes
// a 16:9 PPTX slide with the rendered atom canvas embedded as a full-bleed
// PNG. Slide title taken from scaffold slot. Speaker notes optional.
//
// Why image embed (not native PPTX shapes):
//   1. Atoms-2d are dense Canvas2D renders (gradient + specular + drop
//      shadow + text wrapping). Translating each atom 1:1 to PPTX
//      shapes would lose visual parity and balloon the file
//   2. Image embed is portable across PowerPoint / Keynote / Google Slides
//   3. Atlas is the spatial visual PRESENTER — the PPTX is the deliverable
//      to share / present; downstream editability is not a goal
//
// Architectural note: the 3D side consumes a SCAFFOLD-PIPELINE deck.json,
// NOT this PPTX. PPTX is for human delivery; deck.json is for 3D translator.
// =============================================================================

import { renderAtom } from '../atoms-2d/registry.js';

// pptxgenjs loaded from esm.sh on first call (matches pdfjs CDN pattern in
// src/parser/pdf.js — no build step / bundler required).
const PPTXGEN_CDN = 'https://esm.sh/pptxgenjs@3.12.0';
let PptxGenJS = null;

async function loadPptxGen() {
  if (PptxGenJS) return PptxGenJS;
  const mod = await import(/* @vite-ignore */ PPTXGEN_CDN);
  PptxGenJS = mod.default || mod.PptxGenJS || mod;
  return PptxGenJS;
}

/**
 * @typedef {object} ExportSlotInput
 * @property {number} slotIdx
 * @property {string} slotName
 * @property {string} slotTitle
 * @property {object} sceneData — {subjects: [{type, x, y, w, h, args}]}
 */

/**
 * @typedef {object} ExportDeckInput
 * @property {string} title — deck display title
 * @property {import('../themes.js').ThemePreset} theme
 * @property {{id: string, label: string}} scaffold
 * @property {ExportSlotInput[]} slots — in display order
 */

/**
 * Export the assembled deck to a PPTX file and trigger browser download.
 *
 * @param {ExportDeckInput} deck
 * @param {object} [opts]
 * @param {string} [opts.filename] — overrides default `<scaffold>-<date>.pptx`
 * @param {(msg: string, pct: number) => void} [opts.onProgress]
 * @returns {Promise<{filename: string, slideCount: number, bytes: number}>}
 */
export async function exportDeckToPPTX(deck, opts = {}) {
  const onProgress = opts.onProgress || (() => {});
  const Pptx = await loadPptxGen();
  onProgress('pptxgenjs loaded', 5);

  const pres = new Pptx();
  pres.layout = 'LAYOUT_WIDE'; // 13.333×7.5 inches (16:9)
  pres.title = deck.title;
  pres.author = 'Atlas Present';
  pres.company = 'Atlas';

  const SLIDE_W_IN = 13.333;
  const SLIDE_H_IN = 7.5;

  const total = deck.slots.length;
  for (let i = 0; i < total; i++) {
    const slot = deck.slots[i];
    onProgress(`Rendering slot ${i + 1}/${total} (${slot.slotName})`, 5 + (i / total) * 90);

    // Render slot to offscreen canvas → PNG dataURL
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = `rgb(${deck.theme.bg.join(',')})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (slot.sceneData?.subjects) {
      for (const subj of slot.sceneData.subjects) {
        try {
          await renderAtom(ctx, subj.type, subj.args, 'pseudo3d', {
            x: subj.x ?? 0,
            y: subj.y ?? 0,
            w: subj.w ?? 320,
            h: subj.h ?? 240,
            palette: deck.theme,
          });
        } catch (e) {
          console.error(`[pptx] renderAtom ${subj.type} failed:`, e);
        }
      }
    }

    const pngDataURL = canvas.toDataURL('image/png');
    const slide = pres.addSlide();
    slide.background = { color: rgbToHex(deck.theme.bg) };
    // Full-bleed image
    slide.addImage({
      data: pngDataURL,
      x: 0,
      y: 0,
      w: SLIDE_W_IN,
      h: SLIDE_H_IN,
    });
    // Speaker notes: slot purpose for the presenter
    if (slot.slotTitle || slot.slotName) {
      slide.addNotes(
        `${slot.slotTitle || slot.slotName}\n\n${slot.slotPurpose || ''}\n\nAtoms: ${
          (slot.sceneData?.subjects || []).map((s) => s.type).join(', ') || '—'
        }`,
      );
    }
  }

  onProgress('Encoding PPTX...', 96);
  const filename = opts.filename || `${deck.scaffold?.id || 'atlas-deck'}-${todayIsoDate()}.pptx`;

  // pptxgenjs writeFile in browser triggers download
  await pres.writeFile({ fileName: filename });

  onProgress('Done', 100);
  return { filename, slideCount: total, bytes: -1 };
}

function rgbToHex(rgb) {
  return rgb
    .map((c) =>
      Math.max(0, Math.min(255, Math.round(c)))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('');
}

function todayIsoDate() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}
