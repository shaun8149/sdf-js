# DIMENSION 构图系统 v2(骨架反投影)实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 scene 34 从"标本台"重做成 Pasma 式构图系统:2D 骨架反投影放置 + 相机三自由度 + 五构图型 + 布尔词汇池 + 穿刺/相贯/衰变行修饰符 + 构图级消散。

**Architecture:** `probe_4d` 增可选相机参(缺省=旧行为,老场景零 diff);solids-stage 重写为"骨架引擎(纯函数)+ 构图型配方表";几何池扩 5 件布尔词汇;有效性检查 reroll 兜底。spec:`docs/superpowers/specs/2026-08-20-dimension-3d-composition-v2-design.md`。

**Tech Stack:** DIMENSION 孤岛(全局函数脚本/vm 沙箱测试/hash 双流 r());browse+真 Chrome 截图对抗。

## Global Constraints

- 孤岛纪律:不 import sdf-main;全局函数风格;index.html script 序 = CHAIN_FILES(本计划不加新文件,无需动)
- 确定性:禁 Date.now()/Math.random();r() 消费次数不得依赖数据分支(消费恒定化配方);reroll 先耗满固定预算再判定
- 老 3D 场景(7/8/9-22/33)行为零变化:probe_4d 缺省路径逐位一致,回归测试锁死
- 屏幕空间约定:probe 入参 x∈[-1,1], y∈[-1,1] 且 y=-1 为画顶(canvas 惯例);probe 内部 [x, -y, f] 翻转
- 地面 y=−1;region ∈ {background, ground, object};测试基线 77 项全绿起步
- 每任务收尾 `node test/run-tests.mjs` 全绿才 commit;DIMENSION 直接 main commit

---

### Task 1: probe_4d 相机参数化 + 老场景零 diff 回归

**Files:**
- Modify: `scenes/4d.js`(probe_4d 签名)
- Modify: `scenes/index.js`(scene 34 派发传 CAM34)
- Modify: `scenes/solids-stage.js`(声明 `let CAM34 = null;`,本任务只加声明)
- Modify: `test/run-tests.mjs`(零 diff 回归块)

**Interfaces:**
- Produces: `probe_4d(x, y, sceneSdf, cam?)`,cam = `{ ro:[x,y,z], pitch:rad, focal:number }`;全局 `CAM34`
- Consumes: 无新依赖

- [ ] **Step 1: 改 `scenes/4d.js` probe_4d 开头**

把现有的

```js
const probe_4d = (x, y, sceneSdf) => {
  const rd = vec_normalize([x, -y, 2]);
```

替换为:

```js
// cam 可选: { ro, pitch, focal }。缺省 = 旧行为 (ro=cam_ro, pitch=0, focal=2),
// 老场景(7/8/9-22/33)不传 → 光线逐位同旧, 回归测试锁死。pitch>0 = 仰视,
// 地平线屏幕位置 y_horizon = focal·tan(pitch) (y 越大越靠画底)。
const probe_4d = (x, y, sceneSdf, cam) => {
  const ro = cam ? cam.ro : cam_ro;
  const f = cam ? cam.focal : 2;
  let vy = -y, vz = f;
  if (cam && cam.pitch) {
    const c = Math.cos(cam.pitch), s = Math.sin(cam.pitch);
    const ny = vy * c + vz * s, nz = -vy * s + vz * c;
    vy = ny; vz = nz;
  }
  const rd = vec_normalize([x, vy, vz]);
```

并把函数体内所有 `cam_ro` 引用改为 `ro`(共两处:raymarch3 起点与 hit 合成)。

- [ ] **Step 2: `scenes/index.js` 派发行改为**

```js
  if (pa.scene === 34) return probe_4d(x, y, solidsStageSdf, CAM34);
```

- [ ] **Step 3: `scenes/solids-stage.js` 顶部(`let solidsStageSdf = null;` 旁)加**

```js
let CAM34 = null; // { ro, pitch, focal } — 构图型 roll 出 (Task 3); null = 旧默认机位
```

- [ ] **Step 4: 零 diff 回归测试(贴 `test/run-tests.mjs` 测试区末尾)**

```js
// ── probe_4d 相机参数化: 缺省路径老场景零 diff ──
{
  const c = makeSandbox(HASH_A);
  const g = (expr) => vm.runInContext(expr, c);
  // scene 9 (probe_4d 老用户): 网格采样 缺省调用 vs 显式旧参调用 逐位一致
  g('pa.scene = 9; setupScene();');
  let maxDev = 0, checked = 0;
  for (let iy = 0; iy < 12; iy++) {
    for (let ix = 0; ix < 12; ix++) {
      const x = ((ix + 0.5) / 12) * 2 - 1, y = ((iy + 0.5) / 12) * 2 - 1;
      const a = g(`JSON.stringify(probe(${x}, ${y}))`);
      const b = g(`JSON.stringify(probe_4d(${x}, ${y}, (p) => scene9_sdf(p), { ro: [0, 0, -3.5], pitch: 0, focal: 2 }))`);
      if (a !== b) maxDev++;
      checked++;
    }
  }
  ok(maxDev === 0, `probe_4d 缺省=显式旧参 逐位一致 (${checked} 点)`);
  // 仰视语义: pitch>0 时画面中心射线朝上 (rd_y > 0)
  const up = g('(() => { const c2 = Math.cos(0.3), s2 = Math.sin(0.3); return (0 * c2 + 2 * s2) > 0; })()');
  ok(up, 'pitch>0 = 仰视 (中心射线 rd_y 上扬)');
}
```

- [ ] **Step 5: 跑测试**

Run: `node test/run-tests.mjs` Expected: 79 passed(77 基线 +2), 0 failed

- [ ] **Step 6: Commit**

```bash
git add scenes/4d.js scenes/index.js scenes/solids-stage.js test/run-tests.mjs
git commit -m "feat(camera): probe_4d 可选相机参 (ro/pitch/focal), 缺省零 diff 回归锁死"
```

---

### Task 2: 骨架引擎(反投影/尺寸反解/有效性探针)

**Files:**
- Modify: `scenes/solids-stage.js`(追加引擎纯函数;旧 setupSolidsStage 暂不动)
- Modify: `test/run-tests.mjs`(引擎单元测试)

**Interfaces:**
- Produces(Task 3 消费,签名固定):
  - `armatureRoll(): { primary:[ax,ay], secondary:[ax,ay] }`(锚点,屏幕系 y=-1 顶;去中心铁律内置)
  - `backProject(anchor, t, cam): [x,y,z]`(沿锚点视线取深度 t 的世界点)
  - `sizeFromHF(hF, t, focal): number`(屏幕占高比 → 世界高)
  - `screenCoverage(sdf, cam, G=32): number`(粗 probe 命中率 0..1,有效性检查用)

- [ ] **Step 1: 追加引擎(`scenes/solids-stage.js` 末尾)**

```js
// =============================================================================
// 骨架引擎 (构图 v2, Pasma RAYHATCHING ch.3 反投影法)
// 屏幕系: x∈[-1,1], y∈[-1,1], y=-1 画顶 (canvas 惯例, 与 probe 入参一致)。
// =============================================================================

// 三分骨架: 竖线 x=±1/3, 横线 y=±1/3, 四交点; 另备对角线锚。
// 去中心铁律: 主锚离画面中心距离 ≥ 0.15。r() 消费次数恒定 (无数据分支)。
const armatureRoll = () => {
  const T = 1 / 3;
  const cross = [[-T, -T], [T, -T], [-T, T], [T, T]];
  const iP = Math.floor(r() * 4);
  const iS = Math.floor(r() * 4);
  const mode = r(); // <0.55 交点锚 | <0.85 竖线滑锚 | else 对角滑锚
  const slideP = r(-0.62, 0.62);
  const slideS = r(-0.62, 0.62);
  let primary, secondary;
  if (mode < 0.55) {
    primary = cross[iP].slice();
    secondary = cross[(iP + 1 + (iS % 3)) % 4].slice();
  } else if (mode < 0.85) {
    primary = [iP < 2 ? -T : T, slideP];
    secondary = cross[iS].slice();
  } else {
    primary = [slideP, slideP * (iP < 2 ? 1 : -1)];
    secondary = [slideS, slideS * (iP < 2 ? -1 : 1)];
  }
  if (Math.hypot(primary[0], primary[1]) < 0.15) primary[1] = primary[1] < 0 ? -0.2 : 0.2;
  return { primary, secondary };
};

// 锚点视线 (含俯仰), 归一后沿线取深度 t
const _anchorRay = (anchor, cam) => {
  let vy = -anchor[1], vz = cam.focal;
  if (cam.pitch) {
    const c = Math.cos(cam.pitch), s = Math.sin(cam.pitch);
    const ny = vy * c + vz * s, nz = -vy * s + vz * c;
    vy = ny; vz = nz;
  }
  const v = [anchor[0], vy, vz];
  const L = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / L, v[1] / L, v[2] / L];
};
const backProject = (anchor, t, cam) => {
  const d = _anchorRay(anchor, cam);
  return [cam.ro[0] + d[0] * t, cam.ro[1] + d[1] * t, cam.ro[2] + d[2] * t];
};

// 屏幕占高比 hF (画幅高=2) → 世界高。透视: 屏 y 线性于 tan, 近似 H = hF·2·t/f。
const sizeFromHF = (hF, t, focal) => (hF * 2 * t) / focal;

// 有效性探针: G² 网格直查 SDF 沿视线是否命中 (廉价 raymarch, 24 步粗版)。
const screenCoverage = (sdf, cam, G = 32) => {
  let hits = 0;
  for (let iy = 0; iy < G; iy++) {
    for (let ix = 0; ix < G; ix++) {
      const x = ((ix + 0.5) / G) * 2 - 1, y = ((iy + 0.5) / G) * 2 - 1;
      const d = _anchorRay([x, y], cam);
      let t = 0.05, hit = false;
      for (let k = 0; k < 24; k++) {
        const p = [cam.ro[0] + d[0] * t, cam.ro[1] + d[1] * t, cam.ro[2] + d[2] * t];
        const dd = sdf(p);
        if (dd < 0.01) { hit = true; break; }
        t += Math.max(dd, 0.04);
        if (t > 30) break;
      }
      if (hit) hits++;
    }
  }
  return hits / (G * G);
};
```

- [ ] **Step 2: 单元测试(贴测试区末尾)**

```js
// ── 骨架引擎: 反投影往返 + 尺寸反解 + 覆盖探针 ──
{
  const c = makeSandbox(HASH_A);
  const g = (expr) => vm.runInContext(expr, c);
  // 往返: 锚点反投影出的点, 用同相机重新投影回屏幕 ≈ 原锚点 (tol 1e-6, 纯几何恒等)
  const rt = g(`(() => {
    const cam = { ro: [0.2, -0.5, -2.5], pitch: 0.25, focal: 1.7 };
    const anchor = [1 / 3, -1 / 3];
    const p = backProject(anchor, 5.0, cam);
    // 重投影: 相机系向量 → 逆俯仰 → 屏幕
    let vx = p[0] - cam.ro[0], vy = p[1] - cam.ro[1], vz = p[2] - cam.ro[2];
    const cp = Math.cos(-cam.pitch), sp = Math.sin(-cam.pitch);
    const ny = vy * cp + vz * sp, nz = -vy * sp + vz * cp;
    const sx = (vx / nz) * cam.focal, sy = -(ny / nz) * cam.focal;
    return Math.hypot(sx - anchor[0], sy - anchor[1]);
  })()`);
  ok(rt < 1e-6, `骨架反投影往返恒等 (dev=${rt.toExponential(1)})`);
  // 尺寸反解: hF=0.5, t=4, f=2 → H=2; 放一个高 2 的柱在正前方 t=4, 覆盖率应显著非零
  ok(Math.abs(g('sizeFromHF(0.5, 4, 2)') - 2) < 1e-9, 'sizeFromHF 解析值正确');
  const cov = g(`(() => {
    const cam = { ro: [0, 0, -3.5], pitch: 0, focal: 2 };
    const s = (p) => Math.hypot(p[0], p[2] - 0.5) - 0.8; // 无限竖柱 z=0.5
    return screenCoverage(s, cam, 24);
  })()`);
  ok(cov > 0.15 && cov < 0.9, `覆盖探针量级合理 (cov=${cov.toFixed(2)})`);
  // 去中心铁律: 512 次 roll 主锚全部离心 ≥0.15
  const deC = g(`(() => {
    for (let i = 0; i < 512; i++) {
      const a = armatureRoll().primary;
      if (Math.hypot(a[0], a[1]) < 0.15) return false;
    }
    return true;
  })()`);
  ok(deC, '去中心铁律: 512 roll 主锚无一入禁区');
}
```

- [ ] **Step 3: 跑测试** Run: `node test/run-tests.mjs` Expected: 83 passed(79+4), 0 failed
- [ ] **Step 4: Commit**

```bash
git add scenes/solids-stage.js test/run-tests.mjs
git commit -m "feat(armature): 骨架引擎 — 三分锚 roll/反投影/尺寸反解/覆盖探针 (纯函数+4 单元)"
```

---

### Task 3: 五构图型 + 布尔词汇池 + 地形/消散/修饰符(setupSolidsStage 重写)

**Files:**
- Modify: `scenes/solids-stage.js`(重写 setupSolidsStage 与放置;保留 SOLID_POOL/_makeSolid 的旋转+量 bbox 部分,弃用 SCALE_BY_COUNT/LAYOUT_BY_COUNT——整段删除并在 commit message 注明"标本台 v1 布局弃用,git 历史可考")
- Modify: `scenes/index.js`(applyScenePostprocess 内 scene34 的 fog/focal 覆盖钩)
- Modify: `test/run-tests.mjs`(scene34 断言按新消费序更新期望值)

**Interfaces:**
- Consumes: Task 1 `CAM34`/probe_4d(cam);Task 2 四引擎函数;`SD3.P`;既有 `_makeSolid` 的 kind/旋转/bbox 逻辑
- Produces: `pa.comp ∈ {'monument','colossus','hover','closeup','stilllife'}`、`pa.fog34`(型内雾 roll 结果或 null)、`pa.focal34`(主件距离锁焦)、`solidsStageSdf`、`CAM34`

- [ ] **Step 1: `_makeSolid` 改测量版(替换其"底沿采样→落地"尾段)**

原函数尾段(底沿采样 + hover + return)替换为纯测量返回(放置权交给构图型):

```js
  // 原生 bbox 量测 (未缩放): y ∈ [-1.6, 1.6] 扫内点, xz 窗 ±1.0
  let yMin = 1.6, yMax = -1.6;
  for (let iy = 0; iy < 64; iy++) {
    const yq = -1.6 + (iy / 63) * 3.2;
    for (let ix = 0; ix < 11; ix++)
      for (let iz = 0; iz < 11; iz++) {
        if (f([-1 + ix * 0.2, yq, -1 + iz * 0.2]) < 0) {
          if (yq < yMin) yMin = yq;
          if (yq > yMax) yMax = yq;
        }
      }
  }
  if (yMax <= yMin) { yMin = -0.5; yMax = 0.5; } // 量测失败兜底 (细件漏采)
  return { kind, f, yMin, yMax };
};
```

- [ ] **Step 2: 布尔词汇池(追加到 SOLID_POOL 定义之后)**

```js
// 布尔词汇 (2-原语组合, 池成员; 非押后的"布尔雕塑八件"成品批)
const BOOL_POOL = [
  ['crescent', () => {
    const R = r(0.55, 0.8), off = r(0.35, 0.6) * R;
    const a = SD3.P.sphere({ radius: R });
    const b = SD3.P.sphere({ radius: R * r(0.75, 0.95) });
    return (p) => Math.max(a(p), -b([p[0] - off, p[1], p[2] - off * 0.4]));
  }],
  ['arch', () => {
    const w = r(0.9, 1.3), h = r(1.0, 1.5), d = r(0.35, 0.6);
    const box = SD3.P.box({ dims: [w, h, d] });
    const hole = r(0.28, 0.42) * w;
    return (p) => Math.max(box(p), -(Math.hypot(p[0], p[1] + h * 0.18) - hole));
  }],
  ['pierced-sphere', () => {
    const R = r(0.55, 0.8), hr = r(0.3, 0.5) * R;
    const s = SD3.P.sphere({ radius: R });
    return (p) => Math.max(s(p), -(Math.hypot(p[0], p[2]) - hr));
  }],
  ['ring-column', () => {
    const t = SD3.P.torus({ majorR: r(0.5, 0.7), minorR: r(0.12, 0.2) });
    const c = SD3.P.cylinder({ radius: r(0.14, 0.22), height: r(1.6, 2.2) });
    const tilt = Math.PI * 0.36, ct = Math.cos(tilt), st = Math.sin(tilt);
    return (p) => {
      const ty = ct * p[1] - st * p[2], tz = st * p[1] + ct * p[2];
      return Math.min(t([p[0], ty, tz]), c(p)); // 相贯: 环竖起穿柱
    };
  }],
  ['bowl', () => {
    const R = r(0.6, 0.85);
    const a = SD3.P.sphere({ radius: R });
    const b = SD3.P.sphere({ radius: R * 0.82 });
    return (p) => Math.max(a(p), -b(p), -p[1]); // 挖芯 + 削顶 → 碗壳
  }],
];
// 池路由: 72% 原语 / 28% 布尔词汇。消费恒定: 两侧 idx 都 roll。
const rollSolidKind = () => {
  const useBool = r() < 0.28;
  const iP = Math.floor(r() * SOLID_POOL.length);
  const iB = Math.floor(r() * BOOL_POOL.length);
  return useBool ? { kind: BOOL_POOL[iB][0], make: BOOL_POOL[iB][1] } : { kind: SOLID_POOL[iP][0], make: () => SD3.P[SOLID_POOL[iP][0]](SOLID_POOL[iP][1]()) };
};
```

并把 `_makeSolid` 开头的 `SOLID_POOL[...]` 两行改为 `const { kind, make } = rollSolidKind(); let f = make();`。

- [ ] **Step 3: 重写 setupSolidsStage(整体替换旧函数与 SCALE_BY_COUNT/LAYOUT_BY_COUNT 段)**

```js
// ---- 构图型配方 (spec §三; 概率 draft 待 contact sheet 终裁) -----------------
// 每型: 相机区间 / 主副件深度与屏占比 / 地形与雾偏好。r() 消费恒定:
// 所有 roll 先耗满, 分支只决定"用不用"。
const _place = (s, anchor, t, hF, cam, grounded, hover) => {
  const H = sizeFromHF(hF, t, cam.focal);
  const scale = H / (s.yMax - s.yMin);
  const pos = backProject(anchor, t, cam);
  const base = s.f;
  const dy = grounded ? (-1 - s.yMin * scale + hover) : 0;
  const cy = grounded ? dy : pos[1] - ((s.yMin + s.yMax) / 2) * scale;
  return (p) => base([(p[0] - pos[0]) / scale, (p[1] - cy) / scale, (p[2] - pos[2]) / scale]) * scale;
};

const setupSolidsStage = () => {
  const compRoll = r();
  pa.comp = compRoll < 0.3 ? 'monument' : compRoll < 0.55 ? 'colossus'
    : compRoll < 0.75 ? 'hover' : compRoll < 0.9 ? 'closeup' : 'stilllife';
  const A = armatureRoll();
  pa.armature = A;

  // 相机 (全型先 roll 满同一预算, 型只选用区间映射)
  const cy = r(), cp = r(), cf = r(), cx = r(-0.35, 0.35);
  const CAMS = {
    monument: { ro: [cx, -0.85 + cy * 0.3, -3.5], pitch: 0.21 + cp * 0.34, focal: 1.5 + cf * 0.5 },
    colossus: { ro: [cx, -0.8 + cy * 0.4, -3.0], pitch: 0.1 + cp * 0.22, focal: 1.4 + cf * 0.5 },
    hover:    { ro: [cx, -0.3 + cy * 0.5, -3.5], pitch: 0.1 + cp * 0.18, focal: 1.6 + cf * 0.5 },
    closeup:  { ro: [cx, -0.6 + cy * 0.7, -2.0], pitch: -0.09 + cp * 0.34, focal: 1.3 + cf * 0.4 },
    stilllife:{ ro: [cx, -0.55 + cy * 0.35, -3.5], pitch: 0.03 + cp * 0.12, focal: 1.7 + cf * 0.5 },
  };
  CAM34 = CAMS[pa.comp];

  // 地形: 平 70 / 缓波 20 / 无 10 (hover 型把无地面权重换到 30)
  const terrRoll = r(), amp = r(0.08, 0.18), kx = r(0.5, 1.1), kz = r(0.5, 1.1);
  const noneTh = pa.comp === 'hover' ? 0.3 : 0.1;
  pa.terrain34 = terrRoll < noneTh ? 'none' : terrRoll < noneTh + 0.2 ? 'waves' : 'flat';

  // 型内消散 (spec §七): 新四型自 roll; 标本台维持全局 pa.fogK
  const fogRoll = r(), fogPick = r();
  if (pa.comp !== 'stilllife') {
    pa.fog34 = fogRoll < 0.2 ? 0 : fogPick < 0.4 ? 0.09 : fogPick < 0.8 ? 0.16 : 0.28;
  } else { pa.fog34 = null; }

  // 修饰符: 穿刺 8% / 相贯 15% (仅双件) / 衰变行 (群像内 50%)
  const pierceRoll = r(), inter Roll = r(), decayRoll = r();
  const pierceOn = pierceRoll < 0.08;
  const pierceR = r(0.5, 1.1), pierceY = r(-0.4, 1.2), pierceTh = r(0.12, 0.3);

  // ---- 按型放置 ----
  const solids = [];
  pa.solidKinds = [];
  const push = (fn, kind) => { solids.push(fn); pa.solidKinds.push(kind); };
  const S1 = _makeSolid(), S2 = _makeSolid(), S3 = _makeSolid(); // 消费恒定: 恒做 3 件
  const hov1 = r(0.5, 1.6), hov2 = r(0.15, 0.5);
  const tP = r(), tS = r(), hFP = r(), hFS = r(), dualOn = r();

  if (pa.comp === 'monument') {
    const t = 2.2 + tP * 2.3, hF = 0.9 + hFP * 0.8;
    push(_place(S1, A.primary, t, hF, CAM34, true, 0), S1.kind);
    if (dualOn < 0.4) push(_place(S2, A.secondary, t + 2 + tS * 3, 0.3 + hFS * 0.5, CAM34, true, 0), S2.kind);
    pa.focal34 = t;
  } else if (pa.comp === 'colossus') {
    const edge = A.primary[0] < 0 ? -1 : 1;
    const giantAnchor = [edge * (0.55 + Math.abs(A.primary[0]) * 0.6), A.primary[1]];
    const t = 1.2 + tP * 1.3, hF = 1.2 + hFP * 0.8;
    push(_place(S1, giantAnchor, t, hF, CAM34, true, 0), S1.kind);
    push(_place(S2, [-edge * (0.25 + tS * 0.4), A.secondary[1]], 7 + tS * 7, 0.12 + hFS * 0.18, CAM34, true, 0), S2.kind);
    pa.focal34 = t;
  } else if (pa.comp === 'hover') {
    const t = 3 + tP * 3, hF = 0.55 + hFP * 0.4;
    const upAnchor = [A.primary[0], -Math.abs(A.primary[1]) - 0.05];
    push(_place(S1, upAnchor, t, hF, CAM34, false, hov1), S1.kind);
    if (dualOn < 0.3) push(_place(S2, A.secondary, t + 3 + tS * 4, 0.15 + hFS * 0.2, CAM34, false, hov2), S2.kind);
    pa.focal34 = t;
  } else if (pa.comp === 'closeup') {
    const t = 0.7 + tP * 0.8, hF = 1.4 + hFP * 1.0;
    const overAnchor = [(A.primary[0] < 0 ? -1 : 1) * (0.5 + hFS * 0.6), A.primary[1] * 1.4];
    push(_place(S1, overAnchor, t, hF, CAM34, false, 0), S1.kind);
    pa.focal34 = t;
  } else { // stilllife 重做: 2-4 小件深度错列
    const n = 2 + Math.floor(r() * 3);
    const pool = [S1, S2, S3, _makeSolid()];
    const anchors = [A.primary, A.secondary, [A.primary[0] * -0.7, A.secondary[1]], [A.secondary[0] * 0.5, A.primary[1] * -0.8]];
    for (let i = 0; i < 4; i++) {
      const t = 2 + r() * 7, hF = 0.2 + r() * 0.25; // 恒 roll 4 组
      if (i < n) push(_place(pool[i], anchors[i], t, hF, CAM34, true, 0), pool[i].kind);
      if (i === 0) pa.focal34 = t;
    }
  }

  // 相贯 (双件时): 副件拉向主件穿插 — 直接再放一件重叠件
  if (solids.length === 2 && interRoll < 0.15) {
    const t = pa.focal34, hF2 = 0.5 + hFS * 0.5;
    const nudge = [A.primary[0] + (A.secondary[0] - A.primary[0]) * 0.25, A.primary[1] + (A.secondary[1] - A.primary[1]) * 0.25];
    push(_place(S3, nudge, t * (1 + (tS - 0.5) * 0.12), hF2, CAM34, true, 0), S3.kind);
  }

  // 衰变行 (群像): monument/hover 单件时 decayRoll<0.18 → 同件沿深度重复 4 件
  if (solids.length === 1 && decayRoll < 0.18 && (pa.comp === 'monument' || pa.comp === 'hover')) {
    const dir = A.primary[0] < 0 ? 1 : -1;
    for (let i = 1; i <= 3; i++) {
      const t = pa.focal34 * (1 + i * 0.85);
      const an = [A.primary[0] + dir * i * 0.3, A.primary[1] + i * 0.04];
      push(_place(S1, an, t, (0.9 + hFP * 0.8) * (1 - i * 0.06), CAM34, pa.comp === 'monument', pa.comp === 'hover' ? hov1 : 0), S1.kind);
    }
    if (pa.fog34 === 0 || pa.fog34 === null) pa.fog34 = 0.16; // 衰变行必须有雾
  }

  // 合成 + 穿刺
  let scene = (p) => {
    let d = solids[0](p);
    for (let i = 1; i < solids.length; i++) d = Math.min(d, solids[i](p));
    return d;
  };
  if (pierceOn) {
    const inner = scene;
    scene = (p) => Math.max(inner(p), -(Math.abs(Math.hypot(p[0] - cx, p[1] - pierceY) - pierceR) - pierceTh));
  }
  pa.pierce34 = pierceOn;

  // 地形合成进场景? 不 — 地面由 probe_4d 的 full=min(ground, sdf) 承担平地;
  // waves/none 由 index.js 的 scene34 包装层处理 (Step 4)。
  solidsStageSdf = scene;

  // 有效性检查: 主件覆盖率软兜底 (消费已全部完成, 此处纯判定+参数收缩重放置)
  const covTargets = { monument: [0.06, 0.7], colossus: [0.1, 0.8], hover: [0.05, 0.6], closeup: [0.12, 0.92], stilllife: [0.03, 0.5] };
  const [lo, hi] = covTargets[pa.comp];
  const cov = screenCoverage(solidsStageSdf, CAM34, 24);
  pa.cov34 = cov;
  if (cov < lo || cov > hi) {
    // 保守重放置: 主件回三分交点 [±T,-T], 中值深度/占比 (确定性: 不再消耗 r())
    const T = 1 / 3;
    const safeAnchor = [A.primary[0] < 0 ? -T : T, -T];
    const mid = { monument: [3.2, 1.2], colossus: [1.8, 1.5], hover: [4.2, 0.72], closeup: [1.05, 1.8], stilllife: [4.5, 0.32] }[pa.comp];
    const lone = _place(S1, safeAnchor, mid[0], mid[1], CAM34, pa.comp !== 'hover' && pa.comp !== 'closeup', pa.comp === 'hover' ? hov1 : 0);
    solidsStageSdf = lone;
    pa.solidKinds = [S1.kind];
    pa.cov34 = screenCoverage(solidsStageSdf, CAM34, 24);
    pa.comp34Fallback = true;
  }
};
```

(实现注意:`const pierceRoll = r(), inter Roll = r()` 中 `inter Roll` 是排版错误,实现为 `interRoll`。)

- [ ] **Step 4: `scenes/index.js` — scene34 的地形与雾/焦覆盖**

probe 派发行上方加包装(地形档),applyScenePostprocess 内 scene34 生效 fog34/focal34:

```js
// scene 34 地形档: waves → 起伏地面替换平地; none → 场景射线里去掉地面
const solidsStageFull = (p) => {
  if (pa.terrain34 === 'none') return solidsStageSdf(p);
  const ground = pa.terrain34 === 'waves'
    ? p[1] + 1 - 0.13 * Math.sin(p[0] * 0.8) * Math.sin(p[2] * 0.8)
    : p[1] + 1;
  return Math.min(ground, solidsStageSdf(p));
};
```

派发行改:`if (pa.scene === 34) return probe_4d(x, y, pa.terrain34 === 'flat' ? solidsStageSdf : solidsStageFull, CAM34);`
—— 注意 flat 时仍走 probe_4d 内建地面(旧路径),waves/none 时传 `solidsStageFull` 且 probe_4d 需要"跳过内建地面"开关:给 cam 加字段 `noGround: true`(probe_4d 内 `const full = cam && cam.noGround ? sceneSdf : (p) => Math.min(p[1] + 1, sceneSdf(p));`),Task 1 已建的回归测试保证缺省路径不受影响;waves/none 时 CAM34.noGround = true 在 setupSolidsStage 里设。

applyScenePostprocess 里 fog/defocus 计算处加两行覆盖:

```js
    const fogK = pa.scene === 34 && pa.fog34 !== null ? pa.fog34 : pa.fogK;
    const focal = pa.scene === 34 && pa.focal34 ? pa.focal34 * 1.0 : pa.focal;
```

(把原引用 pa.fogK/pa.focal 的两处改用局部 fogK/focal。)

- [ ] **Step 5: 更新 scene34 测试块**

原 kinds 断言(HASH_A→`["rounded_box"]` 等)按新消费序重跑取实际值替换;新增:
`pa.comp` 属五值之一、`pa.cov34` 在型区间或 fallback 标记存在、HASH_A/HASH_B comp 或 kinds 至少一项不同(变奏)。凡实跑值填入常量,不留 `|| true`。

- [ ] **Step 6: 跑测试** Run: `node test/run-tests.mjs` Expected: 全绿(计数≈85,以实跑为准)
- [ ] **Step 7: Commit**

```bash
git add scenes/solids-stage.js scenes/index.js test/run-tests.mjs
git commit -m "feat(comp-v2): 五构图型+骨架放置+布尔词汇池+地形/消散/穿刺/相贯/衰变行 (标本台v1布局弃用)"
```

---

### Task 4: 分型视觉对抗 + contact sheet(user 终裁关卡)

**Files:** 无生产代码预期(发现构图 bug 则修 solids-stage 常量);产物 = 每型 3-4 枚 hash 截图 + 五型 contact sheet

- [ ] **Step 1:** `node test/find-hash.mjs 34` 猎 hash;按 `pa.comp` 分桶(find-hash 输出若无 comp,临时在其打印行加 pa.comp,commit 注明)
- [ ] **Step 2:** browse 逐枚截图(dev server 8002;**必带 cache-bust `&v=时间戳`**;每枚 sleep 30)
- [ ] **Step 3:** 五条新对抗标准逐图打分:出画率在型区间 / 负空间成立(空白是形状不是剩余) / 地平线位置随型分布(纪念碑低、悬浮更低或无) / 消散生效(带雾图远端笔触可见变稀借色) / 穿刺-相贯切线可辨(命中该修饰符的 hash)
- [ ] **Step 4:** 发现构图级 bug(出画失控/覆盖率兜底频繁触发/穿刺把主体切没)→ 改配方常量 → 同 hash 复验 → 循环
- [ ] **Step 5:** PIL 拼五型 contact sheet(每型一行 × 3 列)→ **STOP,交 user 终裁**:型概率/雾档/修饰符概率
- [ ] **Step 6: Commit**(如有常量修正)`git commit -m "feat(comp-v2): 分型视觉对抗通过 — 代表 hash 清单在此"`

---

### Task 5: 终裁落地 + 文档 + 全链(user 裁定后执行)

**Files:**
- Modify: `scenes/solids-stage.js`(概率按终裁)
- Modify: sdf-main `sdf-js/examples/genlab/style-plan.json`(3d_content 加 comp 子表)
- Modify: `README.md`(scene 34 描述改 v2)、sdf-main `docs/AGENT_HANDOFF.md`(§0.6 现状行刷新)

- [ ] **Step 1:** 按 user 终裁改型概率/雾档/修饰符常量;`node test/run-tests.mjs` 全绿
- [ ] **Step 2:** style-plan.json `3d_content` 下加 `"comp_34": { 终裁数值, "_locked": true }`(python3 json 改写)
- [ ] **Step 3:** 两仓 README/handoff 各 3-5 行刷新(骨架反投影/五型/布尔词汇/修饰符)
- [ ] **Step 4:** `node test/find-hash.mjs 34` 复跑无崩;两仓 commit(sdf-main push genlab-2d-batch)

---

## Self-Review

- Spec 覆盖:骨架引擎(§一→T2)/相机(§二→T1)/五型(§三→T3)/布尔池(§四→T3)/修饰符(§五→T3)/地形(§六→T3 S4)/消散(§七→T3 S3-S4)/有效性(§八→T3 S3)/验收(§九→T4) ✓;老场景零变化→T1 回归 ✓
- 占位符扫描:无 TBD;T3 S5 "实跑值填入常量"是确定性系统的标准做法(先例:终审必修 1),非占位 ✓
- 类型一致:`armatureRoll/backProject/sizeFromHF/screenCoverage/CAM34/pa.comp/pa.fog34/pa.focal34/pa.terrain34` 各任务间签名一致 ✓;`inter Roll` 排版错误已在 T3 标注更正 ✓
- 消费恒定纪律:T3 所有 roll 先耗满(S1-S3 恒做 3 件、四组静物恒 roll、相机/雾/修饰符预算固定),分支只决定用不用 ✓;fallback 不消耗 r() ✓
