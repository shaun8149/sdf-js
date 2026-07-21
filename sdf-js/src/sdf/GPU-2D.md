# 2D GPU path — what can compile to GLSL

Short reference for the **2D** SDF → GLSL boundary. (3D is separate — see
`sdf3.compile.js`.)

## Rule

A 2D primitive can be emitted to a fragment shader **only if it sets `inst.ast`**.
The compiler walks the AST to generate GLSL; a primitive with no AST has no GLSL
form and can only run on the CPU (its JS `f(p)` distance function).

## Coverage (8 of ~38 d2 exports)

Source of truth: `D2_GLSL_AST_PRIMITIVES` in [`d2.js`](./d2.js).

| Has GLSL AST (GPU-capable) | CPU-only (no AST) |
|---|---|
| circle, ellipse, segment, arc, ring, rectangle, rounded_rectangle, polygon | heart, star, moon, hexagon, triangle, trapezoid, cross, vesica, pie, … (the rest) |

## Why this is fine (not a bug)

- **2D scenes default to the CPU renderers** — `silhouette` / `hatch` (Pasma
  lines) / `bobStipple`. None of them need GLSL; they consume the CPU `f(p)` or
  the layer geometry directly. So a 2D scene built from heart/star/etc. renders
  perfectly — just not through a shader.
- **The GPU path is a 3D concern.** `studio` / `fly3d` / `bob-gpu` raymarch a 3D
  SDF compiled from `d3.js` + community ports. 2D-on-GPU is a niche (a flat scene
  raymarched) that the product does not currently rely on.

## When you'd extend it

Adding `inst.ast` to the remaining 2D primitives is a **documented future
sprint**, only worth doing if a pure-2D GPU path becomes a real requirement
(e.g. animated 2D backgrounds at 60fps that the CPU renderers can't hit). It is
mechanical (mirror each primitive's distance formula into a GLSL emitter in
`sdf3.compile.js`'s 2D section) but unmotivated today.

Until then: if `sdf3.compile.js` is ever handed a 2D primitive that isn't in
`D2_GLSL_AST_PRIMITIVES`, the right behavior is a clear warning ("CPU-only
primitive `<name>` cannot emit GLSL — use a CPU 2D renderer"), not a silent
black shader.
