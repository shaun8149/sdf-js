#!/usr/bin/env node
// =============================================================================
// scripts/bake-icon-library.mjs — Bake selected Phosphor icons into JS map
// -----------------------------------------------------------------------------
// Reads sdf-js/src/icons/categories.js → for each name, opens
// node_modules/@phosphor-icons/core/assets/regular/<name>.svg, extracts the
// concatenated <path d="..."> attribute(s), writes a single map file
// sdf-js/src/icons/baked-library.js as `export const BAKED_ICONS = {...}`.
//
// Multi-path icons: all `d` attributes are joined with a space, producing
// a single string Canvas2D `new Path2D(str)` can consume.
//
// Missing icons (name in categories.js but no SVG file) are logged to stderr
// and skipped (so a typo in categories.js fails loud but bake still completes).
//
// Run via: npm run build:icons
// =============================================================================

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');
const PHOSPHOR_DIR = resolve(REPO_ROOT, 'node_modules/@phosphor-icons/core/assets/regular');
const CATEGORIES_FILE = resolve(REPO_ROOT, 'sdf-js/src/icons/categories.js');
const OUTPUT_FILE = resolve(REPO_ROOT, 'sdf-js/src/icons/baked-library.js');

// Regex matches d="..." attribute. Phosphor SVGs are well-formed single-line
// so the simple regex is safe (no multi-line attrs). Captures payload.
const PATH_D_RE = /<path[^>]*\sd="([^"]+)"/g;

async function extractPathD(svgFile) {
  const svg = await readFile(svgFile, 'utf8');
  const dList = [];
  let m;
  PATH_D_RE.lastIndex = 0;
  while ((m = PATH_D_RE.exec(svg)) !== null) {
    dList.push(m[1]);
  }
  return dList.join(' ');
}

async function loadCategories() {
  const mod = await import(`file://${CATEGORIES_FILE}`);
  return mod.getAllIconNames();
}

async function main() {
  const names = await loadCategories();
  console.log(`Baking ${names.length} icons from Phosphor regular weight...`);
  const baked = {};
  const missing = [];
  for (const name of names) {
    const svgFile = resolve(PHOSPHOR_DIR, `${name}.svg`);
    if (!existsSync(svgFile)) {
      missing.push(name);
      continue;
    }
    const d = await extractPathD(svgFile);
    if (!d) {
      missing.push(`${name} (no d attr)`);
      continue;
    }
    baked[name] = d;
  }
  if (missing.length) {
    console.error(`\nMISSING: ${missing.length} icons not found or empty:`);
    missing.forEach((n) => console.error(`  - ${n}`));
  }
  const lines = [
    '// =============================================================================',
    '// sdf-js/src/icons/baked-library.js — GENERATED, DO NOT EDIT BY HAND',
    `// Generated: ${new Date().toISOString()}`,
    '// Source: @phosphor-icons/core@2.1.1 (MIT), regular weight',
    '// Re-generate: npm run build:icons',
    '// =============================================================================',
    '',
    'export const BAKED_ICONS = Object.freeze({',
    ...Object.entries(baked).map(([n, d]) => `  ${JSON.stringify(n)}: ${JSON.stringify(d)},`),
    '});',
    '',
    'export function getBakedIconNames() {',
    '  return Object.keys(BAKED_ICONS);',
    '}',
    '',
  ];
  await writeFile(OUTPUT_FILE, lines.join('\n'), 'utf8');
  console.log(`\nOK  ${Object.keys(baked).length} icons → ${OUTPUT_FILE}`);
  if (missing.length) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
