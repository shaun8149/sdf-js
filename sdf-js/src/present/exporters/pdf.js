// =============================================================================
// exporters/pdf.js — Export assembled deck → PDF file
// -----------------------------------------------------------------------------
// Sprint 17 — Lighter-weight sibling of pptx.js. Each baked slot becomes one
// PDF page in landscape orientation. Image-embed approach (canvas PNG) — same
// rationale as pptx.js.
//
// PDF is for distribution / archival / printing. PPTX is for editing.
// Both share the same canvas-render pipeline from atoms-2d.
// =============================================================================

import { renderSceneDataToCanvas } from '../atoms-2d/renderer.js';
import { slotPalette, slotRoleOf } from '../retheme.js';
import {
  artMountOpts,
  mountPaletteOverride,
  mountUnderlayDecor,
  insertTransitions,
} from '../art-mount.js';
import { layoutForSlot } from '../atoms-2d/layout.js';

const JSPDF_CDN = 'https://esm.sh/jspdf@2.5.2';
let jsPDF = null;

async function loadJsPDF() {
  if (jsPDF) return jsPDF;
  const mod = await import(/* @vite-ignore */ JSPDF_CDN);
  jsPDF = mod.jsPDF || mod.default?.jsPDF || mod.default;
  if (!jsPDF) throw new Error('jspdf module did not expose jsPDF constructor');
  return jsPDF;
}

/**
 * Export the assembled deck to a PDF file and trigger browser download.
 * Same input shape as exportDeckToPPTX.
 *
 * @param {import('./pptx.js').ExportDeckInput} deck
 * @param {object} [opts]
 * @param {string} [opts.filename]
 * @param {(msg: string, pct: number) => void} [opts.onProgress]
 * @returns {Promise<{filename: string, pageCount: number, bytes: number}>}
 */
export async function exportDeckToPDF(deck, opts = {}) {
  const onProgress = opts.onProgress || (() => {});
  const JsPDF = await loadJsPDF();
  onProgress('jspdf loaded', 5);

  // Landscape A4-ish at 1280:720 aspect (16:9). Use mm units.
  // 280mm × 157.5mm matches 16:9 nicely and fits Letter/A4 landscape.
  const PAGE_W_MM = 280;
  const PAGE_H_MM = 157.5;

  const pdf = new JsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [PAGE_W_MM, PAGE_H_MM],
    compress: true,
  });
  pdf.setProperties({
    title: deck.title,
    author: 'Atlas Present',
    creator: 'Atlas',
    subject: deck.scaffold?.label || 'deck',
  });

  // Sprint 97 (批量产品化): 装裱导出自动合成转场页 — 此前只有临场脚本
  // 会插, in-app 导出与批量脚本从此同一产物
  const slots = opts.artMount ? insertTransitions(deck.slots, opts.artMount) : deck.slots;
  const total = slots.length;
  for (let i = 0; i < total; i++) {
    const slot = slots[i];
    onProgress(`Rendering page ${i + 1}/${total} (${slot.slotName})`, 5 + (i / total) * 90);

    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    // Unified slide painter (Sprint 41): same renderer as the on-screen
    // preview — decoration layer included, per-atom errors non-fatal.
    try {
      await renderSceneDataToCanvas(canvas, slot.sceneData || { subjects: [] }, {
        palette: opts.artMount
          ? mountPaletteOverride(slotPalette(deck.theme, slot), opts.artMount)
          : slotPalette(deck.theme, slot),
        decorRole: slotRoleOf(slot),
        layout: layoutForSlot(slot, slot.sceneData),
        decor: deck.decor
          ? (opts.artMount ? mountUnderlayDecor : (d) => d)(
              { ...deck.decor, seed: (deck.decor.seed ?? 1) + slot.slotIdx },
              opts.artMount,
            )
          : undefined,
        // Sprint 82: 真迹装裱 — screen and file must show the same mount
        ...(artMountOpts(opts.artMount, slot, slotRoleOf(slot)) || {}),
      });
    } catch (e) {
      console.error(`[pdf] slide render failed:`, e);
    }

    const pngDataURL = canvas.toDataURL('image/png');

    if (i > 0) pdf.addPage([PAGE_W_MM, PAGE_H_MM], 'landscape');
    pdf.addImage(pngDataURL, 'PNG', 0, 0, PAGE_W_MM, PAGE_H_MM, undefined, 'FAST');
  }

  onProgress('Encoding PDF...', 96);
  const filename = opts.filename || `${deck.scaffold?.id || 'atlas-deck'}-${todayIsoDate()}.pdf`;
  pdf.save(filename);

  onProgress('Done', 100);
  return { filename, pageCount: total, bytes: -1 };
}

function todayIsoDate() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}
