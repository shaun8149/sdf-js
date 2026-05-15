# `examples/sdf/` — layout guide

A map of what lives in this directory and why. Read this before editing.

---

## 主入口 · 一切从这里开始

**`render-showcase.html`** —— 唯一推荐的浏览入口。tab 切渲染器，每个 tab 内可切场景 1–16。

URL hash 记忆 tab + cache-bust：刷新后回到上次的 tab，iframe 自动从服务器拉最新代码。

---

## 文件分组（按用途）

### A · 库 reference 演示（基础参考，独立维护）

| 文件 | 用途 |
|---|---|
| `2d.html` / `2d-demo.js` | 2D primitives 展示：每个 primitive 一格 |
| `3d.html` / `3d-demo.js` | 3D primitives + 链式 op 展示 |
| `editor.html` / `editor.js` | 实时 SDF 编辑器（滑块 + 即时渲染） |

每个独立，互不依赖。

### B · GLSL shader 路径（独有，不在多场景浏览器里）

| 文件 | 用途 |
|---|---|
| `cactus-shader.html` / `cactus-shader.js` | 单 cactus, **GLSL fragment shader**（SDF 编译到 GPU） |
| `cactus-sand-shader.html` / `cactus-sand-shader.js` | 单 cactus, **GLSL sand 效果** |

shader 路径用 SDF 编译到 GLSL，是 sdf-js 的另一条 backend。**vanilla silhouette / painted 见
render-showcase scene 1**（已替代原 `cactus.html` / `cactus-painted.html`）。

### C · 多场景浏览器（核心，每个 renderer 一个）

| 文件 | 用途 |
|---|---|
| `scenes.js` | **场景目录主入口** —— `makePa` + `makesdf` + `SCENE_META` 全部在这。scene 1–16 的元数据（view/yConvention/kind）在 `SCENE_META` 顶部 |
| `scenes-3d.js` | 3D 场景 probe 函数（scene 15 球 / 16 胶囊） |
| `scenes-debug.html` / `.js` | silhouette adapter（直接 pixel-loop） |
| `streamline-scenes.html` / `.js` | streamline / hatch adapter |
| `scenes-sand.html` / `.js` | sand adapter（p5） |
| `painted-scenes.html` / `.js` | painted adapter（p5）—— 也是唯一支持 3D 场景的 |
| `render-showcase.html` | tab 总入口，iframe 包住上面 4 个 adapter |

**加新场景的工作流：**
1. 在 `scenes.js` 顶部 `SCENE_META` 加一行（`{ yConvention, view, kind? }`)
2. 在 `makesdf()` 加一个 `if (pa.scene === N)` dispatch case 返回 SDF 列表
3. 4 个 adapter 页面的 HTML 加一个按钮 `<button data-scene="N">`
4. （3D 场景）在 `scenes-3d.js` 加 probe 函数，并在 `painted-scenes.js` 走 probe 通路

### D · LLM × SDF 实验存档

**Round 1**（minimal-context prompt）—— **合并文件**：
- `llm-round1.html` / `llm-round1.js`
- 7 个场景在同一个文件里（tree / boat / cathedral / butterfly / hatman / dance / seurat），URL hash 切换
- 一些 bugs 故意保留（trapezoid 签名误用、roseRing 死代码、hatman scale 失控、seurat 没尝试 pointillism）—— 这些是 essay §5 三个 failure mode 的源材料
- `llm-round1.js` 还 export `getDanceSdfs()` 给 `scenes.js` 作为 scene 13 的 SDF 源

**Round 2**（用 SKILL.md prompt 跑出的输出）—— **每个 scene 一个文件**：
- `test-tree-v2.* / test-boat-v2.* / test-cathedral-v2.* / test-butterfly-v2.* / test-hatman-v2.* / test-seurat-v2.*`
- 6 个 standalone 测试页。**双重身份**：既是 standalone 页面，又通过 `export function getSdfs()` 被 `scenes.js` 导入为 scene 8–12 / 14 的 SDF 源
- 编辑这些文件时：standalone 页面会刷新；同时 scenes.js 里对应 scene 也会更新

Round 1 用合并文件、Round 2 保持分散，是有意的：Round 2 是**正在迭代的活跃编辑面**（你今天还在调 seurat-v2），分散文件 git diff 干净；Round 1 是**冻结的存档**，合并降低视觉噪声。

### E · 后续实验 / 独立 demo

| 文件 | 用途 |
|---|---|
| `test-torso.html` / `test-torso.js` | back-view 女体 polygon，两种 mode（`#outline` shell+intersection 单线 / `#hatch` streamline 等距线）。Matisse 和 Pasma 两种 visual register 的对照 |

---

## 怎么找到我要的东西

| 我想做什么 | 去哪个文件 |
|---|---|
| 看 14 个场景的所有渲染器对比 | 打开 `render-showcase.html` |
| 改一个 v2 场景（例如调 Seurat 身体比例） | 改 `test-seurat-v2.js`（standalone + scene 14 同步更新） |
| 加新的 BOB-style 场景 | 改 `scenes.js`（SCENE_META + makesdf） |
| 改 streamline / hatch 配色 | 改 `streamline-scenes.js` 里的 LAYER_COLORS / LAYER_DSEP |
| 调 painted 笔触 | 改 `painted-scenes.js` 或 `src/render/painted.js` |
| 试新 idiom（line art / hatching） | 改或仿照 `test-torso.js` |

---

## 不要碰的（除非有明确理由）

- `scenes.js` 的 `SCENE_META` 表 —— 改单个 scene 的 `view` 或 `yConvention` 会改变所有 renderer 的几何/方向
- v2 文件的 `export function getSdfs()` —— 这是 scenes.js 的导入契约
- `_canvas` 守卫在 v2 文件底部 —— 这让 standalone 页面正常跑，import 时无副作用

---

## 已删除（不再存在）

- `test-seurat-v3.*` —— warm/cool 错位 + intersection-mask 实验，**被证伪**（不是真 Seurat divisionism，需要新 stipple renderer）。如要复活查 git history
- `test-back-torso.* / test-hatch-torso.*` —— 已合并入 `test-torso.html`
- `cactus.* / cactus-painted.*` —— 被 render-showcase scene 1 完全覆盖
- `test-tree.* ~ test-seurat.*` (round 1 的 7 对 14 文件) —— 已合并入 `llm-round1.{html,js}`
