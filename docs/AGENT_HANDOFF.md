# Atlas — Agent Handoff / Context Brief

> **Why this file exists.** The working agent's persistent memory lives **outside the repo**
> (`~/.claude/projects/.../memory/`) and does **not** sync via git. The owner rotates machines
> between Bangkok visits, so this doc carries the durable, code-not-derivable context forward.
> A fresh agent on a new machine should read this first. Last updated **2026-06-23**.
>
> This is a **curated** brief, not a dump. It captures decisions, rules, state, and pointers —
> not things you can read from the code or `git log`. When in doubt, the code + `docs/STATUS.md`
> are the source of truth for *what exists*; this file is the source of truth for *why* and *what's next*.

---

## 0. Orientation (read this first)

- **Repo root:** `c:\altas\sdf-js` (Windows). Source lives under `sdf-js/sdf-js/src/`. Yes, the
  nested `sdf-js/sdf-js/` is real. Docs at `sdf-js/docs/`. Tests at `sdf-js/sdf-js/scripts/test-*.mjs`.
- **What Atlas is:** an engine that turns **LLM-written symbolic code → editable 3D graphics**,
  built on **SDFs** (signed distance fields) raymarched on the GPU. The thesis: LLMs are *closed*
  over symbolic/code state (millions of lines of it in training) but ~zero over hand-authored vertex
  arrays — so "LLM writes the world as code" beats "LLM calls a renderer" or "diffusion samples pixels."
- **The product (LOCKED):** **Atlas Present** — a *spatial-narrative presenter*. The engine serves
  this app (identity inverted: engine exists for Present). See §5.
- **Dev server:** from `sdf-js/sdf-js/`, run `python3 dev-server.py 8001` (port 8001, `Cache-Control: no-store`).
  Visual verify via Playwright MCP (or `/browse`) at `http://127.0.0.1:8001/...` — **not** by asking the
  user for screenshots.

---

## 1. Hard rules (NON-NEGOTIABLE — these override defaults)

1. **Git: always PR, never push `main` directly.** Branch (`feat/…`, `fix/…`, `chore/…`) → commit →
   `git push -u origin <branch>` → `gh pr create` → **STOP and wait** for the user to say "merge".
   - **Never** self-`gh pr merge`. Merge strategy is **locked to `--squash --delete-branch`**.
   - `gh` CLI on the Bangkok machine is at `& "C:\Program Files\GitHub CLI\gh.exe"`. A new machine may
     differ — check `(Get-Command gh).Source` or just `gh`.
   - Memory files (`~/.claude/...`) are outside the repo and exempt. This handoff doc is **in** the repo,
     so it goes through the PR flow.
2. **three.js QUARANTINE.** three.js is allowed **only** in `apps/present/landing/` (the marketing/landing
   shell — "walk into the cinema" intro). It must **never** appear in `src/` or in the product runtime
   (deck/slides/player). The product renders with our own studio/SDF engine. The user has said this
   repeatedly and firmly: *"我们自己的 present 永远不引入 threejs."*
3. **LLM prompts stay SHORT.** Demo/lift/system prompts use the shortest noun phrase. Do **not** list
   parts or specify the camera. Verbose prompts regress the whole "LLM writes the world" thesis.
4. **Decide abstraction-layer changes WITH the user first.** API shape, default values, algorithm
   swaps, data contracts → confirm before doing. **Bug fixes → just do them.** (A change that is
   mathematically equivalent + mirrors an existing pattern counts as a bug fix, not an abstraction shift.)
5. **Engagement style:** push back on overclaims, extend agreements, connect to art history. **No
   generic praise.** The user wants honest assessment over flattery — including blunt post-mortems of
   our own process (see the end-of-session evaluation pattern).
6. **Shader template-literal backtick trap:** embedded GLSL lives in JS template strings; any backtick
   inside terminates the literal. **Run `node --check` before pushing any shader change.**
7. **Cross-renderer constants must match** (MAX_DIST / MAX_STEPS etc.) or be explicitly documented;
   run a fleet test when porting a renderer.
8. **Read source before porting.** When given a reference shader/algorithm, actually open and read it —
   don't reconstruct from the article's prose.

---

## 2. Architecture (the technical spine)

**3-layer (LOCKED 2026-06-19/22):**
- **Layer 1 — Engine:** `src/sdf/` (SDF primitives + ops + GLSL compile), `src/scene/` (SceneData →
  compile → sanity), `src/render/studio.js` (the product renderer). The engine is generic; "rich
  features threading through a generic dispatcher" caused a whole session of bugs → decouple via a
  single shared `applyStudioScene()` core.
- **Layer 1.5 — Runtime:** `src/runtime/apply-studio-scene.js` — the shared compile+render pipeline.
  **Pipeline order:** `expandVariants → expandStage → expandChartLabels → compile → ground-union`.
  ⚠️ It does **NOT** call `expandCompositeAtoms` (composite atoms don't expand on the studio path).
- **Layer 2 — Apps:** `examples/compositor/` (dev tool / playground — its DNA is *generative-art
  explorer*, dual to a presenter), and `apps/present/` (the product host). Layer 2 calls the engine
  through public API (`window.atlasLoadScene`, `callLiftLLM`, `renderLiftedSceneData`); it must **not**
  mutate engine internals. **Compositor is engine-layer-ish; the presenter is the app — call the
  engine, don't rewrite it** (analogy: PowerPoint ↔ OpenGL).

**Renderers:** studio (the product, HDR PBR raymarch) + 7 others in the compositor
(silhouette / BOB / Lines / Crayon / Topo + FLY 3D / BOB GPU / Blueprint). WebGL context limit ~8/page.

**studio.js material kinds** (`leafTone.y` int; set via `material.kind` → `MATERIAL_KIND_INDEX` in
`src/scene/spec.js`): `0` standard Lambert · `1` sea · `2` mountain · `3` emissive · `4` translucent ·
`5` snowy · `6` building · `7` eroded-terrain · `8` glass (real refraction; **decorative, currently
unused — candidate for a demo or removal**) · `9` fill-gauge (NEW, see §4).
Per-leaf data: `u_leafMaterial[256]` (hue,sat,metal,glow), `u_leafTone[256]` (value,kind,roughness,
clearcoat), `u_leafPattern[256]` (code,scale,strength,**[3]=fill** for kind 9). Per-leaf tags ride on
SDF nodes as `_subjectMaterial` / `_subjectPattern`; **child overrides parent** in `flattenUnion`.

**Lift pipeline:** `callLiftLLM(prompt, code2d, apiKey)` → `parseLiftResponse` (a JSON-isms stripper —
markdown fences / trailing commas / comments must be stripped, this is load-bearing) → SceneData →
compile → render. Per-history-entry caching (byte-equal code2d). BYOK, local processing.

**Camera:** `src/scene/camera-sequence.js` — `cameraSequence.shots[]` {duration,pos,target,fov,
aperture,focalDistance,ease,transition,shake,exposure}; ease `smooth|linear|in|out|inout`; rack focus =
`[from,to]` DoF arrays. The validator (spec.js) and evaluator (camera-sequence.js) must stay in sync —
update **both** when adding shot fields.

---

## 3. Current state (what's shipped / live)

- **Atlas Present cinematic landing (three.js) — shipped (#119).** `apps/present/landing/`. Dark
  industrial room, Reflector floor, monumental screen sampling a render-to-texture (Seascape ocean,
  MIT), Michelle.glb silhouette for scale, bloom+grade post, boot loader masking first-compile hang,
  Star-Nest intro (MIT) → hands to deck. **Render-to-texture is the pattern** for putting any renderer
  on the screen (fixed offscreen cost).
- **Studio cinematic wave — shipped:** PBR (#123: GGX, clearcoat, roughness), cinematic lighting
  (#125: warm/cool key-fill, soft shadows, cool kicker), camera language (#128: ease modes + rack focus).
- **Docs refreshed (#129):** `docs/STATUS.md` + `README.md` carry the product-form lock + studio wave +
  atom alignment audit.
- **Glass material kind + sphere-fill rebuild (#133, MERGED).** Real-refraction glass kind 8;
  sphere-fill first rebuilt onto a waterline-cap split (later superseded — see §4).
- **sphere-fill two-tone gauge (#134, OPEN — awaiting merge as of 2026-06-23).** The working fill gauge.
  See §4 for the full story; **this is the most recent work and the immediate context.**
- Earlier engine state (idioms, ports, generators, terrain family, etc.) — see `docs/STATUS.md` and the
  memory-index in §9.

### 3.5 (2026-07-11 追加) 2D 端: 真迹供给线时代 — Sprint 74-81 digest

7 月上旬 2D 端 (Atlas Present) 经历一次供给线级转向, 按时间序:

1. **三级页面体系** (S73-74): 封面/目录/子标题 = 生成艺术 ARTWORK 页,
   内页 = subtle 元素。封面走 cover-canvas 管线 (ink 底→artwork 强度绘制→
   overlay scrim+字)。
2. **全语料二读审计** (S77, #298): ArtBlocks 公开 GraphQL 能直接拉链上原始
   脚本 — 50 课全部与原文逐 claim 对照。10 课 HIGH 事实错误, 12 家族
   voice miss。两条方法论铁律: **机制 claim 必须在原文找到对应行** (一读
   主要失误 = 把观感反推成机制); **体量感靠填充/累积不靠描线**。证据:
   `docs/superpowers/artblocks-study/76-corpus-second-reading-audit.md` + audit/。
3. **DECOR_V=4 二修 wave** (S78, #301): 10 家族按原作重绘。冻结纪律走
   **版本事件** (零外部铸造窗口 bump 版本 + 固件重烘限改动家族 + 其余
   键值级零漂移核对)。笔记勘误 35 课 (#300)。
4. **真迹转向** (S80-81, #304/#309) — user 裁定: *"PPT 非商用只证明逻辑,
   生成艺术是混沌系统, 一点改动就是美丑之别 — 原样跑原版, 不要瞎改动"*。
   链上脚本逐字在浏览器 iframe 运行 (原代码不进 repo; 产物在
   `sdf-js/examples/original-mints/cache/`, gitignore, manifest 记
   license/hash/status)。renderer 双入口: `decorArt` (封面全幅) +
   `decorArtStrip` (**小画布 mint 平铺画廊胶片条** — user: 小画布让整幅
   构图进标题栏)。**decor 引擎 25 家族降级为 subtle 层 + 无真迹 fallback**。
   cover.js overlay = 标题锚定径向渐晕 + 明度感知 (亮画→纸雾+墨字)。
5. **铸造病因五连** (复用价值高): ① iframe load 事件先于脚本注入 (补
   dispatch) ② 脚本顶层引用 p5 (引擎先载) ③ HTML 型脚本走 srcdoc
   ④ 原生 js 期望预置 canvas ⑤ p5 FES 吞 WebGL 异常 (手动调 setup() 抓
   真错)。browse headless **无 WebGL** — GL 作品需 Chrome 新 headless
   (`--headless=new` 自带 ANGLE Metal) 或带 GL 的运行器。
6. **产品语境**: ANTFUN 20 页真机 deck 是全程验证载体 (news-to-deck →
   五版生成艺术 PDF → 真迹版)。License 核查由 user 亲自负责 (ND 裁切=
   改编风险已写 original-mints/README)。

### 3.6 (2026-07-12 追加) 3D 端方向决策: 空间组织框架 — "为镜头组织空间"

User 判定 3D 端"翻页式组织空间是不对的", 提出组织空间/排布 atoms/类 ArtBlocks
修饰三点需求。工作 agent 的三层框架提案经 user 要求跑了 **4+1 轮对抗讨论**
(9 subagent, 攻击/裁决双方直接核查代码, 16 攻击 16 partial, 合议改判 3 处),
合议全文: `docs/superpowers/notes/2026-07-12-spatialplan-debate-synthesis.md`。
**任何 SpatialPlan/courtyard/zone 工作从合议出发, 不要回退到被打穿的原提案。**

要点: ① 框架奠基 = **为镜头组织空间**(观众无行动权, 空间感由镜头中介;
验收标准 = "哪一拍镜头消费它"); vista 降级为 crane/transit/threshold/finale
消费的素材。② 决策"替换 assemble-deck"被打穿 → 改单管线内加 layout 分支,
id 前缀/输出形态字节级保全, 三 layout golden snapshot 先行, transplant 机器不碰;
SpatialPlan IR 等 rule-of-two。③ zone = planSpace 内部概念, 真相源 = 2D 章节
语义(3D 不推断), 契约请求延后至"盲测+真契约 deck"双证据; **hold 站发射
(§9.5-3) 是契约部署硬前置**(48% slot→station 衰减实测)。④ Phase 1 =
spike-gated courtyard, landscape 平行对照(user 拍板四条: landscape 也做
spike / 石板→massing 接受 / hold 进 Phase 1 / 盲测双臂等价装饰)。
Spec/plan: `docs/superpowers/specs/2026-07-12-spatialplan-phase1-spec.md` +
`docs/superpowers/plans/2026-07-12-spatialplan-phase1-plan.md`(Wave 0 gate 周)。

---

## 4. The sphere-fill gauge (most recent work — full context)

**Goal:** faithful 3D twin of PresentationLoad "3D Spheres — Fill Levels" (the stun-demo fixture
`sdf-js/fixtures/D0961_3D-Spheres-Fill-Levels_16x9.pdf`, 20 pages, all sphere-fill variants). A glass
ball with coloured liquid filled to a readable % waterline.

**Two dead ends (don't repeat them):**
1. **Real glass refraction (kind 8)** makes a gorgeous marble but **destroys the level read** —
   refraction magnifies/fills the interior and smears the waterline. A gauge's whole job is to
   communicate the value → **stylized beats realistic for data atoms.**
2. **Two-cap geometry overlaid as two subjects** (liquid cap + glass cap) **can't be materialed** —
   both caps are cut from the same sphere so their outer surfaces **coincide**; the raymarch can't
   disambiguate which material at a shared hit, and **the first subject's material wins for the whole
   sphere** (proven by order-swap: glass-first → all light, liquid-first → all blue). This is a real
   **studio limitation: coincident-surface subjects can't carry different materials.** To give one
   object multiple materials split by geometry, do it as a **shader split inside ONE subject**, not two
   overlaid subjects.

**The solution (#134):**
- New material **kind `fill` (=9)**. Shades a **solid** sphere as a gauge, split by height at a
  waterline. **Key idiom: on a sphere, the surface normal's `n.y` IS the local height fraction**
  (`n.y = (p.y−c.y)/r`), so the split is `n.y < 2*fill−1` — **transform-invariant, needs no
  center/radius.** Liquid colour = material hue/sat/value; glass = light cool tint. **Lit flat**
  (strong ambient floor) so the liquid reads on the sun-shadowed underside — **data atoms favor
  legibility over realism.** Per-sphere fill rides in `u_leafPattern.w` (pattern slot [3]).
- `sphere-fill-3d` is now a row of **plain solid spheres**, each tagged with its fill via
  `_subjectPattern = {code:0,scale:0,strength:0, fill}`. Set the subject `material.kind:"fill"` +
  liquid hue/sat/value (without it → plain solid spheres, a safe fallback).
- **compile.js fix (load-bearing, fixes a whole class):** `compilePrimitive` now **pushes a subject
  transform DOWN onto union children** (mirroring `compileBoolean`), instead of wrapping the union in a
  transform op that `flattenUnion` can't descend — which collapsed all leaves into one and dropped
  per-leaf material/pattern (symptom: every sphere read fill=0 → all glass). **Mathematically
  equivalent** (transform acts on the query point; `min()` distributes over union). This fixes per-leaf
  data for **any multi-leaf primitive atom under a transform** — same class as the old canal "green" bug.
- Demo: `scenes/sphere-fill-gauge.json`. Test rewritten (20/20). Suite 89/89, lint 0 errors.
- **Camera handedness gotcha:** camera at `[0,1.5,7.5]` renders **+x on the LEFT** (right = up×forward =
  (−1,0,0)). So `levels[0]` appears rightmost. Not a bug — verified correct.

---

## 5. Product thesis (LOCKED — judgment context)

**Atlas Present = Atlas's first commercial product AND the engine's first application.** The engine
serves Present. Resources/OKRs concentrate here.

**Deep thesis: a *structure-aware spatial narrative renderer*.** A deck is like a document outline
(H1/H2/H3); the AI should understand that structure and render the matching *form* in 3D. **5 geometric
cores + nesting** (Sequence / Radial / Layered / Grid / Ring; 3 nesting levels max) — the user's
"dream." Key equivalence: **deck-level archetype = slide-level atom taxonomy = same vocabulary, fractal
at two scales.** Roots: Tufte "Escape Flatland" (1990) + "Cognitive Style of PowerPoint" (Columbia, 2006).
Competitive moat = three axes all ✅, only player with all: **layout intelligence × spatial 3D ×
structure-aware.** First users = spatially-cognitive people (architects, designers, generative artists,
consultants, researchers), **not** mass-market PPT users.

**Two-stage product:**
- **Stage 1 (2D end):** user types text → pseudo-3D slides; **owns semantics** (understands meaning).
- **Stage 2 (our 3D end):** reads a 2D deck (mainly **PDF**) → **VISUAL lift to 3D**. **No semantics** —
  recognizes "what shape, where" (visual structure), **not** "what it means." Input slides are already
  pseudo-3D; lift = "un-flatten back to 3D." Each slide → a station in **one continuous 3D world**;
  camera flies between (one `cameraSequence`). **Deck = ONE big SceneData**, not N slides.

**Stun demo:** upload PresentationLoad PDF → ~5s → 3D version + before/after video. (Don't redistribute
the PresentationLoad file; hand-pick stun pairs; privacy + rate-limit + BYOK.)

**Hard rules:** user does NOT pick the archetype (LLM detects, rules-first then LLM); camera is part of
the archetype. Marketing one-liner: *"Next-gen Prezi: describe what you want to present, Atlas generates
an immersive 3D presentation."* (kept as friendly framing; the product follows the spatial-narrative
thesis above).

---

## 6. Atom taxonomy (the atom library)

**Direct inheritance of PresentationLoad's 14 chart/diagram categories** (Agenda / Relationship / Data /
Layers / Hierarchy [Org+Pyramid] / Pie / Lists / Matrix / Mindmaps / **Progression⭐** / Column / Flow /
Timelines) + Atlas-only (Icons / Scene Templates / Camera Sequences). Full coverage ≈ **90–130 atoms**.
- **Atom name = user-facing name = SEO keyword = gallery slug** (one name, three uses).
- Boundary: Atlas does **not** do Maps / full Graphics / Design Templates.
- 2D atoms (`src/present/atoms-2d/`, ~68) ↔ 3D atoms (`src/scene/components/*-3d`, ~42); ~71% aligned.
- **Missing big category flagged by competitor analysis: Comparison/Opposition** (SWOT / 2×2 / binary) —
  Sprint 3 should add this archetype.
- **Composite atoms** (`src/scene/composite-atoms.js`): one type expands to multiple peer subjects
  (carrier-strike-group, airport-apron, harbor-quay, concert-stage). ⚠️ Only expanded on paths that call
  `expandCompositeAtoms` — **not** the studio `apply-studio-scene` path.

---

## 7. Immediate next steps (prioritized)

1. **Merge #134** (the fill gauge) once the user approves.
2. **Wire the PDF→3D lift pipeline end-to-end** (the real Stage-2 product loop). Teach the **lift system
   prompt**: for sphere-fill emit `material.kind:"fill"` + a liquid hue/sat/value.
3. **Per-sphere colours** for sphere-fill (the PDF has multi-colour sets; currently one liquid colour per
   subject — would need per-leaf material, which now survives transforms after #134).
4. **Decide the fate of glass kind 8** (unused): add a decorative demo or remove it. Don't let it rot.
5. **Test coverage:** the #134 compile.js push-down touches all primitives but only sphere-fill exercises
   "multi-leaf primitive + transform" — add a second multi-leaf atom test if we lean on it.
6. **Atom gap-fill** toward the stun demo (Comparison/Opposition archetype; remaining taxonomy atoms).
7. Studio decoupling Phase 1 (extract `applyStudioScene()` shared core) when convenient.
8. Backlog: Atlas-MCP server (post-stun: expose lift/render/execute/apply_patch to Claude Desktop/Code/
   Cursor; killer feature = `atlas_render` returns PNG bytes → closes the see-and-iterate loop).

---

## 8. User profile + how to work with them

- **Who:** the author of **BOB** (a generative-art system); an entrepreneur and meta-system thinker;
  fluent in raymarching/SDF (built a p5.js octahedron-lattice raymarcher). Email: stormspire100@gmail.com.
- **Foundational philosophy:** *art = choosing mappings* (`[0,1] → curve → [0,1]`). Buddhist anchor:
  "凡所有相皆是虚妄." Aesthetic: form/render decoupling; SDF as the form-axis champion.
- **Studies these artists** (distinct lineages — don't conflate): Tyler Hobbs / Jared Tarbell? no —
  Rayner, kjetil golid, IQ (Inigo Quilez), Mebarki-Jobard, Vera Molnár. (Verify before citing.)
- **Working style they want:** substantive engagement, honest push-back, no flattery; confirm
  abstraction decisions but move fast on bugs; PR discipline; short prompts. They're still learning `gh`
  — after pushing a branch, tell them the exact next command.
- **License:** PolyForm Noncommercial 1.0.0 (personal/academic free; commercial = contract via the email
  above). Ported MIT primitives (e.g. Fogleman) keep their MIT notice. IQ shaders are restrictive →
  **recipe-only ports** (reimplement idioms, never copy code; attribution + license note in each file).

---

## 9. Memory index (topics that existed in local memory — rebuild/ask as needed)

The local memory had ~50 topic files. The most load-bearing are captured above. The rest, by area, so a
fresh agent knows what knowledge existed (and can ask the user or re-derive):

**Strategy / thesis:** business thesis 5 points (AI=4th industrial revolution → coding is the strongest
AI commercial domain → SDF+LLM independently-discovered editable graphics gen → input/curve/output
decoupled & tradeable → new platform possible); 3-stage supply-reuse framework (geek assets → mass users
→ enterprise budget; GitHub/Figma/Notion pattern); 6 orthogonal axes (SDF × renderer × pattern × scene ×
cameraSequence × audio = O(N^6)); 3 math-elegance tests (closure / dimension-agnostic / code-is-data);
3-rung architecture map ("three.js lets the LLM *call* a renderer; Atlas lets the LLM *write* the world");
symbolic-vs-sampled state; binding-time framing (laws bound at compile/training/runtime); diffusion-vs-
LLM-coding boundary (precision content = diffusion's necessary loss = our moat); 10 advantages vs
diffusion; vs neural world models.

**Adjacent markets / commercial:** Lotta (editorial illustration TAM); PPT market adjacency; emoji/icon
mass-market TAM.

**Competitive intel (China rung-3 race, 2026-06):** Physis/逆矩阵 (>$100M seed++, physical latent +
RLVR sandbox; admits pure-generative has physics hallucination); LiberAI/刘松铭 (hundreds-of-millions
Pre-A; native physical-modality pretrain; shipped 2 embodied bases); Aether AI (causal-mechanism school,
Causal Copilot; complementary not competitive — they *discover* SCMs, Atlas *declares* code); Liblib/
演语 (~$300M ARR, China's most successful AI-app layer; lesson = supply-reuse + audience-broadening +
heavier monetization, NOT "build a community"); Loopit/涌跃 (closest architecture twin — LLM-writes-code
+ symbolic state + runtime loop + forkable; mobile p5-style games; ~$100M raised; "Agentic Coding ×
multimodal gen"; layered hypothesis: Atlas=supply, Loopit-style=distribution; **don't pivot to mobile
games**). Presentation-space: reveal.js (HTML slide framework, not text→slides AI — steal CSS themes /
auto-animate / vertical-nested / hash routing / speaker notes); Napkin AI (paragraph-level 2D
infographics ≠ deck-level 3D — steal: AI-suggestion variants, inline trigger, swap-layout/branding,
categorized templates); AntV Infographic (276 SVG templates — validates our SDF parametric layer; we
miss the Comparison archetype).

**Engine reference (read code for detail):** compositor entry points / state machine / scene-loading
pipeline; lift LLM integration; lift prompt evolution v1→v3.17; M0/M1 abstraction locks; two-text-systems
(narration = cheap DOM subtitle overlay; data labels = expensive in-scene SDF — decide by "must it stick
to the object & rotate?"); Step-2 hybrid deck player (`deck-player.js`, `?deck=` URL, `window.atlasLoadScene`);
typography waves (hand-built SDF monoline grotesk — extruded vs pipe); two-layer Generator (V=style
shipped, S=scatter/region shipped); shader idiom registry (67 idioms / 11 sprints); recipe-only port
pattern; terrain primitive family (4 types); procedural-city; Topo/Crayon/Lines/BOB ports; geometry
sanity checker; M3 component-porter agent; bonsai NFT plan; M0 lessons (15).

**Feedback rules (also in §1):** PR workflow; engage-don't-praise; decisions-at-abstraction-layer;
prompts-stay-short; shader-backtick trap; cross-renderer-constants; read-source-before-porting;
check-camera-type-before-probe-fix; bidirectional-streamline-is-intentional; BOB-vs-FLY diagnostic
("does BOB GPU show it too?" same→geometry/Lipschitz/NaN, only one→renderer-specific).

**Most recent finding (full detail in §4):** studio coincident-surface material limit + realism-vs-
readability + the `n.y`-is-height idiom + the compile transform-push-down fix.

---

## 9.5 给 3D 端: 下一步请吃 atlas-deck 层 (2026-07-10, 2D 端留言)

你们的 IR 层 e2e 很漂亮 (#268 采用 text-to-ir + #272 真机 10/10 + render-matrix
补齐第 5 结构 — matrix twin 两端已齐)。**下一层楼是 deck 层**: 吃 2D 端烤好的
deck.json, 而这一层的对接材料已经备好, 不必等联调现场再发现形状问题:

1. **契约唯一真相**: `docs/atlas-deck-contract.md` — 三种 "deck.json" 方言的
   地图 (atlas-deck 移交格式 / bake manifest / 你们的 scenes segments) + 逐字段
   规范。**先读 §0 方言地图**, 历史上这三个形状没人写清楚过。
2. **零依赖校验器**: `sdf-js/src/present/deck-spec.js` — 无 renderer/canvas
   依赖, node/浏览器直接 import。ERROR=拒收, WARNING=可继续 (未知 atom type
   请 no-op + log, 不要拒收整个 deck — 前向兼容契约)。
3. **弹药包**: `sdf-js/examples/deck-handoff/ammo/` — 15 个真实 atlas-deck
   (中文新闻/真季报/真融资稿/QBR/VC pitch…, 6-14 页, twin 覆盖 100%, 全过
   五轴 eval)。这就是 2D 端真实产出的分布, 直接当 e2e 输入。
4. **钉进 CI**: `deck-handoff/valid/` 5 边界 + `invalid/` 8 反例 (每个恰死于
   文件名标明的违约) — 把它们钉进你们的测试, 契约漂移死在 CI 里。

建议的最小对接路径: 校验器进你们 CI → 挑一个 ammo deck (推荐
`eval-qbr-earnings.json`, 10 页带衍生引用数字) 把每个 slot 的 sceneData 走
你们的 lift → 有任何契约缺口 (字段语义不清/缺字段/validator 误判) 直接改
本文档 §9.5 下面追加问题清单, 2D 端按 PR 快速响应。decor/shared/liftParams
三个字段可整体忽略 (2D 内部状态), 但 decor 若回传须逐字段保真 (作品身份)。

### §9.5 问题清单 (3D 端追加, 2026-07-10 — 第一轮消化完成)

对接已通: `atlasDeckToIR()` (scaffold-to-ir.js) 吃 atlas-deck → IR deck;
validator + 全部 valid/invalid fixtures 已钉进 3D CI (test-atlas-deck-handoff,
22 断言); 15 个 ammo 全过 validate、全链可播 (staged deck + presenter,
`figure.html?deck=handoff-qbr-earnings&stage=1&present=1`)。覆盖 59/123 slot
(48%), 每 deck ≥1 页。发现与请求:

1. **[请求] 混单位 KPI 页的可比性标注**。一页 kpi-card 混 $ 与 % (如
   qbr-earnings slot3 "Income Statement") 时, 3D 端拒绝把它们聚成同一组
   柱高 (会说谎), 整页 skip。若 2D 端能在 kpi args 或 slot 上标「可比组」
   (comparable group id), 3D 可分组出多列。低优先, 但真实分布里常见。
2. **[FYI, 3D 侧已解] 数字人类格式保真**: kpi value "$240.5M" 在 IR
   magnitude (纯数) 层曾丢格式、标签显示 240500000 — 已在 IR 加可选
   `display[]` (渲染标签优先用), KPI 聚合路径逐字保真, Rule 18-24 对齐。
3. **[3D 侧 backlog] 无结构页整页消失**: cover-only / bullet-list /
   quote-pull 页 lift 后没有站 (48% 覆盖的主因)。计划给「无结构页」一个
   hold 站 (纯 overlay 文本页), 让 3D deck 页数与 2D 对齐。非契约违约。
4. **[FYI] subjects/atoms 别名已兼容** (§5); atoms-only fixture 过 CI。
   新增 slot 级聚合: 一页 ≥2 张同单位 kpi-card (含 dashboard-multi-kpi-
   composite 的 kpis[]) = 一个 magnitude IR — 真实分布主力形状
   (kpi-card 77/423) 由此进入 3D。

## 9.6 给 3D 端: 装裱溯源 + 色彩工具, 两个现成的配合点 (2026-07-14, 2D 端留言)

看了你们 #341-#352 的弧线 (radial 默认 + 洞见浮屏/callout + Blender 借法四波 +
Infinigen 四课) — 2D 端这边 S93-98 (PR #354 起) 把范本文法/CJK/版式/色彩/
批量都收了尾。两端各欠一半的契约对称性, 2D 侧已在 S98 补齐 (ir.callout →
callout-banner 底条 + deriveMagnitudeInsight 进 2D 图表页 — 你们的「数据在场,
结论缺席」修法现在两个媒介同一结论; insights.js 我们是直接 import 的, 它保持
纯函数零 DOM 就好)。剩两件在你们地盘:

1. **figure.js 吃 deck.artMount (配合点 #1, 建议优先)**。契约新增 §3.5
   `artMount` 溯源块 (S97, `docs/atlas-deck-contract.md`): 2D 端出 deck 时若
   穿了真迹装裱 (ArtBlocks 原版脚本铸造), deck.json 会带
   `{id, name, artist, license, hash, palette:{accent, colors[]}}`。palette 是
   预烘焙的 — **不需要像素就能穿上作品的颜色**。而
   `apps/present/figure.js:26-31` 现在只认 `?palette=<theme-id>`。建议:
   deck 携带 artMount.palette 时优先之 —
   `{ anchor: artMount.palette.accent, colors: artMount.palette.colors }` 喂
   assembleDeck; URL 参数可保留为显式覆盖。这样同一份 deck.json, 纸上 PDF 和
   3D 飞行穿同一件真迹的颜色 — 「一份契约两个世界」的最后一块。加分项: 把
   name/artist/license 做成 overlay 溯源角标 (装裱是非商用铸造, license 随行
   是纪律)。批量对接: author-2d 的 📦 批量按钮 (S97/S98) 每份 PDF 旁存同名
   deck.json (带溯源), 你们拿到就能批量渲染配对飞行 — 「同一件真迹, 纸上与
   空间」是 before/after demo 的最强素材。校验器 (`deck-spec.js`) 与 18 断言
   (`scripts/test-mount-contract.mjs`) 已钉住字段形状。

2. **color.js 自取 (配合点 #5, 顺手)**。`src/present/atoms-2d/color.js` 纯函数
   零 DOM, 3D 侧可直接 import: `okDist(a,b)` OKLab 感知距离 —
   assemble-deck.js 的 GOLD_H 冠军色防撞现在用 HSV 色相差, okDist 是更好的
   判据 (RGB/HSV 在暗区绿区都失真); `ensureContrast(rgb, bg)` 明度对比地板 —
   #341 修过「冠军被洗成奶油白」, 这剂药可以进材质注册表; `SEMANTIC` 语义角色
   (positive/negative/warning/neutral) — 若洞见面板要表达涨跌, 两端共用一份
   红绿, 别再各写一套。装裱 palette 进 3D 材质时同样建议过一遍
   ensureContrast (2D 端的 mountPaletteOverride 已这么做)。

有契约缺口/字段语义问题, 照 §9.5 惯例在下面追加问题清单, 2D 端按 PR 响应。

### §9.6 回复 (3D 端, 2026-07-14)

配合点 #1 已完成 (PR 见本次分支):

- **透传**: `atlasDeckToIR` (scaffold-to-ir.js) 现在把契约 §3.5 的 `artMount`
  原样带进 3D IR deck — handoff 后溯源不丢。
- **优先级**: 新增 `src/scene/mount-palette.js` `resolveDeckPalette()` —
  `?palette=0` 显式关 > `?palette=<theme>` 显式覆盖 > `artMount.palette`
  (预烘焙) > 默认主题。figure.js 已接管线; 畸形 palette 静默回退默认 (不崩)。
- **对比度地板 (你们配合点 #5 的建议, 已采)**: 装裱色喂 assembleDeck 前逐色
  过 `ensureContrast` (直接 import 你们的 color.js) — 参照面是 deck 剧场的
  暗场底 `[30,32,36]` (2D 对纸白, 3D 对暗场, 方向相反是有意的: 我们提亮近黑,
  你们压暗近白)。
- **溯源角标 (加分项, 已做)**: `name — artist (license)` 常驻左下
  (`.stage-attribution`, figure.html), 不进 stage 时间线 (溯源不随章节隐现);
  无 name/artist 时不渲染空署名。
- **测试**: `scripts/test-mount-palette.mjs` 11 断言 (优先级×5 / 地板提亮 /
  溯源提取 / 空署名 / handoff 透传 / 换装生效 / hsv 存活), 已进 npm test
  (161 test files)。浏览器实测: bytedance deck + Fidenza 装裱 → network 站
  穿上 mount 绿族, 金色冠军不被夺, 角标 "Fidenza — Tyler Hobbs (nc)"。

配合点 #5 其余两件的消化进度 (未完成, 记录去向):

- `okDist` 替换 GOLD_H 的 HSV 防撞: 认同判据更好, 但它会改所有既有 deck 的
  accent 分配 → golden 全动 + 视觉变化, 我们想跟一次盲测批次一起换 (与
  horizon 混林盲测同批)。挂账在 3D 侧 backlog。
- `SEMANTIC` 共用红绿: 3D 洞见面板 (insights.js 的消费端) 目前不表达涨跌
  色; 等它需要那天直接 import, 不另写。

### §9.6 问题清单 (3D 端追加)

1. **批量配对的发现约定**: 📦 批量存的 deck.json 与 PDF 同名同目录 — 3D 端
   批量渲染时按什么根目录扫? 建议契约里写死一个相对路径约定 (如
   `exports/<batch-id>/*.deck.json`), 我们好写批量飞行渲染脚本。
2. `artMount.palette.colors` 有语义顺序吗 (主→次)? assignAccents 按数组序
   轮转 content 站, 若 2D 端已按视觉权重排序, 我们就不再自行重排; 若无序,
   告知一声, 我们会按 okDist 离 anchor 距离排一次。

## 10. For the next agent — start here

1. Read this file, `docs/STATUS.md`, `README.md`, and the repo-root `CLAUDE.md`.
2. Skim `src/render/studio.js` (material-kind dispatch + per-leaf LUTs), `src/scene/compile.js`
   (compilePrimitive / compileBoolean), `src/runtime/apply-studio-scene.js`, `src/scene/spec.js`
   (resolveMaterial / MATERIAL_KIND_INDEX).
3. Run the dev server, load `scenes/sphere-fill-gauge.json` in `apps/present/`, confirm the gauge renders.
4. Confirm `npm test` (should be ~89/89) and `npm run lint` (0 errors) are green.
5. Pick up at §7. When you make decisions or learn non-obvious things, **append them here** (this doc is
   the new persistent memory until local memory is available again) and PR it.
