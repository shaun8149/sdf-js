// =============================================================================
// bounds.js — bounding / auto-framing toolkit (IQ bounding articles). Wave 6.
// -----------------------------------------------------------------------------
// Recipe-only ports / applications of Inigo Quilez:
//   bounding boxes        https://iquilezles.org/articles/diskbbox/ (family)
//   sphere projection     https://iquilezles.org/articles/sphereproj/
//   SDF bounding volumes  https://iquilezles.org/articles/sdfbounding/
//   L∞-norm SDFs          https://iquilezles.org/articles/distfunctions2dlinf/
//
// Headline: bbox(SDF) → camera-fit, so any atom/deck auto-frames in the studio
// stage instead of being hand-scaled to a fixed camera (the W-studio pain).
// bbox3FromSDF + cameraFitFromBBox run CPU-side at load; the analytic helpers
// (sphereProjRadius / sdBoxLinf / sdBoundingBox) also ship in BOUNDS_GLSL.
//
// License: PolyForm Noncommercial 1.0.0 (Atlas reimplementation).
// =============================================================================

/** Sample an SDF (p→dist) over a cube and return its axis-aligned bounding box.
 *  Approximate (grid-based) — tightens to ~half a cell. Returns {min,max,center,size}. */
export function bbox3FromSDF(sdfFn, opts = {}) {
  const R = opts.radius ?? 3;
  const res = opts.res ?? 48;
  const iso = opts.iso ?? 0;
  const step = (2 * R) / res;
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  let found = false;
  for (let i = 0; i <= res; i++) {
    const x = -R + i * step;
    for (let j = 0; j <= res; j++) {
      const y = -R + j * step;
      for (let k = 0; k <= res; k++) {
        const z = -R + k * step;
        if (sdfFn([x, y, z]) <= iso) {
          found = true;
          if (x < min[0]) min[0] = x;
          if (x > max[0]) max[0] = x;
          if (y < min[1]) min[1] = y;
          if (y > max[1]) max[1] = y;
          if (z < min[2]) min[2] = z;
          if (z > max[2]) max[2] = z;
        }
      }
    }
  }
  if (!found) {
    return { min: [0, 0, 0], max: [0, 0, 0], center: [0, 0, 0], size: [0, 0, 0], empty: true };
  }
  const h = step * 0.5; // the surface lies up to half a cell past the last inside sample
  for (let a = 0; a < 3; a++) {
    min[a] -= h;
    max[a] += h;
  }
  const center = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  const size = [max[0] - min[0], max[1] - min[1], max[2] - min[2]];
  return { min, max, center, size };
}

/** Camera target + distance that frames a bbox's bounding sphere in a vertical
 *  FOV. margin > 1 leaves headroom. Returns {target:[x,y,z], distance}. */
export function cameraFitFromBBox(min, max, fovY = 1.0, margin = 1.15) {
  const center = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2];
  const dx = max[0] - min[0],
    dy = max[1] - min[1],
    dz = max[2] - min[2];
  const radius = 0.5 * Math.hypot(dx, dy, dz);
  const distance = (margin * radius) / Math.sin(fovY / 2);
  return { target: center, distance };
}

/** Screen-space radius of a sphere at view-space distance zDist (tangent-cone
 *  projection). Closer / bigger spheres project larger. */
export function sphereProjRadius(zDist, sphereRadius, focal) {
  return (
    (focal * sphereRadius) / Math.sqrt(Math.max(zDist * zDist - sphereRadius * sphereRadius, 1e-6))
  );
}

// Signed distance to an axis-aligned box [bmin,bmax].
function aabbDist(p, bmin, bmax) {
  const cx = (bmin[0] + bmax[0]) / 2,
    cy = (bmin[1] + bmax[1]) / 2,
    cz = (bmin[2] + bmax[2]) / 2;
  const hx = (bmax[0] - bmin[0]) / 2,
    hy = (bmax[1] - bmin[1]) / 2,
    hz = (bmax[2] - bmin[2]) / 2;
  const qx = Math.abs(p[0] - cx) - hx,
    qy = Math.abs(p[1] - cy) - hy,
    qz = Math.abs(p[2] - cz) - hz;
  const o = Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0));
  return o + Math.min(Math.max(qx, qy, qz), 0);
}

/** Wrap an SDF in an AABB bounding volume: outside the box, return the cheap
 *  (conservative, ≤ true) distance to the box so a sphere-tracer can skip ahead;
 *  inside, evaluate the real SDF. Accelerates expensive multi-primitive atoms. */
export function boundedSDF(sdfFn, bmin, bmax) {
  return (p) => {
    const db = aabbDist(p, bmin, bmax);
    return db > 0 ? db : sdfFn(p);
  };
}

/** L∞ (Chebyshev-norm) box: max(|p|−b). 0 on the surface, <0 inside. */
export function sdBoxLinf(px, py, pz, bx, by, bz) {
  return Math.max(Math.abs(px) - bx, Math.abs(py) - by, Math.abs(pz) - bz);
}

// -----------------------------------------------------------------------------
// GLSL mirror (the helpers usable inside a shader; bbox/camera-fit are CPU-only).
// -----------------------------------------------------------------------------
export const BOUNDS_GLSL = /* glsl */ `
float sphereProjRadius(float zDist, float sr, float focal){
  return focal*sr/sqrt(max(zDist*zDist - sr*sr, 1e-6));
}
float sdBoxLinf(vec3 p, vec3 b){
  vec3 w = abs(p) - b;
  return max(w.x, max(w.y, w.z));
}
float sdBoundingBox(vec3 p, vec3 bmin, vec3 bmax){
  vec3 c = (bmin + bmax) * 0.5;
  vec3 h = (bmax - bmin) * 0.5;
  vec3 q = abs(p - c) - h;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}
`;
