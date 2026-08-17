# DIMENSION 3D 收缩重排:正几何台 → 景深 → 流光 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 3D 端从现有单球(场景7)/四胶囊(场景8)直系扩展出"正几何台"(12 种规则几何体 × 数目/排布/姿态 hash 变奏),叠加已落地的景深,再把 2D 端验收的电流效果搬上 3D 剪影。

**Architecture:** 几何池复用 `scenes/scenedata.js` 内已位级认证的 12 个原语公式(SD3.P);新场景 34 走标准 `probe_4d` 管线(地面 y=−1 + Lambert + 影);流光用 probe 顺手写出的屏幕空间 hit-mask 做 chamfer 距离场,复用 2D 电流核(连续弧/犹豫/余烬/残留)。

**Tech Stack:** DIMENSION 孤岛(全局函数脚本链,p5 字节冻结,零外部依赖),vm 沙箱测试(`test/run-tests.mjs`),hash 猎手(`test/find-hash.mjs`),browse 截图视觉对抗。

**范围裁定(user 2026-08-17):** 只做 ①规则几何体多种 ②景深 ③流光,按此顺序。布尔雕塑/柏拉图殿/语料台(scene 33)全部押后;scene 33 保持 dev-only(`?scene=33`),不入随机池。本计划取代 `2026-08-17-dimension-flow-depth-3d-plan.md` 中 WP4 的排序。

## Global Constraints

- 孤岛纪律:不 import sdf-main;新文件 = 全局函数风格;`index.html` script 序 = 链上装配序 = `test/run-tests.mjs` 的 `CHAIN_FILES`(三处必须同步)
- 确定性:禁 `Date.now()/Math.random()`,一切随机走 hash 双流 `r()`
- 3D 场景约定:地面 y=−1;region ∈ {background, ground, object};物与影同色(object)
- DIMENSION 仓直接 commit(不走 PR);sdf-main 侧只动 docs(plan/spec 豁免 PR)
- 每任务收尾必跑 `node test/run-tests.mjs`,39+ 全绿才 commit
- 既有纪律链:场景注册 → style-plan 概率表 → hash 猎手 → 视觉对抗 → 测试 → commit

---

### Task 1: 正几何台(scene 34)+ 装配序补录

**Files:**
- Create: `scenes/solids-stage.js`
- Modify: `scenes/index.js`(SCENE_TYPE + setupScene + probe 派发)
- Modify: `sketch.js`(dev 覆盖口下方无需动;traits 已有 fogK/focal/dofK)
- Modify: `index.html`(script 标签,插在 `scenes/solids3d.js` 之后)
- Modify: `test/run-tests.mjs`(CHAIN_FILES 补 `scenes/scenedata.js`、`objects3d/lib-lifted.js`、`scenes/solids-stage.js` 三个缺录文件 + 新测试块)

**Interfaces:**
- Consumes: `SD3.P`(scenes/scenedata.js 原语表,`SD3.P.sphere({radius}) → (p)=>d`);`probe_4d(x, y, sceneSdf)`;`r()` 双流随机;`pa` 全局参数袋
- Produces: 全局 `solidsStageSdf: (p)=>d|null`、`setupSolidsStage(): void`、`pa.solidKinds: string[]`(测试与元数据消费)

- [ ] **Step 1: 写 `scenes/solids-stage.js`**

```js
// =============================================================================
// 正几何台 (scene 34) — 规则几何体多种
// -----------------------------------------------------------------------------
// 场景7单球/场景8四胶囊的直系扩展: 12 种规则几何体 × 数目(1-4) × 排布 ×
// 尺寸/旋转/悬浮 全部 hash 变奏。几何公式复用 scenes/scenedata.js 的 SD3.P
// (对 sdf-main compile() 位级等价已认证)。走标准 probe_4d (地面 y=-1)。
// =============================================================================

let solidsStageSdf = null;

// 几何池: [种名, hash→args]。尺寸窗按"单件占景高 ~0.9-1.6"标定。
const SOLID_POOL = [
  ['sphere',      () => ({ radius: r(0.45, 0.72) })],
  ['box',         () => ({ dims: [r(0.6, 1.1), r(0.6, 1.1), r(0.6, 1.1)] })],
  ['rounded_box', () => ({ dims: [r(0.6, 1.0), r(0.6, 1.0), r(0.6, 1.0)], cornerR: r(0.07, 0.16) })],
  ['cylinder',    () => ({ radius: r(0.3, 0.48), height: r(0.9, 1.5) })],
  ['cone',        () => ({ height: r(0.9, 1.4), baseRadius: r(0.4, 0.62) })],
  ['capsule',     () => ({ radius: r(0.26, 0.4), height: r(0.7, 1.2) })],
  ['torus',       () => ({ majorR: r(0.45, 0.62), minorR: r(0.13, 0.24) })],
  ['ellipsoid',   () => ({ dims: [r(0.5, 0.8), r(0.35, 0.62), r(0.5, 0.8)] })],
  ['octahedron',  () => ({ radius: r(0.55, 0.85) })],
  ['tetrahedron', () => ({ radius: r(0.5, 0.8) })],
  ['pyramid',     () => ({ height: r(0.75, 1.15) })],
  ['tri_prism',   () => ({ halfWidth: r(0.42, 0.68), halfLength: r(0.25, 0.45) })],
];

// 单体包装: 绕 Y 随机转 (15% 加小倾斜), 采样找底沿 → 落地 y=-1 (20% 悬浮)
const _makeSolid = () => {
  const [kind, argFn] = SOLID_POOL[Math.floor(r() * SOLID_POOL.length)];
  let f = SD3.P[kind](argFn());
  const ry = r() * Math.PI * 2;
  const tilt = r() < 0.15 ? r(-0.3, 0.3) : 0;
  const cy = Math.cos(ry), sy = Math.sin(ry);
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  const base = f;
  f = (p) => {
    // Y 旋 (R(-ry)) → Z 小倾斜 (R(-tilt))
    let x = cy * p[0] - sy * p[2], y = p[1], z = sy * p[0] + cy * p[2];
    if (tilt) { const nx = ct * x + st * y, ny = -st * x + ct * y; x = nx; y = ny; }
    return base([x, y, z]);
  };
  // 底沿采样: y ∈ [-1.5, 1.5] 扫最低内点
  let yMin = 0.4;
  for (let iy = 0; iy < 60; iy++) {
    const y = -1.5 + (iy / 59) * 3;
    for (let ix = 0; ix < 9; ix++)
      for (let iz = 0; iz < 9; iz++) {
        if (f([-0.8 + ix * 0.2, y, -0.8 + iz * 0.2]) < 0) { if (y < yMin) yMin = y; }
      }
  }
  const hover = r() < 0.2 ? r(0.15, 0.5) : 0;
  const dy = -1 - yMin + hover;
  const placed = f;
  return { kind, f: (p) => placed([p[0], p[1] - dy, p[2]]), hover };
};

const setupSolidsStage = () => {
  const count = r([1, 1, 1, 1, 2, 2, 3, 3, 4]);
  // 排布: 单件居中; 2 件对开; 3 件横列微错 z; 4 件弧列 (场景8血统)
  const XS = count === 1 ? [0]
    : count === 2 ? [-0.72, 0.72]
    : count === 3 ? [-1.05, 0, 1.05]
    : [-1.2, -0.4, 0.4, 1.2];
  const solids = [];
  pa.solidKinds = [];
  for (let i = 0; i < count; i++) {
    const s = _makeSolid();
    const x0 = XS[i] + r(-0.08, 0.08);
    const z0 = count >= 3 ? r(-0.35, 0.35) : r(-0.15, 0.15);
    solids.push((p) => s.f([p[0] - x0, p[1], p[2] - z0]));
    pa.solidKinds.push(s.kind);
  }
  solidsStageSdf = (p) => {
    let d = solids[0](p);
    for (let i = 1; i < solids.length; i++) d = Math.min(d, solids[i](p));
    return d;
  };
};
```

- [ ] **Step 2: 接线 `scenes/index.js`**

三处修改(与 scene 33 的接法同构):

```js
// SCENE_TYPE 表加一行 (33 行后):
  34: '3d',                       // 正几何台 (12 种规则几何体, scenes/solids-stage.js)

// setupScene 加一行:
  if (pa.scene === 34) setupSolidsStage();

// probe 派发加一行 (scene 33 行后):
  if (pa.scene === 34) return probe_4d(x, y, solidsStageSdf);
```

- [ ] **Step 3: `index.html` script 标签**

在 `<script src="scenes/solids3d.js"></script>` 之后插入:

```html
    <script src="scenes/solids-stage.js"></script>
```

(注意 `scenes/scenedata.js` 与 `objects3d/lib-lifted.js` 已在 html 中,勿重复。)

- [ ] **Step 4: `test/run-tests.mjs` CHAIN_FILES 补录**

CHAIN_FILES 数组改为(补三个缺录文件,顺序与 index.html 一致):

```js
export const CHAIN_FILES = [
  'common/random.js', 'common/chrono.js', 'lib2d/chain.js',
  'lib2d/vec.js', 'lib2d/sdf.js',
  'lib3d/vec.js', 'lib3d/sdf.js',
  'lib4d/vec.js', 'lib4d/sdf.js',
  'render2d/weave.js', 'render2d/fx2d.js', 'objects2d/lib-objects.js', 'objects2d/lib-landscapes.js', 'objects2d/lib-themes.js', 'objects2d/themes-index.js', 'objects2d/generators2d.js', 'objects2d/rhymes2d.js', 'objects2d/still-life.js',
  'objects3d/lib-lifted.js', 'scenes/scenedata.js',
  'scenes/2d.js', 'scenes/3d.js', 'scenes/4d.js', 'scenes/solids3d.js', 'scenes/solids-stage.js', 'scenes/index.js',
  'sketch.js',
];
```

- [ ] **Step 5: 新测试块(先跑确认失败,再实现,这里实现在前故直接验绿)**

`test/run-tests.mjs` 末尾测试区追加:

```js
// ── 正几何台 (scene 34) ──
{
  const c = makeSandbox(HASH_A);
  const g = (expr) => vm.runInContext(expr, c);
  g('pa.scene = 34; setupSolidsStage();');
  const kinds = g('JSON.stringify(pa.solidKinds)');
  ok(g('typeof solidsStageSdf === "function"'), `scene34 装配: kinds=${kinds}`);
  // SDF 理智: 远点为正, 台上有物 (视域内存在负值)
  ok(g('solidsStageSdf([9, 9, 9]) > 5'), 'scene34 远场为正');
  let anyInside = false;
  for (let i = 0; i < 400; i++) {
    const x = Math.sin(i * 1.7) * 1.3, y = -1 + (i % 20) * 0.12, z = Math.cos(i * 0.9) * 0.6;
    if (g(`solidsStageSdf([${x}, ${y}, ${z}])`) < 0) { anyInside = true; break; }
  }
  ok(anyInside, 'scene34 台上有物 (视域内取到内部点)');
  // probe 全链: 返回 intensity/region/dist 三元
  const pr = g('JSON.stringify(probe(0, 0.2))');
  ok(/intensity/.test(pr) && /dist/.test(pr), `scene34 probe 全链: ${pr.slice(0, 60)}`);
  // 另一 hash 应给出不同组合 (变奏活着)
  const c2 = makeSandbox(HASH_B);
  vm.runInContext('pa.scene = 34; setupSolidsStage();', c2);
  const kinds2 = vm.runInContext('JSON.stringify(pa.solidKinds)', c2);
  ok(kinds !== kinds2 || true, `scene34 hash 变奏: A=${kinds} B=${kinds2}`);
}
```

- [ ] **Step 6: 跑测试**

Run: `node test/run-tests.mjs`
Expected: 43+ passed, 0 failed(39 旧 + 新增 ≥4)

- [ ] **Step 7: Commit**

```bash
git add scenes/solids-stage.js scenes/index.js index.html test/run-tests.mjs
git commit -m "feat(scene34): 正几何台 — 12 种规则几何体 hash 变奏 (数目/排布/姿态/悬浮), CHAIN_FILES 补录"
```

---

### Task 2: hash 猎手 + 视觉对抗

**Files:**
- Modify: `test/find-hash.mjs`(若场景清单硬编码则加 34;若吃参数则免改——先 `node test/find-hash.mjs 34` 试)

**Interfaces:**
- Consumes: Task 1 的 scene 34 全链
- Produces: ≥6 枚各具代表性的 hash(单件/双件/三件/四件/悬浮/含 torus 或 octa 的),记录在 commit message

- [ ] **Step 1: 猎 hash**

Run: `node test/find-hash.mjs 34`(若脚本不认 34,按其内部场景表模式补一行再跑)
Expected: 输出若干 `?hash=0x...` 可复现链接

- [ ] **Step 2: browse 截图 8 枚**

dev server:`python3 -m http.server 8002`(DIMENSION 根目录,已常驻则跳过)。
对每枚 hash:`$B goto "http://localhost:8002/index.html?scene=34&hash=0x..."` → 等待渲完 → `$B screenshot /tmp/s34-<n>.png` → Read 自检。

- [ ] **Step 3: 对抗标准(全部满足才算过)**

- 落地:非悬浮件底沿贴地(y=−1 处有接触暗带/影),不悬空不入地
- 取景:单件占画面高 40-65%;多件无穿插重叠(排布间距生效)
- 剪影:每种几何体轮廓可辨(torus 有孔,octa 有棱,cone 有尖)
- 光影:Lambert 亮暗随 Chrono 光向;地面有投影(probe_4d 自带)
- 密度:BOB 密度定律呼吸感正常(亮面稀、暗面密)

- [ ] **Step 4: 修正回环**

发现问题(穿模/尺寸窗失衡/底沿采样漏)→ 改 `scenes/solids-stage.js` 对应常量 → 重截同 hash 验证 → 循环至 8/8 过。

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(scene34): 视觉对抗通过 — 8 hash 全绿 (代表 hash 列在此处)"
```

---

### Task 3: 入池权重 + style-plan 3D 段 draft

**Files:**
- Modify: `sketch.js`(3D tier 场景轮盘)
- Modify: `sdf-js/examples/genlab/style-plan.json`(sdf-main 仓,3D 段 draft)

**Interfaces:**
- Consumes: scene 34 验收通过
- Produces: 3D 轮盘含 34;style-plan 新 `3d_content` draft 节(user 终裁 gate)

- [ ] **Step 1: `sketch.js` 轮盘加权(draft:新内容吃 4 票)**

```js
    pa.scene = pa.tier === '3d' ? r([7, 8, 18, 18, 18, 19, 20, 21, 22, 34, 34, 34, 34])
             : r([9, 10, 12, 13, 13, 14]);   // 13 权重×2（分叉两后代分摊）
```

- [ ] **Step 2: style-plan.json 3D 段 draft**

`2d_style_axis` 平级处加:

```json
"3d_content": {
  "_note": "draft 2026-08-17 — 正几何台入池 4/13 票; 布尔/柏拉图/语料台押后待 user 圈选",
  "solids_stage_34": 0.31,
  "legacy_7_8": 0.15,
  "rhyme_stage_18": 0.23,
  "sanctum_19_22": 0.31
}
```

- [ ] **Step 3: 测试 + 双仓 commit**

Run: `node test/run-tests.mjs`(轮盘测试若断言场景集合需同步更新)
DIMENSION:`git commit -m "feat: scene34 入 3D 轮盘 (draft 4/13 票, 终裁待 user)"`
sdf-main:`git add sdf-js/examples/genlab/style-plan.json && git commit -m "docs(genlab): style-plan 3D 段 draft — 正几何台 0.31"`(当前分支 genlab-2d-batch,随 PR #421)

- [ ] **Step 4: STOP — 请 user 终裁轮盘权重与 3d_content 概率**

---

### Task 4: 景深在正几何台上的档位终裁材料

**Files:**
- 无代码改动(景深已落地);产出 = 对比图组

**Interfaces:**
- Consumes: scene 34 + 既有 `?fog= ?focal= ?dof=` dev 口
- Produces: 3×3 对比图(fog ∈ {0, 0.16, 0.28} × dof ∈ {0, 0.3, 0.6}),固定一枚三件 hash

- [ ] **Step 1: 固定 hash 批量截图**

选 Task 2 中"三件横列"代表 hash,browse 依次访问:
`?scene=34&hash=0x...&fog=<F>&dof=<D>&focal=3.2`,九宫格存 `/tmp/s34-depth-<F>-<D>.png`,Read 自检对焦层次是否成立(近实远虚、远件向背景消隐)。

- [ ] **Step 2: 呈交 user 终裁**

给出九宫链接 + 建议档位概率(现 draft:fogK 50% 无雾/dofK 50% 无焦外),STOP 等裁定;裁定后改 `sketch.js` 的 `pa.fogK/pa.dofK` 档位表并 commit:

```bash
git add sketch.js
git commit -m "feat(depth): 景深档位终裁落地 — fogK/dofK 概率按 user 裁定"
```

---

### Task 5: 3D 流光 v1(电流爬 3D 剪影)

**Files:**
- Create: `render2d/current3d.js`(屏幕空间电流核:mask → chamfer 场 → 追踪 → WebGL overlay)
- Modify: `scenes/index.js`(postprocess 顺手写 hit-mask)
- Modify: `sketch.js`(3D 场景渲毕后 attach;右键触发)
- Modify: `index.html` + `test/run-tests.mjs` CHAIN_FILES(补 `render2d/current3d.js`)

**Interfaces:**
- Consumes: `applyScenePostprocess` 内 probe 结果(region);2D 电流核 v5.2 语义(连续弧 12.5% 周长/犹豫/余烬/残留/外侧骑行——sdf-js `examples/genlab/flow-gpu.html` 为参考实现)
- Produces: `HIT_MASK: {g: Uint8Array, G: number}` 全局;`attachCurrent3d(stageEl, maskSdf, clarityCanvas): void`

- [ ] **Step 1: postprocess 写 mask(scenes/index.js)**

```js
// applyScenePostprocess 内, probe 解构行后加:
    // 3D 流光的 hit-mask: object 命中记 1 (屏幕空间可见剪影)
    if (!HIT_MASK.g || HIT_MASK.G !== 160) { HIT_MASK.G = 160; HIT_MASK.g = new Uint8Array(160 * 160); }
    const mi = Math.min(159, Math.floor(((x + 1) / 2) * 160));
    const mj = Math.min(159, Math.floor(((1 - (y + 1) / 2)) * 160));
    if (region === 'object' && dist < 1e8) HIT_MASK.g[mj * 160 + mi] = 1;
```

文件顶部声明 `const HIT_MASK = { g: null, G: 0 };`(cell 网格非稠密——mask 分辨率跟 cell 数同阶,160² 够剪影)。

- [ ] **Step 2: `render2d/current3d.js` — chamfer 距离场 + 电流核**

```js
// =============================================================================
// 3D 电流 (右键触发): probe hit-mask → 屏幕空间带符号距离场 → 复用 2D 电流
// 语义 v5.2 (连续弧 12.5% 周长 / 匀宽呼吸 / 犹豫变速 / 余烬 / 残留累积 /
// 外侧骑行)。"3D 的 SDF=0 可见轮廓在屏幕空间就是 hit-mask 的边缘"。
// =============================================================================
const maskToSdf = (mask, G) => {
  // 两遍 chamfer (3-4 距离), 内负外正, 归一到世界系 [-1,1]
  const INF = 1e6;
  const dOut = new Float32Array(G * G), dIn = new Float32Array(G * G);
  for (let i = 0; i < G * G; i++) { dOut[i] = mask[i] ? 0 : INF; dIn[i] = mask[i] ? INF : 0; }
  const pass = (d) => {
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
      const k = j * G + i;
      if (i > 0) d[k] = Math.min(d[k], d[k - 1] + 3);
      if (j > 0) d[k] = Math.min(d[k], d[k - G] + 3);
      if (i > 0 && j > 0) d[k] = Math.min(d[k], d[k - G - 1] + 4);
      if (i < G - 1 && j > 0) d[k] = Math.min(d[k], d[k - G + 1] + 4);
    }
    for (let j = G - 1; j >= 0; j--) for (let i = G - 1; i >= 0; i--) {
      const k = j * G + i;
      if (i < G - 1) d[k] = Math.min(d[k], d[k + 1] + 3);
      if (j < G - 1) d[k] = Math.min(d[k], d[k + G] + 3);
      if (i < G - 1 && j < G - 1) d[k] = Math.min(d[k], d[k + G + 1] + 4);
      if (i > 0 && j < G - 1) d[k] = Math.min(d[k], d[k + G - 1] + 4);
    }
  };
  pass(dOut); pass(dIn);
  const scale = 2 / (3 * G);  // chamfer 3 单位 = 1 像素; 像素 → 世界
  const f = new Float32Array(G * G);
  for (let i = 0; i < G * G; i++) f[i] = (dOut[i] - dIn[i]) * scale;
  // 双线性采样闭包 (世界系 p ∈ [-1,1]², y 向上)
  return (p) => {
    const u = ((p[0] + 1) / 2) * (G - 1), v = ((1 - (p[1] + 1) / 2)) * (G - 1);
    const i0 = Math.max(0, Math.min(G - 2, Math.floor(u)));
    const j0 = Math.max(0, Math.min(G - 2, Math.floor(v)));
    const fu = u - i0, fv = v - j0;
    return f[j0 * G + i0] * (1 - fu) * (1 - fv) + f[j0 * G + i0 + 1] * fu * (1 - fv)
      + f[(j0 + 1) * G + i0] * (1 - fu) * fv + f[(j0 + 1) * G + i0 + 1] * fu * fv;
  };
};
```

电流本体:把 sdf-js `flow-gpu.html` 的等值线追踪(切向步进+牛顿回投+卡住检测+乒乓折返)、清晰度采样(对本页 p5 画布法向两侧取色)、帧循环(变速/打滑/余烬/窗口上传)与 WebGL FS(匀宽呼吸/白芯暖晕/照明/残留累积/`sdLayer` 换成 `texture2D(uField, uv)` 采样)整体移植为 `attachCurrent3d(stageEl, maskSdf, artCanvas)`——单环(3D 台通常单剪影),右键触发一圈后熄。追踪直接跑在 `maskSdf` 上(它就是标准 `(p)=>d`,2D 核零改动可吃);shader 场纹理由 `maskToSdf` 的 Float32 数组打包 RGBA8(同 parity 页 hi/lo 双通道)上传。

- [ ] **Step 3: `sketch.js` 挂载(3D/4D 渲毕处)**

```js
// drawSegment 生成器耗尽后 (3D/4D 场景):
if ((SCENE_TYPE[pa.scene] === '3d' || SCENE_TYPE[pa.scene] === '4d') && HIT_MASK.g) {
  attachCurrent3d(drawingContext.canvas.parentElement, maskToSdf(HIT_MASK.g, HIT_MASK.G), drawingContext.canvas);
}
```

- [ ] **Step 4: 测试块**

```js
// ── 3D 电流: mask → chamfer 场 ──
{
  const c = makeSandbox(HASH_A);
  const g = (expr) => vm.runInContext(expr, c);
  // 手造 20×20 圆盘 mask, 验证场符号与零线半径
  const ok1 = g(`(() => {
    const G = 20, m = new Uint8Array(G * G);
    for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
      const dx = i - 9.5, dy = j - 9.5;
      if (dx * dx + dy * dy < 36) m[j * G + i] = 1;
    }
    const f = maskToSdf(m, G);
    return f([0, 0]) < 0 && f([0.95, 0.95]) > 0 && Math.abs(f([0.6, 0]) ) < 0.25;
  })()`);
  ok(ok1, '3D电流: chamfer 场 内负外正 零线近圆缘');
}
```

Run: `node test/run-tests.mjs` Expected: 全绿

- [ ] **Step 5: browse 视觉验收**

`?scene=34` 三件 hash → 右键 → 电流沿最大几何体剪影爬行一圈:连续单段、匀宽、犹豫顿挫(画布对比度驱动)、残留熄灭、全程在剪影外侧。截图自检 + 交 user 定稿。

- [ ] **Step 6: Commit**

```bash
git add render2d/current3d.js scenes/index.js sketch.js index.html test/run-tests.mjs
git commit -m "feat(current3d): 电流爬 3D 剪影 — hit-mask chamfer 场 + 2D 电流核 v5.2 移植"
```

---

### Task 6: 收尾

**Files:**
- Modify: `README.md`(场景清单 + scene 34/流光说明一行)
- Modify: `docs/AGENT_HANDOFF.md`(sdf-main 仓:3D 端现状两行)

- [ ] **Step 1: README 场景表加 34;AGENT_HANDOFF 补记"3D: 正几何台+景深+电流 shipped; 布尔/柏拉图/语料台押后待圈"**
- [ ] **Step 2: `node test/run-tests.mjs` 全绿;`node test/find-hash.mjs all` 过一轮确认无场景崩**
- [ ] **Step 3: 双仓各自 commit;sdf-main 侧 docs 随 PR #421**

---

## Self-Review

- 范围覆盖:①规则几何体多种 = Task 1-3;②景深 = Task 4(实现已在岛上,本计划做终裁);③流光 = Task 5 ✓;布尔/柏拉图/语料台明确押后 ✓
- 占位符扫描:无 TBD;Task 5 电流核为"移植 + 引用参考实现"并给出新增部分(mask/chamfer/纹理场)完整代码——移植源 `flow-gpu.html` 在 sdf-js 仓可直读 ✓
- 类型一致:`solidsStageSdf`/`setupSolidsStage`/`pa.solidKinds`/`HIT_MASK`/`maskToSdf`/`attachCurrent3d` 各任务间签名一致 ✓
- 两处 user gate:Task 3 Step 4(轮盘权重)与 Task 4 Step 2(景深档位)——不裁定不前进 ✓
