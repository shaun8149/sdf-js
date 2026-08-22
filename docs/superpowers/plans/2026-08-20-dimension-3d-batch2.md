# DIMENSION 3D batch2(布尔雕塑档 + 两张硬票)实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 判决实验定位像素漂移病灶层;set_features 补 6 个艺术语义 traits;雕塑档八件进构图 v2 池(独立 20% 权重,逐件全套对抗)。

**Architecture:** spec 见 `docs/superpowers/specs/2026-08-20-dimension-3d-batch2-design.md`。雕塑件 = SCULPT_POOL 纯函数,走既有 `_makeSolid` 量测/旋转管线与五型构图,零新基建;判决实验 = dev-only 落笔 checksum 钩 + 浏览器矩阵采样;traits = set_features 调用点扩 6 键(仅 scene 34)。

**Tech Stack:** DIMENSION 孤岛 + vm 沙箱测试(基线 104)+ 真 Chrome/browse 截图。

## Global Constraints

- 消费恒定:r() 先耗满再分支;判决钩与 traits 键**零 r() 消费**;dev 参数(?cksum= ?sculpt=)默认关闭时行为零变化
- 孤岛纪律:不 import sdf-main;CHAIN_FILES 三处同步(本计划不加链上新文件;test/ 下新脚本不进 CHAIN_FILES)
- 老场景(≠34)features/渲染零变化;DIMENSION 直接 main commit;sdf-main 附属走 genlab-3d-batch2 分支
- 每任务收尾 `node test/run-tests.mjs` 全绿才 commit

---

### Task 1: 判决实验(落笔 checksum 定位病灶层)

**Files:**
- Modify: `sketch.js`(dev-only FNV 钩,~12 行)
- Create: `test/verify-determinism.mjs`(浏览器矩阵采样 harness)
- Modify: `test/run-tests.mjs`(钩零消费/默认关闭断言)

**Interfaces:**
- Produces: `window.__strokeChecksum`(?cksum=1 时);`node test/verify-determinism.mjs <hash> <scene> <runs>` → 每次导航的 {checksum, pixelDigest} 矩阵
- Consumes: 现有 drawSegment/drawPoisson 落笔循环

- [ ] **Step 1: sketch.js 钩(drawSegment 的 drawShape 调用前、drawPoisson 落点前各一处)**

```js
// dev-only 判决实验钩 (?cksum=1): 落笔参数卷进 FNV-1a — 与渲染零耦合、零 r() 消费。
// 文件顶部工具区:
let __ck = 0;
const __ckAdd = (a, b, c, d2, e2) => {
  let h = __ck ^ 0x811c9dc5;
  for (const v of [a, b, c, d2, e2]) {
    // 量化到 1e-6 网格再哈希 (排除打印格式噪声, 保留数值差异)
    let x = Math.round(v * 1e6) >>> 0;
    for (let i = 0; i < 4; i++) { h ^= (x & 255); h = (h * 0x01000193) >>> 0; x >>>= 8; }
  }
  __ck = h >>> 0;
};
const __ckOn = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('cksum') === '1';

// drawSegment 内层循环 drawShape(...) 调用前:
      if (__ckOn) __ckAdd(e.x + xoffset + xshift, e.y + yoffset + yshift, e.cellSize, e.colorBase + index, index);

// drawPoisson 落点绘制前 (同样五元: x, y, size, 色索引, 序号 — 按该函数实际变量名取):
      if (__ckOn) __ckAdd(/* 对应五元 */);

// drawOnce 渲染全部完成处 (现有 render_done/$renderOK 触发点旁):
  if (__ckOn) window.__strokeChecksum = __ck >>> 0;
```

- [ ] **Step 2: harness `test/verify-determinism.mjs`**

```js
// 用法: node test/verify-determinism.mjs 0x<hash> <scene> <runs=5>
// 每次全新 headless Chrome (独立 user-data-dir + cache-bust) 导航,
// 收 window.__strokeChecksum + canvas.toDataURL 的 sha256 前 16 位, 打印矩阵与判决。
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const [hash, scene = '34', runs = '5'] = process.argv.slice(2);
if (!hash) { console.error('need hash'); process.exit(1); }
const rows = [];
for (let i = 0; i < +runs; i++) {
  const prof = mkdtempSync(join(tmpdir(), 'vd-'));
  const url = `http://localhost:8002/index.html?scene=${scene}&hash=${hash}&cksum=1&v=${i}`;
  // --dump-dom 前用 virtual-time 等渲染完; 页面侧把结果写进 document.title 便于抓取
  const dom = execFileSync(CHROME, [
    '--headless=new', '--disable-extensions', '--mute-audio',
    `--user-data-dir=${prof}`, '--virtual-time-budget=120000', '--dump-dom', url,
  ], { maxBuffer: 64 * 1024 * 1024 }).toString();
  rmSync(prof, { recursive: true, force: true });
  const ck = (dom.match(/__CK:([0-9a-fx]+)/) || [])[1] ?? 'MISS';
  const px = (dom.match(/__PX:([0-9a-f]{16})/) || [])[1] ?? 'MISS';
  rows.push({ run: i, checksum: ck, pixel: px });
  console.log(`run ${i}: ck=${ck} px=${px}`);
}
const cks = new Set(rows.map((r) => r.checksum));
const pxs = new Set(rows.map((r) => r.pixel));
console.log(`\n判决: checksum ${cks.size === 1 ? '全同' : `${cks.size} 种`} / pixel ${pxs.size === 1 ? '全同' : `${pxs.size} 种`}`);
console.log(cks.size === 1 && pxs.size > 1 ? '→ 病灶在 canvas 光栅器 (JS 无罪)'
  : cks.size > 1 ? '→ JS 侧仍有残余 (顺 checksum 分歧定位)'
  : '→ 本组样本双稳定');
```

页面侧配套:`sketch.js` 的 `__ckOn` 完成处再加两行,把结果写进 `document.title`(dump-dom 可抓):
`document.title = '__CK:' + window.__strokeChecksum.toString(16) + ' __PX:' + sha16(canvas.toDataURL())`
—— sha16 用 SubtleCrypto 或简易 FNV 卷字符串成 16 hex(dev-only,实现者任选,写报告)。

- [ ] **Step 3: 零变化断言(run-tests.mjs)**:vm 沙箱(无 window.location.search 的 cksum)下 `__ckOn === false`;grep 断言钩不含 `r(`。
- [ ] **Step 4: 跑矩阵**:三场景(34 已知漂 hash、30 before 已知细线漂 hash——从 comp-v2 台账/R3 报告取,poisson 对照)× 5 次;判决写入 `test/judgment-report.md`(进 DIMENSION git)。
- [ ] **Step 5: 台账重排**:按判决在 SDD 台账记"fround/定点化 作废|保留"结论。
- [ ] **Step 6:** `node test/run-tests.mjs` 全绿(104+新增);commit(DIMENSION)。

---

### Task 2: set_features 艺术语义 6 键

**Files:**
- Modify: set_features 调用点(grep `set_features` 定位,预计 sketch.js)
- Modify: `test/run-tests.mjs`

**Interfaces:**
- Consumes: `pa.comp / pa.pal3d(.src) / pa.solidKinds / pa.pierce34 / pa.terrain34 / pa.fog34`(构图 v2 已产)
- Produces: scene 34 的 features 增 `Composition/Palette/Forms/Modifier/Terrain/Depth` 6 键(spec §二 值域表);其余场景键集不变

- [ ] **Step 1:** 调用点加 scene 34 分支(纯读 pa,零 r() 消费):

```js
  // scene 34 艺术语义 traits (spec 2026-08-20 §二; 内部参数不暴露)
  if (pa.scene === 34) {
    const compName = { monument: 'Monument', colossus: 'Colossus', hover: 'Hover', closeup: 'Closeup', stilllife: 'Still Life' };
    const mods = [pa.pierce34 && 'Pierce', pa.intersect34 && 'Intersect', pa.decayRow34 && 'Decay Row'].filter(Boolean);
    Object.assign(features, {
      Composition: compName[pa.comp] ?? pa.comp,
      Palette: pa.pal3d ? pa.pal3d.src : 'unknown',
      Forms: (pa.solidKinds ?? []).join('+'),
      Modifier: mods.length ? mods.join('+') : 'None',
      Terrain: { flat: 'Flat', waves: 'Waves', none: 'Void' }[pa.terrain34] ?? 'Flat',
      Depth: pa.fog34 === 0 || pa.fog34 === null ? 'Clear' : pa.fog34 >= 0.28 ? 'Deep' : 'Soft',
    });
  }
```

注意:`pa.intersect34/pa.decayRow34` 若构图 v2 未记录(只 pierce34 有),先在 setupSolidsStage 对应分支补两行 `pa.intersect34 = ...` / `pa.decayRow34 = ...`(纯赋值零消费,与 pierce34 同法含兜底重置)。

- [ ] **Step 2: 测试**:HASH_A/B 各断言 6 键存在且值域合法;非 34 场景断言无这些键;实跑值入常量。
- [ ] **Step 3:** 全绿 commit。

---

### Task 3: 雕塑档八件(SCULPT_POOL + 三分路由)

**Files:**
- Modify: `scenes/solids-stage.js`(SCULPT_POOL + rollPrimaryKind + ?sculpt= dev 口)
- Modify: `test/run-tests.mjs`(八件符号测试 + kinds 期望更新)

**Interfaces:**
- Consumes: `SD3.P`、`_makeSolid` 管线、`r()`
- Produces: `SCULPT_POOL: [name, () => (p)=>d][]` 八件;主件三分路由(原语 .55/布尔 .25/雕塑 .20);`pa.solidKinds` 含雕塑名;dev `?sculpt=<name>` 强制主件(记 `pa.sculptForced`)

- [ ] **Step 1: SCULPT_POOL(贴 BOOL_POOL 之后)**

```js
// 雕塑档 (spec §三, user 圈定八件): 每件纯函数, 走 _makeSolid 同一量测/旋转/落地管线。
const SCULPT_POOL = [
  ['steinmetz', () => {
    const R = r(0.5, 0.75);
    return (p) => Math.max(
      Math.hypot(p[1], p[2]) - R,
      Math.hypot(p[0], p[2]) - R,
      Math.hypot(p[0], p[1]) - R,
    );
  }],
  ['cube-pierced-sphere', () => {
    const R = r(0.6, 0.85), w = R * r(0.34, 0.46);
    const s = SD3.P.sphere({ radius: R });
    return (p) => Math.max(
      s(p),
      -(Math.max(Math.abs(p[1]), Math.abs(p[2])) - w),
      -(Math.max(Math.abs(p[0]), Math.abs(p[2])) - w),
      -(Math.max(Math.abs(p[0]), Math.abs(p[1])) - w),
    );
  }],
  ['ruin-dome', () => {
    const R = r(0.75, 1.0), t = R * r(0.06, 0.1);
    const colR = R * r(0.1, 0.16), colH = R * r(0.55, 0.8);
    const orbR = R * r(0.18, 0.28);
    const col = SD3.P.cylinder({ radius: colR, height: colH });
    return (p) => {
      const shell = Math.max(Math.abs(Math.hypot(p[0], p[1], p[2]) - R) - t, -p[1]);
      const column = col([p[0] + R * 0.35, p[1] - colH / 2, p[2]]);
      const orb = Math.hypot(p[0] - R * 0.3, p[1] - orbR, p[2]) - orbR;
      return Math.min(shell, column, orb);
    };
  }],
  ['caged-orb', () => {
    const S = r(1.0, 1.4);
    const wf = SD3.P.wireframe_box({ dims: [S, S, S], edgeR: S * r(0.03, 0.05) });
    const orb = SD3.P.sphere({ radius: S * r(0.3, 0.4) });
    return (p) => Math.min(wf(p), orb(p));
  }],
  ['death-star', () => {
    const R = r(0.6, 0.85), Rc = R * r(0.55, 0.75), off = R * r(0.85, 1.05);
    return (p) => Math.max(
      Math.hypot(p[0], p[1], p[2]) - R,
      -(Math.hypot(p[0] - off * 0.7, p[1] - off * 0.5, p[2]) - Rc),
    );
  }],
  ['arcade', () => {
    const D = r(0.9, 1.2);
    const w = r(0.34, 0.44), h = r(0.7, 0.95), d = r(0.16, 0.24);
    const hole = w * r(0.55, 0.7);
    const sector = Math.PI / 3; // 6 份
    return (p) => {
      const a = Math.atan2(p[2], p[0]);
      const rr = Math.hypot(p[0], p[2]);
      const an = ((a % sector) + sector) % sector - sector / 2;
      const lx = rr * Math.cos(an) - D, lz = rr * Math.sin(an);
      const qx = Math.abs(lx) - w / 2, qy = Math.abs(p[1]) - h / 2, qz = Math.abs(lz) - d / 2;
      const box = Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0);
      const tunnel = Math.hypot(lx, p[1] + h * 0.18) - hole / 2;
      return Math.max(box, -tunnel);
    };
  }],
  ['bitten-apple', () => {
    const R = r(0.6, 0.8);
    const bite = R * r(0.5, 0.65), boff = R * r(1.0, 1.15);
    const leaf = SD3.P.ellipsoid({ dims: [R * 0.3, R * 0.1, R * 0.14] });
    return (p) => {
      const body = Math.hypot(p[0], p[1], p[2]) - R;
      const biteS = Math.hypot(p[0] - boff, p[1] - R * 0.3, p[2]) - bite;
      const dip = Math.hypot(p[0], p[1] - R * 1.02, p[2]) - R * 0.32;
      const lf = leaf([p[0] - R * 0.16, p[1] - R * 1.06, p[2]]);
      return Math.min(Math.max(body, -biteS, -dip), lf);
    };
  }],
  ['hourglass', () => {
    const H = r(0.9, 1.2), R = H * r(0.32, 0.42);
    const cone = SD3.P.cone({ height: H / 2, baseRadius: R }); // 局部: 底在 -H/4, 尖在 +H/4
    const plate = SD3.P.cylinder({ radius: R * 1.12, height: H * 0.045 });
    return (p) => {
      const up = cone([p[0], H / 4 - p[1], p[2]]);   // 上碗: 底 y=+H/2, 尖 y=0 (反射映射)
      const dn = cone([p[0], p[1] + H / 4, p[2]]);   // 下碗: 底 y=-H/2, 尖 y=0
      const pT = plate([p[0], p[1] - H / 2, p[2]]);
      const pB = plate([p[0], p[1] + H / 2, p[2]]);
      return Math.min(up, dn, pT, pB);
    };
  }],
];
```

- [ ] **Step 2: 三分路由(替换主件的 rollSolidKind 用法)**

```js
// 主件三分池 (spec §三 draft: 原语 .55 / 布尔 .25 / 雕塑 .20; sheet 后终裁)。
// 消费恒定: route + 三路索引恒 roll。副件沿用既有两分 rollSolidKind。
const rollPrimaryKind = () => {
  const route = r();
  const iP = Math.floor(r() * SOLID_POOL.length);
  const iB = Math.floor(r() * BOOL_POOL.length);
  const iS = Math.floor(r() * SCULPT_POOL.length);
  if (route < 0.55) return { kind: SOLID_POOL[iP][0], make: () => SD3.P[SOLID_POOL[iP][0]](SOLID_POOL[iP][1]()) };
  if (route < 0.8) return { kind: BOOL_POOL[iB][0], make: BOOL_POOL[iB][1] };
  return { kind: SCULPT_POOL[iS][0], make: SCULPT_POOL[iS][1] };
};
```

`_makeSolid` 加参 `isPrimary`(S1 传 true,S2/S3/静物池其余传 false;true 走 rollPrimaryKind,false 走原 rollSolidKind——两路各自消费恒定,调用位置恒定);dev 口:`?sculpt=<name>` 时主件 make 强制为该雕塑(`pa.sculptForced = name`,链上构建可剔注释;强制分支仍先耗满全部 roll)。

- [ ] **Step 3: 八件符号测试**:每件构造一次,断言 ①远点 d>3 ②中心附近存在 d<0 ③镂空件(cube-pierced/caged/arcade/death-star)在孔位/笼内取到 d>0 的"洞点"(每件给定具体探针点,实跑标定后写死);kinds 期望值按新消费序实跑更新。
- [ ] **Step 4:** 全绿 commit。

---

### Task 4: 逐件全套对抗 + 8×3 contact sheet(STOP user 终裁)

**Files:** 修构图/尺寸常数如对抗发现问题;产物 ~/Downloads/genlab-3d-batch2/

- [ ] **Step 1:** 逐件 `?sculpt=<name>` × 多 hash 猎构图变奏(五型都要命中过);每件挑 3 枚过构图五标(出画率/负空间/地平线/消散/修饰符可辨)
- [ ] **Step 2:** 电流爬剪影逐件验(镂空件重点:caged-orb/arcade 的 mask 拓扑与追踪不卡死);景深 A/B 逐件一组;PAL3D 配色变奏 ≥2 方案
- [ ] **Step 3:** 发现形体 bug(比例失调/孔不可见/量测失败兜底)→ 改 SCULPT_POOL 常数 → 同 hash 复验
- [ ] **Step 4:** 8 行 × 3 列 contact sheet + 逐件单图存 /tmp 并 cp 到 ~/Downloads/genlab-3d-batch2/;**STOP 交 user**(雕塑档 20% 权重一并裁)

---

### Task 5: 终裁落地 + 文档 + 全链(user 裁定后)

**Files:**
- Modify: `scenes/solids-stage.js`(权重按终裁)、sdf-main `style-plan.json`(comp_34.sculpt_route)、两仓 README/handoff、`test/find-hash.mjs`(如需 sculpt 打印)

- [ ] **Step 1:** 按终裁改三分权重;全绿
- [ ] **Step 2:** style-plan comp_34 加 `sculpt_route: { primitive, bool, sculpt, "_locked": true }`(python3 json)
- [ ] **Step 3:** 两仓文档各 3-5 行(雕塑档八件 + traits 6 键 + 判决结论);`node test/find-hash.mjs 34` 复跑
- [ ] **Step 4:** 两仓 commit;sdf-main push genlab-3d-batch2 并 `gh pr create`(base main),STOP 等 user review

---

## Self-Review

- Spec 覆盖:§一判决实验→T1;§二 traits→T2;§三八件+路由→T3;§四验收→T4;§五纪律→贯穿+T5 ✓
- 占位符扫描:T1 Step 2 sha16 实现者任选并写报告(受控自由度,非 TBD);T3 Step 3 探针点"实跑标定后写死"是确定性系统先例做法 ✓;drawPoisson 五元"按实际变量名取"——调用点变量名需读码,值语义已定 ✓
- 类型一致:SCULPT_POOL/rollPrimaryKind/pa.sculptForced/pa.intersect34/pa.decayRow34 各任务签名一致;hourglass 反射映射数学已在注释给定 ✓
- 消费恒定:钩与 traits 零消费;三分路由恒 roll 4 次;?sculpt= 强制仍耗满 ✓
