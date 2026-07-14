// test-color.mjs — Sprint 96: 色彩语义化回归测试.
// 钉住: 语义角色不被艺术色覆盖 / OKLab 感知距离 / series 可区分 / accent
// 对比度地板 / atoms 消费 palette.semantic。
import {
  SEMANTIC,
  semanticColor,
  rgbToOklab,
  okDist,
  pickDistinct,
  ensureContrast,
} from '../src/present/atoms-2d/color.js';
import { mountPaletteOverride } from '../src/present/art-mount.js';
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

// ── 1. semanticColor 角色 ──
ok(semanticColor({}, 'positive') === SEMANTIC.positive, '无定制: 统一默认 (positive)');
ok(semanticColor(null, 'negative') === SEMANTIC.negative, 'null palette 不炸');
ok(semanticColor({}, 'unknown-role') === SEMANTIC.neutral, '未知角色回落 neutral');
{
  const custom = { semantic: { positive: [1, 2, 3] } };
  ok(semanticColor(custom, 'positive').join() === '1,2,3', '主题可经 palette.semantic 定制');
  ok(semanticColor(custom, 'negative') === SEMANTIC.negative, '未定制的角色仍走默认');
}

// ── 2. OKLab ──
{
  const [L] = rgbToOklab([255, 255, 255]);
  ok(Math.abs(L - 1) < 0.01, '白色 L≈1', `L=${L.toFixed(3)}`);
  const [L0] = rgbToOklab([0, 0, 0]);
  ok(Math.abs(L0) < 0.01, '黑色 L≈0');
  ok(
    Math.abs(okDist([200, 30, 30], [30, 160, 60]) - okDist([30, 160, 60], [200, 30, 30])) < 1e-9,
    '距离对称',
  );
  ok(
    okDist([200, 30, 30], [30, 160, 60]) > okDist([100, 100, 100], [110, 110, 110]),
    '红绿远 > 近灰',
  );
}

// ── 3. pickDistinct series 可区分 ──
{
  const cands = [
    [200, 40, 40],
    [205, 45, 42], // 与首个几乎同色 — 应被拒
    [40, 90, 170],
    [42, 92, 172], // 与上一个几乎同色 — 应被拒
    [40, 160, 90],
    [230, 180, 40],
  ];
  const picked = pickDistinct(cands, 6, 0.09);
  ok(picked.length === 4, '近似色被 OKLab 去重 (6→4)', `got ${picked.length}`);
  const allApart = picked.every((a, i) => picked.every((b, j) => i === j || okDist(a, b) >= 0.09));
  ok(allApart, '选中 series 两两 ΔE ≥ 0.09');
  ok(picked[0] === cands[0], '输入序 = 优先级序 (首色保留)');
}

// ── 4. ensureContrast ──
{
  const paper = [246, 244, 238];
  const pale = [235, 230, 210]; // 与纸底几乎同明度
  const fixed = ensureContrast(pale, paper);
  ok(
    Math.abs(rgbToOklab(fixed)[0] - rgbToOklab(paper)[0]) >= 0.2,
    '过淡 accent 被压暗到对比达标',
    `ΔL=${Math.abs(rgbToOklab(fixed)[0] - rgbToOklab(paper)[0]).toFixed(2)}`,
  );
  const strong = [150, 40, 30];
  ok(ensureContrast(strong, paper) === strong, '对比已达标: 原样返回 (零改动)');
  const darkBg = [24, 24, 30];
  const darkAccent = [40, 38, 50];
  const lifted = ensureContrast(darkAccent, darkBg);
  ok(rgbToOklab(lifted)[0] > rgbToOklab(darkAccent)[0], '暗底过暗 accent 被提亮');
}

// ── 5. mountPaletteOverride 语义纪律 ──
{
  const base = {
    accent: [10, 10, 10],
    colors: [[10, 10, 10]],
    bg: [246, 244, 238],
    silhouetteColor: [30, 30, 34],
    semantic: { positive: [7, 7, 7] },
  };
  const mount = {
    palette: {
      accent: [235, 230, 210],
      colors: [
        [235, 230, 210],
        [40, 90, 170],
      ],
    },
  };
  const out = mountPaletteOverride(base, mount);
  ok(out.semantic === base.semantic, '语义色随 base 透传, 艺术色不覆盖');
  ok(out.bg === base.bg && out.silhouetteColor === base.silhouetteColor, '底色/墨色不动');
  ok(out.accent.join() !== '235,230,210', '过淡艺术 accent 被 ensureContrast 修正');
  ok(out.colors[0] === out.accent, 'colors[0] 与修正后 accent 同步 (atoms 双读法)');
  ok(out.colors[1].join() === '40,90,170', '其余 series 色保留');
}

// ── 6. atoms 消费 palette.semantic (mock canvas) ──
function recCanvas() {
  const rec = { fills: [], texts: [] };
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
        if (k === 'fillText') return (s) => rec.texts.push(String(s));
        return () => {};
      },
      set(t, k, v) {
        if (k === 'fillStyle') rec.fills.push(String(v));
        t[k] = v;
        return true;
      },
    },
  );
  return { canvas: { width: 1280, height: 720, getContext: () => ctx }, rec };
}
const basePalette = {
  accent: [200, 80, 40],
  colors: [[200, 80, 40]],
  bg: [246, 244, 238],
  silhouetteColor: [30, 30, 34],
};

// kpi-card trend pill: 默认语义绿 / 定制语义色生效
{
  const { canvas, rec } = recCanvas();
  await renderSceneDataToCanvas(
    canvas,
    {
      subjects: [
        {
          type: 'kpi-card',
          x: 40,
          y: 40,
          w: 400,
          h: 240,
          args: { value: '90%', label: '留存率', trend: 'up', trendValue: '+12%' },
        },
      ],
    },
    { palette: basePalette },
  );
  ok(
    rec.fills.some((f) => f.includes('40,160,100') || f.includes('40, 160, 100')),
    'kpi 上涨 pill = 统一语义绿',
  );
}
{
  const { canvas, rec } = recCanvas();
  await renderSceneDataToCanvas(
    canvas,
    {
      subjects: [
        {
          type: 'kpi-card',
          x: 40,
          y: 40,
          w: 400,
          h: 240,
          args: { value: '90%', label: '留存率', trend: 'down', trendValue: '-3%' },
        },
      ],
    },
    { palette: { ...basePalette, semantic: { negative: [9, 8, 7] } } },
  );
  ok(
    rec.fills.some((f) => f.includes('9,8,7') || f.includes('9, 8, 7')),
    'palette.semantic 定制下跌色被 kpi 消费',
  );
}

// ── 7. 黑洞页回归 (2026-07-14 事故: theme 对象 → getTheme null → 黑底黑字) ──
{
  const { getTheme } = await import('../src/present/themes.js');
  const t = getTheme('editorial-spectrum');
  ok(!!t, 'getTheme(id) 正常路径');
  ok(getTheme(t) === t, 'getTheme(已解析对象) 原样返回');
  ok(getTheme({ id: 'editorial-spectrum' }).id === 'editorial-spectrum', 'getTheme({id}) 回查');
  // renderer partial palette 防御纵深: 缺 bg/silhouette 不再涂成 rgb(0,0,0)
  const rec = { fills: [] };
  const ctx = new Proxy(
    {},
    {
      get(tg, k) {
        if (k in tg) return tg[k];
        if (k === 'measureText') return (x) => ({ width: String(x).length * 8 });
        if (k === 'getImageData') return () => ({ data: new Uint8ClampedArray(400) });
        if (k === 'createLinearGradient' || k === 'createRadialGradient')
          return () => ({ addColorStop: () => {} });
        if (k === 'fillRect') return () => rec.fills.push(String(ctx.fillStyle));
        return () => {};
      },
      set(tg, k, v) {
        tg[k] = v;
        return true;
      },
    },
  );
  const canvas = { width: 100, height: 100, getContext: () => ctx };
  await renderSceneDataToCanvas(canvas, { subjects: [] }, { palette: { accent: [1, 2, 3] } });
  ok(rec.fills.length > 0 && rec.fills[0] !== 'rgb(0,0,0)', 'partial palette 底色回落纸面, 非黑洞');
}

// ── 8. 灰度装裱 accent 地板 (对抗 round 2) ──
{
  const grey = {
    palette: {
      accent: [199, 199, 199],
      colors: [
        [199, 199, 199],
        [119, 119, 119],
      ],
    },
  };
  const base = { bg: [246, 244, 238], silhouetteColor: [30, 30, 34] };
  const out = mountPaletteOverride(base, grey);
  ok(
    Math.abs(rgbToOklab(out.accent)[0] - rgbToOklab(base.bg)[0]) >= 0.33,
    '浅灰 accent 压到 ΔL≥0.34 (标题级数字可读)',
    `accent=${out.accent}`,
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
