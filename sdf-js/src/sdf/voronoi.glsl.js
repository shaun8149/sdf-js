// =============================================================================
// voronoi.glsl —— cellular / voronoi / brick / hex tessellation library (GPU)
// -----------------------------------------------------------------------------
// Inspired by Shane (Shane Whittington)'s shadertoy work:
//   https://www.shadertoy.com/user/Shane
//   "Voronoi distances", "Cracked walls", "Cellular Tiling", "Hex grid"
//
// Shane's contribution to the shadertoy community is treating voronoi-class
// distance fields as a *reference library* (well-commented, portable, reusable
// across his works). This file ports that spirit: standalone GLSL functions
// that any renderer can call to add cellular surface detail.
//
// Built on Hoskins' hash family (noise.glsl.js) — prepend that first.
// License: shadertoy default CC-BY-NC-SA 3.0. Compatible with Atlas's
// PolyForm Noncommercial 1.0.0.
//
// Usage: NOISE_GLSL + VORONOI_GLSL prepended to shader source. Functions:
//   voronoi3D(p)       → vec3(cell_id, F1, F2-F1)  — cell partition + edge approx
//   voronoi2D(p)       → vec3(cell_id, F1, F2-F1)  — 2D variant
//   brickPattern(p,sz) → vec2(brick_id, edge_dist) — offset-row brick tiling
//   hexTile(p, size)   → vec2(cell_id, edge_dist)  — hexagonal tessellation
//   crackedField(p)    → float                     — preset for cracked stone
// =============================================================================

export const VORONOI_GLSL = /* glsl */ `
// ---- 3D Voronoi cells ----
// Returns:
//   x = cell ID in [0, 1)  — use to color each cell distinctly
//   y = F1 = distance to nearest cell center
//   z = F2 - F1 = approximation of distance to nearest cell edge
//
// 27-cell neighborhood. Shane's classic structure (compute F1+F2 in one pass).
// Built on Hoskins hash33 / hash31 — assumes noise.glsl prelude.

vec3 voronoi3D(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  float d1 = 9.0;
  float d2 = 9.0;
  vec3 nearestCell = vec3(0.0);
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      for (int z = -1; z <= 1; z++) {
        vec3 g = vec3(float(x), float(y), float(z));
        vec3 o = hash33(i + g);
        vec3 r = g + o - f;
        float d = dot(r, r);
        if (d < d1) {
          d2 = d1;
          d1 = d;
          nearestCell = i + g;
        } else if (d < d2) {
          d2 = d;
        }
      }
    }
  }
  return vec3(hash31(nearestCell), sqrt(d1), sqrt(d2) - sqrt(d1));
}

// 2D variant. Cheaper (9 cells), good for ground / wall surfaces.
vec3 voronoi2D(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float d1 = 9.0;
  float d2 = 9.0;
  vec2 nearestCell = vec2(0.0);
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = hash22(i + g);
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < d1) {
        d2 = d1;
        d1 = d;
        nearestCell = i + g;
      } else if (d < d2) {
        d2 = d;
      }
    }
  }
  return vec3(hash21(nearestCell), sqrt(d1), sqrt(d2) - sqrt(d1));
}

// ---- Brick tiling (2D) ----
// Classic running-bond brick pattern in a 2D parametric space (uv). Each row
// offsets by half-brick for proper coursework. uv.y is the vertical axis.
//
// size = (brick length, brick height). Returns:
//   x = brick ID in [0, 1)   — randomized per brick
//   y = distance to nearest mortar line in [0, 0.5]  — 0 = on mortar
//
// Caller must project 3D world point to 2D plane based on surface normal
// (see applyPattern in flyLambert). 3D wrapper kept below for back-compat.

vec2 brickPattern2(vec2 uv, vec2 size) {
  float row = floor(uv.y / size.y);
  float xOffset = mod(row, 2.0) * 0.5;
  vec2 cell = vec2(uv.x / size.x - xOffset, uv.y / size.y);
  vec2 idCell = floor(cell);
  vec2 f = fract(cell);
  vec2 d = 0.5 - abs(f - 0.5);
  float edge = min(d.x, d.y);
  return vec2(hash21(idCell), edge);
}

// 3D wrapper — projects p onto XY plane. Used when caller doesn't know
// surface orientation (legacy / convenience).
vec2 brickPattern(vec3 p, vec3 size) {
  return brickPattern2(p.xy, size.xy);
}

// ---- Hex tiling ----
// Hexagonal cells on a 2D plane (XZ for ground / XY for wall use cases).
// size = hex circumradius. Returns:
//   x = cell ID
//   y = distance to nearest hex edge in [0, 0.5*size]  — small = on grid line
//
// Algorithm: two overlapping rect grids, pick the closer cell-center.

vec2 hexTile(vec2 p, float size) {
  p /= size;
  // Hex layout: rectangular tile is (1, sqrt(3)) wide. Two offset grids per row.
  vec2 r = vec2(1.0, 1.7320508);  // (1, sqrt(3))
  vec2 h = r * 0.5;
  vec2 a = mod(p,         r) - h;
  vec2 b = mod(p + h,     r) - h;
  vec2 gv = dot(a, a) < dot(b, b) ? a : b;
  // Cell center (in original coords)
  vec2 idCell = floor(p / r) + (dot(a, a) < dot(b, b) ? vec2(0.5) : vec2(1.0, 0.5));
  // Edge distance: hex edges are 6 lines, use the 3 unique directions
  vec2 g = abs(gv);
  float edge = 0.5 - max(max(g.x * 0.866 + g.y * 0.5, g.y), g.x * 0.866 - g.y * 0.5);
  return vec2(hash21(idCell), edge);
}

// ---- Cracked-field preset ----
// Combines voronoi3D + jitter to produce stone-crack lines. Returns a single
// scalar in [0, 1] where 0 = on a crack, 1 = mid-stone. Use directly to
// modulate albedo (multiply for dark cracks, mix for colored mortar).

float crackedField(vec3 p, float jitter) {
  vec3 jp = p + jitter * (hash33(floor(p * 2.0)) * 2.0 - 1.0);
  vec3 vor = voronoi3D(jp);
  // vor.z = F2-F1 ≈ distance to nearest edge. smoothstep widens the crack.
  return smoothstep(0.0, 0.04, vor.z);
}
`;
