#!/usr/bin/env node
// =============================================================================
// eval-deck-quality.mjs — Sprint 24 P2 eval harness: score ONE baked deck
// -----------------------------------------------------------------------------
// Scores a deck directory produced by bake-scaffold-pipeline.mjs against four
// axes: STRUCTURE (did every slot get filled), ATOM QUALITY (variety, no LLM
// hallucinated atom types, no silently-ignored args), 3D READINESS (every
// emitted atom has a working twin per Sprint 24 P1's X-gap closure, and the
// lift actually runs without throwing), and TEXT BUDGET (deck stays terse
// enough for a 3-second 3D read, per the lift prompt's hard text budget).
//
// Produces a single 0-100 composite SCORE so pipeline quality is a trackable
// number, not a vibe — see eval-corpus.mjs for the corpus-wide runner.
//
// Usage:
//   node sdf-js/scripts/eval-deck-quality.mjs <deck-dir>
//
// Writes <deck-dir>/eval.json and prints a human-readable table.
// =============================================================================

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { isAtom2DType, getAtomSpec } from '../src/present/atoms-2d/registry.js';
import { hasTwin, liftScaffoldSlot } from '../src/scene/lift-scaffold.js';

// Arg keys that are style/enum/identifier controls, not user-visible prose.
// Excluded (at any nesting depth, by key name) from the TEXT BUDGET char count.
// Kept as an explicit list (rather than spec-type reflection) so the budget
// definition stays legible and stable across atom-spec refactors.
export const NON_TEXT_ARG_KEYS = new Set([
  'type',
  'style',
  'format',
  'colorMode',
  'iconStyle',
  'iconSize',
  'trend',
  'trendDirection',
  'align',
  'fit',
  'layout',
  'cols',
  'icon',
  'id',
  'src',
  'href',
  'direction',
  'shape',
  'variant',
  'orientation',
  'position',
  'anchor',
  'mode',
  'kind',
  'category',
  'colorScheme',
  'size',
  'axis',
  'unit',
  'currency',
  'sortOrder',
  'role',
  'pattern',
  'iconColor',
  'accentColor',
  'font',
]);

/**
 * Recursively sum the length of user-visible string leaves inside an atom's
 * `args` object, skipping any property keyed by a style/enum/identifier name
 * (at any depth — e.g. `items[].icon` is skipped the same as top-level `icon`).
 */
export function collectTextChars(node, keyName = null) {
  if (node == null) return 0;
  if (typeof node === 'string') {
    if (keyName && NON_TEXT_ARG_KEYS.has(keyName)) return 0;
    return node.length;
  }
  if (Array.isArray(node)) {
    return node.reduce((sum, el) => sum + collectTextChars(el, keyName), 0);
  }
  if (typeof node === 'object') {
    let sum = 0;
    for (const [k, v] of Object.entries(node)) {
      if (NON_TEXT_ARG_KEYS.has(k)) continue;
      sum += collectTextChars(v, k);
    }
    return sum;
  }
  return 0;
}

// text-budget sub-score: 1.0 at ≤280 chars/slot, linear falloff to 0 at 600.
function textBudgetScore(charsPerSlot) {
  if (charsPerSlot <= 280) return 1;
  if (charsPerSlot >= 600) return 0;
  return 1 - (charsPerSlot - 280) / (600 - 280);
}

/**
 * Score one baked deck directory (must contain deck.json + slots/*.json as
 * produced by bake-scaffold-pipeline.mjs).
 *
 * @param {string} deckDir — absolute or cwd-relative path to the deck dir
 * @returns {Promise<object>} the eval result (same shape written to eval.json)
 */
export async function scoreDeckQuality(deckDir) {
  const dir = resolve(deckDir);
  const deckJsonPath = join(dir, 'deck.json');
  if (!existsSync(deckJsonPath)) {
    throw new Error(`eval-deck-quality: no deck.json in ${dir}`);
  }
  const manifest = JSON.parse(readFileSync(deckJsonPath, 'utf8'));

  const slotsTotal = manifest.slots.length;
  const slotsEmpty = manifest.slots.filter((s) => s.mappingEmpty).length;
  const slotsErrored = manifest.slots.filter((s) => s.error).length;
  const bakedSlotEntries = manifest.slots.filter((s) => s.liftFile && !s.error && !s.mappingEmpty);
  const slotsBaked = bakedSlotEntries.length;
  const fillRate = slotsTotal > 0 ? slotsBaked / slotsTotal : 0;

  // ── load each baked slot's sceneData ──
  const slotSceneDatas = []; // { slotIdx, slotName, sceneData }
  for (const s of bakedSlotEntries) {
    const slotPath = join(dir, s.liftFile);
    if (!existsSync(slotPath)) continue; // deck.json says baked but file missing — skip
    const slotEntry = JSON.parse(readFileSync(slotPath, 'utf8'));
    if (slotEntry.sceneData) {
      slotSceneDatas.push({
        slotIdx: s.slotIdx,
        slotName: s.slotName,
        sceneData: slotEntry.sceneData,
      });
    }
  }

  // ── ATOM QUALITY ──
  const allSubjects = []; // { slotIdx, subject }
  for (const { slotIdx, sceneData } of slotSceneDatas) {
    for (const subject of sceneData.subjects || []) {
      allSubjects.push({ slotIdx, subject });
    }
  }
  const nonCoverSubjects = allSubjects.filter(({ subject }) => subject.type !== 'cover');

  const atomInstances = nonCoverSubjects.length;
  const atomTypesDistinct = new Set(nonCoverSubjects.map(({ subject }) => subject.type)).size;
  const varietyRatio = atomInstances > 0 ? atomTypesDistinct / atomInstances : 0;

  const unknownSubjects = nonCoverSubjects.filter(({ subject }) => !isAtom2DType(subject.type));
  const unknownAtomCount = unknownSubjects.length;
  const unknownAtomTypes = [...new Set(unknownSubjects.map(({ subject }) => subject.type))];

  // arg_violations: subject.args keys not declared in the atom's spec.args.
  // Only checked for known atom types (unknown types are already flagged above).
  const specCache = new Map();
  async function specFor(type) {
    if (specCache.has(type)) return specCache.get(type);
    let spec = null;
    try {
      spec = await getAtomSpec(type);
    } catch {
      spec = null;
    }
    specCache.set(type, spec);
    return spec;
  }

  let argViolationCount = 0;
  const offenderCounts = new Map(); // `${type}.${key}` -> count
  for (const { subject } of allSubjects) {
    if (!isAtom2DType(subject.type)) continue;
    const spec = await specFor(subject.type);
    if (!spec || !spec.args) continue;
    const allowedKeys = new Set(Object.keys(spec.args));
    for (const key of Object.keys(subject.args || {})) {
      if (!allowedKeys.has(key)) {
        argViolationCount++;
        const offKey = `${subject.type}.${key}`;
        offenderCounts.set(offKey, (offenderCounts.get(offKey) || 0) + 1);
      }
    }
  }
  const argViolationTopOffenders = [...offenderCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([offKey, count]) => {
      const dot = offKey.indexOf('.');
      return { type: offKey.slice(0, dot), key: offKey.slice(dot + 1), count };
    });

  // ── 3D READINESS ──
  const twinnedSubjects = allSubjects.filter(({ subject }) => hasTwin(subject.type));
  const twinCoverage = allSubjects.length > 0 ? twinnedSubjects.length / allSubjects.length : 0;
  const untwinnedTypes = [
    ...new Set(
      allSubjects
        .filter(({ subject }) => !hasTwin(subject.type))
        .map(({ subject }) => subject.type),
    ),
  ];

  let liftSuccessCount = 0;
  const liftErrors = [];
  let subjectsTotal = 0;
  let subjectsPlaced = 0;
  for (const { slotIdx, slotName, sceneData } of slotSceneDatas) {
    const total = (sceneData.subjects || []).length;
    subjectsTotal += total;
    try {
      const { scene } = liftScaffoldSlot(sceneData, { theme: manifest.theme });
      liftSuccessCount++;
      subjectsPlaced += scene.subjects.length;
    } catch (e) {
      liftErrors.push({ slotIdx, slotName, error: e.message });
    }
  }
  const liftedSubjectRate = subjectsTotal > 0 ? subjectsPlaced / subjectsTotal : 0;

  // ── TEXT BUDGET ──
  let totalCharsAcrossSlots = 0;
  let maxSlotChars = 0;
  for (const { sceneData } of slotSceneDatas) {
    let slotChars = 0;
    for (const subject of sceneData.subjects || []) {
      slotChars += collectTextChars(subject.args, null);
    }
    totalCharsAcrossSlots += slotChars;
    if (slotChars > maxSlotChars) maxSlotChars = slotChars;
  }
  const charsPerSlot = slotsBaked > 0 ? totalCharsAcrossSlots / slotsBaked : 0;

  // ── SCORE ──
  const structureScore = fillRate * 25;
  const varietyScore = Math.min(1, atomTypesDistinct / 6) * 15;
  const hallucinationScore = (1 - unknownAtomCount / Math.max(1, atomInstances)) * 15;
  const twinScore = twinCoverage * 20;
  const liftScore = (liftSuccessCount / Math.max(1, slotsBaked)) * 15;
  const textScore = textBudgetScore(charsPerSlot) * 10;
  const score =
    structureScore + varietyScore + hallucinationScore + twinScore + liftScore + textScore;

  return {
    deckDir: dir,
    deckName: manifest.deckName,
    structure: {
      slots_total: slotsTotal,
      slots_baked: slotsBaked,
      slots_empty: slotsEmpty,
      slots_errored: slotsErrored,
      fill_rate: fillRate,
      pick_method: manifest.scaffold.pickerMethod,
      scaffold_id: manifest.scaffold.id,
      theme_id: manifest.theme.id,
    },
    atomQuality: {
      atom_instances: atomInstances,
      atom_types_distinct: atomTypesDistinct,
      variety_ratio: varietyRatio,
      unknown_atom_count: unknownAtomCount,
      unknown_atom_types: unknownAtomTypes,
      arg_violations: argViolationCount,
      arg_violations_top_offenders: argViolationTopOffenders,
    },
    threeDReadiness: {
      twin_coverage: twinCoverage,
      untwinned_types: untwinnedTypes,
      lift_success: liftSuccessCount,
      lift_attempted: slotSceneDatas.length,
      lift_errors: liftErrors,
      lifted_subject_rate: liftedSubjectRate,
    },
    textBudget: {
      chars_per_slot: charsPerSlot,
      max_slot_chars: maxSlotChars,
    },
    score: {
      total: Math.round(score * 10) / 10,
      breakdown: {
        structure: Math.round(structureScore * 10) / 10,
        variety: Math.round(varietyScore * 10) / 10,
        hallucination: Math.round(hallucinationScore * 10) / 10,
        twin: Math.round(twinScore * 10) / 10,
        lift: Math.round(liftScore * 10) / 10,
        text: Math.round(textScore * 10) / 10,
      },
    },
    generatedAt: new Date().toISOString(),
  };
}

function printHumanTable(result) {
  const s = result.structure;
  const a = result.atomQuality;
  const t = result.threeDReadiness;
  const b = result.textBudget;
  console.log(`\n══ eval: ${result.deckName} ══\n`);
  console.log('STRUCTURE');
  console.log(
    `  slots: ${s.slots_baked}/${s.slots_total} baked (fill_rate ${(s.fill_rate * 100).toFixed(0)}%), ${s.slots_empty} empty, ${s.slots_errored} errored`,
  );
  console.log(`  scaffold: ${s.scaffold_id}  theme: ${s.theme_id}  pick_method: ${s.pick_method}`);
  console.log('\nATOM QUALITY');
  console.log(
    `  atom_instances: ${a.atom_instances}  atom_types_distinct: ${a.atom_types_distinct}  variety_ratio: ${a.variety_ratio.toFixed(2)}`,
  );
  console.log(
    `  unknown_atom_count: ${a.unknown_atom_count}${a.unknown_atom_types.length ? ' [' + a.unknown_atom_types.join(', ') + ']' : ''}`,
  );
  console.log(
    `  arg_violations: ${a.arg_violations}${a.arg_violations_top_offenders.length ? '  top: ' + a.arg_violations_top_offenders.map((o) => `${o.type}.${o.key}×${o.count}`).join(', ') : ''}`,
  );
  console.log('\n3D READINESS');
  console.log(
    `  twin_coverage: ${(t.twin_coverage * 100).toFixed(0)}%${t.untwinned_types.length ? '  untwinned: [' + t.untwinned_types.join(', ') + ']' : ''}`,
  );
  console.log(
    `  lift_success: ${t.lift_success}/${t.lift_attempted}${t.lift_errors.length ? '  errors: ' + t.lift_errors.map((e) => `slot${e.slotIdx}(${e.error.slice(0, 40)})`).join('; ') : ''}`,
  );
  console.log(`  lifted_subject_rate: ${(t.lifted_subject_rate * 100).toFixed(0)}%`);
  console.log('\nTEXT BUDGET');
  console.log(
    `  chars_per_slot: ${b.chars_per_slot.toFixed(0)}  max_slot_chars: ${b.max_slot_chars}`,
  );
  console.log(
    `\nSCORE: ${result.score.total}/100  (structure ${result.score.breakdown.structure} + variety ${result.score.breakdown.variety} + hallucination ${result.score.breakdown.hallucination} + twin ${result.score.breakdown.twin} + lift ${result.score.breakdown.lift} + text ${result.score.breakdown.text})\n`,
  );
}

// -----------------------------------------------------------------------------
// CLI entry point
// -----------------------------------------------------------------------------
const isMain =
  process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (isMain) {
  const deckDir = process.argv[2];
  if (!deckDir) {
    console.error('Usage: node sdf-js/scripts/eval-deck-quality.mjs <deck-dir>');
    process.exit(2);
  }
  const result = await scoreDeckQuality(deckDir);
  printHumanTable(result);
  writeFileSync(join(resolve(deckDir), 'eval.json'), JSON.stringify(result, null, 2));
  console.log(`Wrote ${join(resolve(deckDir), 'eval.json')}`);
}
