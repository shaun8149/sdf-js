# NOTICE — Third-Party Components

The Atlas Project source code in this repository is licensed under
[PolyForm Noncommercial 1.0.0](./LICENSE.md), **except for the
third-party components below**, which retain their original licenses.
Those components remain freely usable under their original terms.

---

## fogleman/sdf (MIT)

**Origin**: <https://github.com/fogleman/sdf>
**Copyright**: © 2021 Michael Fogleman
**License**: MIT

Portions of `sdf-js/src/sdf/` are direct JavaScript ports of, or
contain derivative work from, Michael Fogleman's Python `sdf` library.
Specifically:

- 2D primitive functions in [`sdf-js/src/sdf/d2.js`](./sdf-js/src/sdf/d2.js)
  (e.g. `circle`, `rectangle`, `polygon`, `triangle`, `hexagon`,
  `trapezoid`, `oriented_box`, `isosceles_trapezoid`, `parallelogram`,
  `rhombus`, `quadratic_bezier`, `slab`, `rounded_x`, `vesica`).
- 3D primitive functions in [`sdf-js/src/sdf/d3.js`](./sdf-js/src/sdf/d3.js)
  (e.g. `sphere`, `box`, `plane`, `capsule`, `cylinder`, `cone`, `torus`,
  `ellipsoid`, `tetrahedron`, `octahedron`, `dodecahedron`,
  `icosahedron`, `rounded_box`, `pyramid`).
- Boolean ops scaffolding in [`sdf-js/src/sdf/dn.js`](./sdf-js/src/sdf/dn.js)
  (`union`, `difference`, `intersection`, `negate`, `dilate`, `erode`,
  `shell`).

These functions, in the form ported from the original Python library,
remain available under the MIT License. Any user may use, copy, modify,
merge, publish, distribute, sublicense, and/or sell these specific
functions subject to the standard MIT terms shown below.

### MIT License (for fogleman/sdf derivatives)

```
Copyright (c) 2021 Michael Fogleman

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Inigo Quilez 2D / 3D SDF formulas (public domain / no warranty)

**Origin**: <https://iquilezles.org/articles/distfunctions/> and related
**Author**: Inigo Quilez

Several primitive SDF formulas in this codebase (e.g. `arc`, `ring`,
`heart`, `star`, `moon`, `cross`, `pie`, `horseshoe`, `egg`,
`oriented_box`, the GLSL primitives in `sdf-js/src/sdf/sdf2.glsl.js`
and `sdf-js/src/sdf/sdf3.glsl.js`) implement formulas published on
Inigo Quilez's public articles. IQ explicitly releases his SDF
formulas without warranty for public use.

---

## Reinder Nijhoff Turtletoy motif library (CC-BY 4.0)

**Origin**: Turtletoy by Reinder Nijhoff
**Default motif data**: 20 hand-drawn motifs in
[`sdf-js/src/motifs/defaults.js`](./sdf-js/src/motifs/defaults.js)
with the `DEFAULT_ORDER` complexity index.

This dataset is reproduced for educational and research purposes.
Commercial redistribution of the motif data specifically requires
verifying terms with the original author.

---

## Erik Swahn Autoscope palette pool (palette data only)

**Origin**: Erik Swahn's Autoscope generative art piece
**Data used**: PALETTES, SKIES, PAPERS color pools in
[`sdf-js/src/palette/autoscope.js`](./sdf-js/src/palette/autoscope.js)

Color palettes are factual data and generally not copyrightable;
included with attribution. The scene-generation code that consumes
these palettes is Atlas Project original work and is licensed under
PolyForm Noncommercial 1.0.0.

---

## Summary

- **Atlas Project original work** (renderer pool, scene engine, Compositor,
  motif sweep algorithm, BOB GPU shader pipeline, autoscope scene generators,
  CA logic on top of SDF, palette generators, math/easing utilities, all
  examples, all documentation, the Atlas brand and product surface):
  PolyForm Noncommercial 1.0.0 (see [LICENSE.md](./LICENSE.md))
- **Fogleman/sdf derivative primitives**: MIT (see above)
- **IQ formulas, Nijhoff motifs, Autoscope palette pools**: original
  authors' terms, attribution provided

Commercial use of any part of the Atlas Project original work requires
a commercial license — see [COMMERCIAL.md](./COMMERCIAL.md).
