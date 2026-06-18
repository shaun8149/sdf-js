#!/usr/bin/env node
// =============================================================================
// bake-slidedata.mjs — pre-parse the fixture PDF into JSON for browser demo
// -----------------------------------------------------------------------------
// pdfjs-dist works in browsers too, but for the M1.5 stun demo we want the
// page to render instantly without bundling a worker. So: bake once via this
// script, commit the resulting JSON, demo HTML loads via fetch().
//
// Usage:  node sdf-js/scripts/bake-slidedata.mjs
// Output: sdf-js/examples/sdf/pdf-mapping-data.json (gitignored if PDF is)
// =============================================================================

import { parseDeck } from '../src/parser/index.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, '..');

const PDF_PATH = path.join(REPO, 'fixtures', 'test-deck.pdf');
const OUT_PATH = path.join(REPO, 'examples', 'sdf', 'pdf-mapping-data.json');

const slides = await parseDeck(PDF_PATH);
await fs.writeFile(OUT_PATH, JSON.stringify(slides));
console.log(`baked ${slides.length} slides → ${path.relative(REPO, OUT_PATH)}`);
console.log(`  size: ${((await fs.stat(OUT_PATH)).size / 1024).toFixed(1)} KB`);
