# Atlas Present Sprint 1 v4 — PDF → 2D Info Graphic MVP

**Date:** 2026-06-19 (Sprint 1 第 4 次架构, **2D 先于 3D** swap)
**Status:** Awaiting user review
**Effort:** ~5-6 hours subagent-driven
**Authoritative thesis:** [[atlas-present-spatial-narrative-thesis]] (memory)
**Position:** Atlas Present = 引擎首个商业化产品 + 首个应用场景 (user lock 2026-06-19)
**Mode in this sprint:** 2D Info Graphic only (per dual-mode thesis + 2D-first swap)

---

## 1 — Goal + Sprint 1 范围

**核心目标**: 实现 Atlas Present 第一个 deliverable mode — **PDF → 2D Info Graphic**。用户 drop 一个 PDF, Atlas 解析每页, lift 成 3D SceneData (供未来 mode 复用), Sprint 1 仅渲染成**一张 2D 高密度信息图** (PNG/SVG 可导出)。Tufte-pure deliverable, 无 cinematic 动画, 全程 headless 可测。

**Demo flow (end-to-end)**:
1. 用户访问 `/examples/present/`
2. Drop 一个 5 页 PDF (Sprint 1 优先支持 5-10 页, 太多页 layout 会拥挤)
3. Parse + lift (后台进度条, ~2 min for 5 pages with current lift cost ~$1)
4. Lift 完成后: 屏幕渲染 **2D Info Graphic** (Linear timeline 形态: 5 个 slide 横向排列 + 编号 + 标题)
5. 用户点 "Export PNG" 按钮 → 下载图片
6. (Optional) 用户回 library → 看到 deck 卡片 + 略缩图

**Sprint 1 范围 (per spatial-narrative thesis 锁的 Sprint 1)**:
- ✅ **2D Info Graphic mode only** (NO 3D Play in Sprint 1)
- ✅ 顶层 Linear archetype (1 个几何核)
- ✅ PDF 导入 (输入唯一方式 Sprint 1)
- ✅ **Mode-agnostic data schema** — 用 `sections + region` 词汇, **不含 3D 词**
- ✅ Library page (列出已 imported decks)
- ✅ Export PNG
- ❌ 3D Play mode (Sprint 2)
- ❌ Text / PPT / DOC 输入 (Sprint 2-3)
- ❌ Radial / Grid / Hierarchical 等其它 archetype (Sprint 3)
- ❌ 嵌套机制 (Sprint 4)
- ❌ LLM-driven archetype detection (Sprint 6)
- ❌ Editor / atom-picking (永远不做 — Gamma-style import → consume)
- ❌ Streaming UX (Sprint 2 起做 — 2D mode 等所有 lift 完再 render 一次即可)
- ❌ Speaker notes / autoplay / video / share URL (Sprint 3+)

---

## 2 — 架构 (Layer 2 app, mode-agnostic schema)

按 [[compositor-layered-for-presentation]] LOCK + [[atlas-present-spatial-narrative-thesis]] 的 mode-agnostic schema:

```
Layer 2: examples/present/  +  src/present/      ← Atlas Present (this sprint)
  ↓ 唯一一个 render mode consumer (2D Info Graphic)
[future: 3D Play / Video / Static 3D / Outline PDF — Sprint 2+]
  imports
Layer 1: src/compositor-api.js                   ← unchanged (Layer 1 不动)
  +
Layer 1: src/parser/index.js (PDF parser)        ← existing (M0.3)
  +
Layer 1: src/mapping/slide-to-2d-code.js         ← existing (M1.5 emitter)
  +
Layer 1: src/render/silhouette.js                ← existing CPU 2D renderer
  ↓
Layer 0: sdf-js core (SDF tree + atoms + GLSL)   ← unchanged
```

**Sprint 1 用的 Layer 1 API (全是 existing, 不改 Layer 1)**:
- `src/parser/index.js parseDeck(pdfBytes)` — PDF → SlideData[]
- `src/mapping/slide-to-2d-code.js emitSlide2dCode(slideData)` — SlideData → 2D code
- `compositor-api.callLiftLLM(prompt, code2d, apiKey)` — 2D code → 3D SceneData
- `compositor-api.compileScene(sceneData)` — SceneData → unified SDF
- `compositor-api.createRendererForId('silhouette', canvas)` — Sprint 1 唯一 renderer

**Sprint 1 不用 (因为是 3D 相关)**:
- `waypoint-tween.js` (camera animation — Sprint 2 起用)
- `sphericalToCamState` (spherical camera — Sprint 2 起用)
- GPU renderers (fly3d / studio / bob-gpu — Sprint 2 起用 for 3D Play)

**Layer 2 新模块 (Sprint 1)**:
- `pipeline.js` — orchestrate parse → emit → sequential lift (no streaming UX yet)
- `linear-layout.js` — compute section regions (mode-agnostic positions/bboxes) for Linear archetype
- `info-graphic-render.js` — render sections to 2D info graphic (timeline form for Linear archetype) using silhouette CPU renderer
- `library-page.js` — list decks + Import PDF + view/export buttons
- `deck-view.js` — load deck, render info graphic, show Export PNG button

---

## 3 — 数据模型 (v3 schema, mode-agnostic)

**Vocabulary lock** (per memory 修订): 用 `sections + region`, NOT `waypoints + camera`. 不含 3D 词汇。

```ts
type Deck = {
  // Identity
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;

  // Source (Sprint 1: PDF only)
  source: {
    type: 'pdf';                  // Sprint 2+ 加 'text' | 'docx'
    fileName: string;
    pageCount: number;
  };

  // Spatial layout
  layout: {
    archetype: 'linear';          // Sprint 3 起加 'radial' | 'grid' | ...
    spacing: number;              // 默认 6 — section centers 间距 (mode-agnostic units, 用于 region.centerX 计算)
  };

  // Per-section data (renamed from "slides", "waypoints" — both 3D-leaky)
  sections: SectionEntry[];

  // NOTE: 故意不在 Sprint 1 schema 里加 "theme.renderer" / "tween" / "autoFlow" / etc. —
  // 那些是 3D Play mode 的 concerns, Sprint 2 加 3D Play 时再加。Mode-agnostic schema 严守。
};

type SectionEntry = {
  id: string;
  pageIndex: number;              // 原 PDF 第几页 (0-based)
  status: 'pending' | 'lifting' | 'ready' | 'error';
  
  // Lift inputs (filled at parse time)
  slideData?: object;             // SlideData v1 from parser
  code2d?: string;                // emitted 2D code
  prompt?: string;                // user-facing label / title
  
  // Lift output (filled when status='ready')
  sceneData?: object;             // 3D SceneData v1 (compositor-compatible)
  
  // Region — mode-agnostic spatial descriptor (NOT a camera)
  region?: {
    centerX: number;              // section 中心位置 (在 canvas 坐标)
    centerY: number;
    centerZ: number;
    halfWidth: number;            // section 范围 (从 bbox 推导)
    halfHeight: number;
    halfDepth: number;
    title?: string;               // section 标题 (来自 PDF page title 或 slideData.title)
  };
  
  // Error
  liftError?: string;
};
```

**localStorage v3 schema**:
```
{ version: 3, decks: Deck[] }
```
v1 (PPT-mode) + v2 (Canvas Mode) silent drop on first v3 load.

**Mode-derived (不存 schema, 各 mode 自己派生)**:
- 2D Info Graphic 派生: `region.centerX/Y` → 2D 画布位置; `region.halfWidth/Height` → 2D 图块大小
- 3D Play (Sprint 2+) 派生: `region.centerX/Y/Z` → camera target; `max(halfX/Y/Z)*2` → camera distance

---

## 4 — Pipeline (Sprint 1 简化: 无 streaming UX)

### 4.1 Pipeline 顺序

```
1. User drops PDF                              (~0s)
2. Read file as ArrayBuffer                    (~0.1s)
3. parseDeck(bytes) → SlideData[]              (~0.5s for 5 pages)
4. emitSlide2dCode for each page → code2d[]    (~0s sync)
5. Save deck to storage (all sections pending)
6. Display LIBRARY → "Lifting..." card with progress (N/M)
7. Sequential lift queue: process section 0 → 1 → 2 → ...
   - Each lift: ~20s, $0.21
   - On 'ready': compute region (bbox + center), save to storage, update progress
8. When ALL sections 'ready':
   - Compute final 2D layout (linear-layout.js)
   - Render 2D info graphic (info-graphic-render.js)
   - Display
   - Enable "Export PNG" button
```

### 4.2 Sprint 1 NO streaming UX

Sprint 1 wait-until-all-lifted-then-render-once。User sees:
- Library 卡片显示 "Lifting 3/5"
- 等所有 5 sections 都 ready, render 2D info graphic
- 期间 deck view 显示 "Generating info graphic..."

Sprint 2 起 3D Play mode 才需要 streaming (slide 1 first ship)。2D mode 不需要。

### 4.3 Cost

5-page PDF Sprint 1 测试 = 5 × $0.21 = **$1.05 per deck** (current v3.18 prompt)

### 4.4 Error handling

- Parse failure: alert "PDF parse failed: <reason>"; deck NOT saved
- Lift failure (single section): mark `status='error'`; queue continues to next
- All sections lifted but ≥1 errored: render 2D info graphic with placeholder rect for errored sections
- BYOK missing (`atlas-anthropic-key` localStorage): show input modal before pipeline starts

---

## 5 — Linear Layout 算法 (Sprint 1 唯一 archetype)

### 5.1 Region 计算 (mode-agnostic)

Given N lifted sections with sceneData (each has subjects + bbox):

```
For each section i (0-indexed):
  bbox = compute bbox of sceneData.subjects     // 从 sceneData 算 (existing utility)
  region.centerX = i * spacing                  // Linear archetype: 沿 X 轴
  region.centerY = bbox.centerY                 // 保持原始 Y
  region.centerZ = bbox.centerZ                 // 保持原始 Z
  region.halfWidth = bbox.halfWidth
  region.halfHeight = bbox.halfHeight
  region.halfDepth = bbox.halfDepth
  region.title = slideData.title || `Page ${i+1}`
```

**spacing 默认 6 units** (per memory). N=5 sections → canvas 总宽 ~30 units。

### 5.2 2D Info Graphic 渲染 (Sprint 1 Linear flavor)

2D info graphic 是 **timeline form** (Linear archetype 的 2D 形态, per memory mapping):

```
+---------------------------------------------------------------+
|  Q1 Sales Deck                                                |
|  PDF: q1-sales.pdf · 5 pages · Generated 2026-06-19           |
+---------------------------------------------------------------+
|                                                               |
|   1            2            3            4            5      |
| ┌───┐       ┌───┐       ┌───┐       ┌───┐       ┌───┐         |
| │[A]│──────►│[B]│──────►│[C]│──────►│[D]│──────►│[E]│         |
| └───┘       └───┘       └───┘       └───┘       └───┘         |
|  Title       Title      Title       Title       Title         |
|  Page 1      Page 2     Page 3      Page 4      Page 5        |
|                                                               |
|  [Export PNG]   [Export SVG (Sprint 3+)]                      |
+---------------------------------------------------------------+
```

### 5.2.1 渲染分工 — Atlas IP 边界 (per memory hard rule 5)

- **Atlas native**: 每个 section 块**内部**的 slide 内容缩略图 — 用 `silhouette` CPU renderer 渲染 sceneData 的 SDF
- **Canvas2D + system fonts (3rd-party)**: 所有 chrome — 边框 / 箭头 / 编号 / 标题 / page# / 顶部 header

### 5.2.2 渲染算法

1. Canvas 总尺寸: N * 200px + padding, 高度 400px (固定 Sprint 1)
2. Header (顶部): `ctx.font = 'bold 16px sans-serif'` + `ctx.fillText('Q1 Sales Deck', ...)`; 元信息 `ctx.font = '11px sans-serif'`. **系统字体, 不用 SDF**
3. 每 section 框: `ctx.strokeRect(x, y, 150, 150)` 画边框
4. 每 section 内 (~140×140 px inside frame): 单独 mount silhouette CPU renderer 渲染 sceneData → 黑白侧影. **这是 Atlas SDF 渲染入口**
5. 每 section 编号 (上方 "1", "2"...): `ctx.font = 'bold 24px sans-serif'` + `ctx.fillText(String(i+1), ...)`. **系统字体**
6. 每 section 标题 (下方): `ctx.font = '12px sans-serif'` + `ctx.fillText(region.title, ...)`. **系统字体, 长字符串 truncate ellipsis**
7. 箭头 (块之间): `ctx.beginPath(); ctx.moveTo + lineTo + 三角形头`. Canvas2D 原生, **不用 Atlas SDF**
8. Page# (下方 "Page 1"...): `ctx.font = '10px sans-serif'`. **系统字体**

**关键拒绝**:
- ❌ 不用 SDF text 渲染编号 / 标题 / page# (over-engineered)
- ❌ 不用 SDF 画箭头 (Canvas2D `lineTo` 简单 100x)
- ❌ 不引入 p5.js for Sprint 1 (原生 Canvas2D 足够; p5 Sprint 3+ 互动 info graphic 时再考虑)
- ✅ 但 section 内的 slide 缩略图 必须走 Atlas silhouette renderer (那是 Atlas 差异化)

### 5.2.3 字体策略

Sprint 1 用 sans-serif 系统栈: `font-family: -apple-system, system-ui, sans-serif` (跟 compositor 一致). 不引入 Web Font (额外加载 + FOUT 复杂度). Sprint 3+ 主题系统再考虑可选 web font。

### 5.3 Export PNG

`canvas.toDataURL('image/png')` → 触发下载 (default browser download API)。Sprint 1 仅 PNG; SVG 留 Sprint 3+。

---

## 6 — UI sketches

### 6.1 Library page (`/examples/present/`)

```
┌──────────────────────────────────────────────────────────────┐
│ Atlas Present                            [+ Import PDF]      │
├──────────────────────────────────────────────────────────────┤
│  [Deck card]      [Deck card]      [Deck card]               │
│  Q1 Sales         Atlas Pitch      Strategy                  │
│  5 sections       12 sections      8 sections                │
│  Lifted ✓         Lifting 4/12     Lifted ✓                 │
│  Updated 2h       Just now         Updated 1d                │
│  [View] [⋯]       (no view yet)    [View] [⋯]               │
└──────────────────────────────────────────────────────────────┘
```

- [+ Import PDF] opens file picker, triggers pipeline
- Card shows lift progress live
- [View] only shown when ALL sections ready
- [⋯] menu: rename / delete / re-lift / export PNG (jumps to deck-view + auto-triggers export)
- Empty state: "Drop a PDF here, or click [+ Import PDF]"

### 6.2 Deck view (`/examples/present/?deck=<id>`)

```
┌──────────────────────────────────────────────────────────────┐
│ [← Library]  Q1 Sales                                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   1          2          3          4          5             │
│ ┌──┐──────►┌──┐──────►┌──┐──────►┌──┐──────►┌──┐             │
│ │  │       │  │       │  │       │  │       │  │             │
│ └──┘       └──┘       └──┘       └──┘       └──┘             │
│ Page 1     Page 2     Page 3     Page 4     Page 5           │
│                                                              │
│ [Export PNG]  [Re-lift]  (3D Play coming Sprint 2)           │
└──────────────────────────────────────────────────────────────┘
```

- Big info graphic canvas
- Export button below
- (Optional) "3D Play coming Sprint 2" placeholder hint

### 6.3 No fullscreen, no navigation in Sprint 1

Sprint 1 deck-view 就是个 static page. 没 ←→ key, 没 fullscreen, 没 cursor hide. 用户看图 + 导出, that's it.

3D Play 的 UX (fullscreen / ←→ / cursor hide / cinematic) 是 Sprint 2 的事。

---

## 7 — File layout

### NEW (Sprint 1 v4)

| Path | LoC est. | Responsibility |
|---|---|---|
| `sdf-js/src/present/pipeline.js` | ~200 | parsePdf → emit 2D → sequential lift queue + storage updates (NO streaming UX) |
| `sdf-js/src/present/linear-layout.js` | ~60 | Compute section regions for Linear archetype (centerX = i*spacing, bbox from sceneData) |
| `sdf-js/src/present/info-graphic-render.js` | ~150 | Compose info graphic: Canvas2D + system fonts for chrome (header / borders / arrows / labels / numbers / titles); call into silhouette renderer ONLY for slide thumbnail inside each section frame |
| `sdf-js/src/present/library-page.js` | ~150 | Library list + Import PDF + card actions |
| `sdf-js/src/present/deck-view.js` | ~100 | Load deck + trigger info-graphic-render + Export PNG button |
| `sdf-js/scripts/test-linear-layout.mjs` | ~80 | L1 tests for region computation (~12 assertions) |
| `sdf-js/scripts/test-pipeline.mjs` | ~120 | L1 tests for pipeline state machine with MOCK lift (~20 assertions) |
| `sdf-js/scripts/test-info-graphic-render.mjs` | ~80 | L1 tests for info graphic render output structure (~10 assertions, headless canvas) |

### REPLACE (Canvas Mode artifacts)

| Path | Sprint 1 v3 (Canvas Mode) status | Sprint 1 v4 action |
|---|---|---|
| `sdf-js/src/present/deck-model.js` | Canvas+Waypoint schema | REWRITE for v3 schema (source / sections / layout) — drop waypoint+camera vocabulary |
| `sdf-js/scripts/test-deck-model.mjs` | 42 assertions | REWRITE for v3 schema (~30 assertions, mode-agnostic vocabulary) |
| `sdf-js/src/present/deck-library.js` | Canvas Mode library card | REPLACE with new `library-page.js` (or refactor in place) — Linear progress UI |
| `sdf-js/src/present/deck-editor.js` | Canvas Mode 3D editor | **DELETE** (no editor in Gamma model) |
| `sdf-js/src/present/atom-palette.js` | Canvas Mode subject palette | **DELETE** (no user atom placement) |
| `sdf-js/src/present/present-mode.js` | Canvas Mode single canvas + tween | **DELETE** (Sprint 1 没 present mode; Sprint 2 加 3D Play 时新写) |
| `sdf-js/src/present/waypoint-tween.js` | Canvas Mode camera tween | **DEFER** — 留在 codebase 但 Sprint 1 不 import. Sprint 2 起用 |
| `sdf-js/examples/present/index.html` | Router (library/editor/present) | UPDATE — router becomes (library / deck-view) |
| `sdf-js/examples/present/style.css` | Editor styles | REPLACE — info graphic + library styles, drop 3D editor CSS |

### KEEP unchanged from Sprint 1 v1 (PPT-mode 时期)

| Path | Why |
|---|---|
| `sdf-js/src/compositor-api.js` | Layer 1 — Sprint 1 用 callLiftLLM / compileScene / createRendererForId |
| `sdf-js/scripts/test-compositor-api.mjs` | Still valid |
| `sdf-js/src/parser/index.js` | PDF parser — Layer 1 |
| `sdf-js/src/mapping/slide-to-2d-code.js` | 2D emitter — Layer 1 |
| `sdf-js/src/render/silhouette.js` | Sprint 1 唯一 renderer — Layer 1 |
| `sdf-js/scripts/test-waypoint-tween.mjs` | Still passes (waypoint-tween.js 留在 codebase, 只是 Sprint 1 不用) |

---

## 8 — 测试计划

### L1 unit tests

**`test-linear-layout.mjs`** (~12 assertions):
- `computeRegions(sections, spacing)` returns array of region objects
- N=1: region.centerX = 0
- N=3, spacing=6: centerX = [0, 6, 12]
- region.halfWidth/Height/Depth derived from sceneData bbox
- region.title from slideData.title fallback to "Page {i+1}"
- spacing default 6
- Empty sections → empty regions

**`test-pipeline.mjs`** (~20 assertions, NO real LLM):
- `createPipeline(pdfBytes, deckCallback)` returns state machine
- Parse stage emits SlideData[]
- Emit stage emits code2d[]
- Lift stage uses MOCK lift function, emits 'lifting' / 'ready' / 'error' per section
- Sequential: section 0 lifted before section 1 starts
- Cancel: stops further lifts
- State persistence: pipeline serialize/deserialize works (5 of 10 lifted)

**`test-info-graphic-render.mjs`** (~10 assertions, headless canvas):
- `renderInfoGraphic(deck, canvas)` returns void, populates canvas
- N=3 sections → 3 silhouette renders + 2 arrows + 3 numbers + 3 titles + 1 header
- Canvas width scales with N (sections * 200 + padding)
- Canvas height fixed (400px Sprint 1)
- Export PNG: `canvas.toDataURL('image/png')` returns valid data URL

**`test-deck-model.mjs` REWRITE** (~30 assertions):
- `createDeck(title, source)` returns v3 schema (no waypoints / camera fields)
- `addPendingSections(deck, slideDataArray)` bulk add in 'pending' status
- `updateSectionStatus(deck, sectionId, status, payload?)` transitions
- localStorage v3 round-trips
- v1 + v2 (legacy) storage silent drop
- listDecks sorted by updatedAt desc
- rename / duplicate (note: duplicate must re-trigger lift, since lifted SceneData is per-content)

### L2 browse smoke

- Phase 4 (pipeline ship): load test PDF (fixture), verify pipeline state transitions visible in library
- Phase 5 (info-graphic-render ship): drop PDF, see info graphic render in deck-view

### L3 end-to-end acceptance (manual via real browser OR /browse headless)

1. Open `/examples/present/` → empty library
2. Drop a 5-page test PDF (use `sdf-js/fixtures/test-deck.pdf`)
3. Within 1s: see deck card "Lifting 1/5"
4. Within 2min: card → "Lifted ✓"
5. Click [View] → deck-view loads
6. Within 1-2s: info graphic renders (5 silhouette blocks + arrows + numbers + titles + header)
7. Click [Export PNG] → PNG downloads to user's Downloads folder
8. Verify PNG opens correctly in image viewer + shows expected content
9. Reload page → deck still in library (localStorage persist)
10. Re-click [View] → info graphic re-renders (deterministic, same output)

---

## 9 — Acceptance criteria

1. ✅ PDF drop → deck card appears < 1s
2. ✅ Lift sequential, ~$0.21/section (= ~$1 for 5-page deck)
3. ✅ Library card shows progress live (re-renders on status change)
4. ✅ Info graphic renders < 2s after lift complete
5. ✅ Export PNG works (downloads, ~50-200KB file size for 5-section deck)
6. ✅ Data model is **mode-agnostic** — `git grep -n "camera\|yaw\|pitch\|distance\|focal" sdf-js/src/present/deck-model.js` should return ZERO matches (强制证据)
7. ✅ npm test: 31/31 baseline + 3 new test files (~62 new assertions) = ALL GREEN
8. ✅ Library still works post-pivot (Canvas Mode → 2D Info Graphic 切换, library 卡片 schema 改)
9. ✅ No regression in compositor (cube-3d-showcase still renders via /browse silhouette path)
10. ✅ Code organized to be **Sprint 2-friendly** — Sprint 2 加 3D Play 不需要碰 deck-model.js (schema 已 mode-agnostic) 或 linear-layout.js (region 数据已 mode-agnostic)

---

## 10 — Hard rules

### Rule 1 — Pipeline 是 Layer 2, 调 Layer 1 sequential

Pipeline 用 `compositor-api.callLiftLLM` per section via Layer 2 队列。**NO 直接 Anthropic fetch in pipeline.js** — 必须走 Layer 1.

### Rule 2 — 数据模型严守 mode-agnostic vocabulary

`deck-model.js` schema **不允许出现以下 3D 词汇**: `camera`, `yaw`, `pitch`, `distance`, `focal`, `waypoint`, `cameraSequence`, `tween`, `easing`, `autoFlow`. 用 `region`, `sections`, `bbox` 等空间无关词汇。

CI/grep 验证: `git grep -n "camera\|yaw\|pitch\|distance\|focal\|waypoint" sdf-js/src/present/deck-model.js` 必须 0 命中。

### Rule 3 — Linear layout 是纯函数

`linear-layout.js` 输入 sections (immutable), 输出 regions (immutable). NO DOM, NO side effects. Fully testable.

### Rule 4 — Info graphic render 是纯函数 (输入 deck, 输出 canvas)

`info-graphic-render.js renderInfoGraphic(deck, canvas)` 是 deterministic — 同 deck 同 canvas size → 同样输出 (像素级)。NO 时间依赖, NO random。

### Rule 5 — Storage size guard

localStorage 写之前检查总 size; > 4MB 时拒绝新 deck 并提示用户删除老 deck。

### Rule 6 — No user-facing editor

Per thesis hard rule 1: 用户**不选** archetype, **不调整** layout / spacing。完全 import → consume。

### Rule 7 — Deck = ONE big SceneData (thesis hard rule 4)

Sections 各自的 sceneData 在 render 时合并 (info-graphic-render 内部); 永久存储是 N 个独立 sceneData (per section), 但 render-time always ONE composite view。**NOT 维护多个 active SceneData**。

### Rule 8 — Sprint 1 ship 不 import waypoint-tween.js

`waypoint-tween.js` 留在 codebase (Sprint 2 起用), 但 Sprint 1 不 import 它。如果 Sprint 1 代码 import 它 = 提示有 3D-leak。

### Rule 9 — Atlas IP 边界 (per memory hard rule 5)

**用 Atlas SDF**:
- 每 section 块内部的 slide 内容缩略图 (silhouette CPU renderer 渲染 sceneData) ✓
- (Sprint 2+) 3D Play mode 内 in-scene 3D 文字 (text-3d-pipe / text-3d-extruded atom)

**用 Canvas2D + 系统字体 (3rd-party / 原生 API)**:
- Info graphic 的所有 chrome (header / 边框 / 箭头 / section 编号 / section 标题 / page# / footer)
- Library page UI 文字
- 所有按钮 label / progress text

**判别问句**:
- 这个东西被光照 / 摄像机变换 / 材质处理吗? Yes → Atlas SDF; No → Canvas2D
- 这个东西需要 LLM 写代码生成吗? Yes → Atlas atom; No → 手写 Canvas2D
- 反例: 用 SDF 渲染 "Page 3" 标签是 over-engineered (违反 rule 9)

### Rule 10 — Sprint 1 不引入新 3rd-party 依赖

- ✅ 用现有: Canvas2D API (浏览器原生), 系统字体 ("system-ui, sans-serif"), pdf.js (已在 codebase)
- ❌ 不引入: p5.js (Sprint 3+ 互动 info graphic 再考虑), three.js (Sprint 2+ 3D Play 决定), 任何 web font (FOUT 复杂度)
- 依赖 footprint 维持简洁 — Sprint 1 deliverable 用现有工具够

---

## 11 — Out of scope (明确不做 + Sprint 归属)

- **3D Play mode** (fullscreen + camera tween + ←→ keys + overview + auto-flow) — **Sprint 2** (用 Sprint 1 同 data 加 render path)
- Text input → outline → sections chain — **Sprint 2**
- PPT (`.pptx`) 直接 import — **Sprint 2** (PDF 已 cover PPT 转 PDF)
- DOCX import — **Sprint 2**
- Streaming UX (first-section-first ship) — **Sprint 2** (3D Play 需要; 2D 不需要)
- SVG export — **Sprint 3** (PNG 先)
- Radial / Grid / Hierarchical / Ring / Layered archetypes — **Sprint 3-5**
- Per-archetype 2D info graphic visual templates — **Sprint 3** (Sprint 1 仅 Linear = timeline 形态)
- 嵌套机制 — **Sprint 4**
- Static 3D Render mode — **Sprint 4**
- Outline + Snapshots PDF mode — **Sprint 4**
- Video export mode — **Sprint 5**
- LLM-driven archetype detection — **Sprint 6**
- Speaker notes — **Sprint 4+**
- URL share / fork — **Sprint 5**
- Cloud sync / multi-user — **Sprint 6+**
- Mobile responsive — **Sprint 5+**

---

## 12 — Phase 切分 preview (for writing-plans)

5-6 phases, **~5-6 hr subagent-driven**:

| Phase | Scope | 时间 |
|---|---|---|
| 1 | Memory note (Sprint 1 v3 Canvas Mode deprecate) + cleanup (DELETE editor.js / atom-palette.js / present-mode.js, banner waypoint-tween.js 'Sprint 2+') | 20 min |
| 2 | `linear-layout.js` + TDD (~12 assertions) | 1 hr |
| 3 | `deck-model.js` REWRITE for v3 schema (mode-agnostic vocabulary) + TDD (~30 assertions) | 1.5 hr |
| 4 | `pipeline.js` + TDD with mock lift (~20 assertions) | 1.5 hr |
| 5 | `info-graphic-render.js` + TDD (~10 assertions) + `library-page.js` + `deck-view.js` + REWRITE `style.css` | 1.5 hr |
| 6 | L3 acceptance via /browse + memory SHIPPED note + push | 30 min |

**Total: ~6 hr**。比 v3 (Canvas Mode 3D editor) ~10 hr **少 40%**, 而且 deliverable 是 shareable PNG。
