#!/usr/bin/env node
// =============================================================================
// bake-slidedata.mjs — pre-parse the fixture PDF into SlideData JSON
// -----------------------------------------------------------------------------
// pdfjs-dist runs in browsers, but bundling its worker into a static demo
// page is heavy. So we bake once via this script and commit the JSON.
// The browser demo (examples/pdf-demo/pdf-demo.js) loads the JSON, then
// runs the deterministic emitter src/mapping/slide-to-2d-code.js per slide.
//
// Different role from the deleted pre-mapped JSON: that one stored 3D
// SceneData directly. This stores RAW SlideData — emit + render happens in
// browser, keeping the demo end-to-end with the pipeline we ship.
//
// Usage:  node sdf-js/scripts/bake-slidedata.mjs
// Output: sdf-js/examples/pdf-demo/slidedata.json
// Input:  sdf-js/fixtures/test-deck.pdf (gitignored — drop your own to regen)
// =============================================================================

import { parseDeck } from '../src/parser/index.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');

const PDF_PATH = path.join(REPO, 'fixtures', 'test-deck.pdf');
const OUT_PATH = path.join(REPO, 'examples', 'pdf-demo', 'slidedata.json');

const slides = await parseDeck(PDF_PATH);
await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
await fs.writeFile(OUT_PATH, JSON.stringify(slides));
console.log(`baked ${slides.length} slides → ${path.relative(REPO, OUT_PATH)}`);
console.log(`  size: ${((await fs.stat(OUT_PATH)).size / 1024).toFixed(1)} KB`);
