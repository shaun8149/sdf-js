// =============================================================================
// business-icon — 10-icon business icon set (Atlas atom, Sprint 1 atom 7/9)
// -----------------------------------------------------------------------------
// First Atlas-built icon atom under taxonomy icons/business/. Single atom type
// with `name` discriminator (instead of 10 separate atom types) — LLM API is
// simpler ("business-icon name='arrow-up'" vs 10 different type strings) and
// PRIMS/spec/compile wire-in stays minimal.
//
// 10 P0 business icons covering ~80% of KPI Dashboard demo needs:
//   arrow-up / arrow-down / check / x-mark   — status + trend (4)
//   dollar / percent                          — financial (2)
//   person                                    — HR / user (1)
//   gear                                      — settings / process (1)
//   document / calendar                       — workflow (2)
//
// Geometry: each icon fits roughly in [-size/2, size/2] cube. Stroke-based
// icons (arrows, marks, $, %) use 3D capsules (radius = thickness/2) lying in
// XY plane — natural rounded edges in Z. Filled icons (person, gear, doc,
// calendar) use rounded boxes + discs extruded along Z.
//
// All icons share a single GLSL helper sdBusinessIcon(p, iconId, ...) that
// dispatches by iconId. Each icon's JS impl is a small SDF function called by
// the wrapper businessIconSDF.
//
// Author: Atlas (2026-06-18)
// License: PolyForm Noncommercial 1.0.0
// =============================================================================

import { SDF3 } from '../../../sdf/core.js';

// Icon ID enum — keep in sync with GLSL sdBusinessIcon dispatch chain
export const ICON_IDS = {
  'arrow-up': 0,
  'arrow-down': 1,
  check: 2,
  'x-mark': 3,
  dollar: 4,
  percent: 5,
  person: 6,
  gear: 7,
  document: 8,
  calendar: 9,
};
export const ICON_NAMES = Object.keys(ICON_IDS);

// ---- SDF primitive helpers (CPU) --------------------------------------------

function sdCap(p, ax, ay, az, bx, by, bz, r) {
  const pax = p[0] - ax,
    pay = p[1] - ay,
    paz = p[2] - az;
  const bax = bx - ax,
    bay = by - ay,
    baz = bz - az;
  const dotPaBa = pax * bax + pay * bay + paz * baz;
  const dotBaBa = bax * bax + bay * bay + baz * baz;
  const h = dotBaBa > 0 ? Math.max(0, Math.min(1, dotPaBa / dotBaBa)) : 0;
  const dx = pax - bax * h,
    dy = pay - bay * h,
    dz = paz - baz * h;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - r;
}

function sdSph(p, cx, cy, cz, r) {
  const dx = p[0] - cx,
    dy = p[1] - cy,
    dz = p[2] - cz;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - r;
}

function sdRBox(p, cx, cy, cz, hx, hy, hz, rr) {
  const qx = Math.abs(p[0] - cx) - hx + rr;
  const qy = Math.abs(p[1] - cy) - hy + rr;
  const qz = Math.abs(p[2] - cz) - hz + rr;
  const dx = Math.max(qx, 0),
    dy = Math.max(qy, 0),
    dz = Math.max(qz, 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz) + Math.min(Math.max(qx, qy, qz), 0) - rr;
}

function sdDiscExt(p, cx, cy, r, halfDepth) {
  const lenXY = Math.sqrt((p[0] - cx) * (p[0] - cx) + (p[1] - cy) * (p[1] - cy));
  const d2 = lenXY - r;
  const wx = d2,
    wy = Math.abs(p[2]) - halfDepth;
  const wxMax = Math.max(wx, 0),
    wyMax = Math.max(wy, 0);
  return Math.min(Math.max(wx, wy), 0) + Math.sqrt(wxMax * wxMax + wyMax * wyMax);
}

// ---- Per-icon SDFs ----------------------------------------------------------

function iconArrowUp(p, half, r) {
  const apex = [0, half, 0];
  return Math.min(
    sdCap(p, apex[0], apex[1], 0, -half, -half * 0.5, 0, r),
    sdCap(p, apex[0], apex[1], 0, half, -half * 0.5, 0, r),
  );
}

function iconArrowDown(p, half, r) {
  return iconArrowUp([p[0], -p[1], p[2]], half, r);
}

function iconCheck(p, half, r) {
  return Math.min(
    sdCap(p, -half * 0.7, -half * 0.1, 0, -half * 0.1, -half * 0.5, 0, r),
    sdCap(p, -half * 0.1, -half * 0.5, 0, half * 0.6, half * 0.5, 0, r),
  );
}

function iconXMark(p, half, r) {
  return Math.min(
    sdCap(p, -half, -half, 0, half, half, 0, r),
    sdCap(p, -half, half, 0, half, -half, 0, r),
  );
}

function iconDollar(p, half, r) {
  let d = sdCap(p, 0, half, 0, 0, -half, 0, r);
  d = Math.min(d, sdCap(p, -half * 0.5, half * 0.5, 0, half * 0.5, half * 0.5, 0, r));
  d = Math.min(d, sdCap(p, -half * 0.5, -half * 0.5, 0, half * 0.5, -half * 0.5, 0, r));
  return d;
}

function iconPercent(p, half, r, thickness) {
  const sR = thickness * 1.2;
  let d = sdSph(p, -half * 0.5, half * 0.5, 0, sR);
  d = Math.min(d, sdSph(p, half * 0.5, -half * 0.5, 0, sR));
  d = Math.min(d, sdCap(p, -half, -half, 0, half, half, 0, r));
  return d;
}

function iconPerson(p, half, halfD) {
  let d = sdSph(p, 0, half * 0.4, 0, half * 0.35);
  d = Math.min(d, sdRBox(p, 0, -half * 0.4, 0, half * 0.6, half * 0.4, halfD, half * 0.3));
  return d;
}

function iconGear(p, half, halfD) {
  const outerR = half * 0.85;
  const innerR = half * 0.4;
  let d = sdDiscExt(p, 0, 0, outerR, halfD);
  d = Math.max(d, -sdDiscExt(p, 0, 0, innerR, halfD));
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    const tx = Math.cos(a) * half * 0.92;
    const ty = Math.sin(a) * half * 0.92;
    d = Math.min(d, sdSph(p, tx, ty, 0, half * 0.15));
  }
  return d;
}

function iconDocument(p, size, halfD) {
  return sdRBox(p, 0, 0, 0, size * 0.4, size * 0.5, halfD, size * 0.04);
}

function iconCalendar(p, size, halfD) {
  let d = sdRBox(p, 0, 0, 0, size * 0.45, size * 0.45, halfD, size * 0.05);
  d = Math.min(
    d,
    sdRBox(p, -size * 0.2, size * 0.55, 0, size * 0.05, size * 0.1, halfD * 1.5, size * 0.02),
  );
  d = Math.min(
    d,
    sdRBox(p, size * 0.2, size * 0.55, 0, size * 0.05, size * 0.1, halfD * 1.5, size * 0.02),
  );
  return d;
}

// ---- Dispatcher -------------------------------------------------------------

function callIcon(id, p, size, thickness, depth) {
  const half = size / 2;
  const r = thickness / 2;
  const halfD = depth / 2;
  switch (id) {
    case 0:
      return iconArrowUp(p, half, r);
    case 1:
      return iconArrowDown(p, half, r);
    case 2:
      return iconCheck(p, half, r);
    case 3:
      return iconXMark(p, half, r);
    case 4:
      return iconDollar(p, half, r);
    case 5:
      return iconPercent(p, half, r, thickness);
    case 6:
      return iconPerson(p, half, halfD);
    case 7:
      return iconGear(p, half, halfD);
    case 8:
      return iconDocument(p, size, halfD);
    case 9:
      return iconCalendar(p, size, halfD);
    default:
      return 1e6;
  }
}

export function businessIconSDF({
  name = 'check',
  size = 1.0,
  thickness = 0.15,
  depth = 0.15,
} = {}) {
  const id = name in ICON_IDS ? ICON_IDS[name] : 2; // default to 'check'

  const inst = SDF3((p) => callIcon(id, p, size, thickness, depth));

  inst.ast = {
    kind: 'prim',
    name: 'business-icon',
    args: [id, size, thickness, depth, name],
  };
  return inst;
}

export const businessIconSpec = {
  type: 'business-icon',
  category: 'icons/business',
  args: {
    name: {
      type: 'string',
      default: 'check',
      doc: `Icon name. One of: ${ICON_NAMES.join(', ')}`,
    },
    size: {
      type: 'number',
      default: 1.0,
      doc: 'Overall scale (icon fits in ~[-size/2, size/2] cube)',
    },
    thickness: {
      type: 'number',
      default: 0.15,
      doc: 'Line stroke thickness for stroke-based icons (arrows, marks, $, %)',
    },
    depth: { type: 'number', default: 0.15, doc: 'Z extrusion depth' },
  },
  examples: ICON_NAMES.map((n) => ({ name: `Icon: ${n}`, args: { name: n } })),
  description: '10 core business icons (arrows, marks, currency, person, gear, document, calendar)',
  source: {
    author: 'Atlas',
    builtAt: '2026-06-18',
    builder: 'Sprint 1 atom #7 — first 10 of business icon set',
    license: 'PolyForm Noncommercial 1.0.0',
  },
};
