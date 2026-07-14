// test-page-lint.mjs — 视觉闸门回归: 黑洞/空白/无对比 拦截, 正常页/艺术页放行.
import { lintPage, pageKindOf, pageStats } from '../src/present/page-lint.js';

let passed = 0;
let failed = 0;
function ok(cond, msg, extra = '') {
  if (cond) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.log(`  ✗ ${msg}${extra ? ` — ${extra}` : ''}`);
  }
}

// 合成 ImageData: 生成器 f(x,y) → [r,g,b]
function synth(w, h, f) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r, g, b] = f(x, y);
      const o = (y * w + x) * 4;
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
      data[o + 3] = 255;
    }
  return { data, width: w, height: h };
}

// ── 灾难形态拦截 ──
{
  // 黑洞页 (事故复刻): 90% 近黑 + 一条白 band
  const img = synth(128, 72, (x, y) => (y < 8 ? [230, 228, 224] : [8, 8, 10]));
  const r = lintPage(img, 'content');
  ok(!r.ok && r.issues.some((i) => i.startsWith('black-hole')), '黑洞正文页被拦', r.issues.join());
  // 同一页若是 art 页 (全幅深色真迹) — 放行
  const ra = lintPage(img, 'art');
  ok(ra.ok, '深色艺术页放行 (kind=art)');
}
{
  // 空白页: 全纸色
  const img = synth(128, 72, () => [246, 244, 238]);
  const r = lintPage(img, 'art');
  ok(!r.ok && r.issues.some((i) => i.startsWith('blank-page')), '空白页被拦 (art 页也不允许空白)');
}
{
  // 无对比度: 两个近似灰
  const img = synth(128, 72, (x) => (x % 2 ? [128, 128, 128] : [138, 138, 138]));
  const r = lintPage(img, 'content');
  ok(!r.ok && r.issues.some((i) => i.startsWith('no-contrast')), '无对比度页被拦');
}

// ── 正常形态放行 ──
{
  // 典型正文页: 纸面 + 深墨文字块 + 彩色卡片
  const img = synth(128, 72, (x, y) => {
    if (y < 10) return [40, 40, 46]; // 顶部深色横带 (art crop)
    if (y > 20 && y < 40 && x > 10 && x < 60) return [30, 30, 34]; // 文字块
    if (y > 45 && x > 70) return [200, 80, 40]; // accent 卡
    return [246, 244, 238];
  });
  const r = lintPage(img, 'content');
  ok(r.ok, '正常正文页放行', r.issues.join());
}
{
  // 全幅彩色真迹封面
  const img = synth(128, 72, (x, y) => [(x * 5) % 255, (y * 7) % 255, ((x + y) * 3) % 255]);
  ok(lintPage(img, 'art').ok, '彩色全幅艺术页放行');
}

// ── pageKindOf 归类 ──
ok(pageKindOf({ _transition: { index: 0 } }, 'banner') === 'art', '转场页 = art');
ok(
  pageKindOf({ sceneData: { subjects: [{ type: 'cover' }] } }, 'banner') === 'art',
  '纯 cover = art',
);
ok(
  pageKindOf({ sceneData: { subjects: [{ type: 'cover' }, { type: 'kpi-card' }] } }, 'banner') ===
    'content',
  'banner 正文页 = content',
);
ok(
  pageKindOf(
    { sceneData: { subjects: [{ type: 'cover' }, { type: 'quote-pull' }] } },
    'statement',
  ) === 'art',
  'statement = art',
);

// ── stats 采样健壮性 ──
{
  const s = pageStats(synth(1280, 720, () => [128, 128, 128]));
  ok(Number.isFinite(s.std) && Number.isFinite(s.contrast), '大画布抽样有限值');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
