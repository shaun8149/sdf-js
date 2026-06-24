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
  // IQ-shader program W7 — analytic ray intersectors + sphere density / ibilinear
  { category: 'math', file: 'sdf-js/scripts/test-intersect.mjs' },
  // IQ-shader program W8 — fractals (mandelbrot/bulb, quaternion julia, menger…)
  { category: 'math', file: 'sdf-js/scripts/test-fractal.mjs' },
  // IQ-shader program W9 — procedural effects (clouds, deform, feedback, life)
  { category: 'math', file: 'sdf-js/scripts/test-effects.mjs' },
  // IQ-shader program W10 — math/rotation (quaternions, fourier, tri dist, uv)
  { category: 'math', file: 'sdf-js/scripts/test-mathx.mjs' },
  // IQ-shader program W11 — cleanup (ellipse dist, box shadow, SDF AO, lyapunov)
  { category: 'math', file: 'sdf-js/scripts/test-extra.mjs' },
  // IQ-shader program W13 — gap-fill (2D bbox, multires/box AO, GI, implicit dist)
  { category: 'math', file: 'sdf-js/scripts/test-gaps.mjs' },

  // M7 world runtime — determinism CI (the foundation Fable 5 asked for)
  { category: 'world', file: 'sdf-js/scripts/world/test-determinism.mjs' },

  // Scene-level composition tests
  { category: 'scene', file: 'sdf-js/scripts/test-composite-atoms.mjs' },
  { category: 'scene', file: 'sdf-js/scripts/test-type-aliases.mjs' },
  { category: 'scene', file: 'sdf-js/scripts/test-gbms-batch.mjs' },
  { category: 'scene', file: 'sdf-js/scripts/test-primitive-registry-sync.mjs' },
  { category: 'scene', file: 'sdf-js/scripts/test-stage.mjs' },
  { category: 'scene', file: 'sdf-js/scripts/test-apply-studio-scene.mjs' },

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
  { category: 'parser', file: 'sdf-js/scripts/test-pdf-line-clustering.mjs' },
  { category: 'parser', file: 'sdf-js/scripts/test-pdf-page-chrome.mjs' },

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
  { category: 'shapes', file: 'sdf-js/scripts/test-arrow-3d.mjs' },
  { category: 'shapes', file: 'sdf-js/scripts/test-diamond-3d.mjs' },
  { category: 'shapes', file: 'sdf-js/scripts/test-gear-3d.mjs' },
  { category: 'shapes', file: 'sdf-js/scripts/test-cube-segmented-3d.mjs' },
  { category: 'shapes', file: 'sdf-js/scripts/test-circle-frame-3d.mjs' },
  { category: 'shapes', file: 'sdf-js/scripts/test-circle-stack-3d.mjs' },
  { category: 'shapes', file: 'sdf-js/scripts/test-circle-segmented-3d.mjs' },
  { category: 'shapes', file: 'sdf-js/scripts/test-circle-loop-3d.mjs' },

  // Sprint 4: node-edge chart atoms (relationship graph / org chart / flow chart).
  { category: 'diagram', file: 'sdf-js/scripts/test-relationship-graph-3d.mjs' },
  { category: 'diagram', file: 'sdf-js/scripts/test-org-chart-3d.mjs' },
  { category: 'diagram', file: 'sdf-js/scripts/test-flow-chart-3d.mjs' },
  { category: 'diagram', file: 'sdf-js/scripts/test-tree-diagram-3d.mjs' },
  { category: 'diagram', file: 'sdf-js/scripts/test-mindmap-3d.mjs' },
  { category: 'diagram', file: 'sdf-js/scripts/test-timeline-3d.mjs' },

  // Sprint 5 Wave A: taxonomy class-fillers (matrix / progression / agenda / layers / lists).
  { category: 'diagram', file: 'sdf-js/scripts/test-matrix-grid-3d.mjs' },
  { category: 'diagram', file: 'sdf-js/scripts/test-progression-3d.mjs' },
  { category: 'diagram', file: 'sdf-js/scripts/test-agenda-list-3d.mjs' },
  { category: 'diagram', file: 'sdf-js/scripts/test-layer-stack-3d.mjs' },
  { category: 'diagram', file: 'sdf-js/scripts/test-bullet-list-3d.mjs' },

  // Sprint 5 Wave B: data-viz (funnel / venn / waterfall / scatter / gantt).
  { category: 'diagram', file: 'sdf-js/scripts/test-funnel-3d.mjs' },
  { category: 'diagram', file: 'sdf-js/scripts/test-venn-3d.mjs' },
  { category: 'diagram', file: 'sdf-js/scripts/test-waterfall-3d.mjs' },
  { category: 'diagram', file: 'sdf-js/scripts/test-scatter-3d.mjs' },
  { category: 'diagram', file: 'sdf-js/scripts/test-gantt-3d.mjs' },
  { category: 'diagram', file: 'sdf-js/scripts/test-gauge-3d.mjs' },
  { category: 'scene', file: 'sdf-js/scripts/test-chart-labels.mjs' },

  // Sprint 5 Wave C: fishbone / traffic-light / radial-spoke + puzzle-piece.
  { category: 'diagram', file: 'sdf-js/scripts/test-fishbone-3d.mjs' },
  { category: 'diagram', file: 'sdf-js/scripts/test-traffic-light-3d.mjs' },
  { category: 'diagram', file: 'sdf-js/scripts/test-radial-spoke-3d.mjs' },
  { category: 'shapes', file: 'sdf-js/scripts/test-puzzle-piece-3d.mjs' },

  // Layer 1 public API extracted from compositor.js (used by Layer 2 / MCP / tests)
  { category: 'api', file: 'sdf-js/scripts/test-compositor-api.mjs' },

  // Layer 2 — Atlas Present (deck library + editor + present mode)
  { category: 'present', file: 'sdf-js/scripts/test-pdf-text-extractor.mjs' },
  { category: 'present', file: 'sdf-js/scripts/test-p5-sandbox.mjs' },
  { category: 'present', file: 'sdf-js/scripts/test-p5-idiom-registry.mjs' },
  { category: 'present', file: 'sdf-js/scripts/test-deck-model.mjs' },
  { category: 'present', file: 'sdf-js/scripts/test-branding-palettes.mjs' },
  { category: 'present', file: 'sdf-js/scripts/test-waypoint-tween.mjs' },
  { category: 'present', file: 'sdf-js/scripts/test-pipeline.mjs' },
  { category: 'present', file: 'sdf-js/scripts/test-atoms-2d-framework.mjs' },
  { category: 'present', file: 'sdf-js/scripts/test-icon-library.mjs' },
  { category: 'present', file: 'sdf-js/scripts/test-scaffolds.mjs' },
  { category: 'present', file: 'sdf-js/scripts/test-picker-llm.mjs' },
  { category: 'present', file: 'sdf-js/scripts/test-mapper-llm.mjs' },
  { category: 'present', file: 'sdf-js/scripts/test-icon-library-expanded.mjs' },
  { category: 'present', file: 'sdf-js/scripts/test-atoms-icons.mjs' },
  { category: 'present', file: 'sdf-js/scripts/test-atom-catalog.mjs' },
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
