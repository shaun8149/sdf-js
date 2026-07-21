#!/usr/bin/env node
// =============================================================================
// visual-audit.mjs — Sprint 36: the VISUAL adversarial axis.
//
// The text axes (facts/entities × recall/precision) can't see a slide that
// RENDERS wrong: text drawn off-canvas, labels colliding across atoms,
// unreadably small fonts, blank pages. Screenshot pixel-diffing would need a
// browser per deck; instead this runs every atom's REAL drawing code against
// an instrumented ctx that records each fillText/fillRect with the live font
// size and position, then applies deterministic geometry judgments:
//
//   OUT_OF_BOUNDS    — ink drawn beyond the 1280×720 canvas (+8px tolerance)
//   TEXT_OVERFLOW    — a string whose estimated width crosses the right edge
//   TINY_FONT        — text at < 9px (unreadable at deck scale)
//   TEXT_COLLISION   — text bboxes from DIFFERENT subjects overlapping >40%
//                      of the smaller box (same-atom stacking is by design)
//   BLANK_SLOT       — a slot whose full render produced < 5 ink calls
//   SUBJECT_OVERLAP  — non-cover subject bboxes intersecting >25% of smaller
//
// Width estimate: CJK chars ≈ 1.0×fontSize, Latin ≈ 0.58×fontSize — the same
// metric feeds the instrumented measureText so atoms' own fit logic
// (fitLabelSize etc.) behaves realistically during the audit.
// =============================================================================
import { renderAtom } from '../src/present/atoms-2d/registry.js';

const CANVAS_W = 1280;
const CANVAS_H = 720;
const EDGE_TOL = 8;

export function estimateTextWidth(text, fontSize) {
  let w = 0;
  for (const ch of String(text)) {
    w += /[ᄀ-ᇿ⺀-꓏가-힣豈-﫿︰-﹏＀-￯]/.test(ch) ? fontSize : fontSize * 0.58;
  }
  return w;
}

function parseFontPx(font) {
  const m = String(font).match(/(\d+(?:\.\d+)?)px/);
  return m ? parseFloat(m[1]) : 12;
}

// Instrumented ctx: tracks font/align/baseline AND the full affine transform
// (atoms draw rotated axis labels via translate+rotate — a noop transform
// would record false coordinates) through save/restore; records text and ink
// calls tagged with the currently-rendering subject index.
const IDENTITY = [1, 0, 0, 1, 0, 0];
function matMul(m, n) {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}
function matApply(m, x, y) {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}
// axis-aligned bounding box of a local-space rect pushed through m
function transformedAABB(m, x, y, w, h) {
  const corners = [
    matApply(m, x, y),
    matApply(m, x + w, y),
    matApply(m, x, y + h),
    matApply(m, x + w, y + h),
  ];
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY };
}

export function makeAuditCtx(record) {
  const state = {
    font: '10px sans',
    textAlign: 'left',
    textBaseline: 'alphabetic',
    m: [...IDENTITY],
  };
  const stack = [];
  const noop = () => {};
  const ink = () => record.inkCalls++;
  return {
    save: () => stack.push({ ...state, m: [...state.m] }),
    restore: () => {
      const prev = stack.pop();
      if (prev) Object.assign(state, prev);
    },
    translate: (x, y) => {
      state.m = matMul(state.m, [1, 0, 0, 1, x, y]);
    },
    rotate: (rad) => {
      const c = Math.cos(rad);
      const s = Math.sin(rad);
      state.m = matMul(state.m, [c, s, -s, c, 0, 0]);
    },
    scale: (sx, sy) => {
      state.m = matMul(state.m, [sx, 0, 0, sy ?? sx, 0, 0]);
    },
    transform: (a, b, c, d, e, f) => {
      state.m = matMul(state.m, [a, b, c, d, e, f]);
    },
    setTransform: (a, b, c, d, e, f) => {
      state.m = [a, b, c, d, e, f];
    },
    beginPath: noop,
    closePath: noop,
    moveTo: noop,
    lineTo: noop,
    quadraticCurveTo: noop,
    bezierCurveTo: noop,
    arc: ink,
    arcTo: noop,
    ellipse: ink,
    rect: noop,
    roundRect: noop,
    clip: noop,
    setLineDash: noop,
    stroke: ink,
    fill: ink,
    strokeRect: ink,
    clearRect: noop,
    drawImage: ink,
    strokeText: noop,
    fillRect(x, y, w, h) {
      record.inkCalls++;
      record.rects.push({
        subject: record.currentSubject,
        ...transformedAABB(state.m, x, y, w, h),
      });
    },
    fillText(text, x, y) {
      if (!String(text).trim()) return;
      record.inkCalls++;
      const fs = parseFontPx(state.font);
      const w = estimateTextWidth(text, fs);
      let bx = x;
      if (state.textAlign === 'center') bx = x - w / 2;
      else if (state.textAlign === 'right' || state.textAlign === 'end') bx = x - w;
      let by = y - fs; // approx top for alphabetic baseline
      if (state.textBaseline === 'middle') by = y - fs / 2;
      else if (state.textBaseline === 'top') by = y;
      const box = transformedAABB(state.m, bx, by, w, fs);
      record.texts.push({
        subject: record.currentSubject,
        text: String(text),
        ...box,
        fontSize: fs,
      });
    },
    measureText: (t) => ({ width: estimateTextWidth(t, parseFontPx(state.font)) }),
    createLinearGradient: () => ({ addColorStop: noop }),
    createRadialGradient: () => ({ addColorStop: noop }),
    set font(v) {
      state.font = v;
    },
    get font() {
      return state.font;
    },
    set textAlign(v) {
      state.textAlign = v;
    },
    get textAlign() {
      return state.textAlign;
    },
    set textBaseline(v) {
      state.textBaseline = v;
    },
    get textBaseline() {
      return state.textBaseline;
    },
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: '',
    lineJoin: '',
    shadowColor: '',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    globalAlpha: 1,
  };
}

function overlapArea(a, b) {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/**
 * auditSlotVisual(sceneData, {palette}) → issues[]
 * Each issue: { kind, subject?, type?, detail }
 */
export async function auditSlotVisual(sceneData, { palette } = {}) {
  const record = { texts: [], rects: [], inkCalls: 0, currentSubject: -1 };
  const ctx = makeAuditCtx(record);
  const subjects = sceneData.subjects || [];
  const issues = [];

  for (let i = 0; i < subjects.length; i++) {
    const s = subjects[i];
    record.currentSubject = i;
    try {
      await renderAtom(ctx, s.type, s.args, 'pseudo3d', {
        x: s.x ?? 0,
        y: s.y ?? 0,
        w: s.w ?? 320,
        h: s.h ?? 240,
        palette: palette || {
          bg: [247, 244, 224],
          silhouetteColor: [30, 27, 30],
          accent: [38, 70, 130],
          colors: [[38, 70, 130]],
        },
      });
    } catch (e) {
      issues.push({
        kind: 'RENDER_CRASH',
        subject: i,
        type: s.type,
        detail: e.message.slice(0, 100),
      });
    }
  }

  // BLANK_SLOT — a pure cover slot (deck/section cover) legitimately draws
  // little (gradient + title); only flag content slots.
  const isPureCover = subjects.length > 0 && subjects.every((s) => s.type === 'cover');
  if (record.inkCalls < 5 && !isPureCover) {
    issues.push({ kind: 'BLANK_SLOT', detail: `only ${record.inkCalls} ink calls` });
  }

  // OUT_OF_BOUNDS + TEXT_OVERFLOW + TINY_FONT
  for (const t of record.texts) {
    // single-char decorative glyphs (giant quote marks, arrows) hug or cross
    // edges by design — not a layout defect
    if (t.text.trim().length <= 1) continue;
    if (t.fontSize < 9) {
      issues.push({
        kind: 'TINY_FONT',
        subject: t.subject,
        type: subjects[t.subject]?.type,
        detail: `"${t.text.slice(0, 30)}" at ${t.fontSize.toFixed(1)}px`,
      });
    }
    if (t.x < -EDGE_TOL || t.y < -EDGE_TOL || t.y + t.h > CANVAS_H + EDGE_TOL) {
      issues.push({
        kind: 'OUT_OF_BOUNDS',
        subject: t.subject,
        type: subjects[t.subject]?.type,
        detail: `"${t.text.slice(0, 30)}" at (${t.x.toFixed(0)},${t.y.toFixed(0)})`,
      });
    } else if (t.x + t.w > CANVAS_W + EDGE_TOL) {
      issues.push({
        kind: 'TEXT_OVERFLOW',
        subject: t.subject,
        type: subjects[t.subject]?.type,
        detail: `"${t.text.slice(0, 30)}" ends at x=${(t.x + t.w).toFixed(0)}`,
      });
    }
  }

  // TEXT_COLLISION across different subjects
  for (let i = 0; i < record.texts.length; i++) {
    for (let j = i + 1; j < record.texts.length; j++) {
      const a = record.texts[i];
      const b = record.texts[j];
      if (a.subject === b.subject) continue;
      const ov = overlapArea(a, b);
      const smaller = Math.min(a.w * a.h, b.w * b.h);
      if (smaller > 0 && ov / smaller > 0.4) {
        issues.push({
          kind: 'TEXT_COLLISION',
          detail: `"${a.text.slice(0, 20)}" (subj ${a.subject}) × "${b.text.slice(0, 20)}" (subj ${b.subject})`,
        });
      }
    }
  }

  // SUBJECT_OVERLAP (declared boxes, cover excluded — covers underlay by design)
  for (let i = 0; i < subjects.length; i++) {
    for (let j = i + 1; j < subjects.length; j++) {
      const a = subjects[i];
      const b = subjects[j];
      if (a.type === 'cover' || b.type === 'cover') continue;
      const ov = overlapArea(
        { x: a.x ?? 0, y: a.y ?? 0, w: a.w ?? 0, h: a.h ?? 0 },
        { x: b.x ?? 0, y: b.y ?? 0, w: b.w ?? 0, h: b.h ?? 0 },
      );
      const smaller = Math.min((a.w ?? 0) * (a.h ?? 0), (b.w ?? 0) * (b.h ?? 0));
      if (smaller > 0 && ov / smaller > 0.25) {
        issues.push({
          kind: 'SUBJECT_OVERLAP',
          detail: `${a.type}[${i}] × ${b.type}[${j}] overlap ${((ov / smaller) * 100).toFixed(0)}%`,
        });
      }
    }
  }

  return issues;
}

/**
 * auditDeckVisual(slotSceneDatas, {palette}) → { issues, bySlot, counts }
 * slotSceneDatas: [{slotIdx, slotName, sceneData}]
 */
export async function auditDeckVisual(slotSceneDatas, opts = {}) {
  const bySlot = [];
  const counts = {};
  for (const { slotIdx, slotName, sceneData } of slotSceneDatas) {
    const issues = await auditSlotVisual(sceneData, opts);
    for (const iss of issues) counts[iss.kind] = (counts[iss.kind] || 0) + 1;
    if (issues.length) bySlot.push({ slotIdx, slotName, issues });
  }
  return { bySlot, counts, total: Object.values(counts).reduce((s, n) => s + n, 0) };
}
