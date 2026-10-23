#!/usr/bin/env node
// =============================================================================
// genlab-ab — 旧版 (out/<id>.js) vs 新版 (out-v2/<id>.js) 盲评对照图
// -----------------------------------------------------------------------------
// 每件一张 1240×660 的左右对照 (左右随机), 标题只写 id 与 A/B; 钥匙写进
// <outDir>/_key.json ({ id: { A: 'old'|'new', B: ... } }), 揭盲用。
// 另出 _index.png 缩略总览 (每件一行: A | B) 与 _ballot.md 评分表模板。
// 用法: node sdf-js/scripts/genlab-ab.mjs --pilot pilot1.json --out ~/Downloads/genlab-rewrite-pilot1 [--seed 7] [--size 600]
// =============================================================================
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { renderModule } from './genlab-render.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');
const GENLAB = join(ROOT, 'examples/genlab');
const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const SIZE = Number(opt('--size', 600));
const FIXED = args.includes('--fixed'); // 固定左旧右新 (不盲), 标签写 旧/新
const LBL_A = FIXED ? 'OLD  (Opus 5)' : 'A',
  LBL_B = FIXED ? 'NEW  (Opus 5.5)' : 'B';
const outDir = opt('--out', join(homedir(), 'Downloads', 'genlab-rewrite-pilot1')).replace(
  /^~/,
  homedir(),
);
mkdirSync(outDir, { recursive: true });

const pilot = JSON.parse(readFileSync(join(GENLAB, opt('--pilot', 'pilot1.json')), 'utf8'));
const items = [];
for (const [pool, arr] of Object.entries(pilot.picked))
  for (const p of arr) items.push({ pool, ...p });

// 左右随机: 固定种子 sfc32, 结果写钥匙
const sfc32 = (a, b, c, d) => () => {
  a >>>= 0;
  b >>>= 0;
  c >>>= 0;
  d >>>= 0;
  let t = (a + b) | 0;
  a = b ^ (b >>> 9);
  b = (c + (c << 3)) | 0;
  c = (c << 21) | (c >>> 11);
  d = (d + 1) | 0;
  t = (t + d) | 0;
  c = (c + t) | 0;
  return (t >>> 0) / 4294967296;
};
const rnd = sfc32(0x9e3779b9, 0x243f6a88, 0xb7e15162, Number(opt('--seed', 7)));
for (let i = 0; i < 12; i++) rnd();

const PAD = 20,
  TITLE = 40;
// 增量: 已出过的件沿用原左右分配 (评分表不作废), 只给新件抽边
const keyPath = join(outDir, '_key.json');
const key = existsSync(keyPath) ? JSON.parse(readFileSync(keyPath, 'utf8')) : {};
const thumbs = [];
for (const it of items) {
  const oldSrc = join(GENLAB, 'out', `${it.id}.js`),
    newSrc = join(GENLAB, 'out-v2', `${it.id}.js`);
  if (!existsSync(newSrc)) {
    console.log(`跳过 ${it.id}: 无新版`);
    continue;
  }
  const oldPng = await renderModule(oldSrc, null, SIZE);
  // 新版终稿渲不出来时退回第一轮 (r1), 钥匙里记 newVersion
  let newPng,
    newVersion = 'final';
  try {
    newPng = await renderModule(newSrc, null, SIZE);
  } catch (e) {
    const r1 = join(GENLAB, 'out-v2', `${it.id}.r1.js`);
    try {
      newPng = await renderModule(r1, null, SIZE);
      newVersion = 'r1';
    } catch (e2) {
      console.log(`跳过 ${it.id}: 新版渲染失败 (${String(e.message).slice(0, 80)})`);
      continue;
    }
  }
  const prior = key[it.id];
  const newLeft = FIXED ? false : prior ? prior.A === 'new' : rnd() < 0.5;
  key[it.id] = {
    pool: it.pool,
    A: newLeft ? 'new' : 'old',
    B: newLeft ? 'old' : 'new',
    newVersion,
  };
  const [imgA, imgB] = await Promise.all([
    loadImage(newLeft ? newPng : oldPng),
    loadImage(newLeft ? oldPng : newPng),
  ]);
  const W = SIZE * 2 + PAD * 3,
    H = SIZE + TITLE + PAD * 2;
  const c = createCanvas(W, H),
    g = c.getContext('2d');
  g.fillStyle = '#1a1a1a';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#ddd';
  g.font = '22px Menlo, monospace';
  g.fillText(`${it.id}   (${it.pool}${it.culled ? ', culled' : ''})`, PAD, 30);
  g.textAlign = 'center';
  g.font = 'bold 26px Menlo, monospace';
  g.fillText(LBL_A, PAD + SIZE / 2, H - 8);
  g.fillText(LBL_B, PAD * 2 + SIZE + SIZE / 2, H - 8);
  g.textAlign = 'left';
  g.drawImage(imgA, PAD, TITLE + PAD / 2, SIZE, SIZE);
  g.drawImage(imgB, PAD * 2 + SIZE, TITLE + PAD / 2, SIZE, SIZE);
  const file = join(outDir, `${it.pool}-${it.id}.png`);
  writeFileSync(file, c.toBuffer('image/png'));
  thumbs.push({ id: it.id, pool: it.pool, culled: !!it.culled, A: imgA, B: imgB });
  console.log('wrote', file);
}
writeFileSync(join(outDir, '_key.json'), JSON.stringify(key, null, 2));

// 总览: 每池一张网格图 (每格 = A | B 缩略), 加每池一份盲评表
const T = 200,
  PER_ROW = 3,
  CELL_W = T * 2 + 14,
  CELL_H = T + 34;
for (const pool of [...new Set(thumbs.map((t) => t.pool))]) {
  const list = thumbs.filter((t) => t.pool === pool);
  const rows = Math.ceil(list.length / PER_ROW);
  const W = PER_ROW * (CELL_W + 16) + 16,
    H = rows * (CELL_H + 12) + 16;
  const c = createCanvas(W, H),
    g = c.getContext('2d');
  g.fillStyle = '#1a1a1a';
  g.fillRect(0, 0, W, H);
  g.font = '14px Menlo, monospace';
  list.forEach((t, i) => {
    const x = 16 + (i % PER_ROW) * (CELL_W + 16),
      y = 16 + Math.floor(i / PER_ROW) * (CELL_H + 12);
    g.fillStyle = t.culled ? '#e8a' : '#ddd';
    g.fillText(`${t.id}${t.culled ? ' (culled)' : ''}`, x, y + 14);
    g.drawImage(t.A, x, y + 22, T, T);
    g.drawImage(t.B, x + T + 14, y + 22, T, T);
    g.fillStyle = '#888';
    g.textAlign = 'center';
    g.fillText(LBL_A, x + T / 2, y + 20 + T + 12);
    g.fillText(LBL_B, x + T + 14 + T / 2, y + 20 + T + 12);
    g.textAlign = 'left';
  });
  writeFileSync(join(outDir, `_index-${pool}.png`), c.toBuffer('image/png'));
  const ballotPath = join(outDir, `_ballot-${pool}.md`);
  const ballotRows = list.map((t) => `- [ ] ${t.id}${t.culled ? ' (culled)' : ''}: `);
  const head = FIXED
    ? `# ${pool} (左旧右新): 每行填 新 / 旧 / 平\n\n`
    : `# 盲评 ${pool}: 每行填 A / B / 平\n\n`;
  if (!existsSync(ballotPath)) writeFileSync(ballotPath, head + ballotRows.join('\n') + '\n');
  else {
    const have = readFileSync(ballotPath, 'utf8');
    const add = ballotRows.filter(
      (r) => !have.includes(r.replace(/^- \[ \] /, '').split(':')[0] + ':'),
    );
    if (add.length) writeFileSync(ballotPath, have.replace(/\n*$/, '\n') + add.join('\n') + '\n');
  }
}
console.log(`done: ${thumbs.length} sheets, key → ${join(outDir, '_key.json')}`);
