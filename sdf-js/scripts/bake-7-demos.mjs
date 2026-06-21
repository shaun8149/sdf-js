#!/usr/bin/env node
// 7-case demo bake for Sprint 11/12/13 manual visual verify.
// Generates 1 variant per case to keep cost low (~$0.40 total).
// Each case is hand-designed to stress a specific feature.
//
// Usage: ANTHROPIC_API_KEY=$(cat /tmp/atlas-l3/key.txt) \
//          node sdf-js/scripts/bake-7-demos.mjs

import { writeFileSync, mkdirSync } from 'node:fs';
import { createVisualPipeline, VARIANT_COUNT } from '../src/present/pipeline.js';
import {
  callLiftLLM,
  parseLiftResponse,
  sanitize2dSceneData,
  loadSystemPromptLift,
} from '../src/compositor-api.js';
import { addVisual } from '../src/present/deck-model.js';

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
  console.error('ANTHROPIC_API_KEY required');
  process.exit(1);
}

const PROMPT_URL = 'http://localhost:8001/examples/compositor/system-prompt-lift-3d.md';
const EVIDENCE_DIR = new URL('../examples/l3-render/evidence/', import.meta.url).pathname;
mkdirSync(EVIDENCE_DIR, { recursive: true });

const CASES = [
  {
    id: 'D1_kpi_pure',
    feature: 'Sprint 12 hero typography + IBM Plex Mono',
    text: 'Our SaaS hit $10M ARR with 95% customer retention and 45% year-over-year growth.',
  },
  {
    id: 'D2_icons_sequence',
    feature: 'Sprint 13 iconography per step + sequence archetype',
    text: 'New user journey: sign up, verify email, complete onboarding, make first purchase, reach retention milestone.',
  },
  {
    id: 'D3_hierarchy_numeric',
    feature: 'hierarchy + numeric labels + multi-color',
    text: "Engineering's 35 people split across: 12 backend engineers, 8 frontend developers, 6 ML researchers, 5 DevOps engineers, and 4 security specialists.",
  },
  {
    id: 'D4_data_chart',
    feature: 'kpi-hero + IBM Plex Mono digit alignment',
    text: 'Quarterly revenue trajectory: Q1 $1.2M, Q2 $1.8M, Q3 $2.4M, Q4 $3.1M — representing 158% annual growth.',
  },
  {
    id: 'D5_compare_metaphor',
    feature: 'Atlas wedge — concrete metaphor for abstract comparison',
    text: 'The lean startup runs with 5 engineers, 3 designers, and 2 product managers — shipping features 10x faster than enterprise teams of 50.',
  },
  {
    id: 'D6_dense_concept',
    feature: 'Sprint 13 multi-icon list + AT LEAST 1 icon per unit rule',
    text: 'AI agents coordinate across 12 specialized roles: researcher, planner, coder, reviewer, executor, debugger, optimizer, monitor, communicator, integrator, validator, and orchestrator.',
  },
  {
    id: 'D7_long_narrative',
    feature: 'Sprint 11 reliability + JSON discipline on long input',
    text: "Last quarter our recommendation engine A/B tested 4 ranking algorithms across 2.3 million users, finding the hybrid neural-collaborative approach increased click-through rate by 23% while reducing latency 40ms — we're rolling it out to all 12 markets next month.",
  },
];

async function main() {
  console.log('Baking 7 demo cases (1 variant each)...');
  await loadSystemPromptLift(PROMPT_URL);

  for (const tc of CASES) {
    console.log(`\n${tc.id} (${tc.feature})`);
    console.log(`  text: ${tc.text.slice(0, 80)}...`);

    const deck = { id: `demo-${tc.id}`, paragraphs: [], visuals: [] };
    const visual = addVisual(deck, {
      startOffset: 0,
      endOffset: tc.text.length,
      text: tc.text,
    });
    visual.variants = visual.variants.slice(0, 1); // only 1 variant

    const deps = {
      callLiftLLM: (p, c, k, o) => callLiftLLM(p, c, k, { ...o, promptUrl: PROMPT_URL }),
      parseLiftResponse,
      sanitize2dSceneData,
      saveDeck: () => {},
    };

    const handle = createVisualPipeline(deck, visual.id, API_KEY, deps, {
      onEvent: (e) => {
        if (e.type === 'lift-ready') process.stdout.write(`  ✓ ${e.archetype}\n`);
        else if (e.type === 'lift-error') process.stdout.write(`  ✗ ${e.error}\n`);
      },
    });

    await handle.start();

    const v = visual.variants[0];
    // Build analyses block matching l3-render harness expectations
    const code = (v.sceneData?.subjects || [])
      .filter((s) => s?.type === 'p5-sketch')
      .map((s) => s?.args?.code || '')
      .join('\n');
    const icons = [...code.matchAll(/drawAtlasIcon\(['"]([\w-]+)['"]/g)].map((m) => m[1]);
    const analyses = [
      {
        idx: 0,
        status: v.status,
        archetype: v.archetype,
        p5CodeLen: code.length,
        sprint12_usesInter: /\bInter\b/.test(code),
        sprint12_usesIBMPlexMono: /IBM Plex Mono/.test(code),
        sprint13_drawAtlasIconCount: icons.length,
        sprint13_iconNames: icons,
        sprint5_8_idioms: [
          'generateApparatusGrid',
          'voronoiCells',
          'delaunayTriangles',
          'springBrushStroke',
          'spaceColonization',
          'lSystemSegments',
          'weaveFlowDashes',
          'packCirclesInSDF',
          'irregularGridPack',
          'packShapes',
          'roundedPolyPath',
          'buildFlowField',
          'traceFlowLines',
          'chromotome',
        ].filter((n) => new RegExp(`\\b${n}\\b`).test(code)),
      },
    ];

    const evidence = {
      id: tc.id,
      text: tc.text,
      feature: tc.feature,
      analyses,
      variants: [
        {
          idx: 0,
          status: v.status,
          archetype: v.archetype,
          liftError: v.liftError,
          sceneData: v.sceneData,
        },
      ],
    };
    writeFileSync(`${EVIDENCE_DIR}${tc.id}.json`, JSON.stringify(evidence, null, 2));
    console.log(`  saved ${tc.id}.json`);
  }
  console.log('\nDone. View at:');
  for (const tc of CASES) {
    console.log(`  http://localhost:8001/examples/l3-render/?case=${tc.id}&v=0`);
  }
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});
