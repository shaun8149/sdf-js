// test-layout.mjs — Sprint 95: 版式语法回归测试.
// 钉住: layoutForSlot 确定性调度 / applySplitLayout 几何重映射 (纯函数) /
// applyStatementLayout 装裱卡收纳 / renderer 两个新版式的绘制契约。
import {
  layoutForSlot,
  applySplitLayout,
  applyStatementLayout,
  statementCardRect,
  SPLIT_RAIL_FRAC,
} from '../src/present/atoms-2d/layout.js';
import { renderSceneDataToCanvas } from '../src/present/atoms-2d/renderer.js';

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

// ── 1. layoutForSlot 调度 ──
{
  const quoteScene = {
    subjects: [
      { type: 'cover', args: { title: 'ANTFUN 理念' } },
      { type: 'quote-pull', args: { quote: '...' } },
    ],
  };
  ok(layoutForSlot({ slotName: 'quote' }, quoteScene) === 'statement', '单 quote 页 → statement');
  const leadScene = {
    subjects: [
      { type: 'cover', args: { title: '第一章' } },
      { type: 'bullet-list', args: { items: [] } },
    ],
  };
  ok(layoutForSlot({ slotName: 'theme-1-lead' }, leadScene) === 'split', '-lead 轻页 → split');
  const denseLead = {
    subjects: [
      { type: 'cover', args: {} },
      { type: 'kpi-card', args: {} },
      { type: 'kpi-card', args: {} },
      { type: 'kpi-card', args: {} },
    ],
  };
  ok(
    layoutForSlot({ slotName: 'theme-2-lead' }, denseLead) === 'banner',
    '-lead 密页 (3+ atoms) 留 banner',
  );
  ok(
    layoutForSlot({ slotName: 'key-figures' }, denseLead) === 'banner',
    '普通内容页 → banner (现状不变)',
  );
  ok(
    layoutForSlot(
      { slotName: 'theme-3-lead' },
      { subjects: [{ type: 'bullet-list', args: {} }] },
    ) === 'banner',
    '-lead 无 cover 主体 → banner (rail 无标题可载)',
  );
}

// ── 2. applySplitLayout 几何 ──
{
  const scene = {
    subjects: [
      { type: 'cover', x: 0, y: 0, w: 1280, h: 120, args: { title: 'T' } },
      { type: 'bullet-list', x: 40, y: 160, w: 1200, h: 520, args: {} },
    ],
  };
  const railW = Math.round(1280 * SPLIT_RAIL_FRAC);
  const out = applySplitLayout(scene, 1280, 720);
  const cover = out.subjects.find((s) => s.type === 'cover');
  const body = out.subjects.find((s) => s.type === 'bullet-list');
  ok(
    cover.x === 0 && cover.y === 0 && cover.w === railW && cover.h === 720,
    'cover 主体占满左 rail',
  );
  ok(body.x >= railW, '正文重映射进右列 (x ≥ railW)', `x=${body.x}`);
  ok(body.x + body.w <= 1280, '正文不出右边界');
  ok(body.y === 80, '正文上移回收横带空档 (160→80)');
  ok(scene.subjects[0].w === 1280 && scene.subjects[1].x === 40, '纯函数: 输入不被修改');
}

// ── 3. applyStatementLayout 装裱卡 ──
{
  const scene = {
    subjects: [
      { type: 'cover', x: 0, y: 0, w: 1280, h: 120, args: { title: 'ANTFUN 理念' } },
      { type: 'quote-pull', x: 40, y: 160, w: 1200, h: 520, args: { quote: 'q' } },
    ],
  };
  const { sceneData, kicker, card } = applyStatementLayout(scene, 1280, 720);
  ok(kicker === 'ANTFUN 理念', 'cover 标题成为 kicker');
  ok(!sceneData.subjects.some((s) => s.type === 'cover'), 'cover 主体退场');
  const q = sceneData.subjects[0];
  ok(
    q.x >= card.x && q.y >= card.y && q.x + q.w <= card.x + card.w && q.y + q.h <= card.y + card.h,
    '正文收进装裱卡内',
  );
  const ref = statementCardRect(1280, 720);
  ok(card.x === ref.x && card.w === ref.w, '卡几何与 statementCardRect 一致');
}

// ── 4. renderer 绘制契约 (mock canvas) ──
function recCanvas() {
  const rec = { ops: [], texts: [], aligns: [], images: [] };
  const ctx = new Proxy(
    {},
    {
      get(t, k) {
        if (k in t) return t[k];
        if (k === '__rec') return rec;
        if (k === 'measureText') return (s) => ({ width: String(s).length * 8 });
        if (k === 'getImageData') return () => ({ data: new Uint8ClampedArray(4 * 100) });
        if (k === 'createLinearGradient' || k === 'createRadialGradient')
          return () => ({ addColorStop: () => {} });
        if (k === 'fillText')
          return (s, x, y) => {
            rec.texts.push(String(s));
            rec.ops.push(['fillText', String(s), Math.round(x), Math.round(y)]);
            rec.aligns.push(ctx.textAlign);
          };
        if (k === 'drawImage')
          return (...a) => {
            rec.images.push(a);
            rec.ops.push(['drawImage', a.length]);
          };
        return (...a) =>
          rec.ops.push([
            String(k),
            ...a.map((v) => (typeof v === 'number' ? Math.round(v) : String(v).slice(0, 24))),
          ]);
      },
      set(t, k, v) {
        t[k] = v;
        return true;
      },
    },
  );
  return { canvas: { width: 1280, height: 720, getContext: () => ctx }, rec };
}
const palette = {
  accent: [200, 80, 40],
  colors: [[200, 80, 40]],
  bg: [246, 244, 238],
  silhouetteColor: [30, 30, 34],
};
const fakeArt = { width: 1280, height: 985 };

// split 渲染
{
  const { canvas, rec } = recCanvas();
  await renderSceneDataToCanvas(
    canvas,
    {
      subjects: [
        { type: 'cover', x: 0, y: 0, w: 1280, h: 120, args: { title: '第一章' } },
        {
          type: 'bullet-list',
          x: 40,
          y: 160,
          w: 1200,
          h: 520,
          args: { title: '第一章总览', items: [{ label: '要点' }] },
        },
      ],
    },
    { palette, decorArt: fakeArt, decorRole: 'section', layout: 'split' },
  );
  const railW = Math.round(1280 * SPLIT_RAIL_FRAC);
  const art = rec.images.find((a) => a.length === 9);
  ok(!!art, 'split: rail 真迹 cover-fit (9 参裁绘)');
  ok(
    art && art[7] === railW && art[8] === 720,
    'split: 真迹裁绘为竖 rail 尺寸',
    art && `${art[7]}x${art[8]}`,
  );
  const ti = rec.texts.indexOf('第一章');
  ok(ti >= 0 && rec.aligns[ti] === 'center', 'split: rail 标题居中');
  const tx = rec.ops.find((o) => o[0] === 'fillText' && o[1] === '第一章');
  ok(tx && tx[2] <= railW, 'split: rail 标题落在 rail 内', tx && `x=${tx[2]}`);
  ok(!rec.texts.includes('第一章总览'), 'split: 正文标题与 rail 重复时剥除');
  ok(rec.texts.includes('要点'), 'split: 正文内容保留');
}

// statement 渲染
{
  const { canvas, rec } = recCanvas();
  await renderSceneDataToCanvas(
    canvas,
    {
      subjects: [
        { type: 'cover', x: 0, y: 0, w: 1280, h: 120, args: { title: 'ANTFUN 理念' } },
        {
          type: 'quote-pull',
          x: 40,
          y: 160,
          w: 1200,
          h: 520,
          args: { quote: '收益应当归于建设者', attribution: '创始团队' },
        },
      ],
    },
    { palette, decorArt: fakeArt, decorRole: 'content', layout: 'statement' },
  );
  const full = rec.images.find((a) => a.length === 9 && a[7] === 1280 && a[8] === 720);
  ok(!!full, 'statement: 真迹全幅 cover-fit');
  ok(rec.texts.includes('ANTFUN 理念'), 'statement: kicker 小字上卡');
  const card = statementCardRect(1280, 720);
  const cardRect = rec.ops.find(
    (o) => o[0] === 'fillRect' && o[1] === card.x && o[2] === card.y && o[3] === card.w,
  );
  ok(!!cardRect, 'statement: 装裱卡按 statementCardRect 绘制');
  ok(rec.texts.includes('收益应当归于建设者'), 'statement: 引文正文保留');
}

// 无 art 面 → 静默回落 banner (不抛错, 几何不动)
{
  const { canvas, rec } = recCanvas();
  const r = await renderSceneDataToCanvas(
    canvas,
    {
      subjects: [
        { type: 'cover', x: 0, y: 0, w: 1280, h: 120, args: { title: 'T' } },
        { type: 'bullet-list', x: 40, y: 160, w: 1200, h: 520, args: { items: [{ label: 'L' }] } },
      ],
    },
    { palette, layout: 'split' },
  );
  ok(r.errors.length === 0, '无 art 面 split 请求: 静默回落, 零错误');
  ok(rec.texts.includes('L'), '回落后内容照常渲染');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
