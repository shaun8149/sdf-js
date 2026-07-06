#!/usr/bin/env node
// atoms-to-ir-demo.mjs — Sprint 27 proof CLI: baked scaffold deck → IR deck →
// assembleDeck → compiled-ready scene JSON. The 2D pipeline's rich output
// (101 atoms, facts recall 95.8%) feeding the cinematic IR renderer.
//
// Usage: node sdf-js/scripts/atoms-to-ir-demo.mjs <deck-dir> [--env alpine]
// Writes sdf-js/scenes/ir-from-<deckname>.json (open on the 3D machine via
// ?scene=ir-from-<deckname>).
import { writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { deckToIR } from '../src/scene/scaffold-to-ir.js';
import { assembleDeck } from '../src/scene/assemble-deck.js';

const args = process.argv.slice(2);
const deckDir = args.find((a) => !a.startsWith('--'));
if (!deckDir) {
  console.error('usage: node sdf-js/scripts/atoms-to-ir-demo.mjs <deck-dir> [--env alpine]');
  process.exit(2);
}
const envIdx = args.indexOf('--env');
const env = envIdx > -1 ? args[envIdx + 1] : undefined;

const irDeck = deckToIR(resolve(deckDir));
console.log(`\n══ ${irDeck.title} — ${irDeck.slides.length} structural slides ══`);
for (const ir of irDeck.slides) {
  console.log(
    `  ${(ir.title || '(untitled)').padEnd(34)} ${ir.structure.padEnd(10)} nodes=${ir.nodes.length}${ir.magnitude ? ' +magnitude' : ''}${ir.relations ? ` +relations(${ir.relations.length})` : ''}`,
  );
}

const scene = assembleDeck(irDeck, env ? { env } : {});
const name = `ir-from-${basename(resolve(deckDir)).replace(/^eval-/, '')}`;
scene.name = scene.name || name;
const out = new URL(`../scenes/${name}.json`, import.meta.url).pathname;
writeFileSync(out, JSON.stringify(scene, null, 2));
console.log(
  `\nWrote ${out.replace(/^.*sdf-js\//, 'sdf-js/')} (subjects: ${scene.subjects.length}, overlay: ${(scene.overlay || []).length})`,
);
