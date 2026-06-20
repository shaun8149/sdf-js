#!/usr/bin/env node
// =============================================================================
// scripts/run-tests.mjs — CLI test orchestrator (root)
//
// Single source of truth for which tests run under `npm test`. Runs each test
// file in a child process, captures output, prints PASS / FAIL per file, and
// exits non-zero if any test failed.
//
// Add a new test: append to TESTS below. Group it under the right category;
// CI runs them all. Local devs can run a single category via the npm scripts
// in package.json (npm run test:smoke, test:world, etc.).
//
// API-key-required tests (scripts/regression/lift-regression.mjs) are NOT in
// this list — they live under `npm run test:regression` and only run when the
// caller has ANTHROPIC_API_KEY set.
// =============================================================================

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..');

const TESTS = [
  // 2D + 3D primitive smoke tests
  { category: 'smoke', file: 'sdf-js/test/smoke.mjs' },
  { category: 'smoke', file: 'sdf-js/test/smoke2d.mjs' },
  { category: 'smoke', file: 'sdf-js/test/scene-smoke.mjs' },

  // Geometry sanity checker (M5 prereq)
  { category: 'sanity', file: 'sdf-js/scripts/test-sanity.mjs' },

  // IQ-shader program W1 — remapping / easing math toolkit (recipe-only ports)
  { category: 'math', file: 'sdf-js/scripts/test-easing.mjs' },
  // IQ-shader program W2 — noise w/ analytic derivatives, warp, voronoise/edges
  { category: 'math', file: 'sdf-js/scripts/test-noise.mjs' },
  // IQ-shader program W3 — band-limited filtering / texturing (checker/grid/etc)
  { category: 'math', file: 'sdf-js/scripts/test-filter.mjs' },
  // IQ-shader program W4 — lighting (sphere AO/shadow, outdoor model, fog)
  { category: 'math', file: 'sdf-js/scripts/test-lighting.mjs' },
  // IQ-shader program W5 — SDFs with analytic gradients (sdg*)
  { category: 'math', file: 'sdf-js/scripts/test-sdg.mjs' },
  // IQ-shader program W6 — bounds / auto-framing (bbox, camera-fit, bounding vol)
  { category: 'math', file: 'sdf-js/scripts/test-bounds.mjs' },

  // M7 world runtime — determinism CI (the foundation Fable 5 asked for)
  { category: 'world', file: 'sdf-js/scripts/world/test-determinism.mjs' },

  // Scene-level composition tests
  { category: 'scene', file: 'sdf-js/scripts/test-composite-atoms.mjs' },
  { category: 'scene', file: 'sdf-js/scripts/test-type-aliases.mjs' },
  { category: 'scene', file: 'sdf-js/scripts/test-gbms-batch.mjs' },

  // Generator-S (Phase 2 ops: array, mirror)
  { category: 'generator', file: 'sdf-js/scripts/test-generator-s.mjs' },
  { category: 'generator', file: 'sdf-js/scripts/test-generator-s-e2e.mjs' },

  // Community shader ports (port-shader skill regression)
  { category: 'port-shader', file: 'sdf-js/scripts/port-shader/test-atoms.mjs' },
  { category: 'port-shader', file: 'sdf-js/scripts/port-shader/test-solid-angle.mjs' },
  { category: 'port-shader', file: 'sdf-js/scripts/port-shader/test-link.mjs' },
  { category: 'port-shader', file: 'sdf-js/scripts/port-shader/test-batch-iq.mjs' },

  // Sprint 1 chart + icon + presentation atoms (Atlas use case Stage 1 supply)
  { category: 'atom', file: 'sdf-js/scripts/test-pyramid-3d.mjs' },
  { category: 'atom', file: 'sdf-js/scripts/test-bar-3d.mjs' },
  { category: 'atom', file: 'sdf-js/scripts/test-column-3d.mjs' },
  { category: 'atom', file: 'sdf-js/scripts/test-line-3d.mjs' },
  { category: 'atom', file: 'sdf-js/scripts/test-pie-3d.mjs' },
  { category: 'atom', file: 'sdf-js/scripts/test-kpi-card-3d.mjs' },
  { category: 'atom', file: 'sdf-js/scripts/test-business-icons.mjs' },
  { category: 'atom', file: 'sdf-js/scripts/test-cover-3d.mjs' },
  { category: 'atom', file: 'sdf-js/scripts/test-grid-layout.mjs' },

  // M0.3 PDF parser (Atlas use case PPT-lift workflow)
  { category: 'parser', file: 'sdf-js/scripts/test-pdf-parser.mjs' },

  // M1.5 SlideData → 2D SDF code emitter (consumed by compositor + lift LLM)
  { category: 'mapper', file: 'sdf-js/scripts/test-slide-to-2d-code.mjs' },

  // Atlas typography Wave 1 — digits + KPI symbols as SDF glyphs.
  { category: 'typography', file: 'sdf-js/scripts/test-text-3d.mjs' },
  { category: 'typography', file: 'sdf-js/scripts/test-text-3d-pipe.mjs' },

  // Sprint: PresentationLoad-style 3D Shape atoms (cube / sphere / pyramid variants).
  { category: 'shapes', file: 'sdf-js/scripts/test-cube-3d.mjs' },
  { category: 'shapes', file: 'sdf-js/scripts/test-sphere-fill-3d.mjs' },
  { category: 'shapes', file: 'sdf-js/scripts/test-sphere-network-3d.mjs' },
  { category: 'shapes', file: 'sdf-js/scripts/test-sphere-tree-3d.mjs' },
  { category: 'shapes', file: 'sdf-js/scripts/test-sphere-segmented-3d.mjs' },

  // Layer 1 public API extracted from compositor.js (used by Layer 2 / MCP / tests)
  { category: 'api', file: 'sdf-js/scripts/test-compositor-api.mjs' },

  // Layer 2 — Atlas Present (deck library + editor + present mode)
  { category: 'present', file: 'sdf-js/scripts/test-pdf-text-extractor.mjs' },
  { category: 'present', file: 'sdf-js/scripts/test-p5-sandbox.mjs' },
  { category: 'present', file: 'sdf-js/scripts/test-p5-idiom-registry.mjs' },
  { category: 'present', file: 'sdf-js/scripts/test-deck-model.mjs' },
  { category: 'present', file: 'sdf-js/scripts/test-waypoint-tween.mjs' },
  { category: 'present', file: 'sdf-js/scripts/test-pipeline.mjs' },
];

// -----------------------------------------------------------------------------
// CLI: optional category filter (e.g. `node scripts/run-tests.mjs world`)
// -----------------------------------------------------------------------------

const filterCategory = process.argv[2];
const selected = filterCategory ? TESTS.filter((t) => t.category === filterCategory) : TESTS;

if (selected.length === 0) {
  console.error(
    `No tests match category "${filterCategory}".\n` +
      `Available categories: ${[...new Set(TESTS.map((t) => t.category))].join(', ')}`,
  );
  process.exit(2);
}

// -----------------------------------------------------------------------------
// Run
// -----------------------------------------------------------------------------

const banner = filterCategory
  ? `Atlas CLI tests — category "${filterCategory}" (${selected.length} files)`
  : `Atlas CLI tests — full suite (${selected.length} files)`;
console.log(banner);
console.log('='.repeat(banner.length));

const failed = [];
const t0 = Date.now();

for (const { category, file } of selected) {
  const label = `[${category}] ${file}`;
  process.stdout.write(label.padEnd(70, ' '));

  const result = spawnSync('node', [file], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
  });

  if (result.status === 0) {
    console.log('  PASS');
  } else {
    console.log('  FAIL');
    failed.push({
      file,
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
    });
  }
}

const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
console.log('='.repeat(banner.length));
console.log(
  `${selected.length - failed.length}/${selected.length} test files passed  (${elapsed}s)`,
);

// -----------------------------------------------------------------------------
// Failure details (only printed on failure)
// -----------------------------------------------------------------------------

if (failed.length > 0) {
  console.log(`\nFAILED files:`);
  for (const f of failed) {
    console.log(`\n--- ${f.file}  (exit ${f.status}) ---`);
    if (f.stdout) console.log(f.stdout.trim());
    if (f.stderr) console.log(`stderr: ${f.stderr.trim()}`);
  }
  process.exit(1);
}
