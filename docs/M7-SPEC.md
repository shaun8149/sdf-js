# M7 — Transition Rules Runtime (v2.1)

> v2.1 changes: rules now declare `phase` + `reads`/`writes` (ECS-style scheduling
> discipline, conflict lint at load time); step() folds over phases; §10 adds a
> **pending-approval proposal** for SceneData sub-scene instancing (M0 territory —
> not part of M7, do not implement without sign-off).
>
> Goal: turn Atlas from a world-spec language into a rung-2 world simulator.
> First target: **Scene A — a 3D flow-field particle world** (A1 fields, A2 flocking),
> chosen because emergence is the demo and `field/` + `streamline/` already exist.
> Second target: **Scene B — the rocket** (narrative demo: scripted vs simulated).
> Non-goals (this slice): learned dynamics, multiplayer netcode, SDF-vs-SDF collision, soft bodies.

---

## 1. Core contract

### 1.1 World wrapper (SceneData v1 stays locked)

SceneData v1 (M0, locked 2026-05-17) is **not modified**. Dynamics live in a wrapper:

```js
World = {
  scene:     SceneData,      // SDF environment: obstacles, terrain, set dressing (unchanged)
  params:    {},             // low-cardinality dynamics vars, keyed by subject id (rocket etc.)
  particles: ParticleBlock | null,   // high-cardinality population — see §1.2
  fields:    FieldSpec | null,       // see Scene A1
  rules:     Rule[],
  clock:     { t, dt, tick },        // dt fixed (1/60), never variable
  rng:       { seed, n },            // counter-based; rules call rng(world)
  log:       TickLog                 // see §4
}
```

Separation of concerns: **SceneData describes the SDF environment; params/particles
describe what moves through it.** Renderers consume `world.scene` unchanged — all 6
existing renderers work with zero modification. Particles get their own lightweight
renderer (§5).

### 1.2 ParticleBlock — SoA, not subjects

Particles are NOT SceneData subjects. Thousands of entries would bloat SceneData and
explode patch logs. Structure-of-arrays, transferable to the worker as one block:

```js
ParticleBlock = {
  n:        number,
  pos:      Float32Array,   // n × 3
  vel:      Float32Array,   // n × 3
  mass:     Float32Array,   // n × 1
  modeW:    Float32Array,   // n × 2  — per-particle [flowWeight, gradWeight], see A1
  alive:    Uint8Array,
  trailLen: number          // ring-buffer depth for live trails (render concern, §5)
}
```

Rules that touch particles receive the block and return a **new** block (copy-on-write
at the array level; internally they may write into a scratch buffer — purity is defined
at the step boundary, not per-assignment).

### 1.3 Rule — the unit the LLM emits

```js
Rule = {
  id:      string,
  phase:   "input" | "forces" | "integrate" | "constrain" | "sync",
  reads:   string[],         // declared data dependencies, e.g. ["params.rocket.fuel", "particles.pos", "fields"]
  writes:  string[],         // declared outputs, e.g. ["particles.vel"]  — wildcard tails allowed: "params.rocket.*"
  enabled: boolean,                                  // toggleable live from UI
  applies: (world) => boolean,                       // cheap guard, pure
  apply:   (world, actions, dt) => Effect            // PURE. No I/O, no Date, no bare Math.random
}

Effect = { patches?: Patch[], particles?: ParticleBlock }
Patch  = { path: string, value: any }
```

**Why declarations (ECS lesson).** With a flat rule array, two LLM-emitted rules that
silently write the same path resolve by last-write-wins — invisible until it bites.
Declared read/write sets let the runtime do three things at **load time**, before a
single tick runs:

1. **Conflict lint**: two enabled rules in the same phase writing overlapping paths →
   load rejected with a named conflict (not a runtime surprise).
2. **Declaration check**: a rule whose `apply` emits a patch outside its declared
   `writes` is rejected. For LLM-emitted rules this is free self-audit — the model
   must state its intent, and the runtime holds it to it.
3. **Dataflow visualization**: the Laws panel can render reads→writes as a graph,
   which is the audit story made visible.

### 1.4 Phases & scheduling

Rules execute in fixed phase order; array order only breaks ties **within** a phase:

| phase | what belongs here | Scene A examples | Scene B examples |
| --- | --- | --- | --- |
| `input`     | drain actions into state | stir, drop-obstacle, set-mode-weights | cut-engine, add-payload |
| `forces`    | accumulate accelerations / steering | field blend, flock-separation/alignment/cohesion, flock-avoid | thrust, gravity |
| `integrate` | advance positions from velocities | integrate, respawn | integrate, fuel-burn |
| `constrain` | clamp / resolve violations | bounds | ground-collision |
| `sync`      | write through to scene/render state | scene.subjects updates | exhaust scale, crash pose |

LLM-emitted rules carry their phase; a rule in the wrong phase (e.g. a force rule
patching positions) fails the declaration check. This is the loop contract made
explicit — the part game engines got right.

**Integrator guarantee (not an accident — a promise):** the phase order
`forces` (writes vel) → `integrate` (writes pos) enforces **semi-implicit
(symplectic) Euler** — velocity updates before position, the industry-standard
ordering that keeps oscillating systems (orbits, springs) energy-stable. Explicit
Euler (pos before vel) drifts and explodes; the phase contract makes that ordering
unwritable. Do not "upgrade" to RK4 — symplectic Euler at fixed dt is the right
tool for this runtime.

The runtime's `step()` folds over phases, then rules:

```js
const PHASES = ["input", "forces", "integrate", "constrain", "sync"];

function step(world, actions) {
  let particles = world.particles;
  const patches = [];
  for (const phase of PHASES) {
    for (const rule of world.rules) {
      if (rule.phase !== phase || !rule.enabled || !rule.applies(world)) continue;
      const fx = rule.apply({ ...world, particles }, actions, world.clock.dt);
      if (fx.patches)   patches.push(...assertDeclared(rule, fx.patches));
      if (fx.particles) particles = fx.particles;
    }
  }
  const next = applyPatches(world, patches);
  next.particles = particles;
  next.clock = advance(world.clock);
  next.log   = appendTick(world.log, { tick: next.clock.tick, actions, patches });  // lean mode: actions only, §4
  return next;
}
```

Design rationale: **pure functions** make replay/fork/savegame structurally free;
**many small rules** make every law of the world separately auditable and separately
toggleable — which is the demo; **declared dataflow + phases** keep that auditability
intact as the rule count grows past what eyeballs can order.

### 1.5 Actions

```js
Action = { tick: number, type: string, subjectId?: string, payload?: any }
// Scene A: {type:"stir", payload:{center,radius,impulse}}, {type:"drop-obstacle", payload:{sdf}},
//          {type:"set-mode-weights"}, {type:"spawn-predator"}, {type:"toggle-order"}
// Scene B: {type:"cut-engine"}, {type:"add-payload"}, {type:"refuel"}
```

Queued by the UI, drained once per tick. Rules read actions; rules never read the DOM.

---

## 2. Determinism discipline

1. `dt` fixed at 1/60; render loop uses the accumulator pattern.
2. No `Date.now()`, no bare `Math.random()` in rules. Randomness via `rng(world)` —
   counter-based PRNG whose state lives in the World and survives replay/fork.
3. Float discipline: all particle math in Float32 (typed arrays), same op order on
   replay. Avoid `Math.sin/cos` table variance by using our `math/` wrappers.
4. **CI test, not a nicety:** serialize savegame → cold replay → final World deep-equal
   (particle blocks compared bitwise).

---

## 3. Sandbox

LLM-emitted rule modules are untrusted code.

- Rules execute in a **Web Worker**; main thread holds the canonical World.
  ParticleBlock arrays pass as transferables (zero-copy).
- Worker scope exposes a frozen whitelist: `rng`, `vec3` helpers, `clamp/lerp/easing`
  from `src/math/`, `sampleField`, `sdfQuery` (see A1). No `fetch`, no DOM, no `eval`.
- Static lint on emitted source: reject `Date`, `Math.random`, `fetch`, `import`,
  unbounded `while`.
- **Declaration enforcement (load + runtime):** emitted patches outside the rule's
  declared `writes` → rule rejected; same-phase write overlap between enabled rules →
  load rejected with a named conflict (§1.3). Declarations are part of the LLM's
  emitted module and are checked against behavior, not trusted.
- Per-tick budget: over N ms → tick dropped, rule flagged in the Laws panel
  (a visibly "broken law", not a frozen page).

---

## 4. Tick log — savegame / replay / fork

```js
TickLog = {
  v: 2,
  mode: "full" | "lean",
  seed: number,
  initial: WorldSnapshot,                 // scene + params + particle block at tick 0
  ticks: [{ tick, actions, patches? }]    // append-only; patches omitted in lean mode
}
```

- **full** — per-tick patches recorded. For low-cardinality worlds (rocket): every tick
  is a readable diff, full audit trail.
- **lean** — actions only. For particle worlds: determinism (§2) means trajectories are
  *derivable*, so the savegame of a 10k-particle artwork is a few KB of JSON.
  **The artwork's complete provenance = seed + rules + intervention sequence.**
- Replay = re-execute from `initial`. Fork = truncate at tick k, branch. Export/import
  JSON from the UI in both scenes.

---

## 5. Rendering particles & trails

- New lightweight renderer `render/particles.js` (GPU points/lines), drawing from
  ParticleBlock + a position ring buffer of depth `trailLen`. The SDF environment
  underneath renders through the existing pool, unchanged.
- **Trail mode (art mode):** accumulate positions into an offscreen buffer instead of
  clearing — the render of the *history*, Fidenza-style. Generative art renders the
  log; games render the present. Same runtime, two consumption modes.
- SVG export of trails (Lines-renderer pipeline) is a stretch goal, not this slice's
  acceptance.

---

## 6. Scene A — flow-field world

### A1 — 3D fields + selectable motion (first target)

**Fields.** Two fields coexist; every particle blends them by its `modeW = [wFlow, wGrad]`:

1. **Flow field — curl noise.** Do NOT use raw 3D noise as velocity: it has divergence,
   particles pile into sinks and the picture dies. Use curl of a noise potential
   (Bridson-style): `F(p) = ∇ × Ψ(p)` — divergence-free by construction, flow never
   collapses. Implemented in `src/field/curl3.js` on top of existing `field/` noise.
   FieldSpec params (frequency, octaves, gain, animSpeed·t) live in `world.fields`
   and are patchable — "stir" perturbs them locally.
2. **Gradient field — free from SDF.** `G(p) = ∇d(p)` of `world.scene`'s SDF, via the
   existing probe/raymarch machinery exposed as `sdfQuery(p) → {d, grad}`.
   `-G` attracts to surfaces, `+G` repels, projecting velocity onto the tangent plane
   makes particles **hug and orbit** geometry. Any gallery scene becomes a field for free.

Effective field per particle: `E(p) = wFlow·F(p) + wGrad·G'(p)`.

**Motion — two orders, one toggle.** Two mutually exclusive rules; switching them is
the "laws are replaceable code" beat:

| rule id | law | character |
| --- | --- | --- |
| `motion-first-order`  | `vel = E(p)` (Fidenza-style: field IS velocity) | obedient, lines hug the field |
| `motion-second-order` | `acc = E(p)/mass; vel += acc·dt; speedClamp` | inertial: overshoot, swing, mass matters |

Plus: `integrate` (`pos += vel·dt`), `bounds` (wrap or soft-contain), `respawn` (dead
particles re-enter at seeded positions — through `rng(world)`, so replay holds).

**Interventions (UI):** stir the field (local impulse), drop an SDF obstacle (sphere/box
union'd into the scene — gradient field updates automatically), per-population
`modeW` sliders, mass slider, first/second-order toggle, rule checkboxes, savegame
export/import/fork.

**A1 acceptance:**
1. Curl-noise flow runs indefinitely without clumping (visual + a divergence spot-check test).
2. `wGrad`-dominant particles visibly orbit/hug an SDF subject; dropping an obstacle
   mid-run bends nearby trajectories on the next ticks.
3. First↔second order toggle changes line character instantly and obviously.
4. Determinism CI (§2.4) passes with ≥ 5k particles.
5. Trail mode accumulates a plottable Fidenza-like image; its savegame is < 50 KB.

### A2 — flocking (emergence layer)

Reynolds boids, **one Rule per law** — the three checkboxes are the soul of this demo:

| rule id | local law | toggle it off and… |
| --- | --- | --- |
| `flock-separation` | steer away from neighbors inside `rSep` | the flock collapses into a clump |
| `flock-alignment`  | steer toward mean neighbor heading inside `rAlign` | a directionless swarm |
| `flock-cohesion`   | steer toward neighbor centroid inside `rCoh` | the flock disperses |

Each rule contributes a steering force, weight-clamped (`maxForce`, `maxSpeed` in
params). They stack ON TOP of A1's field forces — a murmuration drifting through a
curl-noise wind.

**Obstacle avoidance via SDF (free):** `flock-avoid` — if `sdfQuery(pos).d < rAvoid`,
steer along `+grad`. Boids flow around any gallery scene; the gothic cathedral is now
a thing birds flock around. No mesh colliders, no nav data — the distance function IS
the collision knowledge.

**Predator:** `{type:"spawn-predator"}` adds a strong moving repulsor (camera-ray
placement or scripted orbit). Scattering + regrouping is the emergence money-shot.

**Neighbor search:** naive O(n²) caps you at a few hundred boids. Spec a uniform
spatial hash (`src/world/hashgrid.js`, cell ≈ max perception radius), rebuilt per tick
inside the worker. Target: **2,000 boids @ 60fps** with all rules on.

**A2 acceptance:**
1. All three on → recognizable murmuration; each single toggle-off produces its
   distinct failure mode (clump / swarm / dispersal) within seconds.
2. Boids visibly avoid an SDF subject placed in their path; works on at least one
   pre-lifted gallery scene.
3. Predator causes scatter-and-regroup with no predator-specific flock code —
   it is only a repulsor in the field stack.
4. 2k boids @ 60fps; determinism CI passes.

### Provenance discipline (both A1 & A2)

Rule modules (`examples/world/flow.rules.js`, `flock.rules.js`) are LLM-generated via
the SKILL.md pipeline and checked in **with the prompt and model id in a header
comment**. The claim is "the LLM wrote the laws" — keep the receipt in the file.

---

## 7. Scene B — rocket (narrative demo, after A)

Unchanged from v1 in substance; abbreviated here. Subjects: rocket (capsule+cone),
pad, ground, exhaust. Rules: `thrust`, `gravity`, `fuel-burn`, `integrate`,
`ground-collision` (~20 lines total — that's the point). Log mode: **full**.

UI: `Scripted / Simulated` mode toggle (timeline vs rule engine — visually identical
until intervened), buttons `Cut one engine` / `Add 500kg payload` / `Refuel`
(deliberately functional-but-inert in Scripted mode — do not gray them out; pressing a
button that the world ignores IS the lesson), Laws panel, savegame panel.

Acceptance: (1) counterfactual — cutting engines changes the trajectory; (2) emergent
failure — TWR < 1 → crash that exists nowhere as a script, only as arithmetic;
(3) determinism replay; (4) Scripted mode ignores all interventions.

---

## 8. File layout

```
sdf-js/src/world/
├── runtime.js       // step(), tick loop (accumulator), action queue
├── patch.js         // applyPatches + structural diff
├── rules.js         // registry, enable/disable, lint, worker host
├── particles.js     // ParticleBlock alloc / copy-on-write / transferables
├── hashgrid.js      // uniform spatial hash (A2)
├── rng.js           // counter-based seeded PRNG
└── log.js           // TickLog full/lean, replay, fork, (de)serialize

sdf-js/src/field/
└── curl3.js         // curl noise on top of existing noise field

sdf-js/src/render/
└── particles.js     // GPU points/lines + trail accumulation mode

sdf-js/examples/world/
├── flow.html / flow.scene.js / flow.rules.js          // A1
├── flock.html / flock.rules.js                        // A2 (reuses flow scene)
└── rocket.html / rocket.scene.js / rocket.rules.js / rocket.timeline.js   // B
```

Build order: `runtime + rng + log + determinism CI` → `particles + curl3 + A1 motion
rules` → `render/particles + trail mode` → A1 ship → `hashgrid + flocking rules` →
A2 ship → Scene B.

---

## 9. Out of scope, recorded so they don't creep in

- SDF-vs-SDF collision response (avoidance ≠ contact resolution). Scope discipline:
  Atlas's simulator layer covers **law-writable dynamics** (fields, flocking, orbits,
  resources, rule systems) — solver-grade contact physics is a different problem and
  we do not claim it.
  **Recorded future path (do not build this slice):** if/when contact-ish physics is
  needed, the route is **XPBD — constraints as rules**, not a solver port. Each XPBD
  constraint (distance, bending, volume) is a few-line position-projection function
  that fits the `constrain` phase natively and stays LLM-writable/auditable/toggleable.
  Cloth, ropes, and soft bodies enter Atlas through that door; Sequential-Impulse /
  PGS solvers never do. Narrowphase queries stay free via `sdfQuery` (d = penetration,
  ∇d = contact normal); sphere tracing along the velocity gives CCD for free.
- Variable dt / substeps. Multiplayer. Rule hot-reload across workers. GPU-compute
  particle simulation (worker + typed arrays first; move to GPGPU only if 2k boids
  @ 60fps fails on CPU).
- **Change detection** (Bevy-style "run only when declared `reads` changed") — the
  `reads` declarations from §1.3 make this a cheap future optimization; do not build
  it this slice.
- 4D: the slice explorer reuses this runtime later (a `w`-translate rule + scroll
  action; curl noise generalizes to 4D potential). Do not special-case anything now.

---

## 10. PROPOSAL (pending approval — touches locked M0, not part of M7)

### SceneData sub-scene instancing

**Status: proposal only. SceneData v1 is locked (2026-05-17). Do NOT implement
without explicit sign-off; recorded here so the idea survives.**

Godot's `.tscn` lesson: a scene should be embeddable in another scene as an instance,
with local overrides, while staying a human-readable text document. Proposed addition
to a future SceneData v2:

```js
subject = { id, ref: "scene:cathedral@v3", overrides: { translate: [...], scale: ... } }
```

- Compile step resolves refs into the SDF tree (cycle detection required).
- Editing the referenced scene updates all instances; overrides stay local.
- What it buys: build-once-reuse-everywhere composition, generator templates that
  assemble worlds from a scene library, and scenes as tradable units with stable
  identity — the document stays a document.
- Cost: ref resolution semantics, versioning (`@v3`), and serialize/diff rules all
  need spec work. That is M0-spec-amendment work, on its own timeline, after M7 ships.

Counter-lesson recorded alongside (Unity): keep every serialized artifact hand-readable
and hand-editable JSON. No binary encodings in TickLog lean mode — 15 KB vs 50 KB does
not matter; readability is the non-renewable asset.
