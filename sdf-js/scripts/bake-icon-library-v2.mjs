#!/usr/bin/env node
// =============================================================================
// bake-icon-library-v2.mjs — Sprint 18 3-source icon bake
// -----------------------------------------------------------------------------
// Reads sdf-js/src/icons/categories.js (14 curated cats), pulls SVG `d`
// attributes from 3 npm packages, and writes 3 ESM source files Atlas can
// import directly without runtime SVG parsing:
//
//   - sdf-js/src/icons/baked-library.js  Phosphor icons (most names)
//   - sdf-js/src/icons/brand-icons.js    Simple Icons brand logos
//   - sdf-js/src/icons/flag-icons.js     flag-icons country flags
//
// Run from repo root:  node sdf-js/scripts/bake-icon-library-v2.mjs
// =============================================================================

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CATEGORIES } from '../src/icons/categories.js';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const PHOSPHOR_DIR = `${REPO}/node_modules/@phosphor-icons/core/assets/regular`;
const SIMPLE_ICONS_DIR_CANDIDATES = [
  `${REPO}/node_modules/simple-icons/icons`,
  `${REPO}/node_modules/simple-icons/_icons`,
];
const FLAG_ICONS_DIR = `${REPO}/node_modules/flag-icons/flags/4x3`;

const OUT_PHOSPHOR = `${REPO}/sdf-js/src/icons/baked-library.js`;
const OUT_BRAND = `${REPO}/sdf-js/src/icons/brand-icons.js`;
const OUT_FLAGS = `${REPO}/sdf-js/src/icons/flag-icons.js`;

// Categories that map to Phosphor (vs Simple Icons / flags)
const PHOSPHOR_CATEGORIES = [
  'business',
  'tech',
  'ai-robotics',
  'medical',
  'finance',
  'hrm',
  'calendar',
  'signs',
  'nature-energy',
  'transport',
  'arrows',
];
const BRAND_CATEGORIES = ['brand-social', 'brand-tools'];

// ============================================================================
// SVG path extraction helper — pull `d="..."` from an SVG file
// ============================================================================
function extractPathD(svgText) {
  // SVG files may have multiple <path> elements; concatenate their `d` attrs
  const matches = [...svgText.matchAll(/<path[^>]*\sd="([^"]+)"/g)];
  if (matches.length === 0) return null;
  return matches.map((m) => m[1]).join(' ');
}

// ============================================================================
// PHASE 1 — bake Phosphor (existing names + new from PHOSPHOR_CATEGORIES)
// ============================================================================
function bakePhosphor() {
  if (!existsSync(PHOSPHOR_DIR)) {
    throw new Error(`@phosphor-icons/core not installed: ${PHOSPHOR_DIR}`);
  }
  const baked = {};
  const missing = [];
  // Dedupe names from PHOSPHOR_CATEGORIES (an icon can appear in multiple cats)
  const wanted = new Set();
  for (const cat of PHOSPHOR_CATEGORIES) {
    for (const n of CATEGORIES[cat]) wanted.add(n);
  }
  for (const name of wanted) {
    const path = `${PHOSPHOR_DIR}/${name}.svg`;
    if (!existsSync(path)) {
      missing.push(name);
      continue;
    }
    const svg = readFileSync(path, 'utf8');
    const d = extractPathD(svg);
    if (!d) {
      missing.push(name + ' (no <path d>)');
      continue;
    }
    baked[name] = d;
  }
  return { baked, missing };
}

// ============================================================================
// PHASE 2 — bake Simple Icons brand logos
// ============================================================================
function findSimpleIconsDir() {
  for (const dir of SIMPLE_ICONS_DIR_CANDIDATES) {
    if (existsSync(dir)) return dir;
  }
  return null;
}

function loadSlugToHex() {
  // simple-icons v16 SVGs have no inline fill= attr; brand hex lives in data JSON
  const dataPath = `${REPO}/node_modules/simple-icons/data/simple-icons.json`;
  if (!existsSync(dataPath)) {
    console.warn('  WARN: simple-icons data JSON not found at', dataPath);
    return {};
  }
  const raw = readFileSync(dataPath, 'utf8');
  const data = JSON.parse(raw);
  const map = {};
  for (const key of Object.keys(data)) {
    const entry = data[key];
    if (entry && entry.slug && entry.hex) {
      map[entry.slug] = '#' + entry.hex;
    }
  }
  return map;
}

function bakeSimpleIcons() {
  const dir = findSimpleIconsDir();
  if (!dir) {
    throw new Error(
      `simple-icons not installed (looked in: ${SIMPLE_ICONS_DIR_CANDIDATES.join(', ')})`,
    );
  }
  // Load slug→hex map from data JSON (v16+ SVGs have no inline fill attribute)
  const slugToHex = loadSlugToHex();

  const baked = {};
  const missing = [];
  const wanted = new Set();
  for (const cat of BRAND_CATEGORIES) {
    for (const n of CATEGORIES[cat]) wanted.add(n);
  }
  for (const slug of wanted) {
    const path = `${dir}/${slug}.svg`;
    if (!existsSync(path)) {
      missing.push(slug);
      continue;
    }
    const svg = readFileSync(path, 'utf8');
    const d = extractPathD(svg);
    if (!d) {
      missing.push(slug + ' (no <path d>)');
      continue;
    }
    // Brand color from data JSON; fall back to #000000 only if slug not found
    const color = slugToHex[slug] ?? '#000000';
    baked[slug] = { path: d, color };
  }
  return { baked, missing };
}

// ============================================================================
// PHASE 3 — bake flag-icons (auto-pull all 207, not just the curated top-50)
// Bakes ALL flag-icons SVGs — CATEGORIES['flags'] is informational only
// (used by categories.js consumers + lift prompt), not by the bake.
// ============================================================================
function bakeFlagIcons() {
  if (!existsSync(FLAG_ICONS_DIR)) {
    throw new Error(`flag-icons not installed: ${FLAG_ICONS_DIR}`);
  }
  const baked = {};
  // Auto-pull every SVG in the folder (flag-icons ships 207 in 4x3 layout)
  for (const fname of readdirSync(FLAG_ICONS_DIR)) {
    if (!fname.endsWith('.svg')) continue;
    const code = fname.replace(/\.svg$/, '').toLowerCase();
    const svg = readFileSync(`${FLAG_ICONS_DIR}/${fname}`, 'utf8');
    // Flags are complex multi-shape SVGs — store the inner SVG body (between
    // first <svg> open and last </svg> close), not just <path d>. This lets
    // the consumer paste it directly into a Path2D-incompatible flag renderer.
    const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, '');
    baked[code] = inner.trim();
  }
  return { baked, missing: [] };
}

// ============================================================================
// WRITERS
// ============================================================================
function writeBakedFile(path, exportName, data, header) {
  const body = JSON.stringify(data, null, 2);
  const content = `// =============================================================================
// ${path.split('/').pop()} — AUTO-GENERATED by bake-icon-library-v2.mjs
// DO NOT EDIT MANUALLY. Re-run the bake script to update.
// ${header}
// =============================================================================

export const ${exportName} = ${body};
`;
  writeFileSync(path, content);
}

// ============================================================================
// RUN
// ============================================================================
console.log('Baking Phosphor icons...');
const phosphor = bakePhosphor();
console.log(
  `  ${Object.keys(phosphor.baked).length} icons baked; ${phosphor.missing.length} missing`,
);
if (phosphor.missing.length > 0) {
  console.log(
    '  missing:',
    phosphor.missing.slice(0, 20).join(', '),
    phosphor.missing.length > 20 ? `... +${phosphor.missing.length - 20}` : '',
  );
}

console.log('\nBaking Simple Icons...');
const brand = bakeSimpleIcons();
console.log(`  ${Object.keys(brand.baked).length} icons baked; ${brand.missing.length} missing`);
if (brand.missing.length > 0) {
  console.log('  missing:', brand.missing.slice(0, 20).join(', '));
}

console.log('\nBaking flag-icons...');
const flags = bakeFlagIcons();
console.log(`  ${Object.keys(flags.baked).length} flags baked`);

console.log('\nWriting output files...');
writeBakedFile(
  OUT_PHOSPHOR,
  'BAKED_ICONS',
  phosphor.baked,
  'Source: @phosphor-icons/core (MIT) - regular weight SVG path d attributes.',
);
writeBakedFile(
  OUT_BRAND,
  'BRAND_ICONS',
  brand.baked,
  'Source: simple-icons (MIT) - brand SVG path + native brand fill color.',
);
writeBakedFile(
  OUT_FLAGS,
  'FLAG_ICONS',
  flags.baked,
  'Source: flag-icons (CC0) - 4x3 SVG inner body keyed by ISO 3166-1 alpha-2.',
);

console.log(
  `\nTotal baked: ${
    Object.keys(phosphor.baked).length +
    Object.keys(brand.baked).length +
    Object.keys(flags.baked).length
  } icons across 3 source files.`,
);
