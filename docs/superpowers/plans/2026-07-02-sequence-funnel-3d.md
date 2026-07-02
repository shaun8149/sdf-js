# Sequence / Funnel 3D — Vertical Slice 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the "structure-aware spatialization" direction by building ONE structure — a sales funnel you fly *through* — from an Intermediate Representation (IR), and blind-testing it against the flat 2D funnel of the same data.

**Architecture:** `IR → renderSequence(ir) → sceneData → studio (realtime WebGL)`. The renderer reads the IR **only** (never 2D x/y coordinates) so a `text → IR` front-end can plug in later with zero renderer changes. The "time dimension" (build-in / narrative) is delivered by the **camera fly-through** plus **page-level JS-timed label reveal** — NOT by `subject.animation`, because the engine's animation expression grammar supports only `sin/cos(t)` oscillation, not one-shot reveals (confirmed in `src/scene/expr.js`; grammar is `factor := '(' expr ')' | sin|cos '(' expr ')' | number | 't'`). Geometry build-ins are backlog (need an expr-grammar extension).

**Tech Stack:** Vanilla ES modules, WebGL2 studio renderer (`src/render/studio.js`), the existing SDF atom pipeline (`src/scene/compile.js`, `apply-studio-scene.js`), Canvas2D for the flat funnel (`src/present/atoms-2d/charts/data/funnel.js`). No new deps. Tests are plain `.mjs` files run by `scripts/run-tests.mjs`.

## Global Constraints

- **IR-decoupling rule:** `renderSequence` and any renderer read the IR object only — never a scaffold slot's `x/y/w/h`. This is the one architectural invariant.
- **Two-text-systems:** all labels/numbers are DOM overlay (projected), never baked SDF text.
- **Delivery:** realtime web; budget 60fps on a laptop browser.
- **Scope (YAGNI):** funnel sub-form of `sequence` only. No other structures, no `text → IR`, no deck assembly, no editor, no video export.
- **Git:** work on a feature branch; commit per task; **never push `main`, never self-merge** — open a PR and stop (repo rule in `CLAUDE.md`).
- **Tests:** every new module gets a `.mjs` test appended to the `TESTS` list in `scripts/run-tests.mjs`; `node scripts/run-tests.mjs` must stay green.

---

## File Structure

- `sdf-js/src/scene/ir.js` — **new.** IR schema constants + `validateIR(ir)`. One responsibility: define & validate the IR.
- `sdf-js/src/scene/components/charts/data/funnel-3d.js` — **modify.** Add optional `radii` (per-boundary radii) so stage widths can come from magnitude.
- `sdf-js/src/scene/compile.js` — **modify.** Forward `radii` in the `funnel-3d` wrapper.
- `sdf-js/src/scene/render-sequence.js` — **new.** `renderSequence(ir) → sceneData` (3D funnel form + fly-through camera + reveal-tagged overlay) and `renderSequence2d(ir) → { type:'funnel', args }` (maps IR → 2D funnel atom args).
- `sdf-js/src/scene/scaffold-to-ir.js` — **new.** `funnelSlotToIR(sceneData) → ir` — proves a real scaffold slot can produce the same IR the renderer consumes.
- `sdf-js/apps/present/figure.html` + `sdf-js/apps/present/figure.js` — **new.** Standalone live figure page: mounts studio, applies `renderSequence(ir)`, plays the camera, fades stage labels in by sequence time. `?ir=<name>` loads a fixture.
- `sdf-js/apps/present/blind.html` — **new.** Blind-pick page: 2D funnel canvas and the 3D figure iframe, side by side, randomized left/right, unlabelled.
- `sdf-js/scenes/ir/funnel-sales.json` — **new.** One IR fixture (the vc-pitch-style sales funnel) both pages/tests use.
- `sdf-js/scripts/test-ir.mjs`, `test-render-sequence.mjs`, `test-scaffold-to-ir.mjs`, `test-funnel-3d-radii.mjs` — **new.** Unit tests.

---

### Task 1: IR schema + `validateIR`

**Files:**
- Create: `sdf-js/src/scene/ir.js`
- Test: `sdf-js/scripts/test-ir.mjs`

**Interfaces:**
- Produces: `validateIR(ir) → { ok: boolean, errors: string[] }`; `STRUCTURES` (array of valid `structure` strings, `['sequence']` for now).
- IR v0 shape (grown from funnel): `{ structure, nodes: string[], magnitude?: number[], relations?: [], emphasis?: number[], order?: number[], title?: string }`.

- [ ] **Step 1: Write the failing test**

```js
// sdf-js/scripts/test-ir.mjs
import { validateIR, STRUCTURES } from '../src/scene/ir.js';

let pass = 0, fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== ir (validateIR) ===\n');

ok(STRUCTURES.includes('sequence'), 'sequence is a known structure');

const good = { structure: 'sequence', nodes: ['A', 'B', 'C'], magnitude: [100, 40, 10], order: [0, 1, 2] };
ok(validateIR(good).ok, 'a well-formed sequence IR validates');

ok(!validateIR({ structure: 'nope', nodes: ['A'] }).ok, 'unknown structure rejected');
ok(!validateIR({ structure: 'sequence', nodes: [] }).ok, 'empty nodes rejected');
ok(!validateIR({ structure: 'sequence', nodes: ['A', 'B'], magnitude: [1] }).ok, 'magnitude length must match nodes');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node sdf-js/scripts/test-ir.mjs`
Expected: FAIL — `Cannot find module '../src/scene/ir.js'`.

- [ ] **Step 3: Write minimal implementation**

```js
// sdf-js/src/scene/ir.js
// Intermediate Representation: the neutral "what structure does this content have"
// that decouples input (scaffold / text) from 3D rendering. v0, grown from the funnel.
export const STRUCTURES = ['sequence'];

export function validateIR(ir) {
  const errors = [];
  if (!ir || typeof ir !== 'object') return { ok: false, errors: ['ir must be an object'] };
  if (!STRUCTURES.includes(ir.structure)) errors.push(`unknown structure "${ir.structure}"`);
  if (!Array.isArray(ir.nodes) || ir.nodes.length === 0) errors.push('nodes must be a non-empty array');
  if (ir.magnitude != null) {
    if (!Array.isArray(ir.magnitude)) errors.push('magnitude must be an array');
    else if (Array.isArray(ir.nodes) && ir.magnitude.length !== ir.nodes.length)
      errors.push('magnitude length must match nodes length');
  }
  if (ir.order != null && (!Array.isArray(ir.order) || ir.order.length !== (ir.nodes || []).length))
    errors.push('order length must match nodes length');
  return { ok: errors.length === 0, errors };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node sdf-js/scripts/test-ir.mjs`
Expected: PASS — `5 passed, 0 failed`.

- [ ] **Step 5: Register the test + commit**

Add to `scripts/run-tests.mjs` TESTS array (after the `test-lift-scaffold.mjs` line):
```js
  { category: 'scene', file: 'sdf-js/scripts/test-ir.mjs' },
```
Then:
```bash
git add sdf-js/src/scene/ir.js sdf-js/scripts/test-ir.mjs scripts/run-tests.mjs
git commit -m "feat(ir): IR v0 schema + validateIR (structure/nodes/magnitude)"
```

---

### Task 2: `funnel-3d` per-boundary radii (magnitude → stage widths)

**Files:**
- Modify: `sdf-js/src/scene/components/charts/data/funnel-3d.js`
- Modify: `sdf-js/src/scene/compile.js` (the `'funnel-3d':` wrapper, ~line 693)
- Test: `sdf-js/scripts/test-funnel-3d-radii.mjs`

**Interfaces:**
- Produces: `funnel3dSDF({ stages, radii?, ... })` — when `radii` (length `stages+1` boundary radii, top→bottom) is given, each stage `i` is a `capped_cone(radii[i] → radii[i+1])`; when absent, the existing linear `topRadius→bottomRadius` taper is unchanged.

Current loop (funnel-3d.js:32-39) uses `radAt(frac)`. We add a `radii` branch.

- [ ] **Step 1: Write the failing test**

```js
// sdf-js/scripts/test-funnel-3d-radii.mjs
import { funnel3dSDF } from '../src/scene/components/charts/data/funnel-3d.js';

let pass = 0, fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== funnel-3d radii ===\n');

// no radii → still builds (linear taper path unchanged)
ok(funnel3dSDF({ stages: 4 }) != null, 'linear taper path still builds');

// radii given → builds; the AST records the per-boundary radii we passed
const sdf = funnel3dSDF({ stages: 3, radii: [1.0, 0.6, 0.3, 0.1] });
ok(sdf != null, 'radii path builds');
ok(sdf.ast && sdf.ast.name === 'funnel-3d', 'still a funnel-3d prim');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node sdf-js/scripts/test-funnel-3d-radii.mjs`
Expected: FAIL — radii is ignored today, but more importantly the test asserts nothing new yet fails only if the file is missing; run it and confirm it currently PASSES the build asserts. If it passes without changes, tighten: add `ok(sdf.ast.args, 'ast has args')` — the point of this task is the code change below; the test guards that `radii` does not break the build.

- [ ] **Step 3: Write minimal implementation**

In `funnel-3d.js`, extend the signature and loop:
```js
export function funnel3dSDF({
  stages = 4,
  topRadius = 0.95,
  bottomRadius = 0.22,
  stageHeight = 0.4,
  gap = 0.06,
  colors = null,
  radii = null,           // NEW: per-boundary radii, length stages+1, top→bottom
} = {}) {
  const N = Math.max(1, Math.floor(stages));
  const totalH = N * stageHeight + (N - 1) * gap;
  const useRadii = Array.isArray(radii) && radii.length >= N + 1;
  const radAt = (frac) => topRadius + frac * (bottomRadius - topRadius);
  const parts = [];
  for (let i = 0; i < N; i++) {
    const rT = useRadii ? radii[i] : radAt(i / N);
    const rB = useRadii ? radii[i + 1] : radAt((i + 1) / N);
    const yTop = totalH / 2 - i * (stageHeight + gap);
    const yBot = yTop - stageHeight;
    const seg = capped_cone([0, yTop, 0], [0, yBot, 0], rT, rB);
    if (colors && colors[i] != null) seg._subjectMaterial = resolveMaterial(colors[i]) || seg._subjectMaterial;
    parts.push(seg);
  }
  const out = parts.length === 1 ? parts[0] : union(...parts);
  return out;
}
```
(Keep the existing `import { capped_cone } ...`, `union`, `resolveMaterial`, and the `inst.ast = {...}` tail exactly as they are; only the signature + `rT/rB` lines change. If the current file has no `ast` on the union path, leave that untouched — the test's `ast.name` assert targets the existing behavior; if the union path returns no `.ast`, drop that one assert.)

In `compile.js`, the `funnel-3d` wrapper — add `radii`:
```js
  'funnel-3d': (a) =>
    funnel3dSDF({
      stages: a.stages ?? a.count ?? 4,
      topRadius: a.topRadius ?? 0.95,
      bottomRadius: a.bottomRadius ?? 0.22,
      stageHeight: a.stageHeight ?? 0.4,
      gap: a.gap ?? 0.06,
      colors: a.colors ?? null,
      radii: a.radii ?? null,
    }),
```

- [ ] **Step 4: Run tests**

Run: `node sdf-js/scripts/test-funnel-3d-radii.mjs` → PASS.
Run: `node scripts/run-tests.mjs` → still green (existing `test-funnel-3d.mjs` unaffected — linear path unchanged).

- [ ] **Step 5: Register test + commit**

Add to `scripts/run-tests.mjs`: `{ category: 'diagram', file: 'sdf-js/scripts/test-funnel-3d-radii.mjs' },`
```bash
git add sdf-js/src/scene/components/charts/data/funnel-3d.js sdf-js/src/scene/compile.js sdf-js/scripts/test-funnel-3d-radii.mjs scripts/run-tests.mjs
git commit -m "feat(funnel-3d): optional per-boundary radii (magnitude-driven widths)"
```

---

### Task 3: `renderSequence(ir) → sceneData` (funnel form + fly-through camera)

**Files:**
- Create: `sdf-js/src/scene/render-sequence.js`
- Test: `sdf-js/scripts/test-render-sequence.mjs`

**Interfaces:**
- Consumes: `validateIR` (Task 1).
- Produces:
  - `renderSequence(ir) → sceneData` — a v1 scene with ONE `funnel-3d` subject (radii from `ir.magnitude`), a `cameraSequence` that descends *through* the funnel axis and ends framed on the emphasis stage, and `overlay[]` stage labels each tagged with a `revealAt` seconds value (consumed by the figure page, Task 6). Reads `ir` only.
  - `magnitudeToRadii(magnitude, maxR, tipR) → number[]` (length N+1) — area-proportional boundary radii + a tip.

- [ ] **Step 1: Write the failing test**

```js
// sdf-js/scripts/test-render-sequence.mjs
import { renderSequence, magnitudeToRadii } from '../src/scene/render-sequence.js';

let pass = 0, fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== render-sequence (3D funnel) ===\n');

const ir = { structure: 'sequence', nodes: ['Leads', 'Qualified', 'Proposal', 'Closed'],
  magnitude: [1000, 400, 150, 40], emphasis: [3], order: [0, 1, 2, 3], title: 'Sales Funnel' };

// radii: monotonically narrowing, length N+1, last is the tip
const r = magnitudeToRadii(ir.magnitude, 1.4, 0.12);
ok(r.length === 5, 'radii has N+1 boundaries');
ok(r[0] > r[1] && r[1] > r[2], 'radii narrow with magnitude');
ok(Math.abs(r[4] - 0.12) < 1e-9, 'last boundary is the tip radius');

const scene = renderSequence(ir);
ok(scene.subjects.length === 1 && scene.subjects[0].type === 'funnel-3d', 'one funnel-3d subject');
ok(scene.subjects[0].args.stages === 4, 'stages == nodes.length');
ok(Array.isArray(scene.subjects[0].args.radii) && scene.subjects[0].args.radii.length === 5, 'radii passed to atom');
ok(scene.cameraSequence && scene.cameraSequence.shots.length >= 2, 'has a multi-shot fly-through');

// fly-through: camera Y descends across shots (through the funnel axis)
const ys = scene.cameraSequence.shots.map((s) => s.pos[1]);
ok(ys[0] > ys[ys.length - 1], 'camera descends (fly-through)');

// labels → overlay, each with a revealAt; title present; NO baked SDF text
const labels = scene.overlay.filter((o) => o.role === 'card' || o.role === 'value');
ok(labels.length === 4 && labels.every((o) => typeof o.revealAt === 'number'), '4 stage labels, each reveal-tagged');
ok(scene.overlay.some((o) => o.role === 'title'), 'title in overlay');
ok(scene.subjects.every((s) => !/text/.test(s.type)), 'no baked SDF text');

// IR-decoupling: renderSequence must not read x/y — feeding an IR with x/y changes nothing
const withXY = { ...ir, nodes: ir.nodes.map((n) => ({ label: n, x: 999, y: 999 })) };
// nodes may be strings or {label}; renderSequence reads label/magnitude, never x/y
const s2 = renderSequence({ ...ir });
ok(JSON.stringify(s2.subjects[0].args.radii) === JSON.stringify(scene.subjects[0].args.radii), 'deterministic from IR');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node sdf-js/scripts/test-render-sequence.mjs`
Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```js
// sdf-js/src/scene/render-sequence.js
// Structure renderer #1: sequence → funnel. Reads the IR ONLY (never 2D x/y).
// The "time dimension" is the camera fly-through + revealAt-tagged overlay labels
// (the figure page fades them in by sequence time). No subject.animation (the engine's
// expr grammar can't do one-shot reveals — see plan Context).
import { validateIR } from './ir.js';

const label = (n) => (typeof n === 'string' ? n : (n && (n.label ?? n.name)) || '');

// area-proportional boundary radii (sqrt of magnitude), plus a tip. Length N+1.
export function magnitudeToRadii(magnitude, maxR = 1.4, tipR = 0.12) {
  const m = (magnitude || []).map((x) => Math.max(0, Number(x) || 0));
  const mMax = Math.max(...m, 1);
  const r = m.map((x) => Math.max(tipR, maxR * Math.sqrt(x / mMax)));
  r.push(tipR); // converge to a tip below the last stage
  return r;
}

const DEFAULT_MAT = { hue: 0.04, sat: 0.72, value: 0.82, kind: 'normal', roughness: 0.3, clearcoat: 0.45 };

export function renderSequence(ir) {
  const v = validateIR(ir);
  if (!v.ok) throw new Error(`renderSequence: invalid IR — ${v.errors.join('; ')}`);

  const nodes = ir.nodes.map(label);
  const N = nodes.length;
  const mag = ir.magnitude || nodes.map(() => 1);
  const order = ir.order && ir.order.length === N ? ir.order : nodes.map((_, i) => i);
  const emphasis = new Set(ir.emphasis || [N - 1]);

  const stageHeight = 0.55, gap = 0.12;
  const radii = magnitudeToRadii(mag, 1.4, 0.12);
  const totalH = N * stageHeight + (N - 1) * gap;
  const topY = 1.6 + totalH / 2; // funnel sits centred around y≈1.6

  const subject = {
    id: 'funnel',
    type: 'funnel-3d',
    args: { stages: N, radii, stageHeight, gap },
    transform: { translate: [0, 1.6, 0] },
    material: { ...DEFAULT_MAT },
  };

  // stage centre Y (top→bottom), for label anchors + camera targets
  const stageY = (i) => topY - stageHeight / 2 - i * (stageHeight + gap);

  // fly-through: start high above the mouth, descend through the axis to the emphasis stage.
  const holdEach = 1.6; // seconds the camera lingers per stage
  const shots = [];
  shots.push({ duration: 0.01, pos: [0.6, topY + 2.4, 6.2], target: [0, topY, 0], fov: 52, aperture: 0, focalDistance: 6, ease: 'smooth' });
  for (let i = 0; i < N; i++) {
    const y = stageY(i);
    shots.push({ duration: holdEach, pos: [0, y + 0.9, Math.max(2.6, radii[i] * 3.2 + 2.2)], target: [0, y, 0], fov: 46, transition: 'blend', aperture: 0, focalDistance: 4, ease: 'smooth' });
  }

  // labels → overlay, reveal-tagged by shot arrival (shot i+1 starts at 0.01 + i*holdEach)
  const overlay = [{ text: String(ir.title || nodes[0]).toUpperCase(), anchor: [0, topY + 1.4, 0], role: 'title' }];
  for (const i of order) {
    const y = stageY(i);
    const revealAt = 0.01 + i * holdEach; // seconds
    overlay.push({ text: nodes[i], anchor: [radii[i] + 0.5, y, 0], role: 'card', align: 'left', revealAt });
    overlay.push({ text: String(mag[i]), anchor: [0, y, radii[i] + 0.2], role: 'value', radius: emphasis.has(i) ? 0.5 : 0.36, revealAt });
  }

  return {
    v: 1,
    name: `(sequence) ${ir.title || 'funnel'}`,
    subjects: [subject],
    overlay,
    cameraSequence: { loop: false, shots },
    defaults: { stage: { size: [16, 12, 11] } },
  };
}

// IR → 2D funnel atom args (for the flat counterpart / blind test)
export function renderSequence2d(ir) {
  const nodes = ir.nodes.map(label);
  const mag = ir.magnitude || nodes.map(() => 1);
  return { type: 'funnel', args: { title: ir.title || '', stages: nodes.map((n, i) => ({ label: n, value: mag[i] })) } };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node sdf-js/scripts/test-render-sequence.mjs` → PASS (all asserts).

- [ ] **Step 5: Compile-check the produced scene**

Add a temporary check (or reuse the repo's compile path). Inline node:
```bash
node --input-type=module -e "
import { renderSequence } from './sdf-js/src/scene/render-sequence.js';
import { compile } from './sdf-js/src/scene/index.js';
import { expandStage } from './sdf-js/src/scene/stage.js';
const ir={structure:'sequence',nodes:['Leads','Qualified','Proposal','Closed'],magnitude:[1000,400,150,40],emphasis:[3],title:'Sales Funnel'};
const s=renderSequence(ir); compile(expandStage(s),{}); console.log('compiles OK', s.subjects[0].args.radii.map(r=>r.toFixed(2)).join(','));
"
```
Expected: `compiles OK 1.40,0.89,0.55,0.28,0.12` (radii narrow to tip). If compile throws, fix the scene shape before committing.

- [ ] **Step 6: Register test + commit**

Add to `scripts/run-tests.mjs`: `{ category: 'scene', file: 'sdf-js/scripts/test-render-sequence.mjs' },`
```bash
git add sdf-js/src/scene/render-sequence.js sdf-js/scripts/test-render-sequence.mjs scripts/run-tests.mjs
git commit -m "feat(render-sequence): IR → 3D funnel form + fly-through camera + reveal-tagged labels"
```

---

### Task 4: `scaffold-to-ir` — prove the input seam

**Files:**
- Create: `sdf-js/src/scene/scaffold-to-ir.js`
- Test: `sdf-js/scripts/test-scaffold-to-ir.mjs`

**Interfaces:**
- Produces: `funnelSlotToIR(sceneData) → ir` — reads a scaffold slot's `funnel` subject `args.stages` (each `{label, value}`), emits a `sequence` IR. Never reads `x/y/w/h`.

- [ ] **Step 1: Write the failing test**

```js
// sdf-js/scripts/test-scaffold-to-ir.mjs
import { funnelSlotToIR } from '../src/scene/scaffold-to-ir.js';
import { validateIR } from '../src/scene/ir.js';

let pass = 0, fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== scaffold-to-ir (funnel) ===\n');

const slot = { name: 'ask', subjects: [
  { type: 'funnel', x: 80, y: 120, w: 520, h: 480,
    args: { title: 'Sales Funnel', stages: [
      { label: 'Leads', value: 1000 }, { label: 'Qualified', value: 400 },
      { label: 'Proposal', value: 150 }, { label: 'Closed', value: 40 } ] } } ] };

const ir = funnelSlotToIR(slot);
ok(validateIR(ir).ok, 'produces a valid IR');
ok(ir.structure === 'sequence', 'structure = sequence');
ok(JSON.stringify(ir.nodes) === JSON.stringify(['Leads', 'Qualified', 'Proposal', 'Closed']), 'nodes from stage labels');
ok(JSON.stringify(ir.magnitude) === JSON.stringify([1000, 400, 150, 40]), 'magnitude from stage values');
ok(!JSON.stringify(ir).includes('120') && !JSON.stringify(ir).includes('520'), 'IR carries no x/y/w/h');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: Run → FAIL** (module missing). `node sdf-js/scripts/test-scaffold-to-ir.mjs`

- [ ] **Step 3: Implement**

```js
// sdf-js/src/scene/scaffold-to-ir.js
// Input adapter: a 2D scaffold slot with a funnel → sequence IR. Reads data only,
// never x/y/w/h — that's what lets a text→IR adapter slot in later unchanged.
export function funnelSlotToIR(sceneData) {
  const f = (sceneData.subjects || []).find((s) => s.type === 'funnel');
  if (!f) throw new Error('funnelSlotToIR: no funnel subject in slot');
  const stages = Array.isArray(f.args?.stages) ? f.args.stages : [];
  return {
    structure: 'sequence',
    nodes: stages.map((s) => (typeof s === 'string' ? s : s.label || '')),
    magnitude: stages.map((s) => Number(s?.value) || 0),
    emphasis: [Math.max(0, stages.length - 1)],
    order: stages.map((_, i) => i),
    title: f.args?.title || '',
  };
}
```

- [ ] **Step 4: Run → PASS.** `node sdf-js/scripts/test-scaffold-to-ir.mjs`

- [ ] **Step 5: Register test + commit**

Add to `scripts/run-tests.mjs`: `{ category: 'scene', file: 'sdf-js/scripts/test-scaffold-to-ir.mjs' },`
```bash
git add sdf-js/src/scene/scaffold-to-ir.js sdf-js/scripts/test-scaffold-to-ir.mjs scripts/run-tests.mjs
git commit -m "feat(scaffold-to-ir): 2D funnel slot → sequence IR (input seam, no x/y)"
```

---

### Task 5: The IR fixture

**Files:**
- Create: `sdf-js/scenes/ir/funnel-sales.json`

- [ ] **Step 1: Write the fixture**

```json
{
  "structure": "sequence",
  "nodes": ["Leads", "Qualified", "Proposal", "Negotiation", "Closed"],
  "magnitude": [1200, 520, 240, 110, 45],
  "emphasis": [4],
  "order": [0, 1, 2, 3, 4],
  "title": "Sales Funnel"
}
```

- [ ] **Step 2: Verify it validates + renders**

```bash
node --input-type=module -e "
import { readFileSync } from 'node:fs';
import { validateIR } from './sdf-js/src/scene/ir.js';
import { renderSequence } from './sdf-js/src/scene/render-sequence.js';
const ir=JSON.parse(readFileSync('sdf-js/scenes/ir/funnel-sales.json','utf8'));
console.log('valid:', validateIR(ir).ok, '| stages:', renderSequence(ir).subjects[0].args.stages);
"
```
Expected: `valid: true | stages: 5`.

- [ ] **Step 3: Commit**

```bash
git add sdf-js/scenes/ir/funnel-sales.json
git commit -m "feat(ir): sales-funnel IR fixture"
```

---

### Task 6: Live figure page (3D fly-through + timed label reveal)

**Files:**
- Create: `sdf-js/apps/present/figure.html`
- Create: `sdf-js/apps/present/figure.js`

**Interfaces:**
- Consumes: `renderSequence` (Task 3), the studio (`createStudioRenderer`, `applyStudioScene`, `studio.setSequence`, `studio.getSequenceTime`, `studio.project`, `studio.requestRender`), `makeOverlay` is NOT reused (we drive our own reveal-timed overlay).
- Behavior: `?ir=funnel-sales` fetches `scenes/ir/<name>.json` → `renderSequence(ir)` → mount + play. A rAF loop reads `studio.getSequenceTime()` and, for each overlay item, projects its anchor via `studio.project()` and sets opacity = `time >= revealAt ? fade-in : 0`.

- [ ] **Step 1: Write `figure.html`**

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Atlas Figure — sequence/funnel</title>
    <style>
      html, body { margin: 0; height: 100%; background: #0e0f12; overflow: hidden; }
      #wrap { position: fixed; inset: 0; }
      #c { display: block; width: 100%; height: 100%; }
      .lbl { position: fixed; transform: translate(-50%, -50%); pointer-events: none;
        font: 600 13px -apple-system, Inter, sans-serif; color: #fff; padding: 4px 10px;
        border-radius: 5px; background: rgba(30,32,40,0.82); opacity: 0; transition: opacity .5s; white-space: nowrap; }
      .lbl.value { background: rgba(40,116,196,0.92); font-weight: 700; }
    </style>
  </head>
  <body>
    <div id="wrap"><canvas id="c"></canvas></div>
    <script type="module" src="./figure.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Write `figure.js`**

```js
import { createStudioRenderer } from '../../src/render/studio.js';
import { applyStudioScene } from '../../src/runtime/apply-studio-scene.js';
import { renderSequence } from '../../src/scene/render-sequence.js';

const wrap = document.getElementById('wrap');
const canvas = document.getElementById('c');
function size() { canvas.width = wrap.clientWidth; canvas.height = wrap.clientHeight; }
size();

const studio = createStudioRenderer({
  canvas,
  getControls: () => ({ lightAzim: 0.5, lightAlt: 0.7, lightDist: 30, fov: 1.5, shadowsOn: true, groundOn: true, checkerOn: true }),
  onFps: () => {},
});
window.addEventListener('resize', () => { size(); studio.requestRender && studio.requestRender(); });

const name = new URLSearchParams(location.search).get('ir') || 'funnel-sales';
const ir = await (await fetch(`../../scenes/ir/${name}.json`)).json();
const scene = renderSequence(ir);
applyStudioScene(studio, scene);
if (studio.setSequence) studio.setSequence(scene.cameraSequence);

// our own reveal-timed overlay (labels fade in as the camera reaches each stage)
const items = (scene.overlay || []).filter((o) => o.anchor && o.text);
const els = items.map((o) => {
  const d = document.createElement('div');
  d.className = 'lbl' + (o.role === 'value' ? ' value' : '') + (o.role === 'title' ? ' title' : '');
  d.textContent = o.text;
  if (o.role === 'title') { d.style.fontSize = '20px'; d.style.fontWeight = '900'; }
  document.body.appendChild(d);
  return d;
});
function tick() {
  const t = studio.getSequenceTime ? studio.getSequenceTime() : 1e9;
  for (let i = 0; i < items.length; i++) {
    const o = items[i], el = els[i];
    const p = studio.project(o.anchor);
    if (!p || !p.visible) { el.style.opacity = 0; continue; }
    el.style.left = `${p.x * canvas.clientWidth}px`;
    el.style.top = `${p.y * canvas.clientHeight}px`;
    const revealed = o.revealAt == null || t >= o.revealAt;
    el.style.opacity = revealed ? 1 : 0;
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
```
(Note the relative paths: `apps/present/` → `../../src/...` and `../../scenes/...`, matching `present.js`.)

- [ ] **Step 3: Verify with the browser (Playwright)**

- Start dev server if not running (`python3 dev-server.py 8001` from repo root per project memory).
- Navigate to `http://127.0.0.1:8001/apps/present/figure.html?ir=funnel-sales`, wait ~8s (the fly-through), screenshot.
- Expected: a **converging funnel** (wide top → narrow tip), the camera visibly **descending through it**, stage labels (Leads/Qualified/…/Closed) + magnitudes **fading in top→bottom** as the camera passes, "SALES FUNNEL" title on top. No console errors.
- If the camera does not descend / funnel is inverted / labels mis-anchored, fix `renderSequence` shot params or anchor Y before committing.

- [ ] **Step 4: Commit**

```bash
git add sdf-js/apps/present/figure.html sdf-js/apps/present/figure.js
git commit -m "feat(present): live sequence/funnel figure — fly-through + timed label reveal"
```

---

### Task 7: Blind-pick page (2D vs 3D)

**Files:**
- Create: `sdf-js/apps/present/blind.html`

**Interfaces:**
- Consumes: `renderSequence2d` (Task 3) + `drawPseudo3D` from `src/present/atoms-2d/charts/data/funnel.js`; the 3D side is the Task 6 figure via `<iframe>`.

- [ ] **Step 1: Write `blind.html`**

```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Which is more persuasive?</title>
    <style>
      html, body { margin: 0; height: 100%; background: #f4f2ee; font-family: -apple-system, Inter, sans-serif; }
      .q { text-align: center; padding: 14px; font-size: 15px; font-weight: 600; }
      .split { display: flex; height: calc(100% - 100px); gap: 16px; padding: 0 16px 16px; }
      .pane { flex: 1; background: #fff; border: 1px solid #ddd8cf; border-radius: 8px; overflow: hidden; display: flex; align-items: center; justify-content: center; }
      .pane iframe, .pane canvas { width: 100%; height: 100%; border: 0; }
      .pick { text-align: center; padding-bottom: 16px; }
      .pick button { font-size: 15px; padding: 10px 22px; margin: 0 10px; border-radius: 6px; border: 1px solid #333; background: #fff; cursor: pointer; }
    </style>
  </head>
  <body>
    <div class="q">For a pitch, which is more persuasive? (pick the left or right panel)</div>
    <div class="split">
      <div class="pane" id="left"></div>
      <div class="pane" id="right"></div>
    </div>
    <div class="pick"><button data-side="left">◀ Left</button><button data-side="right">Right ▶</button></div>
    <script type="module">
      import { renderSequence2d } from '../../src/scene/render-sequence.js';
      import { drawPseudo3D } from '../../src/present/atoms-2d/charts/data/funnel.js';

      const name = new URLSearchParams(location.search).get('ir') || 'funnel-sales';
      const ir = await (await fetch(`../../scenes/ir/${name}.json`)).json();

      function make2d() {
        const cv = document.createElement('canvas'); cv.width = 620; cv.height = 620;
        const ctx = cv.getContext('2d');
        const { args } = renderSequence2d(ir);
        drawPseudo3D(ctx, args, { x: 40, y: 40, w: 540, h: 540, palette: {} });
        return cv;
      }
      function make3d() {
        const f = document.createElement('iframe');
        f.src = `./figure.html?ir=${encodeURIComponent(name)}`;
        return f;
      }
      // randomize left/right, unlabelled
      const threeLeft = Math.random() < 0.5;
      document.getElementById('left').appendChild(threeLeft ? make3d() : make2d());
      document.getElementById('right').appendChild(threeLeft ? make2d() : make3d());

      const truth = { leftIs3d: threeLeft };
      document.querySelectorAll('.pick button').forEach((b) =>
        b.addEventListener('click', () => {
          const picked3d = (b.dataset.side === 'left') === truth.leftIs3d;
          console.log('PICK', b.dataset.side, '→', picked3d ? '3D' : '2D'); // tally offline
          alert(`Recorded: you picked the ${picked3d ? '3D' : '2D'} version.`);
        }),
      );
    </script>
  </body>
</html>
```

- [ ] **Step 2: Verify with the browser (Playwright)**

- Navigate to `http://127.0.0.1:8001/apps/present/blind.html?ir=funnel-sales`, wait ~8s, screenshot.
- Expected: two panels — a flat 2D funnel and the live 3D fly-through — randomized L/R, unlabelled, with Left/Right buttons. Reload a few times to confirm the side randomizes.

- [ ] **Step 3: Commit**

```bash
git add sdf-js/apps/present/blind.html
git commit -m "feat(present): blind-pick page — 2D vs 3D funnel, randomized"
```

---

### Task 8: Run the go/no-go test + open PR

- [ ] **Step 1: Full test suite green**

Run: `node scripts/run-tests.mjs` → all pass (4 new test files registered).

- [ ] **Step 2: Run the blind pick**

Share `http://…/apps/present/blind.html?ir=funnel-sales` with **5–8 people**; each: one blind pick on "which is more persuasive for a pitch." Tally the console `PICK … → 3D/2D`.
**Decision:** 3D chosen by **≥ 70%** → GO (build hierarchy / network / magnitude on this pattern). Else → NO-GO (the direction dies cheaply; write up the finding).

- [ ] **Step 3: Push branch + open PR (do NOT merge)**

```bash
git push -u origin <feature-branch>
gh pr create --title "feat: sequence/funnel 3D — vertical slice 1 (IR + fly-through + blind test)" --body "..."
```
Stop. Report the PR URL + the blind-pick result to the user.

---

## Self-Review

**Spec coverage:**
- §3 IR-decoupling → Task 1 (IR), Task 3 (`renderSequence` reads IR; test asserts determinism-from-IR), Task 4 (scaffold→IR carries no x/y). ✓
- §4 IR v0 six fields → Task 1 schema (structure/nodes/magnitude/relations/emphasis/order). ✓
- §5 form (magnitude-driven funnel) → Task 2 (radii) + Task 3 (`magnitudeToRadii`). ✓
- §5 camera fly-through → Task 3 (descending shots; test asserts descent). ✓
- §5 build-in → **revised** to camera reveal + timed overlay (Task 3 `revealAt`, Task 6 fade loop) because `subject.animation` can't do one-shot reveals (documented in Context). ✓
- §5 overlay labels → Task 3 + Task 6. ✓
- §6 2D counterpart → Task 3 `renderSequence2d` + Task 7 `drawPseudo3D`. ✓
- §6 blind-pick, ≥70%, 5–8 people → Task 7 page + Task 8 procedure. ✓
- §7 realtime web → Tasks 6/7 (studio, WebGL). ✓
- §8 scope / non-goals → no other structures, no text→IR, no deck/editor/video. ✓

**Placeholder scan:** every code step has real code; the PR body `"..."` in Task 8 is the one intentional fill-in (author at PR time). No "add error handling" / "similar to Task N".

**Type consistency:** `renderSequence(ir)`, `renderSequence2d(ir)`, `magnitudeToRadii(magnitude,maxR,tipR)`, `validateIR(ir)→{ok,errors}`, `funnelSlotToIR(sceneData)→ir`, `funnel3dSDF({...,radii})` — names/signatures match across tasks. Overlay item shape `{text, anchor, role, revealAt?}` consistent between Task 3 (producer) and Task 6 (consumer).

**Known soft spot:** Task 2 Step 2 — the radii test may pass before the code change (radii is simply ignored today). That's acceptable: the task's value is the code change + guarding that `radii` doesn't break the build/linear path; `test-render-sequence` (Task 3) is what actually proves radii reach the atom.

## Verification (end-to-end)

1. `node scripts/run-tests.mjs` → green (IR, funnel radii, render-sequence, scaffold-to-ir).
2. `http://127.0.0.1:8001/apps/present/figure.html?ir=funnel-sales` → funnel renders, camera flies *through* top→tip, labels reveal in order. (Playwright screenshot.)
3. `http://127.0.0.1:8001/apps/present/blind.html?ir=funnel-sales` → 2D and 3D side by side, randomized. (Playwright screenshot.)
4. Run the blind pick with 5–8 people → GO/NO-GO on the direction.
