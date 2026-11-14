import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { commitFinalRewrite, hasCompleteRewriteOutput } from './lib/genlab-rewrite-output.mjs';

const dir = mkdtempSync(join(tmpdir(), 'genlab-rewrite-output-'));

try {
  assert.equal(hasCompleteRewriteOutput(dir, 'piece-a'), false, 'missing output is incomplete');

  writeFileSync(join(dir, 'piece-a.js'), 'broken candidate');
  assert.equal(hasCompleteRewriteOutput(dir, 'piece-a'), false, 'js without png is incomplete');

  writeFileSync(join(dir, 'piece-a.png'), 'old png');
  assert.equal(hasCompleteRewriteOutput(dir, 'piece-a'), true, 'js + png is complete');

  await assert.rejects(
    commitFinalRewrite({
      outDir: dir,
      id: 'piece-b',
      code: 'bad code',
      note: 'bad note',
      prompt: 'draw bad',
      size: 600,
      renderModule: async () => {
        throw new Error('render failed');
      },
    }),
    /render failed/,
  );
  assert.equal(existsSync(join(dir, 'piece-b.js')), false, 'failed render must not commit js');
  assert.equal(existsSync(join(dir, 'piece-b.txt')), false, 'failed render must not commit note');
  assert.equal(existsSync(join(dir, 'piece-b.png')), false, 'failed render must not commit png');

  await commitFinalRewrite({
    outDir: dir,
    id: 'piece-c',
    code: 'good code',
    note: 'good note',
    prompt: 'draw good',
    size: 600,
    renderModule: async (srcPath, pngPath) => {
      assert.equal(readFileSync(srcPath, 'utf8'), 'good code');
      writeFileSync(pngPath, 'png bytes');
    },
  });
  assert.equal(readFileSync(join(dir, 'piece-c.js'), 'utf8'), 'good code');
  assert.equal(readFileSync(join(dir, 'piece-c.txt'), 'utf8'), 'PROMPT: draw good\n\ngood note\n');
  assert.equal(readFileSync(join(dir, 'piece-c.png'), 'utf8'), 'png bytes');

  writeFileSync(join(dir, 'piece-d.js'), 'old good');
  writeFileSync(join(dir, 'piece-d.txt'), 'old note');
  writeFileSync(join(dir, 'piece-d.png'), 'old png');
  await assert.rejects(
    commitFinalRewrite({
      outDir: dir,
      id: 'piece-d',
      code: 'new bad',
      note: 'new bad note',
      prompt: 'draw replacement',
      size: 600,
      renderModule: async () => {
        throw new Error('replacement failed');
      },
    }),
    /replacement failed/,
  );
  assert.equal(readFileSync(join(dir, 'piece-d.js'), 'utf8'), 'old good');
  assert.equal(readFileSync(join(dir, 'piece-d.txt'), 'utf8'), 'old note');
  assert.equal(readFileSync(join(dir, 'piece-d.png'), 'utf8'), 'old png');
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log('test-genlab-rewrite-output: ok');
