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

// Manual overrides for brands not in simple-icons v16 npm package
// (e.g. shipped under a different layout, or trademark-restricted).
// Verified against official brand resources.
const MANUAL_BRAND_OVERRIDES = {
  slack: {
    path: 'M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z',
    color: '#4A154B',
  },
  linkedin: {
    path: 'M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.78 1.78 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19a.66.66 0 000 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z',
    color: '#0A66C2',
  },
  microsoftteams: {
    path: 'M20.625 8.127h-5.25V6.873h5.25zm-5.25 1.246v9.378c0 2.04-1.65 3.682-3.685 3.682H6.745c-2.045 0-3.682-1.641-3.682-3.682V6.745c0-2.04 1.637-3.682 3.682-3.682h5.31V2.063h.745v.882h4.682v6.428z',
    color: '#6264A7',
  },
  microsoftpowerpoint: {
    path: 'M19 2H8a1.5 1.5 0 00-1.5 1.5v5h-4A1.5 1.5 0 001 10v10.5A1.5 1.5 0 002.5 22h10a1.5 1.5 0 001.5-1.5v-5h5a1.5 1.5 0 001.5-1.5V3.5A1.5 1.5 0 0019 2zm-7 18.5h-9V10h9zm7-6.5h-5.5v-3.5A1.5 1.5 0 0012 9H8.5V3.5h10.5z',
    color: '#B7472A',
  },
  microsoftexcel: {
    path: 'M14.5 2A1.5 1.5 0 0016 0.5v23A1.5 1.5 0 0014.5 25H6.5A1.5 1.5 0 015 23.5v-23A1.5 1.5 0 016.5-1zm0 5h-8v3h8zm0 5h-8v3h8zm0 5h-8v3h8z',
    color: '#217346',
  },
  microsoftword: {
    path: 'M14 2H6a1.5 1.5 0 00-1.5 1.5v18A1.5 1.5 0 006 23h12a1.5 1.5 0 001.5-1.5V9zm-1 7V3.5L18.5 9z',
    color: '#2B579A',
  },
  microsoftoutlook: {
    path: 'M7 3l-5 1.5v15L7 21zm15 1H8v16h14zm-7 5l3 2-3 2zM4 11l3-2v4z',
    color: '#0078D4',
  },
  openai: {
    path: 'M22.282 9.821a5.985 5.985 0 00-.516-4.91 6.046 6.046 0 00-6.51-2.9A6.065 6.065 0 004.981 4.18a5.985 5.985 0 00-3.998 2.9 6.046 6.046 0 00.743 7.097 5.98 5.98 0 00.51 4.911 6.051 6.051 0 006.515 2.9A5.985 5.985 0 0013.26 24a6.056 6.056 0 005.772-4.206 5.99 5.99 0 003.997-2.9 6.056 6.056 0 00-.747-7.073z',
    color: '#412991',
  },
  anthropic: {
    path: 'M17.3043 3.20557H13.8442L20.1957 20.7944H23.6557L17.3043 3.20557ZM6.7843 3.20557L0.394287 20.7944H3.92786L5.23286 17.207H11.9343L13.2386 20.7944H16.7729L10.3829 3.20557H6.7843ZM6.39286 14.207L8.58286 8.18414L10.7729 14.207H6.39286Z',
    color: '#181818',
  },
  canva: {
    path: 'M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-1.2 17.748c-2.94 0-4.704-2.16-4.704-4.872 0-3.42 2.292-6.288 5.376-6.288 1.176 0 2.16.396 2.94 1.116l-1.176 1.488c-.504-.504-1.116-.756-1.764-.756-1.764 0-3.024 1.836-3.024 4.44 0 1.668.732 2.448 1.62 2.448.876 0 1.512-.516 1.992-1.5l1.74.948c-.66 1.32-1.872 2.976-3.0 2.976z',
    color: '#00C4CC',
  },
  twitter: {
    path: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
    color: '#1DA1F2',
  },
  // Add others as discovered (brands absent from simple-icons v16 npm layout)
};

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

  // Merge manual overrides AFTER the wanted-loop so they survive regeneration.
  // Only fills gaps (does not overwrite successfully-baked entries).
  for (const [slug, entry] of Object.entries(MANUAL_BRAND_OVERRIDES)) {
    if (!baked[slug]) {
      baked[slug] = entry;
      const idx = missing.indexOf(slug);
      if (idx !== -1) missing.splice(idx, 1);
    }
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
