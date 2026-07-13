// test-template.mjs — Sprint 93: 范本文法回归保护.
// 范本 v3 的规则 (居中 / hoist / 查重剥除 / 小字剥除 / 转场页) 此前零测试
// 覆盖 — renderer 任何重构都可能静默退化。本文件把每条文法钉成断言。
import { renderSceneDataToCanvas } from '../src/present/atoms-2d/renderer.js';
import {
  insertTransitions,
  transitionArt,
  underlayFamilyFor,
  mountUnderlayDecor,
  mountPaletteOverride,
  artMountOpts,
} from '../src/present/art-mount.js';

let passed = 0;
let failed = 0;
function ok(cond, msg) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.log(`  ✗ ${msg}`);
  }
}

const palette = {
  accent: [200, 80, 40],
  colors: [
    [200, 80, 40],
    [40, 90, 160],
    [90, 150, 90],
  ],
  bg: [246, 244, 238],
  silhouetteColor: [30, 30, 34],
};

function recCanvas() {
  const rec = { ops: [], texts: [], aligns: [], fonts: [], images: [] };
  const ctx = new Proxy(
    {},
    {
      get(t, k) {
        if (k in t) return t[k]; // stored props (font/textAlign/…) read back
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
            rec.fonts.push(ctx.font);
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
  // textAlign/font live on the proxy target via set trap
  return {
    canvas: { width: 1280, height: 720, getContext: () => ctx },
    rec,
    ctx,
  };
}

const fakeArt = { width: 1280, height: 985 };
const fakeMount = {
  id: '0xtest-1',
  name: 'Test Piece',
  artist: 'Tester',
  cover: fakeArt,
  strip: [fakeArt],
  variants: [
    { width: 100, height: 80 },
    { width: 200, height: 160 },
  ],
  palette: {
    accent: [10, 120, 200],
    colors: [
      [10, 120, 200],
      [220, 60, 60],
    ],
  },
};

// ── 1. 封面: 标题居中 + 全幅真迹 ──
{
  const { canvas, rec } = recCanvas();
  await renderSceneDataToCanvas(
    canvas,
    {
      subjects: [
        { type: 'cover', x: 0, y: 0, w: 1280, h: 720, args: { title: '大标题', subtitle: '副题' } },
      ],
    },
    { palette, decorArt: fakeArt, decorRole: 'cover' },
  );
  const ti = rec.texts.indexOf('大标题');
  ok(ti >= 0, '封面标题绘制');
  ok(rec.aligns[ti] === 'center', '封面标题居中 (textAlign center)');
  ok(rec.images.length >= 1 && rec.images[0].length === 9, '封面全幅真迹 cover-fit (9 参裁绘)');
  const st = rec.texts.indexOf('副题');
  ok(st >= 0 && rec.aligns[st] === 'center', '封面副题跟随居中');
}

// ── 2. banner 页: 标题居中 + 字号随 band + hoist 查重剥除 ──
{
  const { canvas, rec } = recCanvas();
  await renderSceneDataToCanvas(
    canvas,
    {
      subjects: [
        { type: 'cover', x: 0, y: 0, w: 1280, h: 120, args: { title: '机制基准' } },
        {
          type: 'comparison-table',
          x: 40,
          y: 160,
          w: 1200,
          h: 520,
          args: {
            title: '机制基准与行业定位',
            columns: [{ label: 'A' }, { label: 'B' }],
            features: [{ label: '行一', values: ['x', 'y'] }],
          },
        },
      ],
    },
    { palette, decorArt: fakeArt, decorRole: 'section' },
  );
  const ti = rec.texts.indexOf('机制基准');
  ok(ti >= 0 && rec.aligns[ti] === 'center', 'band 标题居中');
  const px = parseInt((rec.fonts[ti] || '').match(/(\d+)px/)?.[1] || '0', 10);
  ok(px >= 26 && px <= 46, `band 标题字号随 band 高 (${px}px ∈ [26,46])`);
  ok(!rec.texts.includes('机制基准与行业定位'), '体内标题与 banner 重复时剥除');
  ok(rec.texts.includes('行一'), '表体内容保留');
}

// ── 3. agenda: 标题上提 + 小字剥除 ──
{
  const { canvas, rec } = recCanvas();
  await renderSceneDataToCanvas(
    canvas,
    {
      subjects: [
        { type: 'cover', x: 0, y: 0, w: 1280, h: 120, args: { title: 'Overview' } },
        {
          type: 'agenda-list',
          x: 40,
          y: 160,
          w: 1200,
          h: 520,
          args: {
            title: '核心主题',
            items: [
              { label: '主题一', sublabel: '小字一' },
              { label: '主题二', sublabel: '小字二' },
              { label: '主题三' },
              { label: '主题四' },
              { label: '主题五' },
            ],
          },
        },
      ],
    },
    { palette, decorArt: fakeArt, decorRole: 'agenda' },
  );
  ok(rec.texts.includes('核心主题'), 'agenda 标题上提进 banner');
  ok(!rec.texts.includes('Overview'), '英文槽位名退役');
  ok(rec.texts.includes('主题一'), '条目标题保留');
  ok(!rec.texts.includes('小字一') && !rec.texts.includes('小字二'), 'agenda 小字剥除');
  const hoisted = rec.texts.filter((t) => t === '核心主题').length;
  ok(hoisted === 1, '标题只画一次 (体内不重复)');
}

// ── 4. banner 页 bullet-list 小字剥除 ──
{
  const { canvas, rec } = recCanvas();
  await renderSceneDataToCanvas(
    canvas,
    {
      subjects: [
        { type: 'cover', x: 0, y: 0, w: 1280, h: 120, args: { title: '页题' } },
        {
          type: 'bullet-list',
          x: 40,
          y: 160,
          w: 600,
          h: 500,
          args: {
            title: '要点',
            items: [{ label: '要点一', sublabel: '灰色注脚' }, { label: '要点二' }],
          },
        },
      ],
    },
    { palette, decorArt: fakeArt, decorRole: 'section' },
  );
  ok(rec.texts.includes('要点一'), 'bullet 标题保留');
  ok(!rec.texts.includes('灰色注脚'), 'bullet 小字剥除 (banner 页)');
}

// ── 5. 转场页合成 ──
{
  const slots = [
    { slotIdx: 0, slotName: 'cover', sceneData: { subjects: [] } },
    {
      slotIdx: 1,
      slotName: 'agenda',
      sceneData: {
        subjects: [
          {
            type: 'agenda-list',
            args: { items: [1, 2, 3, 4, 5, 6].map((i) => ({ label: `节${i}` })) },
          },
        ],
      },
    },
    { slotIdx: 3, slotName: 'theme-1-lead', slotTitle: 'T1', sceneData: { subjects: [] } },
    { slotIdx: 5, slotName: 'theme-2-lead', slotTitle: 'T2', sceneData: { subjects: [] } },
    { slotIdx: 15, slotName: 'risk-matrix', slotTitle: 'R', sceneData: { subjects: [] } },
  ];
  const out = insertTransitions(slots, fakeMount);
  const trans = out.filter((s) => s._transition);
  ok(trans.length === 3, `转场页按节边界合成 (${trans.length})`);
  ok(trans[0].sceneData.subjects[0].type === 'cover', '转场页 = 封面式纯 cover');
  ok(trans[0].sceneData.subjects[0].args.title === '节1', '转场标题取 agenda 条目');
  ok(!trans[0].sceneData.subjects[0].args.subtitle, '无页码字样 (01/6 已删)');
  ok(
    out.indexOf(trans[0]) === out.findIndex((s) => s.slotName === 'theme-1-lead') - 1,
    '转场页插在 -lead 前',
  );
  const a0 = transitionArt(fakeMount, trans[0]);
  const a1 = transitionArt(fakeMount, trans[1]);
  ok(a0 === fakeMount.variants[0] && a1 === fakeMount.variants[1], '转场页轮换不同 hash 变体');
  ok(transitionArt({ ...fakeMount, variants: [] }, trans[0]) === fakeMount.cover, '无变体回退主图');
}

// ── 6. 装裱工具函数确定性 ──
{
  const f1 = underlayFamilyFor('L38');
  ok(f1 === underlayFamilyFor('L38'), '内页纹样确定性 (同 id 同家族)');
  ok(f1 !== 'peg-wraps', '内页纹样排除同作品 port (异源纪律)');
  const p2 = mountPaletteOverride(palette, fakeMount);
  ok(p2.accent === fakeMount.palette.accent && p2.bg === palette.bg, '提色换 accent 保底色');
  const d2 = mountUnderlayDecor({ family: 'x', seed: 1 }, fakeMount, 'homo');
  ok(!!d2.family, 'homo 模式可用');
  const o = artMountOpts(fakeMount, { slotIdx: 4 }, 'content');
  ok(o.decorRole === 'section' && o.decorUnder === true, '内页升 section + underlay 请求');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
