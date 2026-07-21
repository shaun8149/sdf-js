// =============================================================================
// exporters/pdf.js — Export assembled deck → PDF file
// -----------------------------------------------------------------------------
// Sprint 17 — Lighter-weight sibling of pptx.js. Each baked slot becomes one
// PDF page in landscape orientation. Image-embed approach (canvas PNG) — same
// rationale as pptx.js.
//
// PDF is for distribution / archival / printing. PPTX is for editing.
// Both share the same canvas-render pipeline from atoms-2d.
//
// Sprint 100 (批量出厂检): 核心循环拆成 buildDeckPdf — headless 批量脚本
// (scripts/batch-decks.mjs) 与 in-app 下载共用同一段代码, 临场脚本复刻管线
// 导致的漂移 (2026-07-14 黑洞页事故) 从结构上封死。opts.lint 打开渲染后
// 视觉闸门 (page-lint.js): 黑洞/空白/无对比页在出厂前 fail loud。
// =============================================================================

import { renderSceneDataToCanvas } from '../atoms-2d/renderer.js';
import { slotPalette, slotRoleOf } from '../retheme.js';
import {
  artMountOpts,
  mountPaletteOverride,
  mountUnderlayDecor,
  insertTransitions,
  agendaLabelsOf,
  themeSlotBannerTitle,
} from '../art-mount.js';
import { layoutForSlot } from '../atoms-2d/layout.js';
import { lintPage, pageKindOf } from '../page-lint.js';

const JSPDF_CDN = 'https://esm.sh/jspdf@2.5.2';
let jsPDF = null;

async function loadJsPDF() {
  if (jsPDF) return jsPDF;
  const mod = await import(/* @vite-ignore */ JSPDF_CDN);
  jsPDF = mod.jsPDF || mod.default?.jsPDF || mod.default;
  if (!jsPDF) throw new Error('jspdf module did not expose jsPDF constructor');
  return jsPDF;
}

// Landscape A4-ish at 1280:720 aspect (16:9). Use mm units.
// 280mm × 157.5mm matches 16:9 nicely and fits Letter/A4 landscape.
const PAGE_W_MM = 280;
const PAGE_H_MM = 157.5;

/**
 * buildDeckPdf(deck, opts) → { pdf, pageCount, lint }
 * The canonical deck→PDF pipeline WITHOUT the download side-effect —
 * consumed by exportDeckToPDF (in-app save) and the headless batch runner.
 *
 * @param {import('./pptx.js').ExportDeckInput} deck
 * @param {object} [opts]
 * @param {(msg: string, pct: number) => void} [opts.onProgress]
 * @param {object} [opts.artMount]  — loaded mount (see art-mount.js)
 * @param {boolean} [opts.lint]     — run page-lint per page (default true; pass
 *   false only for debugging); issues collected in the returned lint report;
 *   lint.ok === false means出厂不合格
 * @returns {Promise<{pdf: object, pageCount: number,
 *   lint: {ok: boolean, pages: Array<{slotName: string, issues: string[]}>}}>}
 */
export async function buildDeckPdf(deck, opts = {}) {
  const onProgress = opts.onProgress || (() => {});
  const runLint = shouldRunPdfLint(opts);
  const JsPDF = await loadJsPDF();
  onProgress('jspdf loaded', 5);

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
  // 对抗 R4: theme-N-lead/detail 的占位符页题 → agenda 第 N 条 (与转场页同源)
  const agendaLabels = agendaLabelsOf(deck.slots);
  const lintPages = [];
  for (let i = 0; i < total; i++) {
    const slot = slots[i];
    onProgress(`Rendering page ${i + 1}/${total} (${slot.slotName})`, 5 + (i / total) * 90);

    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const layout = layoutForSlot(slot, slot.sceneData);
    // Unified slide painter (Sprint 41): same renderer as the on-screen
    // preview — decoration layer included, per-atom errors non-fatal.
    let renderFailed = false;
    try {
      await renderSceneDataToCanvas(canvas, slot.sceneData || { subjects: [] }, {
        palette: opts.artMount
          ? mountPaletteOverride(slotPalette(deck.theme, slot), opts.artMount)
          : slotPalette(deck.theme, slot),
        decorRole: slotRoleOf(slot),
        layout,
        decor: deck.decor
          ? (opts.artMount ? mountUnderlayDecor : (d) => d)(
              { ...deck.decor, seed: (deck.decor.seed ?? 1) + slot.slotIdx },
              opts.artMount,
            )
          : undefined,
        // Sprint 82: 真迹装裱 — screen and file must show the same mount
        ...(artMountOpts(opts.artMount, slot, slotRoleOf(slot)) || {}),
        ...(themeSlotBannerTitle(slot, agendaLabels)
          ? { bannerTitle: themeSlotBannerTitle(slot, agendaLabels) }
          : {}),
      });
    } catch (e) {
      console.error(`[pdf] slide render failed:`, e);
      if (!runLint) throw e;
      renderFailed = true;
      recordPdfRenderFailure(lintPages, slot, e);
    }

    if (runLint && !renderFailed) {
      const ctx = canvas.getContext('2d');
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const r = lintPage(img, pageKindOf(slot, layout));
      if (!r.ok) lintPages.push({ slotName: slot.slotName, issues: r.issues });
    }

    const pngDataURL = canvas.toDataURL('image/png');

    if (i > 0) pdf.addPage([PAGE_W_MM, PAGE_H_MM], 'landscape');
    pdf.addImage(pngDataURL, 'PNG', 0, 0, PAGE_W_MM, PAGE_H_MM, undefined, 'FAST');
  }

  onProgress('Encoding PDF...', 96);
  return { pdf, pageCount: total, lint: { ok: lintPages.length === 0, pages: lintPages } };
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
  const runLint = shouldRunPdfLint(opts);
  const { pdf, pageCount, lint } = await buildDeckPdf(deck, { ...opts, lint: runLint });
  if (runLint && !lint.ok) {
    const detail = lint.pages.map((p) => `${p.slotName}: ${p.issues.join(', ')}`).join('; ');
    throw new Error(`page-lint failed — ${detail}`);
  }
  const filename = opts.filename || `${deck.scaffold?.id || 'atlas-deck'}-${todayIsoDate()}.pdf`;
  pdf.save(filename);
  onProgress('Done', 100);
  return { filename, pageCount, bytes: -1 };
}

function todayIsoDate() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

export function shouldRunPdfLint(opts = {}) {
  return opts.lint !== false;
}

export function recordPdfRenderFailure(lintPages, slot, error) {
  const msg = error?.message ? ` (${error.message})` : '';
  lintPages.push({
    slotName: slot?.slotName || `slot-${slot?.slotIdx ?? 'unknown'}`,
    issues: [`render-failed${msg}`],
  });
}
