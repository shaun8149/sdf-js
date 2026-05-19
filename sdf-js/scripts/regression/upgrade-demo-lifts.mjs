// =============================================================================
// upgrade-demo-lifts.mjs — replace bundled demo-lifts/ sceneData with v2.3
// regression outputs. Preserves the id/title/prompt/code2d/meta envelope.
//
// Backup: git history. If you need to revert, `git checkout HEAD~1 --
// sdf-js/examples/compositor/demo-lifts/*.json`.
//
// Usage:
//   node sdf-js/scripts/regression/upgrade-demo-lifts.mjs [--dry-run]
// =============================================================================

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const REPO = '/Users/hexiaoyang/Documents/sdf-main';
const DEMOS = [
  'china-carrier', 'gothic-cathedral', 'spiral-vase', 'mountain-village',
  'clock-915', 'vintage-bicycle', 'dining-setting', 'coastal-lighthouse',
];

const dryRun = process.argv.includes('--dry-run');
const SOURCE_VERSION = 'v2.3';

console.log(`Demo-lifts upgrade ${dryRun ? '[DRY RUN]' : '[WRITE MODE]'} — ${SOURCE_VERSION}`);
console.log('=====================================\n');

let upgraded = 0, skipped = 0, missing = 0;

for (const id of DEMOS) {
  const demoPath = `${REPO}/sdf-js/examples/compositor/demo-lifts/${id}.json`;
  const upgradeSrc = `${REPO}/sdf-js/scripts/regression/results/${id}-${SOURCE_VERSION}.json`;

  if (!existsSync(demoPath)) {
    console.log(`  ${id.padEnd(20)} ✗ demo-lifts file missing`);
    missing++;
    continue;
  }
  if (!existsSync(upgradeSrc)) {
    console.log(`  ${id.padEnd(20)} ⏭  no v2.3 regression result (skip)`);
    skipped++;
    continue;
  }

  const upgrade = JSON.parse(readFileSync(upgradeSrc, 'utf-8'));
  if (upgrade.result?.error) {
    console.log(`  ${id.padEnd(20)} ⏭  v2.3 run had error: ${upgrade.result.error.slice(0, 50)} (skip)`);
    skipped++;
    continue;
  }
  if (!upgrade.sceneData) {
    console.log(`  ${id.padEnd(20)} ⏭  v2.3 result has no sceneData (skip)`);
    skipped++;
    continue;
  }

  // Stats before/after
  const before = JSON.parse(readFileSync(demoPath, 'utf-8'));
  const beforeSubjects = before.sceneData?.subjects?.length || 0;
  const afterSubjects  = upgrade.sceneData.subjects?.length || 0;
  const beforeMat = countWithField(before.sceneData?.subjects, 'material');
  const afterMat  = countWithField(upgrade.sceneData.subjects, 'material');
  const beforePat = countWithField(before.sceneData?.subjects, 'pattern');
  const afterPat  = countWithField(upgrade.sceneData.subjects, 'pattern');

  // Merge: keep id/title/prompt/code2d/meta from old; replace sceneData
  const merged = {
    ...before,
    sceneData: upgrade.sceneData,
    // Bump meta to record the upgrade
    meta: {
      ...(before.meta || {}),
      upgradedFrom: SOURCE_VERSION,
      upgradedAt: new Date().toISOString(),
    },
  };
  // Make sure the upgrade's sceneData carries source = llm-lift attribution
  if (!merged.sceneData.source) {
    merged.sceneData.source = { format: 'llm-lift', prompt: before.prompt };
  }

  if (!dryRun) {
    writeFileSync(demoPath, JSON.stringify(merged, null, 2));
  }

  console.log(
    `  ${id.padEnd(20)} ✓  ` +
    `subj ${beforeSubjects}→${afterSubjects} · ` +
    `mat ${beforeMat}→${afterMat} · ` +
    `pat ${beforePat}→${afterPat}`
  );
  upgraded++;
}

function countWithField(subjects, field) {
  if (!Array.isArray(subjects)) return 0;
  let n = 0;
  for (const s of subjects) {
    if (s[field] != null) n++;
    if (Array.isArray(s.children)) n += countWithField(s.children, field);
  }
  return n;
}

console.log(`\n═══ Summary ═══`);
console.log(`  upgraded: ${upgraded}`);
console.log(`  skipped:  ${skipped}`);
console.log(`  missing:  ${missing}`);
if (dryRun) console.log(`\n  ${dryRun ? 'DRY RUN — no files written. Re-run without --dry-run to apply.' : ''}`);
