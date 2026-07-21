#!/usr/bin/env node
// test-atom-3d-coverage.mjs — Sprint 24 invariant: every atom the LLM can emit
// (i.e. every atom in ANY scaffold's recommended_atoms) must have a 3D exit:
//   (a) an explicit TWIN_MAP entry in lift-2d-to-3d.js, OR
//   (b) a `<type>-3d` primitive registered in spec.js (generic fallback works).
// If neither, the 3D lift silently skips the subject and the slide loses content
// — the "X-shaped gap" this test permanently closes. See sprint24-report.md.
import { readFileSync } from 'node:fs';
import { SCAFFOLDS } from '../src/present/scaffolds/registry.js';
import { TWIN_MAP } from '../src/scene/lift-2d-to-3d.js';

let pass = 0;
let fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));

console.log('=== atom → 3D coverage invariant ===\n');

const specSrc = readFileSync(new URL('../src/scene/spec.js', import.meta.url), 'utf8');

// every atom any scaffold recommends
const recommended = new Set();
for (const s of SCAFFOLDS) {
  for (const slot of s.slots) {
    for (const a of slot.recommended_atoms || []) recommended.add(a);
  }
}

let precise = 0;
let generic = 0;
const deadEnds = [];
for (const atom of recommended) {
  if (Object.prototype.hasOwnProperty.call(TWIN_MAP, atom)) {
    precise++;
  } else if (specSrc.includes(`'${atom}-3d'`)) {
    generic++;
  } else {
    deadEnds.push(atom);
  }
}

console.log(`  recommended atoms: ${recommended.size}`);
console.log(`  precise twin:      ${precise}`);
console.log(`  generic fallback:  ${generic}`);
console.log(
  `  DEAD-END:          ${deadEnds.length}${deadEnds.length ? ' — ' + deadEnds.join(', ') : ''}\n`,
);

ok(recommended.size >= 60, `recommended pool is large (${recommended.size} ≥ 60)`);
ok(deadEnds.length === 0, 'ZERO dead-end atoms (every emittable atom has a 3D exit)');
ok(precise >= 35, `precise twin coverage is deep (${precise} ≥ 35)`);

// spot-check both halves of the closed X-gap
const sprint1920 = ['swot', 'stat-banner', 'comparison-table', 'process-arrows', 'quote-pull'];
for (const a of sprint1920) {
  ok(Object.prototype.hasOwnProperty.call(TWIN_MAP, a), `Sprint 19/20 atom has twin: ${a}`);
}
const sprint22 = ['mountain-path', 'risk-heatmap', 'okr-tree', 'testimonial-wall'];
for (const a of sprint22) {
  ok(recommended.has(a), `Sprint 22 atom is recommendable: ${a}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
