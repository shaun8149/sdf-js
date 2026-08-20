// =============================================================================
// harvest-palettes — LLM 配色方案库收割 (DIMENSION Task 6, user 裁定 2026-08-20:
// "所有颜色来自 LLM")
// -----------------------------------------------------------------------------
// 语料: examples/genlab/out/_audit/*.mjs 的 __layers ({sdf, color} 数组，sdf.f
// 可 CPU 求值)，限定 review.json verdict=pass 且 prompts.json cat=landscape 的件
// (两文件按 id join)。3D 场景 (DIMENSION scene 34) 整套取色，废配色在收割关就死。
//
// 每件算法 (48² 网格评每层覆盖率 + 质心 y，同 flow-gpu.html 的 censusLayers 手法):
//   1. 覆盖率 coverage = 网格内 f(p)<0 的格点占比；质心 centroidY = 内部格点 wy 均值
//      (wy 用 flow-gpu.html 同款 y-flip 映射，与 SDF y-up/画布 y-down 惯例一致)
//   2. bg   = coverage ≥ LARGE_COV_TH 的候选池中 centroidY 最高的一层 (大覆盖+高)
//      ground = 同候选池 (去掉 bg) 中 centroidY 最低的一层 (大覆盖+低)；
//      要求 bg.centroidY 比 ground.centroidY 至少高 BG_GROUND_MARGIN，否则整件丢弃
//      (候选池为空、或凑不出这对高低层，同样丢弃——件内结构不足以撑起配色)
//   3. objs = 剩余层里，对 bg 的亮度差 ≥40 (Y=0.2126R+0.7152G+0.0722B) 或
//      (色相距 ≥60° 且双方饱和度 ≥0.25) 的层，按对比度评分降序取前 2-3 (去重:
//      跳过与已选 obj 欧氏 RGB 距离 <OBJ_DEDUP_DIST 的候选，避免同色层占两个坑；
//      去重后不足 2 个則退回不去重的原始排序前 2-3)。不足 2 个通过对比关 → 整件丢弃。
//   4. 双实配对对比关 (终审必修 1, 2026-08-20 user 裁定"保旋转+数据层堵漏"):
//      DIMENSION scene 34 的 12 色环把 [bg,ground,obj1,obj2] 随机旋转
//      (scenes/index.js 的 startIndex 逻辑不在本脚本改动范围内，user 终裁保留)，
//      代数上只有两组"背景↔物体"配对会被实际渲染出来——(bg, objs[0]) 与
//      (ground, objs[1])。第 3 步只保证 objs 对 bg 达标 (排序也只按对 bg 的评分)，
//      (ground, objs[1]) 此前是陪跑进来的、从未被验证过。这一步补一道门: 两个
//      实配对都必须过第 3 步同一条标准，不过先试 objs[0]/objs[1] 互换位置 (两者
//      都已是过 bg 对比关的候选，互换不引入新层)，仍不过整套淘汰 (不放水到更松
//      的标准)。
//   5. accent = 未被 bg/ground/objs 占用的层里饱和度最高的一层 (小件高饱和的点缀色);
//      若没有剩余层 (件内层数太少)，退回全部层里饱和度最高的一层。
//
// 输出: 直接写 DIMENSION 仓 objects3d/palettes3d.js —— `const PAL3D = [...]`
// (孤岛纪律: 全局脚本, 无 import/export)，每套 { bg, ground, objs, accent, src }。
//
// Usage: node scripts/genlab-audit/harvest-palettes.mjs [--out <path>] [--dry]
// =============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const GENLAB = join(here, '../../examples/genlab');
const AUDIT_DIR = join(GENLAB, 'out/_audit');
const RAW_DIR = join(GENLAB, 'out');

const args = process.argv.slice(2);
const outFlagIdx = args.indexOf('--out');
const DEFAULT_OUT = '/Users/hexiaoyang/Documents/sdf/DIMENSION/objects3d/palettes3d.js';
const OUT_PATH = outFlagIdx >= 0 ? args[outFlagIdx + 1] : DEFAULT_OUT;
const DRY = args.includes('--dry');

// ---- 调参常量 (2026-08-20 用 107 件 landscape-pass 语料标定, 见 task-6-report) ---
const GRID = 48; // 覆盖率/质心网格边长
const DEFAULT_VIEW = 1.4; // view: 字段缺失时的缺省 (同 flow-gpu.html)
const LARGE_COV_TH = 0.12; // bg/ground 候选池覆盖率下限
const MIN_OBJ_COV = 0.003; // objs 候选覆盖率下限 (排除测量噪声级碎屑, ~7 格点)
const BG_GROUND_MARGIN = 0.05; // bg.centroidY 必须比 ground.centroidY 高至少这么多
const CONTRAST_Y = 40; // 亮度差阈值
const CONTRAST_HUE = 60; // 色相距阈值 (度)
const CONTRAST_SAT = 0.25; // 色相路径要求双方饱和度下限
const OBJ_DEDUP_DIST2 = 20 * 20; // objs 去重的欧氏 RGB 距离阈值 (平方, 免开方)
const MIN_ROWS = 3; // 件内至少要有几层有效 SDF 层才值得分析

// ---- 颜色数学 ----------------------------------------------------------------
const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

const rgbToHsl = ([r8, g8, b8]) => {
  const r1 = r8 / 255,
    g1 = g8 / 255,
    b1 = b8 / 255;
  const mx = Math.max(r1, g1, b1),
    mn = Math.min(r1, g1, b1);
  const l = (mx + mn) / 2;
  if (mx === mn) return { h: 0, s: 0, l };
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h;
  if (mx === r1) h = (g1 - b1) / d + (g1 < b1 ? 6 : 0);
  else if (mx === g1) h = (b1 - r1) / d + 2;
  else h = (r1 - g1) / d + 4;
  return { h: h * 60, s, l };
};

// 圆周色相距, [0,180]
const hueDist = (h1, h2) => {
  const d = Math.abs(h1 - h2) % 360;
  return d > 180 ? 360 - d : d;
};

const rgbDist2 = (a, b) => {
  const dr = a[0] - b[0],
    dg = a[1] - b[1],
    db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
};

// ---- 48² 网格覆盖率 + 质心 y (同 flow-gpu.html censusLayers 的 wx/wy 映射) -----
const censusLayer = (f, VIEW) => {
  let inside = 0,
    sumY = 0;
  for (let py = 0; py < GRID; py++) {
    const wy = -(((py + 0.5) / GRID) * 2 * VIEW - VIEW);
    for (let px = 0; px < GRID; px++) {
      const wx = ((px + 0.5) / GRID) * 2 * VIEW - VIEW;
      if (f([wx, wy]) < 0) {
        inside++;
        sumY += wy;
      }
    }
  }
  return { coverage: inside / (GRID * GRID), centroidY: inside ? sumY / inside : null };
};

// ---- 语料清单: prompts.json × review.json join, cat=landscape 且 verdict=pass --
const prompts = JSON.parse(readFileSync(join(GENLAB, 'prompts.json'), 'utf8'));
const review = JSON.parse(readFileSync(join(GENLAB, 'review.json'), 'utf8'));
const landscapeIds = prompts.prompts
  .filter((p) => p.cat === 'landscape')
  .map((p) => p.id)
  .filter((id) => review.verdicts[id] === 'pass');

// ---- 逐件收割 ------------------------------------------------------------------
const results = [];
const rejects = {
  loadFail: 0,
  tooFewLayers: 0,
  noBgGroundPool: 0,
  noGround: 0,
  badSeparation: 0,
  tooFewObjs: 0,
  groundObjGate: 0, // 双实配对对比关 (终审必修 1): 互换 objs[0]/objs[1] 后仍凑不出
  // (bg,objs[0]) 与 (ground,objs[1]) 双双过关的组合, 整件丢弃
};
let swapFixed = 0; // 双实配对对比关: 靠互换 objs[0]/objs[1] 才双过的件数 (非丢弃, 计数用于报告)

for (const id of landscapeIds) {
  let mod;
  try {
    mod = await import(join(AUDIT_DIR, `${id}.mjs`));
  } catch (e) {
    rejects.loadFail++;
    continue;
  }
  let VIEW = DEFAULT_VIEW;
  try {
    const raw = readFileSync(join(RAW_DIR, `${id}.js`), 'utf8');
    VIEW = +(raw.match(/view:\s*([\d.]+)/)?.[1] ?? DEFAULT_VIEW);
  } catch (e) {
    /* 用缺省 VIEW */
  }

  const layers = mod.__layers ?? [];
  const rows = [];
  for (const L of layers) {
    const sdf = L && (L.sdf ?? L);
    const f = sdf && (sdf.f ? (p) => sdf.f(p) : typeof sdf === 'function' ? sdf : null);
    if (!f || !Array.isArray(L.color)) continue;
    const { coverage, centroidY } = censusLayer(f, VIEW);
    if (coverage < 1e-4 || centroidY === null) continue;
    const { h, s, l } = rgbToHsl(L.color);
    rows.push({ coverage, centroidY, color: L.color, Y: luminance(L.color), h, s, l });
  }
  if (rows.length < MIN_ROWS) {
    rejects.tooFewLayers++;
    continue;
  }

  // bg/ground: 大覆盖候选池里挑质心最高/最低
  const poolLarge = rows.filter((r) => r.coverage >= LARGE_COV_TH);
  if (!poolLarge.length) {
    rejects.noBgGroundPool++;
    continue;
  }
  const bg = poolLarge.reduce((a, b) => (b.centroidY > a.centroidY ? b : a));
  const groundPool = poolLarge.filter((r) => r !== bg);
  if (!groundPool.length) {
    rejects.noGround++;
    continue;
  }
  const ground = groundPool.reduce((a, b) => (b.centroidY < a.centroidY ? b : a));
  if (!(bg.centroidY > ground.centroidY + BG_GROUND_MARGIN)) {
    rejects.badSeparation++;
    continue;
  }

  // objs: 对 bg 的对比关 (亮度差≥40 或 色相距≥60°+双方饱和度≥0.25)，按对比度评分降序
  const rest = rows.filter((r) => r !== bg && r !== ground && r.coverage >= MIN_OBJ_COV);
  const scored = rest
    .map((r) => {
      const yd = Math.abs(r.Y - bg.Y);
      const hd = hueDist(r.h, bg.h);
      const passY = yd >= CONTRAST_Y;
      const passHue = hd >= CONTRAST_HUE && r.s >= CONTRAST_SAT && bg.s >= CONTRAST_SAT;
      return { ...r, pass: passY || passHue, score: Math.max(yd / CONTRAST_Y, hd / CONTRAST_HUE) };
    })
    .filter((r) => r.pass)
    .sort((a, b) => b.score - a.score);
  if (scored.length < 2) {
    rejects.tooFewObjs++;
    continue;
  }

  // 去重 (欧氏 RGB 距离过近的候选跳过，避免 objs 出现近似同色层占两个坑)
  const objsPicked = [];
  for (const c of scored) {
    if (objsPicked.length >= 3) break;
    if (objsPicked.every((p) => rgbDist2(p.color, c.color) >= OBJ_DEDUP_DIST2)) objsPicked.push(c);
  }
  const objs = objsPicked.length >= 2 ? objsPicked : scored.slice(0, Math.min(3, scored.length));

  // 双实配对对比关 (终审必修 1, 2026-08-20 user 裁定): 两个实际会被渲染出来的
  // "背景↔物体"配对——(bg, objs[0]) 与 (ground, objs[1])——都必须过与第 3 步
  // 同一条对比标准 (亮度差≥40 或 色相距≥60°+双方饱和度≥0.25)。objs[2] (若存在)
  // 不参与判定 (环只取 objs[0]/objs[1] 两件, 见 DIMENSION scenes/index.js 注释)。
  const passesContrast = (a, b) => {
    if (Math.abs(a.Y - b.Y) >= CONTRAST_Y) return true;
    return hueDist(a.h, b.h) >= CONTRAST_HUE && a.s >= CONTRAST_SAT && b.s >= CONTRAST_SAT;
  };
  let [o0, o1, ...oRest] = objs;
  let pairOk = passesContrast(bg, o0) && passesContrast(ground, o1);
  if (!pairOk && passesContrast(bg, o1) && passesContrast(ground, o0)) {
    // 互换位置能双过: objs 两个候选都已经是过 bg 对比关的层, 互换不引入新层、
    // 不放松标准, 只是把"谁站 objs[0] / 谁站 objs[1]"这个此前从未校验过的位置
    // 分配修正过来。
    [o0, o1] = [o1, o0];
    pairOk = true;
    swapFixed++;
  }
  if (!pairOk) {
    rejects.groundObjGate++;
    continue;
  }
  const objsFinal = [o0, o1, ...oRest];

  // accent: 未被占用的层里饱和度最高；件内层数太少时退回全部层
  const used = new Set([bg, ground, ...objsFinal]);
  const accentPool = rows.filter((r) => !used.has(r));
  const accentSrc = (accentPool.length ? accentPool : rows).reduce((a, b) => (b.s > a.s ? b : a));

  results.push({
    bg: bg.color,
    ground: ground.color,
    objs: objsFinal.map((o) => o.color),
    accent: accentSrc.color,
    src: id,
  });
}

// ---- 统计 -----------------------------------------------------------------------
const objCounts = { 2: 0, 3: 0 };
for (const r of results) objCounts[r.objs.length] = (objCounts[r.objs.length] ?? 0) + 1;

console.log(`═══ harvest-palettes ═══`);
console.log(`landscape pass 候选: ${landscapeIds.length}`);
console.log(`收割成功: ${results.length} (目标 ≥80)`);
console.log(`丢弃原因:`, rejects);
console.log(
  `双实配对对比关 (终审必修 1): 靠互换 objs[0]/objs[1] 才双过 ${swapFixed} 套, 互换后仍不过而整套淘汰 ${rejects.groundObjGate} 套`,
);
console.log(`objs 数量分布: 2 件=${objCounts[2] ?? 0}  3 件=${objCounts[3] ?? 0}`);
if (results.length < 80) {
  console.warn(
    `⚠ 收割 ${results.length} 套 < 目标 80 —— 按 user 裁定不放松对比关标准, 直接交付这批 (不补数)`,
  );
}

// ---- 生成 palettes3d.js -----------------------------------------------------
const fmtRgb = (c) => `[${c[0]},${c[1]},${c[2]}]`;
const fmtEntry = (p) =>
  `  { bg:${fmtRgb(p.bg)}, ground:${fmtRgb(p.ground)}, objs:[${p.objs.map(fmtRgb).join(',')}], accent:${fmtRgb(p.accent)}, src:${JSON.stringify(p.src)} },`;

const header = `// =============================================================================
// PAL3D — LLM 配色方案库 (DIMENSION Task 6, user 裁定 2026-08-20: "所有颜色来自 LLM")
// -----------------------------------------------------------------------------
// AUTO-GENERATED by sdf-main sdf-js/scripts/genlab-audit/harvest-palettes.mjs
// (${new Date().toISOString().slice(0, 10)})。手改会被下次收割覆盖——要调整改脚本。
//
// 来源: sdf-js/examples/genlab/out/_audit/*.mjs 的 __layers (SDF+色), 限定
// review.json verdict=pass 且 prompts.json cat=landscape 的 ${landscapeIds.length} 件语料，
// 48² 网格评每层覆盖率+质心 y 后按角色指认 (bg/ground=大覆盖高/低质心,
// objs=对 bg 亮度差≥40 或色相距≥60°+双方饱和度≥0.25 的前 2-3 层, accent=剩余层
// 最高饱和度)。终审必修 1 (2026-08-20 user 裁定"保旋转+数据层堵漏"): scene 34
// 12 色环随机旋转 [bg,ground,obj1,obj2]，代数上只有 (bg,objs[0]) 与
// (ground,objs[1]) 两组配对会被实际渲染出来——双实配对都必须过上面同一条对比
// 标准，不过先试 objs[0]/objs[1] 互换 (${swapFixed} 套靠互换过关)，仍不过整套
// 丢弃 (${rejects.groundObjGate} 套)。收割 ${results.length}/${landscapeIds.length}
// (objs 2 件×${objCounts[2] ?? 0} / 3 件×${objCounts[3] ?? 0})。
//
// 每套: { bg:[r,g,b], ground:[r,g,b], objs:[[r,g,b]×2-3], accent:[r,g,b], src }
// (rgb 0-255；src=来源件 id，链上审美血统可溯)。scene 34 (objects3d/palettes3d.js
// 旁的接线见 scenes/index.js) 每次渲染抽一套整体取色，不再用通用 pigments 表。
// =============================================================================

const PAL3D = [
${results.map(fmtEntry).join('\n')}
];
`;

if (DRY) {
  console.log(`\n--dry: 不写文件。前 3 套预览:\n`);
  console.log(results.slice(0, 3).map(fmtEntry).join('\n'));
} else {
  writeFileSync(OUT_PATH, header);
  console.log(`\n写入 ${OUT_PATH} (${(header.length / 1024).toFixed(1)} KB)`);
}
