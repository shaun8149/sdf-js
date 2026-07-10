#!/usr/bin/env node
// Smoke tests for validate-auto-scaffold's bake safety guards. These tests
// intentionally exercise pre-flight failures, so they never call the live LLM.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  buildDroppedSlots,
  isSafeDeckName,
  parseArgs,
} from './validate-auto-scaffold.mjs';

let pass = 0;
let fail = 0;
function ok(cond, msg) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${msg}`);
  } else {
    fail++;
    console.error(`  ✗ ${msg}`);
  }
}

console.log('=== validate-auto-scaffold safety test ===\n');

{
  const parsed = parseArgs(['--force', 'article.txt', 'deck-a']);
  ok(parsed.articlePath === 'article.txt', 'parseArgs keeps article path');
  ok(parsed.deckName === 'deck-a', 'parseArgs keeps deck name');
  ok(parsed.force === true, 'parseArgs detects --force');
}

{
  ok(isSafeDeckName('qbr-guidewire-auto'), 'safe slug accepted');
  ok(!isSafeDeckName('../qbr-guidewire-auto'), 'path traversal deckName rejected');
  ok(!isSafeDeckName('/tmp/deck'), 'absolute deckName rejected');
}

{
  const scaffold = {
    slots: [
      { name: 'cover', title: 'Cover' },
      { name: 'income', title: 'Income' },
      { name: 'outlook', title: 'Outlook' },
    ],
  };
  const dropped = buildDroppedSlots(
    scaffold,
    [{ slotIdx: 0, slotName: 'cover', liftFile: 'slots/slot-00-cover.json' }],
    [{ slot: 'outlook', message: 'LLM timeout' }],
  );
  ok(dropped.length === 2, 'missing scaffold slots are recorded');
  ok(dropped[0].slotName === 'income', 'empty slot keeps scaffold order');
  ok(dropped[0].reason === 'no-source-content', 'unmapped slot gets no-source-content');
  ok(dropped[1].slotName === 'outlook', 'errored slot matched by name');
  ok(dropped[1].reason === 'lift-error', 'errored slot gets lift-error reason');
  ok(dropped[1].error === 'LLM timeout', 'errored slot preserves message');
}

{
  const script = fileURLToPath(new URL('./validate-auto-scaffold.mjs', import.meta.url));
  const res = spawnSync(process.execPath, [script, 'missing-article.txt', 'qbr-guidewire-auto'], {
    encoding: 'utf8',
  });
  ok(res.status === 1, 'existing output is rejected without --force');
  ok(res.stderr.includes('already exists'), 'existing output explains --force escape hatch');
}

{
  const script = fileURLToPath(new URL('./validate-auto-scaffold.mjs', import.meta.url));
  const res = spawnSync(process.execPath, [script, 'missing-article.txt', '../escape'], {
    encoding: 'utf8',
  });
  ok(res.status === 1, 'unsafe deckName exits before any write');
  ok(res.stderr.includes('unsafe deckName'), 'unsafe deckName error is explicit');
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
