# Structure-Aware Spatialization — Vertical Slice 1: Sequence / Funnel

**Date:** 2026-07-02
**Status:** Design (approved in brainstorm; pending spec review → plan)
**Scope:** One vertical slice. Not a platform.

---

## 1. The reframe (why this exists)

Today's 3D pipeline lifts an already-structured 2D scaffold by **copying its x/y layout onto a
wall** and adding a camera move. That copies *layout*, not *structure* — which is why the output
is "flat slides in 3D": often prettier than, but no clearer than, the 2D original. 3D has not yet
*earned its existence*.

The correct framing (the "Napkin" model): **content has a latent structure — sequence, hierarchy,
network, magnitude — and each structure has a 3D form that carries meaning 2D cannot.** The product
is **structure-aware spatialization**, not "prettier slides."

**Why now (the title insight):** a static slide lacks two dimensions — **a camera (spatial point of
view)** and **a timeline (temporal narrative)**. That was never a design choice; it was a *medium*
limitation (paper → projector → PDF). We are not bound by that medium. This work is not "make PPT
flashier" — it is **putting back the two dimensions the medium amputated.**

**Why 3D should win (our prior):** humans are innately good at understanding 3D space. That is a
strong prior, not proof — so this slice ends in a blind test that converts the prior into evidence.

## 2. The core bet & how this slice de-risks it

The whole direction rests on ONE unproven assumption: **a structure rendered in its native 3D form,
with camera + motion, is more persuasive/memorable than the flat 2D version.** Validating it needs
neither an IR nor text-inference nor a product — only the single most iconic "3D-wins" structure,
done stunningly, placed next to its 2D twin. This slice builds exactly that and stops.

If the best case (a funnel you fly *through*) does not beat 2D, the direction dies cheaply. If it
wins, the render chain, camera language, and animation layer are already built, and the other three
structures are copies of the same pattern.

## 3. Architecture — the IR decoupling (the one architectural rule)

```
[input adapters]                [structure renderers]           [studio]
2D scaffold ─┐                   dispatch on ir.structure:
             ├──→   IR   ──→     renderSequence(ir) ──→ sceneData ──→ realtime render
text (later) ─┘                  (reads IR ONLY — never x/y)
```

- **IR** = Intermediate Representation: the neutral, structured description of *what structure the
  content has*. It decouples "who supplies the structure" from "how it becomes 3D."
- **Structure renderers** are a family — one per structure type; `ir.structure` selects which.
  This slice builds **only `renderSequence`** (funnel sub-form).
- **The single architectural discipline:** the renderer reads the IR, **never the scaffold's x/y
  coordinates.** This is what lets a `text → IR` front-end plug in later with **zero renderer
  changes**. `scaffold → IR` is built now; `text → IR` (a prompt) is explicitly deferred.
- Everything downstream of `sceneData` (studio, camera sequencing, overlay) already exists and is
  reused unchanged.

## 4. IR v0 — grown from the funnel, not spec-first

The IR carries only what the funnel slice needs. It grows a field only when a later structure needs
it — no upfront schema design.

```js
{
  structure: 'sequence',                              // dispatch key
  nodes: ['Leads', 'Qualified', 'Proposal', 'Closed'],// ordered elements
  magnitude: [1000, 400, 150, 40],                    // per-node quantity → funnel widths (optional)
  relations: [],                                      // edges; sequence is implicit order → empty
  emphasis: [3],                                      // node indices to highlight (the outcome)
  order: [0, 1, 2, 3],                                // narrative / build-in order (defaults to node order)
}
```

Fields map 1:1 to the six agreed in brainstorm: structure / nodes / relationships / magnitude /
emphasis / narrative-order. `relations` stays empty for sequence; it earns its use at structure #2
(hierarchy/network).

## 5. The sequence renderer — `renderSequence(ir) → sceneData`

This is the moat: the **structure → form → camera → motion** chain the current pipeline is missing.
Four parts, funnel sub-form:

1. **Form.** A true converging funnel: `funnel-3d` with `stages = nodes.length` and **per-stage
   radius derived from `magnitude`** (not an equal-width cone). Emphasis node reads as the tip.
2. **Camera language — the fly-through.** The camera starts above the wide mouth and **descends
   through the funnel's axis** to the narrow outcome, rather than viewing it from outside. This is
   the iconic "3D-wins" move and the sharpest 2D contrast. Authored as a `cameraSequence`.
3. **Build-in animation.** Stages enter top→bottom in `order`; magnitude readouts count/scale up as
   the camera reaches each stage. **This is the first real use of the engine's `subj.animation`**
   (transform animation exists in compile.js but no scene uses it) — the animation layer is built
   here, minimally, for reveal + grow.
4. **Overlay.** Stage labels + magnitude numbers (DOM overlay, per the two-text-systems rule),
   revealed in `order`, anchored to each stage.

Output is a standard `sceneData` the studio renders live — and, per delivery decision, an
**embeddable realtime 3D figure** (P1 unit), not a deck slide.

## 6. The 2D counterpart & the go/no-go test

- `renderSequence2d(ir) → flat funnel` — the **same IR** rendered as a clean 2D funnel (reuse the
  existing 2D funnel atom). Same content, both sides — a fair test.
- **Blind-pick page:** the 2D funnel and the 3D fly-through side by side, **randomized left/right,
  unlabelled**.
- **Criterion (operationalized):** one question — *"for a pitch, which is more persuasive?"* — to
  **5–8 real people**, blind. **3D wins if ≥ 70% pick it.** Win → build the other three structures
  on this pattern. Lose → the direction dies here, cheaply.

## 7. Delivery form

**Realtime web first** (decided). The figure is a live WebGL scene (reuses the studio), embeddable
and orbit-able; build-ins play in real time. Performance budget: 60fps on a laptop browser — heavy
look (thick GI / DOF) yields to framerate where needed. **Video export is a later baked pass over
the same scene**, not a separate pipeline. Not built in this slice.

## 8. Scope — YAGNI

**In:** `scaffold → IR` adapter (funnel only), IR v0, `renderSequence` (funnel form + fly-through
camera + build-in animation + overlay), `renderSequence2d`, the blind-pick page, tests.

**Out (explicit non-goals / backlog):**
- The other three structures (hierarchy / network / magnitude) — copies of this pattern, *after* the
  test wins.
- `text → IR` — a prompt front-end; the IR seam exists so it plugs in later. Not built.
- Deck assembly (P3) and continuous walkable world (P2, the north star).
- **2D/3D mixed-layout design system** — deferred to when we assemble a mixed deck (this slice is
  all-3D-wins, so it does not bite).
- The 3D editor, video export.

## 9. Definition of done

A single **embeddable, live 3D funnel** — converging form from `magnitude`, camera flying *through*
it, stages building in over time — produced from an **IR** (not from 2D coordinates), shown beside
a **2D funnel of the same IR**, with the **blind pick run**. Outcome: a **go/no-go** on the whole
direction, plus a reusable render/camera/animation pattern if go.

## 10. Testing

- **IR validation:** schema check (structure enum, parallel arrays length-match).
- **`renderSequence` unit test:** IR → sceneData shape — funnel stages == nodes.length, per-stage
  radius reflects magnitude, `cameraSequence` present with through-axis shots, `subj.animation`
  present on staged subjects, overlay labels in `order`. Reads IR, asserts it never depends on x/y.
- **Animation smoke:** a scene with `subj.animation` compiles + advances (first exercise of that
  engine path).
- Wire into `npm test` (the repo's single-source test list).

## 11. Risks

- **Animation layer is greenfield** — `subj.animation` exists but is unexercised; it may need small
  engine fixes. Mitigation: keep build-ins to transform reveal + scale (the paths that already
  compile), avoid exotic anim.
- **The bet may lose.** That is the point — the slice is designed to lose *cheaply* and *early*.
- **Funnel ≠ all of "sequence."** Slice 1 is deliberately the funnel sub-form only; linear-flow
  sequences (corridor/path) are a later branch of the same renderer.
