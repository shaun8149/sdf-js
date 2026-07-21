// =============================================================================
// 3D SDF library —— GLSL 版本
// -----------------------------------------------------------------------------
// 与 d3.js 一一对应。primitives 来自 IQ "3D Distance Functions"：
//   https://iquilezles.org/articles/distfunctions/
//   https://www.shadertoy.com/view/Xds3zN  (MIT, Copyright © 2013 Inigo Quilez)
// d3.js 有但 IQ paste 没有的四个（rounded_box / tetra / dodeca / icosa）
// 移植自 d3.js 自己的 JS 公式。
//
// GLSL 没有 closure / 运算符重载，"链式"在 shader 里退化成"嵌套 + 显式传 p"：
//   JS:   sphere(0.5).translate([1, 2, 3])         即 sdSphere(p - [1,2,3], 0.5)
//   GLSL: sdSphere(p - vec3(1.0, 2.0, 3.0), 0.5)
//
// 命名约定：保留 IQ 的 sdXxx 命名（与 Shadertoy 生态一致），方便从 Shadertoy
// 直接 drop-in。我们 JS 端 d3.js 用 sphere/box/torus 等无前缀；T4 compiler
// 负责名字映射 + 参数翻译（e.g. d3.box(size) → sdBox(p, size*0.5)）。
//
// 用法：把 SDF3_GLSL 字符串 prepend 到你的 fragment shader 源码里。
// =============================================================================

export const SDF3_GLSL = /* glsl */ `
// 时间 uniform：让 sdWaves / time-modulated primitives / animation 可用。
// caller shader 不要重复声明（会冲突）。如果不动画，无需 setUniform，默认 0。
uniform float u_time;

// Rune erosion heightmap sampler (Sprint 12). bound by flyLambert when scene
// has a terrain-eroded-rune subject; contains 4 channels per texel:
//   .x = eroded height [0,1]
//   .y = ridgeMap     [0,1]  (mapped from [-1,1])
//   .z = treeAmount   [0,1]
//   .w = erosionOffset [0,1] (mapped from [-1,1])
// Sampled in shader's eroded-terrain material branch + the SDF primitive.
uniform sampler2D u_heightmap;

// ---- helpers ---------------------------------------------------------------

float dot2(vec2 v)  { return dot(v, v); }
float dot2(vec3 v)  { return dot(v, v); }
float ndot(vec2 a, vec2 b) { return a.x * b.x - a.y * b.y; }

// ---- IQ Primitives (https://iquilezles.org/articles/distfunctions/) ------

float sdPlane(vec3 p) {
  return p.y;
}

float sdSphere(vec3 p, float s) {
  return length(p) - s;
}

// IQ exact box. b = half-extents
float sdBox(vec3 p, vec3 b) {
  vec3 d = abs(p) - b;
  return min(max(d.x, max(d.y, d.z)), 0.0) + length(max(d, 0.0));
}

// Hollow box frame. b = half-extents, e = frame thickness
float sdBoxFrame(vec3 p, vec3 b, float e) {
  p = abs(p) - b;
  vec3 q = abs(p + e) - e;
  return min(min(
    length(max(vec3(p.x, q.y, q.z), 0.0)) + min(max(p.x, max(q.y, q.z)), 0.0),
    length(max(vec3(q.x, p.y, q.z), 0.0)) + min(max(q.x, max(p.y, q.z)), 0.0)),
    length(max(vec3(q.x, q.y, p.z), 0.0)) + min(max(q.x, max(q.y, p.z)), 0.0));
}

// Approximated (not exact) ellipsoid. r = semi-axes
float sdEllipsoid(vec3 p, vec3 r) {
  float k0 = length(p / r);
  float k1 = length(p / (r * r));
  return k0 * (k0 - 1.0) / k1;
}

// Torus around Y axis. t = (major radius, minor radius)
float sdTorus(vec3 p, vec2 t) {
  return length(vec2(length(p.xz) - t.x, p.y)) - t.y;
}

// Partial torus. sc = (sin, cos) of cap angle, ra = major, rb = minor
float sdCappedTorus(vec3 p, vec2 sc, float ra, float rb) {
  p.x = abs(p.x);
  float k = (sc.y * p.x > sc.x * p.y) ? dot(p.xy, sc) : length(p.xy);
  return sqrt(dot(p, p) + ra * ra - 2.0 * ra * k) - rb;
}

// Hexagonal prism (axis = Z). h = (apothem, half-height)
float sdHexPrism(vec3 p, vec2 h) {
  const vec3 k = vec3(-0.8660254, 0.5, 0.57735);
  p = abs(p);
  p.xy -= 2.0 * min(dot(k.xy, p.xy), 0.0) * k.xy;
  vec2 d = vec2(
    length(p.xy - vec2(clamp(p.x, -k.z * h.x, k.z * h.x), h.x)) * sign(p.y - h.x),
    p.z - h.y);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

// Octagonal prism (axis = Z). r = apothem, h = half-height
float sdOctogonPrism(vec3 p, float r, float h) {
  const vec3 k = vec3(-0.9238795325, 0.3826834323, 0.4142135623);
  p = abs(p);
  p.xy -= 2.0 * min(dot(vec2( k.x, k.y), p.xy), 0.0) * vec2( k.x, k.y);
  p.xy -= 2.0 * min(dot(vec2(-k.x, k.y), p.xy), 0.0) * vec2(-k.x, k.y);
  p.xy -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
  vec2 d = vec2(length(p.xy) * sign(p.y), p.z - h);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

// Capsule between points a and b with radius r
float sdCapsule(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

// Round cone (axis = Y). r1 = base radius, r2 = top radius, h = height
float sdRoundCone(vec3 p, float r1, float r2, float h) {
  vec2 q = vec2(length(p.xz), p.y);
  float b = (r1 - r2) / h;
  float a = sqrt(1.0 - b * b);
  float k = dot(q, vec2(-b, a));
  if (k < 0.0)   return length(q) - r1;
  if (k > a * h) return length(q - vec2(0.0, h)) - r2;
  return dot(q, vec2(a, b)) - r1;
}

// Round cone between points a and b. r1/r2 = end radii
float sdRoundCone(vec3 p, vec3 a, vec3 b, float r1, float r2) {
  vec3  ba = b - a;
  float l2 = dot(ba, ba);
  float rr = r1 - r2;
  float a2 = l2 - rr * rr;
  float il2 = 1.0 / l2;
  vec3 pa = p - a;
  float y = dot(pa, ba);
  float z = y - l2;
  float x2 = dot2(pa * l2 - ba * y);
  float y2 = y * y * l2;
  float z2 = z * z * l2;
  float k = sign(rr) * rr * rr * x2;
  if (sign(z) * a2 * z2 > k) return  sqrt(x2 + z2)             * il2 - r2;
  if (sign(y) * a2 * y2 < k) return  sqrt(x2 + y2)             * il2 - r1;
                             return (sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}

// Triangular prism (axis = Z). h = (apothem, half-height)
float sdTriPrism(vec3 p, vec2 h) {
  const float k = sqrt(3.0);
  h.x *= 0.5 * k;
  p.xy /= h.x;
  p.x = abs(p.x) - 1.0;
  p.y = p.y + 1.0 / k;
  if (p.x + k * p.y > 0.0) p.xy = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;
  p.x -= clamp(p.x, -2.0, 0.0);
  float d1 = length(p.xy) * sign(-p.y) * h.x;
  float d2 = abs(p.z) - h.y;
  return length(max(vec2(d1, d2), 0.0)) + min(max(d1, d2), 0.0);
}

// Vertical cylinder. h = (radius, half-height)
float sdCylinder(vec3 p, vec2 h) {
  vec2 d = abs(vec2(length(p.xz), p.y)) - h;
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

// Arbitrary cylinder between a and b. r = radius
float sdCylinder(vec3 p, vec3 a, vec3 b, float r) {
  vec3 pa = p - a;
  vec3 ba = b - a;
  float baba = dot(ba, ba);
  float paba = dot(pa, ba);
  float x = length(pa * baba - ba * paba) - r * baba;
  float y = abs(paba - baba * 0.5) - baba * 0.5;
  float x2 = x * x;
  float y2 = y * y * baba;
  float d = (max(x, y) < 0.0)
          ? -min(x2, y2)
          : (((x > 0.0) ? x2 : 0.0) + ((y > 0.0) ? y2 : 0.0));
  return sign(d) * sqrt(abs(d)) / baba;
}

// Infinite cone (axis = Y). c = (sin, cos) of half-angle, h = height
float sdCone(vec3 p, vec2 c, float h) {
  vec2 q = h * vec2(c.x, -c.y) / c.y;
  vec2 w = vec2(length(p.xz), p.y);
  vec2 a = w - q * clamp(dot(w, q) / dot(q, q), 0.0, 1.0);
  vec2 b = w - q * vec2(clamp(w.x / q.x, 0.0, 1.0), 1.0);
  float k = sign(q.y);
  float d = min(dot(a, a), dot(b, b));
  float s = max(k * (w.x * q.y - w.y * q.x), k * (w.y - q.y));
  return sqrt(d) * sign(s);
}

// Capped cone (axis = Y). h = half-height, r1/r2 = bottom/top radii
float sdCappedCone(vec3 p, float h, float r1, float r2) {
  vec2 q = vec2(length(p.xz), p.y);
  vec2 k1 = vec2(r2, h);
  vec2 k2 = vec2(r2 - r1, 2.0 * h);
  vec2 ca = vec2(q.x - min(q.x, (q.y < 0.0) ? r1 : r2), abs(q.y) - h);
  vec2 cb = q - k1 + k2 * clamp(dot(k1 - q, k2) / dot2(k2), 0.0, 1.0);
  float s = (cb.x < 0.0 && ca.y < 0.0) ? -1.0 : 1.0;
  return s * sqrt(min(dot2(ca), dot2(cb)));
}

// Capped cone between points a and b
float sdCappedCone(vec3 p, vec3 a, vec3 b, float ra, float rb) {
  float rba  = rb - ra;
  float baba = dot(b - a, b - a);
  float papa = dot(p - a, p - a);
  float paba = dot(p - a, b - a) / baba;
  float x = sqrt(papa - paba * paba * baba);
  float cax = max(0.0, x - ((paba < 0.5) ? ra : rb));
  float cay = abs(paba - 0.5) - 0.5;
  float k = rba * rba + baba;
  float f = clamp((rba * (x - ra) + paba * baba) / k, 0.0, 1.0);
  float cbx = x - ra - f * rba;
  float cby = paba - f;
  float s = (cbx < 0.0 && cay < 0.0) ? -1.0 : 1.0;
  return s * sqrt(min(cax * cax + cay * cay * baba,
                      cbx * cbx + cby * cby * baba));
}

// Solid angle (cone of given angle on a sphere). c = (sin, cos) of angle, ra = sphere radius
float sdSolidAngle(vec3 pos, vec2 c, float ra) {
  vec2 p = vec2(length(pos.xz), pos.y);
  float l = length(p) - ra;
  float m = length(p - c * clamp(dot(p, c), 0.0, ra));
  return max(l, m * sign(c.y * p.x - c.x * p.y));
}

// Link (chain link / oblong torus, axis +Y).
// le = half-length of straight section, r1 = major radius (loop), r2 = minor radius (tube).
float sdLink(vec3 p, float le, float r1, float r2) {
  vec3 q = vec3(p.x, max(abs(p.y) - le, 0.0), p.z);
  return length(vec2(length(q.xy) - r1, q.z)) - r2;
}

// Octahedron (exact). s = vertex distance from origin
float sdOctahedron(vec3 p, float s) {
  p = abs(p);
  float m = p.x + p.y + p.z - s;
  vec3 q;
       if (3.0 * p.x < m) q = p.xyz;
  else if (3.0 * p.y < m) q = p.yzx;
  else if (3.0 * p.z < m) q = p.zxy;
  else return m * 0.57735027;
  float k = clamp(0.5 * (q.z - q.y + s), 0.0, s);
  return length(vec3(q.x, q.y - s + k, q.z - k));
}

// Pyramid (square base, IQ canonical). Base = 1×1 at y=0, apex at y=+h
float sdPyramid(vec3 p, float h) {
  float m2 = h * h + 0.25;
  p.xz = abs(p.xz);
  p.xz = (p.z > p.x) ? p.zx : p.xz;
  p.xz -= 0.5;
  vec3 q = vec3(p.z, h * p.y - 0.5 * p.x, h * p.x + 0.5 * p.y);
  float s = max(-q.x, 0.0);
  float t = clamp((q.y - 0.5 * p.z) / (m2 + 0.25), 0.0, 1.0);
  float a = m2 * (q.x + s) * (q.x + s) + q.y * q.y;
  float b = m2 * (q.x + 0.5 * t) * (q.x + 0.5 * t) + (q.y - m2 * t) * (q.y - m2 * t);
  float d2 = min(q.y, -q.x * m2 - q.y * 0.5) > 0.0 ? 0.0 : min(a, b);
  return sqrt((d2 + q.z * q.z) / m2) * sign(max(q.z, -p.y));
}

// Rhombus (flat diamond). la/lb = semi axes, h = thickness, ra = corner radius
float sdRhombus(vec3 p, float la, float lb, float h, float ra) {
  p = abs(p);
  vec2 b = vec2(la, lb);
  float f = clamp((ndot(b, b - 2.0 * p.xz)) / dot(b, b), -1.0, 1.0);
  vec2 q = vec2(length(p.xz - 0.5 * b * vec2(1.0 - f, 1.0 + f))
                * sign(p.x * b.y + p.z * b.x - b.x * b.y) - ra,
                p.y - h);
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0));
}

// Horseshoe. c = (cos, sin) of opening angle, r = radius, le = length, w = (half-width, half-thickness)
float sdHorseshoe(vec3 p, vec2 c, float r, float le, vec2 w) {
  p.x = abs(p.x);
  float l = length(p.xy);
  p.xy = mat2(-c.x, c.y, c.y, c.x) * p.xy;
  p.xy = vec2((p.y > 0.0 || p.x > 0.0) ? p.x : l * sign(-c.x),
              (p.x > 0.0)              ? p.y : l);
  p.xy = vec2(p.x, abs(p.y - r)) - vec2(le, 0.0);
  vec2 q = vec2(length(max(p.xy, 0.0)) + min(0.0, max(p.x, p.y)), p.z);
  vec2 d = abs(q) - w;
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

// U-shape. r = radius, le = length, w = (half-width, half-thickness)
float sdU(vec3 p, float r, float le, vec2 w) {
  p.x = (p.y > 0.0) ? abs(p.x) : length(p.xy);
  p.x = abs(p.x - r);
  p.y = p.y - le;
  float k = max(p.x, p.y);
  vec2 q = vec2((k < 0.0) ? -k : length(max(p.xy, 0.0)), abs(p.z)) - w;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}

// ---- d3.js extensions (not in IQ paste) -----------------------------------

// Rounded box (IQ classic, separate article). b = half-extents, r = corner radius
float sdRoundedBox(vec3 p, vec3 b, float r) {
  vec3 q = abs(p) - b + r;
  return min(max(q.x, max(q.y, q.z)), 0.0) + length(max(q, 0.0)) - r;
}

// Tetrahedron. r = vertex distance from origin
float sdTetrahedron(vec3 p, float r) {
  return (max(abs(p.x + p.y) - p.z, abs(p.x - p.y) + p.z) - r) / sqrt(3.0);
}

// Dodecahedron. r = vertex distance from origin
float sdDodecahedron(vec3 p, float r) {
  const float phi  = 1.6180339887498949;            // (1 + sqrt(5)) / 2
  const float len  = 2.288245611270738;             // sqrt(1 + (1+phi)^2)
  const float nx   = 0.43701602444882093;           // 1 / len
  const float ny   = 1.1441227956258797;            // (1 + phi) / len
  p = abs(p) / r;
  float a = p.x * nx + p.y * ny;
  float b = p.y * nx + p.z * ny;
  float c = p.x * ny + p.z * nx;
  return (max(max(a, b), c) - nx) * r;
}

// Icosahedron. r = vertex distance from origin
float sdIcosahedron(vec3 p, float r) {
  const float scale = 0.8506507174597755;            // 1 / sqrt(2 + 1/phi)
  const float phi   = 1.6180339887498949;
  const float len   = 2.288245611270738;
  const float nx    = 0.43701602444882093;
  const float ny    = 1.1441227956258797;
  const float w13   = 0.5773502691896258;            // 1 / sqrt(3)
  float R = r * scale;
  p = abs(p) / R;
  float a = p.x * nx + p.y * ny;
  float b = p.y * nx + p.z * ny;
  float c = p.x * ny + p.z * nx;
  float d = (p.x + p.y + p.z) * w13;
  return (max(max(max(a, b), c), d) - nx) * R;
}

// ---- Boolean / decoration ops ---------------------------------------------

float opUnion(float a, float b)      { return min(a, b); }
float opIntersect(float a, float b)  { return max(a, b); }
float opDifference(float a, float b) { return max(a, -b); }

// IQ polynomial smooth variants. k = blend radius
float opSmoothUnion(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}
float opSmoothIntersect(float a, float b, float k) {
  float h = clamp(0.5 - 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) + k * h * (1.0 - h);
}
float opSmoothDifference(float a, float b, float k) {
  float h = clamp(0.5 - 0.5 * (a + b) / k, 0.0, 1.0);
  return mix(a, -b, h) + k * h * (1.0 - h);
}

float opShell(float d, float thickness) { return abs(d) - thickness * 0.5; }
float opDilate(float d, float r)        { return d - r; }
float opErode(float d, float r)         { return d + r; }

// ---- hg_sdf-style join variants (Mercury "Hg" library, demoscene-grade) ---
// All formulas from mercury.sexy/hg_sdf — Lipschitz-preserving join ops that
// produce architectural/mechanical detail at boolean boundaries.
//
// Chamfer = 45-degree flat bevel (square diagonal of size r). Use for cut
// stone, brutalist edges, beveled metalwork.
float opChamferUnion(float a, float b, float r) {
  return min(min(a, b), (a + b - r) * 0.70710678);
}
float opChamferIntersect(float a, float b, float r) {
  return max(max(a, b), (a + b + r) * 0.70710678);
}
float opChamferDifference(float a, float b, float r) {
  return opChamferIntersect(a, -b, r);
}

// Round = quarter-circle bevel (radius r). Use for polished joins, soft
// rounded furniture corners, ceramic vessels. Geometrically distinct from
// smooth-union: this is an exact circular fillet, not exponential blend.
float opRoundUnion(float a, float b, float r) {
  vec2 u = max(vec2(r - a, r - b), vec2(0.0));
  return max(r, min(a, b)) - length(u);
}
float opRoundIntersect(float a, float b, float r) {
  vec2 u = max(vec2(r + a, r + b), vec2(0.0));
  return min(-r, max(a, b)) + length(u);
}
float opRoundDifference(float a, float b, float r) {
  return opRoundIntersect(a, -b, r);
}

// Soft = cubic-polynomial smooth join. Different from opSmoothUnion (which is
// IQ's exponential blend) — this is hg_sdf's preferred soft union for clean
// silhouettes. Use for organic morphs, melted/wax look.
float opSoftUnion(float a, float b, float r) {
  float e = max(r - abs(a - b), 0.0);
  return min(a, b) - e * e * 0.25 / r;
}

// Stairs = N stair steps at the join boundary. Use for: ziggurats, step
// pyramids, cathedral plinths, terraced gardens, mech transitions.
float opStairsUnion(float a, float b, float r, float n) {
  float s = r / n;
  float u = b - r;
  return min(min(a, b), 0.5 * (u + a + abs(mod(u - a + s, 2.0 * s) - s)));
}
float opStairsIntersect(float a, float b, float r, float n) {
  return -opStairsUnion(-a, -b, r, n);
}
float opStairsDifference(float a, float b, float r, float n) {
  return -opStairsUnion(-a, b, r, n);
}

// Columns = N columnar bumps at the join boundary. Use for: gothic clustered
// columns, reeded furniture legs, fluted decorative joints.
// Helper: 45-degree rotation in 2D
vec2 _pR45(vec2 p) {
  return (p + vec2(p.y, -p.x)) * 0.70710678;
}
float opColumnsUnion(float a, float b, float r, float n) {
  if ((a < r) && (b < r)) {
    vec2 p = vec2(a, b);
    float columnradius = r * 1.41421356 / ((n - 1.0) * 2.0 + 1.41421356);
    p = _pR45(p);
    p.x -= 0.70710678 * r;
    p.x += columnradius * 1.41421356;
    if (mod(n, 2.0) == 1.0) p.y += columnradius;
    p.y = mod(p.y + columnradius, 2.0 * columnradius) - columnradius;
    float result = length(p) - columnradius;
    result = min(result, p.x);
    result = min(result, a);
    return min(result, b);
  }
  return min(a, b);
}
float opColumnsDifference(float a, float b, float r, float n) {
  float aa = -a;
  float m = min(aa, b);
  if ((aa < r) && (b < r)) {
    vec2 p = vec2(aa, b);
    float columnradius = r * 1.41421356 / n * 0.5;
    p = _pR45(p);
    p.x -= 0.70710678 * r;
    p.x += columnradius * 1.41421356;
    if (mod(n, 2.0) == 1.0) p.y += columnradius;
    p.y = mod(p.y + columnradius, 2.0 * columnradius) - columnradius;
    float result = -(length(p) - columnradius);
    result = max(result, p.x);
    result = min(result, aa);
    result = min(result, b);
    return -result;
  }
  return -m;
}
float opColumnsIntersect(float a, float b, float r, float n) {
  return opColumnsDifference(a, -b, r, n);
}

// ---- hg_sdf surface-modification ops (asymmetric A + B pairs) ------------
// Unlike union/diff/intersect these are NOT commutative — A is the host
// surface, B is the modifier (line / cutter / ridge / pipe axis).

// Pipe: hollow tube at the intersection of two surfaces. Use for: cables,
// railings, edge-piping on furniture, wireframe-like effects.
float opPipe(float a, float b, float r) {
  return length(vec2(a, b)) - r;
}

// Engrave: engrave B into A's surface (45-degree V-groove). Use for:
// inscribed text, decorative scribed lines, embossed/incised patterns.
float opEngrave(float a, float b, float r) {
  return max(a, (a + r - abs(b)) * 0.70710678);
}

// Groove: rectangular slot cut into A along B. (ra, rb) = depth, half-width.
// Use for: furniture rabbets, mechanical slots, architectural rustication.
float opGroove(float a, float b, float ra, float rb) {
  return max(a, min(a + ra, rb - abs(b)));
}

// Tongue: rectangular ridge added to A along B. Inverse of Groove.
// Use for: tongue-and-groove joinery, edge molding, raised banding.
float opTongue(float a, float b, float ra, float rb) {
  return min(a, max(a - ra, abs(b) - rb));
}

// ---- Transform helpers (act on p, return new p) ---------------------------

vec3 opTranslate(vec3 p, vec3 offset) {
  return p - offset;
}

// 3-axis rotation matrices. Caller composes as needed: rotY(yaw) * rotX(pitch) * p
mat3 rotX(float a) {
  float c = cos(a), s = sin(a);
  return mat3(1.0, 0.0, 0.0,
              0.0,  c , -s ,
              0.0,  s ,  c );
}
mat3 rotY(float a) {
  float c = cos(a), s = sin(a);
  return mat3( c , 0.0,  s ,
              0.0, 1.0, 0.0,
              -s , 0.0,  c );
}
mat3 rotZ(float a) {
  float c = cos(a), s = sin(a);
  return mat3( c , -s , 0.0,
               s ,  c , 0.0,
              0.0, 0.0, 1.0);
}

// Inverse rotation = transpose for orthonormal matrices. Use these when
// transforming p into the primitive's local frame (rotate-the-input idiom):
//   d = sdSphere(rotY_inv(yaw) * (p - center), r)
mat3 rotX_inv(float a) { return rotX(-a); }
mat3 rotY_inv(float a) { return rotY(-a); }
mat3 rotZ_inv(float a) { return rotZ(-a); }

// Non-uniform scale. Returned distance must be multiplied by min(s) to
// remain a conservative SDF (matches d3.js scale convention):
//   d = sdBox(opScale(p, vec3(2.0, 1.0, 1.0)), b) * 1.0
vec3 opScale(vec3 p, vec3 s) {
  return p / s;
}

// ---- Artistic ops (input-space deformations) ------------------------------

// Twist around Y axis. k = radians per unit Y.
vec3 opTwist(vec3 p, float k) {
  float c = cos(k * p.y), s = sin(k * p.y);
  return vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z);
}

// Bend in XY plane around X axis. k = curvature (rad per unit X).
vec3 opBend(vec3 p, float k) {
  float c = cos(k * p.x), s = sin(k * p.x);
  return vec3(c * p.x - s * p.y, s * p.x + c * p.y, p.z);
}

// Curve warp: offset X by amp*sin(driverAxis*freq). The canonical Venice canal
// idiom (x += 20*sin(z*0.02)) generalised — let any axis drive a sinusoidal
// X offset. Composes with any child SDF — buildings, vehicles, mountains all
// get curved along a sinuous path. driverIdx: 0=x, 1=y, 2=z (typically 2).
vec3 opCurve(vec3 p, float amp, float freq, int driverIdx) {
  float driver = driverIdx == 0 ? p.x : (driverIdx == 1 ? p.y : p.z);
  p.x -= amp * sin(driver * freq);
  return p;
}

// ---- Canal building (Venice-style, procedural windows) --------------------
// Procedural building atom: box shell with window grid recesses carved into
// all 4 vertical facades. Window positions / sizes are procedurally generated
// from grid count parameters; the recess depth is fixed so windows feel like
// real openings (not just texture).
//
// Footprint is square (width × width). Building rises from y=0 to y=2*height.
// Caller positions the building via translate (typically y = 0 for ground).
float sdCanalBuilding(vec3 p, float width, float height, float winX, float winY) {
  p.y -= height;  // center on Y (atom expects ground at y=0)

  float shell = sdBox(p, vec3(width, height, width));

  // Window slot dimensions — winX + 0.5 / winY + 0.5 padding pulls outermost
  // windows inward so they don't touch building corners.
  float wsX = 2.0 * width  / (winX + 0.5);
  float wsY = 2.0 * height / (winY + 0.5);
  float halfWinW = wsX * 0.32;
  float halfWinH = wsY * 0.40;
  float recessDepth = 0.18;

  // Cutter for z-facing facades (windows on z = ±width planes). abs(p.z)
  // maps both facades to the same recess. The cutter z-extent is
  // recessDepth + 0.08 (slightly LARGER than recessDepth) so the cutter
  // extends past the outer wall surface. Without this extension, the
  // cutter SDF is exactly 0 at the outer wall in cell footprints, which
  // confuses sphere-trace into rendering the recess opening as wall.
  vec3 qz = vec3(
    mod(p.x + wsX * 0.5, wsX) - wsX * 0.5,
    mod(p.y + wsY * 0.5, wsY) - wsY * 0.5,
    abs(p.z) - width + recessDepth
  );
  float winZ = sdBox(qz, vec3(halfWinW, halfWinH, recessDepth + 0.08));

  // Cutter for x-facing facades (windows on x = ±width planes).
  vec3 qx = vec3(
    abs(p.x) - width + recessDepth,
    mod(p.y + wsY * 0.5, wsY) - wsY * 0.5,
    mod(p.z + wsX * 0.5, wsX) - wsX * 0.5
  );
  float winX2 = sdBox(qx, vec3(recessDepth + 0.08, halfWinH, halfWinW));

  // Roof cornice — thin horizontal recess near the top edge to break the
  // dead-box silhouette. The carve is a band that wraps all 4 vertical
  // facades within recessDepth of the outer surface, between y=cornY±halfH.
  float cornY = height - 0.4;
  float cornHalfH = 0.12;
  float distToOuter = max(abs(p.x), abs(p.z)) - width;
  float cornCarve = max(
    -(distToOuter + recessDepth * 0.5),
    abs(p.y - cornY) - cornHalfH
  );

  // Step factor 0.7: the SDF subtraction max(shell, -union(cutters)) is not
  // strictly Lipschitz at corners where multiple cutters or facade boundaries
  // overlap — sphere trace can overshoot at glancing angles. 0.7 provides
  // safety margin without crippling march convergence.
  return 0.7 * max(shell, -min(min(winZ, winX2), cornCarve));
}

// ---- Canal building lit windows ------------------------------------------
// Thin glow planes inside the window recesses of canal-building. Hash on
// window cell index decides lit/dark. Designed to be a SEPARATE leaf so it
// can carry a glow material independent of the wall material.
//
// Caller composes this atom in the SAME position as a canal-building with
// matching args — they share window grid geometry. Density controls fraction
// lit (0 = all dark, 1 = all lit).
float sdCanalWindows(vec3 p, float width, float height, float winX, float winY, float density, float seed) {
  p.y -= height;
  // Match canal-building window grid exactly.
  float wsX = 2.0 * width  / (winX + 0.5);
  float wsY = 2.0 * height / (winY + 0.5);
  float halfWinW = wsX * 0.30;  // slightly smaller than recess (which uses 0.32)
  float halfWinH = wsY * 0.38;
  float planeDepth = 0.025;

  // Building extent — outside this in x/y, no windows exist. Margin trims edges
  // so windows don't touch building corners (matches canal-building padding).
  float xMargin = width  - 0.2;
  float yMargin = height - 0.4;
  float xBound = abs(p.x) - xMargin;
  float yBound = abs(p.y) - yMargin;

  // ---- x-facing facade planes (windows on z = ±width) ----
  // Slab in z: thin plane at |z| = width - 0.065 (just inside outer skin)
  float facadeZ = abs(p.z) - (width - planeDepth - 0.04);
  float zSlab = abs(facadeZ) - planeDepth;  // <=0 inside slab

  // Per-window cell shape (modulo grid)
  float winLocal_x = mod(p.x + wsX * 0.5, wsX) - wsX * 0.5;
  float winLocal_y = mod(p.y + wsY * 0.5, wsY) - wsY * 0.5;
  float winShape_xLane = max(abs(winLocal_x) - halfWinW, abs(winLocal_y) - halfWinH);

  // Lit/dark per cell
  float cellXi = floor((p.x + wsX * 0.5) / wsX);
  float cellYi = floor((p.y + wsY * 0.5) / wsY);
  float litZ = step(1.0 - density, hash21(vec2(cellXi, cellYi) + seed));

  // Intersection of: slab, building bounds, window cell shape
  float planeZ = max(max(zSlab, max(xBound, yBound)), winShape_xLane);
  // If not lit, push very far (sphere trace will skip past this region)
  planeZ = mix(1e3, planeZ, litZ);

  // ---- z-facing facade planes (windows on x = ±width) ----
  float facadeX = abs(p.x) - (width - planeDepth - 0.04);
  float xSlab = abs(facadeX) - planeDepth;

  float winLocal_z = mod(p.z + wsX * 0.5, wsX) - wsX * 0.5;
  float winShape_zLane = max(abs(winLocal_z) - halfWinW, abs(winLocal_y) - halfWinH);

  float cellZi = floor((p.z + wsX * 0.5) / wsX);
  float litX = step(1.0 - density, hash21(vec2(cellZi, cellYi) + seed + 173.7));

  float zBound = abs(p.z) - xMargin;
  float planeX = max(max(xSlab, max(zBound, yBound)), winShape_zLane);
  planeX = mix(1e3, planeX, litX);

  return min(planeZ, planeX);
}

// ---- IQ-style terrain heightmap (Reinder Nijhoff Himalayas-inspired) -----
// Independent reimplementation. Core idiom (IQ MdX3Rr "Elevated"):
//   - Value noise WITH analytical derivatives (atlasNoised returns vec3)
//   - fbm with gradient-weighted decay: a += b * n.x / (1 + dot(d, d))
//     where d accumulates octave derivatives — produces "smoother on
//     steep slopes, rougher on flat areas", counter-intuitive but visually
//     correct mountain look
//   - Anisotropic octave matrix mat2(1.6, -1.2, 1.2, 1.6) — better than
//     pure rotation, avoids grid artefacts at high octaves
//   - Source-side smoothstep mask creates "valley along z=0" so demo
//     compositions have a natural through-route for a camera path

// Value noise with analytical derivatives (IQ canonical). Returns
// (value, d/dx, d/dy). Derivatives drive the gradient-decay fbm.
vec3 atlasNoised(vec2 x) {
  vec2 f = fract(x);
  vec2 u = f * f * (3.0 - 2.0 * f);
  vec2 p = floor(x);
  float a = hash21(p + vec2(0.0, 0.0));
  float b = hash21(p + vec2(1.0, 0.0));
  float c = hash21(p + vec2(0.0, 1.0));
  float d = hash21(p + vec2(1.0, 1.0));
  return vec3(
    a + (b-a)*u.x + (c-a)*u.y + (a-b-c+d)*u.x*u.y,
    6.0 * f * (1.0 - f) * (vec2(b-a, c-a) + (a-b-c+d) * u.yx)
  );
}

// Heightmap value at xz coords. octaves bound is dynamic via early-break
// (GLSL ES 1.0 requires const loop bounds — use big upper limit + break).
//   maxHeight: peak Y in world units
//   hwRatio:   horizontal-to-vertical scale ratio (smaller = wider mountains)
float atlasTerrainHeight(vec2 x, float maxHeight, float hwRatio, int octaves) {
  vec2 p = x * hwRatio;
  // Valley mask along z=0 — smoothstep ramps from 0.25 at z=0 to 1.0 at |z|>0.4.
  // Creates a low-lying corridor for through-camera paths in demos.
  float s = mix(1.0, smoothstep(0.0, 0.4, abs(p.y)), 0.75);

  float a = 0.0;
  float b = 1.0;
  vec2 d = vec2(0.0);
  mat2 m = mat2(1.6, -1.2, 1.2, 1.6);
  for (int i = 0; i < 32; i++) {
    if (i >= octaves) break;
    vec3 n = atlasNoised(p);
    d += n.yz;
    a += b * n.x / (1.0 + dot(d, d));
    b *= 0.5;
    p = m * p;
  }
  return s * a * (maxHeight * 0.5);
}

// Heightfield-as-SDF wrapper. Step factor 0.3 — high-octave fbm has Lipschitz
// > 1 in many directions, so sphere-trace needs aggressive step damping to
// converge without overshooting peaks. 5 octaves for tracing balances detail
// vs convergence speed; renderer re-evaluates at higher counts for normal/AO.
float sdTerrainHeightmap(vec3 p, float maxHeight, float hwRatio) {
  float h = atlasTerrainHeight(p.xz, maxHeight, hwRatio, 5);
  return (p.y - h) * 0.3;
}

// ---- Elevated terrain (Kolaczynski / iq MdX3Rr-inspired) -----------------
// Sharp mountain ridges rising from flat lowlands. Adds two idioms beyond
// atlasTerrainHeight:
//   1. ridge sharpening via pow(f, ridgePower) — peaks sharpen, valleys flatten
//   2. mountain mask: a low-frequency noise (f0) decides where peaks rise vs
//      where the surface stays flat — gives "mountain range punching out of
//      plain" rather than uniform rolling hills.
//
// Independent reimplementation — no source copied. Algorithm reference:
//   iq's MdX3Rr "Elevated" + Kolaczynski's MttGz4 terrain.glsl recipe.
//
// Tuning:
//   maxHeight    — peak Y in world units (40-100 typical)
//   scale        — horizontal scale (0.005-0.02 typical; smaller = wider features)
//   ridgePower   — sharpness (1.0 = soft hills, 2-3 = sharp alpine peaks)
//   mountainness — fraction of area that becomes mountains (0-1).
//                  0.55 = scattered peaks, 0.35 = continuous mountain range
float atlasTerrainElevated(vec2 x, float maxHeight, float scale,
                            float ridgePower, float mountainness, int octaves) {
  vec2 p = x * scale;
  // f0 = low-frequency mountain-mask noise
  float f0 = atlasNoised(p).x;

  // Multi-octave fbm with IQ derivative damping — smooth Lipschitz keeps
  // sphere-trace from overshooting peaks despite high octave count.
  float a = 0.0;
  float b = 0.5;
  vec2 d = vec2(0.0);
  mat2 m = mat2(1.6, -1.2, 1.2, 1.6);
  vec2 q = p * 2.0;
  for (int i = 0; i < 32; i++) {
    if (i >= octaves) break;
    vec3 n = atlasNoised(q);
    d += n.yz;
    a += b * n.x / (1.0 + dot(d, d));
    b *= 0.5;
    q = m * q;
  }

  // Ridge sharpening: pow on clamped value — small f get pushed toward 0,
  // f near 1 stay near 1 → peaks isolate. Min clamp 0.001 avoids pow(0, x) = NaN.
  float f = pow(clamp(a, 0.001, 1.0), ridgePower);

  // Mountain mask: smoothstep(mountainness, 1, f0). Where f0 < mountainness,
  // height is scaled down 20× (flat lowland). Where f0 > mountainness,
  // height is full peak. Smooth transition between.
  float k = smoothstep(mountainness, 1.0, f0);
  float h = mix(0.05, 1.0, k) * f * maxHeight;

  // Hole carving on flat regions — gives lowlands subtle relief.
  float flatK = 1.0 - smoothstep(0.0, 0.5, k);
  h -= flatK * abs(a * 2.0 - 1.0) * maxHeight * 0.12;

  return h;
}

// ---- Tree canopy 3D bump overlay (IQ Rainforest treesMap recipe-only port) ----
// Adds per-cell tree-bump displacement on top of terrain heightmap. Each 2.5-unit
// tile gets a tree at a hash-randomized offset; trees overlap to form dense canopy.
// Result: terrain surface BUMPS UP at each tree position → real 3D tree silhouettes
// on the canopy edge, not just flat color.
//
// Recipe only — IQ uses ellipsoid SDF per tree (full 3D shape); we approximate
// with smoothstep-falloff height bumps (cheaper, still gives tree-silhouette
// look at distance). Real-tree-like SDF is for hero foreground; this is for
// the canopy as a terrain-feature.
//
// canopyAmount 0 = off (backward compat default). 1 = max density.
// Internally clamped tree height = 4.0 world units (Atlas standard 1-10 scale).
float atlasCanopyBumps(vec2 x, float baseH, float canopyAmount) {
  if (canopyAmount < 0.001) return 0.0;
  vec2 cell = x * 0.4;  // 2.5-unit tiles
  vec2 cellInt = floor(cell);
  vec2 cellFrac = fract(cell);
  float bump = 0.0;
  for (int j = 0; j <= 1; j++) {
    for (int i = 0; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j)) - step(cellFrac, vec2(0.5));
      vec2 tid = cellInt + g;
      vec2 tof = vec2(hash21(tid * 7.3), hash21(tid * 13.1)) - 0.5;
      float td = length(cellFrac - (vec2(0.5) + tof * 0.5 + g));
      // 2026-05-25 fix: bushier trees (lower th, larger tw → rounder shape)
      // Was pointy spikes; now matches IQ's rounder canopy blobs.
      float th = 0.55 + 0.30 * hash21(tid + vec2(5.5));
      float tw = 0.50 + 0.20 * hash21(tid + vec2(11.7));
      bump = max(bump, th * smoothstep(tw, 0.0, td));
    }
  }
  // Activation: canopy only in grass altitude window + gentle baseline.
  // baseH check: trees grow on land between -3 and ~50 units altitude.
  float altMask = smoothstep(-3.0, 4.0, baseH) * (1.0 - smoothstep(45.0, 65.0, baseH));
  return canopyAmount * 4.0 * bump * altMask;
}

// ---- True 3D canopy granularity (IQ Rainforest recipe-only port) -----
// Adds 3D fbm × squared noise to the SDF directly (NOT to the 2D heightmap).
// Critical difference from 2D heightmap noise: 3D noise varies in Y too, so
// tree surfaces have actual 3D bumpy texture (leaf clusters), not 2D vertical
// stripe pattern. Recipe from IQ's treesMap which adds "d += 4*s" to tree SDF.
//
// Called from sdTerrainElevated wrapper with full 3D position p.
// Active near canopy surface (|p.y - h| < 5) + canopy altitude window.
// Returns SDF displacement to ADD to the (p.y - h) raw distance.
float atlasCanopyGranularity(vec3 p, float h, float canopyAmount) {
  if (canopyAmount < 0.001) return 0.0;
  // Altitude mask same as canopy bumps (only trees zone)
  float altMask = smoothstep(-3.0, 4.0, h) * (1.0 - smoothstep(45.0, 65.0, h));
  if (altMask < 0.01) return 0.0;
  // Distance mask: only near the canopy surface (avoid affecting sky / depths)
  float distMask = smoothstep(8.0, 0.0, abs(p.y - h));
  if (distMask < 0.01) return 0.0;
  // 2026-05-25 final dial: amp 2.0 / 1.2 both caused MAX_STEPS exhaustion +
  // floating tree artifacts (ray hits tree top but underlying terrain missed
  // due to step overshoot → sky color). Amp 0.6 keeps Lipschitz manageable
  // (~3.6) with looser step damp 0.18 → no MAX_STEPS exhaustion, no holes.
  // Granular noise still visible as subtle leaf-cluster texture on edges.
  float n = fbm3_lite(p * 3.0);
  n = n * n;
  return canopyAmount * 0.6 * n * altMask * distMask;
}

// ---- Cloud shadow projection (IQ Rainforest recipe-only port) -----------
// Project a world position along sun direction up to cloud-layer Y, sample
// 2D fbm density there, return shadow factor [0=fully shaded, 1=lit].
// Cheap analytical alternative to volumetric cloud occlusion raymarch.
// Combine with regular sun softshadow via multiplication.
float atlasCloudShadow(vec3 pos, vec3 sunDir, float cloudY) {
  if (sunDir.y < 0.05) return 1.0;  // sun below horizon → no projection
  float t = (cloudY - pos.y) / sunDir.y;
  if (t < 0.0) return 1.0;  // pos already above clouds
  vec3 cloudPos = pos + sunDir * t;
  // Sample fbm at projected XZ (use 2D Y=0 for noise input)
  float density = fbm3_lite(vec3(cloudPos.x * 0.003, 0.0, cloudPos.z * 0.003));
  // density ∈ ~[0, 1]; smoothstep to soft shadow
  return mix(0.4, 1.0, 1.0 - smoothstep(0.15, 0.55, density));
}

// ---- Cliff smoothstep injection (IQ Rainforest recipe-only port) -------
// Adds a sudden vertical jump in heightmap at a specified elevation band.
// Result: vertical rock-face cliffs at altitude (e.g. mountain plateau edges).
// Different from terrain-canyon Y-stretch displacement (vertical striations
// on noise); cliff injection creates STRUCTURAL flat-face walls.
//
// Pass cliffJump=0 to disable (backward-compat default). Other defaults
// pick a sensible mid-altitude band when enabled.
//
// Recipe only — IQ Rainforest combines this with smoothstepd() for analytical
// derivative chain-rule normal propagation. Atlas uses 4-tap finite-difference
// calcNormal which handles the discontinuity at higher cost but correct visuals.
float atlasCliffInject(float h, float cliffStart, float cliffEnd, float cliffJump) {
  return h + cliffJump * smoothstep(cliffStart, cliffEnd, h);
}

// SDF wrapper with tighter step damp (0.25 vs heightmap's 0.3) — ridge-
// sharpened peaks need finer steps to avoid penetration.
// 2026-05-24 evening (IQ Elevated study): bumped 6 → 9 octaves for sharper
// visible ridges. IQ's terrainM uses 9 octaves; this matches that LOD.
// Multi-LOD trick (16-oct for normal only) deferred — needs renderer changes
// that are out of scope for this lib-only ship.
float sdTerrainElevated(vec3 p, float maxHeight, float scale,
                         float ridgePower, float mountainness,
                         float cliffStart, float cliffEnd, float cliffJump,
                         float canopyAmount) {
  float h = atlasTerrainElevated(p.xz, maxHeight, scale, ridgePower, mountainness, 9);
  h = atlasCliffInject(h, cliffStart, cliffEnd, cliffJump);
  h += atlasCanopyBumps(p.xz, h, canopyAmount);
  // 3D canopy granularity (added to SDF, not h, so noise varies in Y)
  float granular = atlasCanopyGranularity(p, h, canopyAmount);
  // 2026-05-25 final: granular amp 0.6, Lipschitz ≈ 3.6 + p.y 1 = 4.6.
  // Safe step < 1/4.6 = 0.22. Use 0.18 for safety + speed. With 200 MAX_STEPS
  // canopy zones converge reliably, no holes, no floating trees.
  float stepDamp = mix(0.25, 0.18, smoothstep(0.0, 0.5, canopyAmount));
  return (p.y - h - granular) * stepDamp;
}

// ---- Terrain with lakes (IQ Rainforest envelope idiom) -----------------
// Two-mask combination: a LOW-frequency lake mask decides where the surface
// drops to a flat lake floor; everywhere else the existing elevated terrain
// equation applies. Lakes are NOT a separate water plane — they are part of
// the terrain heightfield, so ridges + valleys form naturally around them.
//
// Recipe-only port of IQ MdX3Rr "Rainforest" envelope() function. Independent
// reimplementation — IQ's specific noise functions and parameters are not
// copied; we use Atlas's existing atlasNoised/atlasTerrainElevated building
// blocks with our own threshold / mix structure.
//
// Tuning:
//   maxHeight    — same as terrain-elevated
//   scale        — same as terrain-elevated (horizontal terrain freq)
//   ridgePower   — same as terrain-elevated
//   mountainness — same as terrain-elevated
//   waterLevel   — Y coordinate where lake floor sits (also where water plane
//                  should be placed by caller; recommend identical Y)
//   lakeScale    — horizontal lake-mask freq (0.0005-0.002 typical;
//                  smaller = bigger lakes, fewer of them)
//   lakeAmount   — fraction of surface area occupied by lakes (0.1-0.5)
float atlasTerrainLakes(vec2 x, float maxHeight, float scale,
                         float ridgePower, float mountainness,
                         float waterLevel, float lakeScale, float lakeAmount,
                         int octaves) {
  // Lake mask: noise above (1 - lakeAmount) → flat lake. Smooth transition
  // band 0.05 wide so shoreline isn't a hard cliff.
  float threshold = 1.0 - lakeAmount;
  float lakeNoise = atlasNoised(x * lakeScale).x;
  float lakeMask = smoothstep(threshold - 0.05, threshold + 0.05, lakeNoise);

  // Mountain terrain — same as terrain-elevated
  float landHeight = atlasTerrainElevated(x, maxHeight, scale, ridgePower, mountainness, octaves);

  // Mix: lake regions go to a guaranteed sub-water depth. Land regions keep
  // their natural variance — some lowlands sit just below water level so the
  // sea-surface plane (placed by caller at waterLevel) shows around shorelines,
  // which is the IQ Rainforest look (water meandering through valleys, not
  // a uniform tan plain hiding the water below). Lake depth scales with
  // maxHeight so large terrain stays consistent.
  float lakeDepth = waterLevel - maxHeight * 0.05;
  return mix(landHeight, lakeDepth, lakeMask);
}

float sdTerrainLakes(vec3 p, float maxHeight, float scale,
                      float ridgePower, float mountainness,
                      float waterLevel, float lakeScale, float lakeAmount) {
  float h = atlasTerrainLakes(p.xz, maxHeight, scale, ridgePower, mountainness,
                                waterLevel, lakeScale, lakeAmount, 8);
  return (p.y - h) * 0.25;
}

// ---- Canyon 3D displacement overlay (IQ Canyon XdsXDS recipe-only port) ----
// Adds a 3D fbm noise offset to ANY heightmap-based SDF. The Y-stretch (typical
// 4×) maps horizontal noise bands to vertical wall striations — the canonical
// sandstone-canyon look (Bryce / Zion / Antelope Canyon). Drop into any
// terrain SDF wrapper as: "(displacement + p.y - h) * damp".
//
// Recipe only — IQ's displacement() uses 4 octaves with custom anisotropic
// rotation matrix; Atlas reimplements with our existing fbm3_lite (3 octaves,
// simpler matrix) which is ~90% the visual quality at ~75% the cost.
//
// Args:
//   p          — world position (3D)
//   scale      — horizontal noise frequency (0.05-0.15 typical)
//   yStretch   — Y-axis frequency multiplier (4.0 = strong vertical striations,
//                1.0 = isotropic crags, 0.25 = horizontal banding)
//   amplitude  — displacement magnitude in world units (1-5 typical)
float atlasCanyonDisplacement(vec3 p, float scale, float yStretch, float amplitude) {
  vec3 q = p * scale * vec3(1.0, yStretch, 1.0);
  return amplitude * fbm3_lite(q);
}

// Canyon terrain SDF: terrain-elevated heightmap + 3D displacement overlay.
// The displacement adds 3D bumpy variation on top of the 2D heightmap, so
// canyon walls show vertical striations + horizontal layering of the noise.
//
// Args:
//   maxHeight, scale, ridgePower, mountainness — same as terrain-elevated
//   displaceAmt — displacement amplitude (3-8 typical for canyon look)
//   yStretch    — Y multiplier on displacement noise (4 = vertical striations)
float sdTerrainCanyon(vec3 p, float maxHeight, float scale,
                       float ridgePower, float mountainness,
                       float displaceAmt, float yStretch) {
  float h = atlasTerrainElevated(p.xz, maxHeight, scale, ridgePower, mountainness, 9);
  float dis = atlasCanyonDisplacement(p, 0.0625, yStretch, displaceAmt);
  return (dis + p.y - h) * 0.25;
}

// ---- Procedural infinite city (Otavio Good Skyline CC0 recipe port) ----
// Per-block skyscraper SDF. World XZ is tiled into unit blocks; each block
// gets a deterministic random building from hash(blockId). Downtown bias
// makes buildings near the city center (world origin) taller.
//
// CRITICAL: This SDF is DISCONTINUOUS at block boundaries. Sphere trace will
// overshoot into neighboring blocks unless caller adds voxel-walk clamping
// to the raymarch step. flyLambert raymarch checks u_cityActive and clamps
// to nearest block boundary in that mode.
//
// Args:
//   p             — world position
//   blockSize     — XZ unit size of city blocks (1.0 typical)
//   maxHeight     — peak skyscraper height (10-25 typical)
//   downtownK     — center-bias strength (3-5; larger = more concentrated downtown)
float sdCityBlock(vec3 p, vec2 blockId, float blockSize, float maxHeight, float downtownK) {
  // Hash per-block random params
  vec2 r1 = vec2(hash21(blockId * 7.13), hash21(blockId * 13.37 + vec2(5.5)));
  vec2 r2 = vec2(hash21(blockId * 23.7 + vec2(11.1)), hash21(blockId * 17.3 + vec2(31.5)));

  // XZ center the position within the block (block center is at (blockSize/2, blockSize/2))
  vec2 localXZ = mod(p.xz, blockSize) - blockSize * 0.5;

  // Downtown bias: closer to origin → taller buildings
  float downtown = clamp(downtownK / max(length(blockId), 1.0), 0.0, 1.0);
  // 2026-05-25 user feedback "街道要更加宽": narrower footprints 0.22-0.32
  // (was 0.30-0.40). Street gap min 0.36 (was 0.20) — wide enough for 2 lanes
  // each direction + sidewalk + room for cars to be visibly on the road.
  float baseRad = blockSize * (0.22 + r1.x * 0.10);
  // Building height — quantized to floor units for window alignment
  float height = (r1.y * r2.x + 0.15) * maxHeight * downtown * (1.0 + (baseRad - 0.3) * 4.0) + 0.5;
  height = floor(height * 5.0) / 5.0;

  // Main tower box. Y origin = 0 ground level.
  float d = sdBox(vec3(localXZ.x, p.y - height * 0.5, localXZ.y),
                  vec3(baseRad, height * 0.5, baseRad));

  // Smaller second section on top (50% of blocks)
  if (r2.y > 0.5 && height > 1.0) {
    float h2 = max(0.2, r2.y * 0.5) * downtown * maxHeight * 0.3;
    h2 = floor(h2 * 5.0) / 5.0;
    float r2rad = baseRad * (0.55 + r1.x * 0.25);
    d = min(d, sdBox(vec3(localXZ.x, p.y - height - h2 * 0.5, localXZ.y),
                      vec3(r2rad, h2 * 0.5, r2rad)));
  }

  // Dome top occasionally (4% chance)
  if (r1.x < 0.04 && height > 1.0) {
    float domeR = baseRad * 0.75;
    d = min(d, length(vec3(localXZ.x, p.y - height, localXZ.y)) - domeR);
  }

  // ---- Cars on roads (Otavio Good Skyline recipe) ------------------------
  // Two-way traffic on each road. Lanes at localXZ ±0.40 (beyond max building
  // footprint 0.32), cars travel along the perpendicular axis.
  // Car size: 0.16 long × 0.045 wide × 0.045 tall. Animated via u_time;
  // cars repeat every 0.55 along travel axis. No conditionals → Lipschitz-
  // safe sphere trace (4 cheap sdBox evals per ray step).
  //
  // Shader detects car hits by checking p.y in (0.04, 0.10) on a lane.
  float carT = u_time * 0.30;
  float ph1 = hash21(vec2(blockId.y, 17.3)) * 5.0;
  float ph2 = hash21(vec2(blockId.y, 31.7)) * 5.0;
  float ph3 = hash21(vec2(blockId.x, 23.9)) * 5.0;
  float ph4 = hash21(vec2(blockId.x, 41.1)) * 5.0;
  // E-W lanes (cars move along X)
  float carEW_zP = +0.40;  // +z lane: cars travel +x
  float carEW_zN = -0.40;  // -z lane: cars travel -x
  float carXp = mod(p.x + carT + ph1, 0.55) - 0.275;
  float carXn = mod(-p.x + carT + ph2, 0.55) - 0.275;
  d = min(d, sdBox(vec3(carXp, p.y - 0.045, localXZ.y - carEW_zP),
                   vec3(0.14, 0.04, 0.05)));
  d = min(d, sdBox(vec3(carXn, p.y - 0.045, localXZ.y - carEW_zN),
                   vec3(0.14, 0.04, 0.05)));
  // N-S lanes (cars move along Z)
  float carNS_xP = +0.40;
  float carNS_xN = -0.40;
  float carZp = mod(p.z + carT + ph3, 0.55) - 0.275;
  float carZn = mod(-p.z + carT + ph4, 0.55) - 0.275;
  d = min(d, sdBox(vec3(localXZ.x - carNS_xP, p.y - 0.045, carZp),
                   vec3(0.05, 0.04, 0.14)));
  d = min(d, sdBox(vec3(localXZ.x - carNS_xN, p.y - 0.045, carZn),
                   vec3(0.05, 0.04, 0.14)));

  // Ground (road + sidewalk plane at y=0)
  d = min(d, p.y);

  return d;
}

float sdProceduralCity(vec3 p, float blockSize, float maxHeight, float downtownK) {
  // Block ID = which city block we're in
  vec2 blockId = floor(p.xz / blockSize);
  return sdCityBlock(p, blockId, blockSize, maxHeight, downtownK) * 0.7;
}

// ---- Rune erosion bonsai terrain (MPL-2.0 — see rune-erosion-filter.js) ----
//
// Reads the CPU-baked heightmap from sampler2D u_heightmap. The 4 channels
// are documented at the top of this file (height/ridgeMap/treeAmount/erosion).
// The SDF is box-bounded; outside the XZ box we return the box wall distance,
// inside we return (p.y - heightmap.x * boxSize.y).
//
// Coordinate mapping: world XZ ∈ [-boxSize.x, boxSize.x] maps to UV [0, 1].
// Sampling uses linear interpolation (texture builtin); flyLambert sets
// the texture filter to LINEAR for smooth raymarch + NEAREST sampling can be
// added later for blueprint contour view if needed.
//
// Lipschitz: heightmap derivatives are bounded by the texture resolution;
// safety factor 0.5 keeps sphere trace from overshooting.
float sdTerrainErodedRune(vec3 p, vec3 boxSize) {
  // Sprint 12-3a: bonsai pedestal SDF. The terrain volume = intersection of
  // 3 constraints: inside box footprint AND above floor AND below heightmap.
  //
  // SDF as max() of three signed components, each positive when OUTSIDE its
  // constraint. Max gives positive (outside solid) iff any constraint fails;
  // negative (inside solid) iff all satisfied. This gives proper box-bounded
  // raymarch with both top (terrain) and side (cliff) surfaces hittable —
  // shader differentiates them via surface normal direction for strata vs
  // terrain material dispatch.
  vec2 uv = clamp(p.xz / (2.0 * boxSize.xz) + 0.5, vec2(0.0), vec2(1.0));
  float h = texture2D(u_heightmap, uv).x * boxSize.y;
  vec2 q = abs(p.xz) - boxSize.xz;
  float dSides  = max(q.x, q.y);     // positive when outside XZ footprint
  float dBottom = -p.y;              // positive when below floor (y < 0)
  float dTop    = p.y - h;           // positive when above heightmap surface
  return max(max(dSides, dBottom), dTop) * 0.5;  // 0.5 = Lipschitz safety
}

// ---- Parametric arch bridge (IQ Snow Bridge MdXGzr recipe-only port) ----
// A single SDF function builds the entire stone bridge — main arch + flat deck +
// side rails + repeated balusters + corner posts + sphere finials — via
// internal mod() repetition and abs() mirroring. One SDF eval ≈ 60 unioned
// primitives but ~10× faster.
//
// Recipe only — IQ MdXGzr is "educational, no commercial, no AI training"
// licensed; Atlas independently reimplements the idiom from scratch using our
// own sdBox helper + parameter names.
//
// Args:
//   p          — local position (apply transform via parent subject)
//   bridgeLen  — total span along Z (typical 24-40 world units)
//   bridgeWidth — half-width of deck along X (typical 3-5)
//   archH      — arch crown height above deck (typical 4-10)
//   railH      — rail post height above deck (typical 1.2-2.0)
//   cornerOff  — Z offset of corner posts from center (typical bridgeLen*0.35)
float sdArchBridge(vec3 p, float bridgeLen, float bridgeWidth,
                    float archH, float railH, float cornerOff) {
  float halfLen = bridgeLen * 0.5;

  // Arch curve: peaks at z=0, vanishes at z=±halfLen. Clamp the cosine input
  // so peripherals don't get garbage extrapolation beyond bridge ends.
  float zNorm = clamp(p.z / max(halfLen, 0.001), -1.0, 1.0);
  float f = 0.5 - 0.5 * cos(3.14159265 * zNorm);

  // Deck-Y reference: raises with arch crown so deck is flat on top of the
  // curve. The +1-6 offset matches IQ's "deck sits on top of vault" anchor.
  float deckY = p.y + 1.0 - 6.0 + f * 4.0;
  vec3 xpos = vec3(p.x, deckY, p.z);

  // Main vault body — height bulges with f²·g. The g mask leaves edges thin
  // (visible arch curve from below) and bulges the middle (solid stone arch).
  float gNorm = 0.5 + 0.5 * p.x / max(bridgeWidth, 0.001);
  float g = 1.0 - (smoothstep(0.15, 0.25, gNorm) - smoothstep(0.75, 0.85, gNorm));
  vec3 archPos = vec3(xpos.x, xpos.y + archH * f * f * g, xpos.z);
  float vault = sdBox(archPos, vec3(bridgeWidth, 0.5 + archH * f * f * g, halfLen) - vec3(0.1)) - 0.1;
  float mindist = vault;

  // Flat deck slab (slight overhang outside vault for cornice ledge)
  float deck = sdBox(xpos, vec3(bridgeWidth + 0.2, 0.1, halfLen));
  mindist = min(mindist, deck);

  // Side rails (mirrored via abs(x) → two rails from one box)
  vec3 sxpos = vec3(abs(xpos.x), xpos.y, xpos.z);
  float rail = sdBox(sxpos - vec3(bridgeWidth - 0.4, railH, 0.0),
                     vec3(0.4, 0.2, halfLen) - vec3(0.05)) - 0.05;
  mindist = min(mindist, rail);

  // Balusters & corner posts. Only within bridge span.
  // Corner posts at z = {0, ±cornerOff}; balusters at all other integer Z.
  if (abs(xpos.z) < halfLen) {
    // Determine if this XZ region is near a corner post position.
    float distToCenter   = abs(xpos.z);
    float distToCornerP  = abs(xpos.z - cornerOff);
    float distToCornerN  = abs(xpos.z + cornerOff);
    bool isCornerPost = (distToCenter < 0.5 || distToCornerP < 0.5 || distToCornerN < 0.5);

    if (isCornerPost) {
      // Corner post + sphere finial + small engraved cutout
      vec3 xp2 = vec3(abs(xpos.x) - (bridgeWidth - 0.6),
                       xpos.y - 1.0,
                       mod(1000.0 + xpos.z, 1.0) - 0.5);
      float post = sdBox(xp2, vec3(0.8, 1.0, 0.45));
      mindist = min(mindist, post);
      // Engraved cutout (subtract)
      float cutout = sdBox(xp2 + vec3(-0.8, 0.0, 0.0), vec3(0.15, 0.9, 0.35));
      mindist = max(mindist, -cutout);
      // Sphere finial on top
      float finial = length(xp2 - vec3(0.0, 1.3, 0.0)) - 0.35;
      mindist = min(mindist, finial);
    } else {
      // Repeating baluster — vase profile via cosine modulation
      vec3 xp2 = vec3(abs(xpos.x) - (bridgeWidth - 0.2),
                       xpos.y - 0.8,
                       mod(1000.0 + xpos.z, 1.0) - 0.5);
      vec3 xpc = vec3(length(xp2.xz), xp2.y, 0.0);
      float mo = 0.8 + 0.2 * cos(2.0 * 6.2831 * xp2.y);    // vertical vase waist
      float ma = cos(4.0 * atan(xp2.x, xp2.z));              // 8-segment angular ridges
      mo -= 0.1 * (1.0 - ma * ma);
      float baluster = sdBox(xpc, vec3(0.2 * mo, 0.5, 0.0));
      mindist = min(mindist, baluster);
    }
  }

  // Step damping — bridge has thin features (balusters 0.2 wide) so tighter
  // damp prevents sphere-trace overshoot. 0.25 matches terrain.
  return 0.25 * mindist;
}

// ---- Canal lamp bulbs (Venice-style streetlamp head) ---------------------
// Just the bulbs (3 spheres candelabra-style — big top + 2 side). Designed
// as a separate leaf so it can carry a high-glow material independently of
// the pole. Caller pairs this with a plain cylinder primitive (the pole)
// at the same translate, with a dark non-glow material.
//
// bulbY: Y coordinate of the big-bulb center (caller places this at the top
//        of their pole). Side bulbs sit 0.6*bulbR lower at ±1.2*bulbR in Z.
float sdCanalLampBulb(vec3 p, float bulbY, float bulbR) {
  float sideY = bulbY - 0.6 * bulbR;
  float sideZ = 1.2 * bulbR;
  float bigBulb  = length(p - vec3(0.0, bulbY, 0.0)) - bulbR;
  float leftBulb = length(p - vec3(0.0, sideY,  sideZ)) - bulbR * 0.7;
  float rightBulb = length(p - vec3(0.0, sideY, -sideZ)) - bulbR * 0.7;
  return min(bigBulb, min(leftBulb, rightBulb));
}

// ---- Canal bridge ---------------------------------------------------------
// Stone arch bridge spanning the canal. Box + tri-prism roof - cylindrical
// archway. Footprint along x (span direction), thickness along z (walkway
// width).
float sdCanalBridge(vec3 p, float span, float archR, float thickness) {
  // Main body: box from y=0 to y=2*archR
  vec3 q = p;
  q.y -= archR;
  float body = sdBox(q, vec3(span * 0.5, archR, thickness * 0.5));
  // Triangular crown on top (gives stone bridge profile)
  vec3 qcrown = vec3(q.x, q.y - archR * 0.4, q.z);
  float crown = sdTriPrism(vec3(qcrown.x, qcrown.y, qcrown.z),
                           vec2(archR * 0.7, thickness * 0.45));
  float bridge = min(body, crown);
  // Cylindrical archway cutting through (axis along z so water passes under).
  // Cylinder oriented with its axis along z requires sdCylinder variant; easier
  // to use sdCappedCylinder with endpoints.
  vec3 arch_a = vec3(0.0, 0.0, -thickness);
  vec3 arch_b = vec3(0.0, 0.0,  thickness);
  float arch = sdCylinder(p, arch_a, arch_b, archR * 0.85);
  // Subtract arch from bridge
  return max(bridge, -arch);
}

// ---- Domain repetition (Inigo Quilez pMod, autoscope idiom) ---------------
// period.x/y/z == 0  → 该轴不重复（等效 period ≈ ∞）
// IMPORTANT: 我们把 0 替换成 1e6 → 该轴的 mod 永不切，保留 caller "0 = 无 rep" 的写法
vec3 rep3(vec3 p, vec3 period) {
  vec3 q = period;
  if (q.x == 0.0) q.x = 1e6;
  if (q.y == 0.0) q.y = 1e6;
  if (q.z == 0.0) q.z = 1e6;
  return p - q * floor(p / q + 0.5);
}

// Limited rep: count[i] >= 0 → 沿轴 i tile 数限制在 ±count[i]；count[i] < 0 → 无限
// 用例：autoscope arch 廊柱 repL3(p, vec3(2.0, 0, 0), vec3(3, 0, 0)) = 7 拱并排
vec3 repL3(vec3 p, vec3 period, vec3 count) {
  vec3 q = period;
  if (q.x == 0.0) q.x = 1e6;
  if (q.y == 0.0) q.y = 1e6;
  if (q.z == 0.0) q.z = 1e6;
  vec3 id = floor(p / q + 0.5);
  if (count.x >= 0.0) id.x = clamp(id.x, -count.x, count.x);
  if (count.y >= 0.0) id.y = clamp(id.y, -count.y, count.y);
  if (count.z >= 0.0) id.z = clamp(id.z, -count.z, count.z);
  return p - q * id;
}

// ---- Axis mirror (|axis| fold) --------------------------------------------
// 单轴 abs 折叠：两侧都显示 child 的 +axis 半边（dn.js mirrorAxis 的 GPU 面）
vec3 mirX3(vec3 p) { return vec3(abs(p.x), p.y, p.z); }
vec3 mirY3(vec3 p) { return vec3(p.x, abs(p.y), p.z); }
vec3 mirZ3(vec3 p) { return vec3(p.x, p.y, abs(p.z)); }

// ---- noise-field 位移场（Infinigen 研读第二课）------------------------------
// d3.js noiseField 的 GPU 面：kind<0.5 = 3-octave 值噪声 fbm（径向鼓胀近似）,
// kind>0.5 = 3D cellular F1（岩石节理）。hash 公式与 CPU 端同一条 sin-fract。
float nfHash(vec3 c) { return fract(sin(dot(c, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float nfValue(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(nfHash(i), nfHash(i + vec3(1.0, 0.0, 0.0)), u.x),
        mix(nfHash(i + vec3(0.0, 1.0, 0.0)), nfHash(i + vec3(1.0, 1.0, 0.0)), u.x), u.y),
    mix(mix(nfHash(i + vec3(0.0, 0.0, 1.0)), nfHash(i + vec3(1.0, 0.0, 1.0)), u.x),
        mix(nfHash(i + vec3(0.0, 1.0, 1.0)), nfHash(i + vec3(1.0, 1.0, 1.0)), u.x), u.y),
    u.z);
}
// 3 octave 手动展开 —— scene SDF 会被内联进 march 循环,任何常量上界的 for
// 都会被 D3D fxc 完全展开(见 studio.js u_loopGuard 的判例),这里必须零循环。
float nfVfbm(vec3 p) {
  float s = 0.5 * nfValue(p);
  p = p * 2.03 + vec3(11.5, 27.1, 5.7);
  s += 0.25 * nfValue(p);
  p = p * 2.03 + vec3(11.5, 27.1, 5.7);
  s += 0.125 * nfValue(p);
  return s / 0.875;
}
// ridged crease（节理）：零循环、单 octave —— 最初的 27-cell Voronoi F1 和
// 双 octave 版都把 D3D pipeline 编译推到分钟级（fxc 对巨型 scene 函数的
// 优化开销 ∝ ALU 体量）；每次 displace 调用点都会把这里整段内联进 march。
float nfRidge(vec3 p) {
  return abs(2.0 * nfValue(p) - 1.0);
}
// sinfold:IQ 经典 sin 位移的 ridged 变体 —— 每次求值 3 个 sin(值噪声要 8 角
// hash)。studio 完整 shader 在 D3D 上把 sceneSDF 内联进十几个调用点,fxc 成本
// ∝ 场 ALU × 调用点,sinfold 是 decor 批量使用时唯一编译得动的档。
float nfSinfold(vec3 p) { return abs(sin(p.x) * sin(p.y * 1.13) * sin(p.z * 0.87)); }
float noiseField3(vec3 p, float kind, float freq, float amp) {
  vec3 q = p * freq;
  float v = kind > 1.5 ? nfSinfold(q) - 0.5
          : kind > 0.5 ? nfRidge(q) - 0.5
          : (nfVfbm(q) - 0.5) * 2.0;
  return amp * v;
}

// ---- hg_sdf-style polar repetition + octant mirror -----------------------
// pModPolar (hg_sdf): fold the two coords perpendicular to an axis into a
// single pie sector of angle 2π/n. Source SDF evaluated in folded space
// repeats radially N times around the axis. Use for: clock dials, gear teeth,
// rose-window petals, dome ribs, fan blades, mandalas.
//
// Three axis-aligned variants instead of a runtime-int dispatch (WebGL1
// would need an if-cascade anyway; emitter picks the right one).

vec2 _polarFold(vec2 v, float n) {
  float angle = 6.28318530718 / n;
  float a = atan(v.y, v.x) + angle * 0.5;
  float r = length(v);
  a = mod(a, angle) - angle * 0.5;
  return vec2(cos(a), sin(a)) * r;
}

vec3 polarModX(vec3 p, float n) {
  vec2 v = _polarFold(p.yz, n);
  return vec3(p.x, v.x, v.y);
}
vec3 polarModY(vec3 p, float n) {
  vec2 v = _polarFold(p.xz, n);
  return vec3(v.x, p.y, v.y);
}
vec3 polarModZ(vec3 p, float n) {
  vec2 v = _polarFold(p.xy, n);
  return vec3(v.x, v.y, p.z);
}

// pMirrorOctant (hg_sdf): mirror in two perpendicular axes plus the diagonal.
// Produces 8-fold symmetry in the chosen plane. Use for: snowflakes, mandala
// bases, symmetric ornamental panels, gothic rose-window arrangements.
//
// 'dist' offsets the mirror lines from the origin (lets you carve out a
// central solid region rather than slicing through it).

vec2 _mirrorOctantBase(vec2 q, vec2 dist) {
  q.x = abs(q.x) - dist.x;
  q.y = abs(q.y) - dist.y;
  if (q.y > q.x) q = q.yx;
  return q;
}

vec3 mirrorOctantXZ(vec3 p, vec2 dist) {
  vec2 q = _mirrorOctantBase(p.xz, dist);
  return vec3(q.x, p.y, q.y);
}
vec3 mirrorOctantXY(vec3 p, vec2 dist) {
  vec2 q = _mirrorOctantBase(p.xy, dist);
  return vec3(q.x, q.y, p.z);
}
vec3 mirrorOctantYZ(vec3 p, vec2 dist) {
  vec2 q = _mirrorOctantBase(p.yz, dist);
  return vec3(p.x, q.x, q.y);
}

// ---- Forest sprint helpers (stylized-tree + maple-leaf + flower + meteor) -
// Idiom-only port from soft-servo/jake's 'Tree in the wind' Shadertoy (analysed
// 2026-05-21). Re-implemented from first principles; no source code copied.
// hg_sdf pModPolar + IQ sdTriangleIsosceles + Hoskins-style hash are
// public-domain idioms re-implemented with original constants.

// chunkedTime: continuous u_time -> (localT in 0..period, iterRand stable in
// cycle). Lets one SDF helper drive per-particle cyclical motion (meteor
// visible window, falling-leaves drop cycle, flickering lights). baseRand
// seeds the phase so multiple particles cycle out of sync.
vec2 chunkedTime(float t, float period, float baseRand) {
  float total = t + baseRand * period;
  float iter = floor(total / period);
  float localT = total - iter * period;
  float iterRand = fract(iter * 0.6180339887);
  return vec2(localT, iterRand);
}

// IQ sdTriangleIsosceles 2D — apex at (0, q.y), half-width q.x. Building
// block for maple-leaf and other organic 2D shapes.
float sdTriangleIsosceles2D(vec2 p, vec2 q) {
  p.x = abs(p.x);
  vec2 a = p - q * clamp(dot(p, q) / dot(q, q), 0.0, 1.0);
  vec2 b = p - q * vec2(clamp(p.x / q.x, 0.0, 1.0), 1.0);
  float s = -sign(q.y);
  vec2 d = min(vec2(dot(a, a), s * (p.x * q.y - p.y * q.x)),
               vec2(dot(b, b), s * (p.y - q.y)));
  return -sqrt(d.x) * sign(d.y);
}

// IQ opExtrusion — 2D distance to 3D extruded slab of half-height h.
float opExtrusion3D(vec3 p, float dist2D, float h) {
  vec2 w = vec2(dist2D, abs(p.z) - h);
  return min(max(w.x, w.y), 0.0) + length(max(w, 0.0));
}

// Atlas-local Hoskins-style 1-in 1-out hash. Custom constants so we are not
// copying David Hoskins CC BY-SA implementation directly.
float forestHash1(float n) {
  n = fract(n * 0.10307);
  n *= n + 31.71;
  n *= n + n;
  return fract(n);
}

// Maple-leaf 2D — 3 isoceles triangles (1 main vertical + 2 sides at +-35deg)
// plus per-leaf fract edge bumps for noisy outline.
float sdMapleLeaf2D(vec2 p, float scale, float rand) {
  vec2 pMain = vec2(p.x, scale * 2.0 - p.y);
  float dMain = sdTriangleIsosceles2D(pMain, vec2(scale * 1.2, scale * 2.0));

  vec2 pSide = pMain;
  pSide.y -= scale * 0.75;
  pSide.x = abs(pSide.x) - scale * 1.3;
  float rc = cos(1.0996), rs = sin(1.0996);
  pSide = mat2(rc, -rs, rs, rc) * pSide;
  float dSide = sdTriangleIsosceles2D(pSide, vec2(scale * 0.55, scale * 1.3));

  float d = min(dMain, dSide);
  float edgeBumps = abs(fract((p.y + abs(p.x) * 2.0) * 8.0 + rand * 6.28) - 0.5)
                  * 0.08
                  * clamp(1.0 - abs(p.y / scale - 0.4) * 1.8, 0.0, 1.0);
  d -= edgeBumps;
  return d;
}

// Maple-leaf 3D — opExtrusion of 2D shape + cheap-bend curl by rand.
float sdMapleLeaf3D(vec3 p, float scale, float rand) {
  float bk = (rand - 0.5) * 5.0 / max(scale, 0.05);
  float bc = cos(bk * p.x), bs = sin(bk * p.x);
  vec3 q = vec3((mat2(bc, -bs, bs, bc) * p.xy), p.z);
  float d2 = sdMapleLeaf2D(q.xy, scale, rand);
  return opExtrusion3D(q, d2, scale * 0.04);
}

// Wavy capsule — vertical capsule with x-perturbation and base-to-tip taper.
// Used as trunk + each main branch in sdStylizedTree.
float sdWavyCapsule(vec3 p, float halfLen, float baseRad, float rand) {
  float yN = clamp(p.y / (2.0 * max(halfLen, 0.01)), 0.0, 1.0);
  float rad = baseRad * (1.0 - yN * 0.65);
  float wave = sin((rand + p.y) / max(halfLen, 0.01) * 11.0) * 0.12 * baseRad;
  vec3 q = p;
  q.x += wave;
  return sdCapsule(q, vec3(0.0, 0.0, 0.0), vec3(0.0, 2.0 * halfLen, 0.0), rad);
}

// 4-layer stylized tree.
//   L1: wavy trunk
//   L2: 3 height-layered main branch sets (pModPolar 6/5/3 fold)
//   L3: cellular leaf instances via pMod3 inside canopy bound
//   wind: trunk fixed, tips swing with sin(t*3.5) * heightK^2
//
// Args:
//   trunkLen  - total trunk height
//   trunkRad  - trunk base radius
//   leafSize  - half-extent of canopy leaf
//   windK     - wind sway amplitude (0=still, 0.15=breezy)
float sdStylizedTree(vec3 p, float trunkLen, float trunkRad, float leafSize, float windK) {
  float windFlex = sin(u_time * 3.5 + p.y * 0.08);
  float heightK = clamp(p.y / max(trunkLen, 0.01), 0.0, 1.0);
  p.x -= windK * windFlex * heightK * heightK;

  float trunk = sdWavyCapsule(p, trunkLen * 0.5, trunkRad, 0.0);

  float branches = 1e6;
  // Layer 2a — 6-fold polar at 0.40 of trunkLen, tilt +0.32pi outward
  {
    vec3 pB = p - vec3(0.0, trunkLen * 0.40, 0.0);
    pB = polarModY(pB, 6.0);
    float ra = forestHash1(1.0);
    float ang = 3.14159 * 0.32 + ra * 0.10;
    float ca = cos(ang), sa = sin(ang);
    pB.xy = mat2(ca, sa, -sa, ca) * pB.xy;
    branches = min(branches, sdWavyCapsule(pB, trunkLen * 0.30, trunkRad * 0.55, ra));
  }
  // Layer 2b — 5-fold at 0.65, tilt +0.35pi
  {
    vec3 pB = p - vec3(0.0, trunkLen * 0.65, 0.0);
    pB = polarModY(pB, 5.0);
    float ra = forestHash1(2.0);
    float ang = 3.14159 * 0.35 - ra * 0.05;
    float ca = cos(ang), sa = sin(ang);
    pB.xy = mat2(ca, sa, -sa, ca) * pB.xy;
    branches = min(branches, sdWavyCapsule(pB, trunkLen * 0.24, trunkRad * 0.45, ra));
  }
  // Layer 2c — 3-fold at 0.85, tilt +0.22pi
  {
    vec3 pB = p - vec3(0.0, trunkLen * 0.85, 0.0);
    pB = polarModY(pB, 3.0);
    float ra = forestHash1(3.0);
    float ang = 3.14159 * 0.22 - ra * 0.10;
    float ca = cos(ang), sa = sin(ang);
    pB.xy = mat2(ca, sa, -sa, ca) * pB.xy;
    branches = min(branches, sdWavyCapsule(pB, trunkLen * 0.18, trunkRad * 0.35, ra));
  }

  // Canopy bound: 3-lobe cluster (irregular like real tree). Each lobe is a
  // sphere; min() unions them. Slight vertical elongation so canopy is taller
  // than wide (mimics maple silhouette).
  vec3 pCan = p - vec3(0.0, trunkLen * 0.95, 0.0);
  // Vertical squish: y-scale 0.75 so ellipsoid is taller in y direction
  float canopyR0 = trunkLen * 0.55;
  vec3 lobeOff1 = vec3( trunkLen * 0.20, trunkLen * 0.10,  trunkLen * 0.15);
  vec3 lobeOff2 = vec3(-trunkLen * 0.30, trunkLen * 0.00, -trunkLen * 0.18);
  vec3 lobeOff3 = vec3( trunkLen * 0.05, trunkLen * 0.25,  trunkLen * 0.05);
  float c0 = length(vec3(pCan.x - lobeOff1.x, (pCan.y - lobeOff1.y) * 0.85, pCan.z - lobeOff1.z)) - canopyR0 * 0.78;
  float c1 = length(vec3(pCan.x - lobeOff2.x, (pCan.y - lobeOff2.y) * 0.85, pCan.z - lobeOff2.z)) - canopyR0 * 0.80;
  float c2 = length(vec3(pCan.x - lobeOff3.x, (pCan.y - lobeOff3.y) * 0.85, pCan.z - lobeOff3.z)) - canopyR0 * 0.72;
  float canopyBound = min(c0, min(c1, c2));

  float leaves;
  if (canopyBound > leafSize * 3.0) {
    leaves = canopyBound;
  } else {
    float cellSize = leafSize * 2.1;
    vec3 idCell = floor(p / cellSize + 0.5);
    vec3 pCell = p - cellSize * idCell;
    float ra = forestHash1(idCell.x * 31.7 + idCell.y * 67.3 + idCell.z * 113.1);
    float rotA = ra * 6.2832;
    float rc = cos(rotA), rs = sin(rotA);
    pCell.xz = mat2(rc, -rs, rs, rc) * pCell.xz;
    pCell.x += (ra - 0.5) * cellSize * 0.4;
    pCell.z += (fract(ra * 7.13) - 0.5) * cellSize * 0.4;
    pCell.y += (fract(ra * 3.71) - 0.5) * cellSize * 0.3;
    float leaf = sdMapleLeaf3D(pCell, leafSize, ra);
    leaves = max(leaf, canopyBound - leafSize * 0.6);
  }

  float wood = opSmoothUnion(trunk, branches, trunkRad * 0.4);
  return opSmoothUnion(wood, leaves, leafSize * 0.25);
}

// Grass blade field — pMod2 cells, 1 tapered blade per cell, wind sway.
// Infinite in xz; caller can wrap in rep DomainGroup to clip. Each blade is
// a capped cone from y=0 to y=h with random per-cell height/tilt. Step factor
// 0.6 applied because thin tapered features need conservative sphere-trace.
//   Args:
//     bladeHeight - max blade tip y (typical 0.25-0.5)
//     density     - cell size (smaller = denser; typical 0.10)
float sdGrassField(vec3 p, float bladeHeight, float density) {
  // Bounding-slab early-out — above the max blade tip, return slab distance
  float maxH = bladeHeight * 1.4;
  if (p.y > maxH + density) return (p.y - maxH) * 0.6;
  // Below ground: large
  if (p.y < -density * 2.0) return abs(p.y);

  float cell = density;
  vec2 idCell = floor(p.xz / cell + 0.5);
  vec2 pCell = p.xz - cell * idCell;
  float rand = forestHash1(idCell.x * 13.71 + idCell.y * 27.33);
  float h = bladeHeight * (0.55 + rand * 0.65);
  // Wind sway: x-offset proportional to height (tip swings most)
  float windPhase = idCell.x * 1.7 + idCell.y * 2.3 + rand * 6.28;
  float wind = sin(u_time * 2.5 + windPhase) * 0.06;
  vec3 pLocal = vec3(pCell.x - wind * p.y, p.y, pCell.y);
  // Tapered capped-cone blade: thick at base (0.013), almost tip (0.001)
  float d = sdCappedCone(pLocal, vec3(0.0, 0.0, 0.0), vec3(0.0, h, 0.0), 0.014, 0.001);
  return d * 0.6;
}

// Forest flower — 5-petal bloom + thin stem. Pair with rep for ground field.
float sdForestFlower(vec3 p, float stemH, float bloomR) {
  float stem = sdCapsule(p, vec3(0.0, 0.0, 0.0), vec3(0.0, stemH, 0.0), stemH * 0.025);
  vec3 pH = p - vec3(0.0, stemH, 0.0);
  pH.y *= 1.8;
  vec3 pPetal = polarModY(pH, 5.0);
  vec3 petalC = vec3(bloomR * 0.65, 0.0, 0.0);
  float petal = length(pPetal - petalC) - bloomR * 0.5;
  float center = length(pH) - bloomR * 0.32;
  float bloom = opSmoothUnion(petal, center, bloomR * 0.18);
  return opSmoothUnion(stem, bloom, bloomR * 0.10);
}

// Meteor streak — emissive capsule that traverses sky once per cycle. Uses
// chunkedTime() so multiple meteor subjects with staggered phase look like
// a continuous shower instead of synchronized lockstep.
//   origin     - position at start of active window
//   velocity   - units/second
//   trailLen   - head-to-tail length
//   period     - cycle length seconds (active + dark)
//   activeFrac - 0..1 fraction of cycle visible
//   phase      - seconds offset for stagger
float sdMeteorStreak(vec3 p, vec3 origin, vec3 velocity,
                     float trailLen, float period, float activeFrac, float phase) {
  vec2 ct = chunkedTime(u_time + phase, period, 0.0);
  float tCyc = ct.x;
  float tActiveMax = activeFrac * period;
  if (tCyc >= tActiveMax) return 1e6;
  float t01 = tCyc / max(tActiveMax, 0.001);
  vec3 head = origin + velocity * tCyc;
  vec3 vDir = normalize(velocity);
  vec3 tail = head - vDir * trailLen;
  float fade = smoothstep(0.0, 0.12, t01) * smoothstep(1.0, 0.85, t01);
  if (fade < 0.02) return 1e6;
  float r = mix(0.04, 0.18, fade);
  return sdCapsule(p, head, tail, r);
}

// ---- Time-aware primitives -------------------------------------------------
// 这些 primitive 内部引用 u_time（caller shader 必须 declare uniform float u_time）。
// BOB GPU / flyLambert 都已声明。autoscope-clone scene-1 sea ground 用。

// 海浪地面（sinusoidal terrain along z after rotation around Y by angle）
//   y_surface = sin(speed * u_time + p_rotated.z / freq) * amp - amp
// SDF: distance to surface in y axis（near-surface approx，足够 raymarch）
float sdWaves(vec3 p, float freq, float amp, float angle, float speed) {
  float c = cos(angle), s = sin(angle);
  // rotateY(p, angle).z = -s*p.x + c*p.z
  float pz = -s * p.x + c * p.z;
  return p.y + sin(speed * u_time + pz / freq) * amp - amp;
}

// ---- Open-ocean sea-surface (height-field as SDF) --------------------------
// Inspired by afl_ext's "Ocean" Shadertoy (MIT, 2017-2024). Independent
// implementation; keeps the wave-drag idiom (position += dir * dx * weight)
// and exp(sin(x)-1) wave shape. Used as a heightfield SDF primitive:
//   distance = (p.y - height(p.xz, t)) * STEP_FACTOR
// STEP_FACTOR < 1 prevents sphere-tracer over-shoot on shallow slopes (the
// height-field gradient overstates the true-distance gradient at glancing
// angles). 0.5 is a safe value learned from prior heightfield-as-SDF ports.

// Single wave octave + its position-derivative (exp(sin(x)-1) shape).
// dx is returned negative so it can be folded directly into the position
// drag step: position += dir * dx.y * weight * DRAG_MULT.
vec2 atlasWavedx(vec2 position, vec2 direction, float frequency, float timeshift) {
  float x = dot(direction, position) * frequency + timeshift;
  float wave = exp(sin(x) - 1.0);
  float dx = wave * cos(x);
  return vec2(wave, -dx);
}

// Iterative wave summation with derivative-driven position drag.
// iterations: 12 for raymarch (cheap), 36 for normal (accurate).
// Returns wave height in [0, 1] roughly; caller scales by depth.
float atlasGetWaves(vec2 position, int iterations, float t) {
  float wavePhaseShift = length(position) * 0.1;
  float iter = 0.0;
  float freq = 1.0;
  float timeMul = 2.0;
  float weight = 1.0;
  float sumV = 0.0;
  float sumW = 0.0;
  for (int i = 0; i < 64; i++) {
    if (i >= iterations) break;  // dynamic-bounded loop for GLSL ES 1.0
    vec2 p = vec2(sin(iter), cos(iter));
    vec2 res = atlasWavedx(position, p, freq, t * timeMul + wavePhaseShift);
    position += p * res.y * weight * 0.38;  // DRAG_MULT
    sumV += res.x * weight;
    sumW += weight;
    weight = mix(weight, 0.0, 0.2);
    freq *= 1.18;
    timeMul *= 1.07;
    iter += 1232.399963;
  }
  return sumV / sumW;
}

// Height-field SDF wrapper. depth = amplitude (positive). The sea sits at
// y ≈ -depth (low) to y ≈ 0 (high). Pass scale to control horizontal wave
// wavelength: small scale = big waves, big scale = chop.
float sdSeaSurface(vec3 p, float depth, float scale) {
  // 12 iterations matches afl_ext's ITERATIONS_RAYMARCH — cheap for tracing.
  // Normal estimation in the renderer can re-call with more iters if desired.
  float h = atlasGetWaves(p.xz * scale, 12, u_time) * depth - depth;
  return (p.y - h) * 0.5;  // step factor to tame the heightfield-as-SDF
}

// High-resolution sea-surface normal (used by sea-shading branch in fly3d).
// Cross-product variant (afl_ext) — produces accurate normal even on steep
// foam crests. 36 iterations for accuracy; called only on hit pixels.
vec3 atlasSeaNormal(vec2 pos, float e, float depth, float scale, float t) {
  vec2 ex = vec2(e, 0.0);
  float H = atlasGetWaves(pos * scale, 36, t) * depth;
  vec3 a = vec3(pos.x, H, pos.y);
  return normalize(cross(
    a - vec3(pos.x - e, atlasGetWaves((pos - ex.xy) * scale, 36, t) * depth, pos.y),
    a - vec3(pos.x, atlasGetWaves((pos + ex.yx) * scale, 36, t) * depth, pos.y + e)
  ));
}

// ---- Sky / atmosphere / sun (afl_ext-inspired, MIT) -------------------------

// Sun direction is a uniform that the renderer fills (we already have light).
// This atmosphere is "extra cheap" — not physical Rayleigh, just a hand-tuned
// gradient that pairs well with the sea-shading branch's reflection lookup.
vec3 atlasSeaAtmosphere(vec3 raydir, vec3 sundir) {
  float trick = 1.0 / (raydir.y * 1.0 + 0.1);
  float trick2 = 1.0 / (sundir.y * 11.0 + 1.0);
  float raysundt = pow(abs(dot(sundir, raydir)), 2.0);
  float sundt = pow(max(0.0, dot(sundir, raydir)), 8.0);
  vec3 baseBlue = vec3(5.5, 13.0, 22.4) / 22.4;
  vec3 suncol = mix(vec3(1.0), max(vec3(0.0), vec3(1.0) - baseBlue), trick2);
  vec3 sky1 = baseBlue * suncol;
  vec3 sky2 = max(vec3(0.0), sky1 - vec3(5.5, 13.0, 22.4) * 0.002 * (trick + -6.0 * sundir.y * sundir.y));
  sky2 *= trick * (0.24 + raysundt * 0.24);
  return sky2 * (1.0 + 1.0 * pow(1.0 - raydir.y, 3.0));
}

// Tiny bright disk centered on the sun direction. Adds to atmosphere for the
// reflection lookup so sun glints appear on the water surface.
float atlasSeaSun(vec3 dir, vec3 sundir) {
  return pow(max(0.0, dot(dir, sundir)), 720.0) * 210.0;
}

// ---- Phase functions (used by both atmosphere and cloud overlay) ---------
// Declared up here so the atmosphere helper below can call atlasMiePhaseSky
// without a forward-reference error (GLSL ES 1.0 requires declaration-before-use).

// Henyey-Greenstein phase function. costh = dot(rayDir, sunDir).
// g ∈ (-1, 1): +g forward-scatter (sun-side glow), -g back-scatter (rim halo).
float atlasHGPhase(float costh, float g) {
  float g2 = g * g;
  return 0.25 * (1.0 - g2) * pow(max(1.0 + g2 - 2.0 * g * costh, 1e-4), -1.5);
}

// ---- Physical atmosphere (Rayleigh + Mie scattering) ----------------------
// Independent reimplementation of robobo1221's atmosphere model. Pure-direction
// math (no positions / no earthRadius), so scale-invariant across world sizes.
// Used as the *sun color source* for cloud lighting — gives clouds physically-
// correct hue without us hand-tuning sunset / midday colour gradients.
//
// Coefficient choices ~ literature for ground-level air. Sun brightness is
// amplified at consumption side (cloud overlay) since these scatters give
// LDR-ish outputs without ACES.

const vec3 atlasRayleighCoeff = vec3(0.27, 0.5, 1.0) * 1e-5;
const vec3 atlasMieCoeff = vec3(0.5e-6);
const float atlasSunBrightness = 3.0;

// Particle thickness along a direction with cosine cosTheta to up. Result
// is in "metres-ish" — multiplied by coefficient (1e-5 scale) gives reasonable
// optical depth. Clamping prevents singularity at horizon (cosTheta -> 0).
float atlasParticleThickness(float cosTheta) {
  float d = max(cosTheta * 2.0 + 0.01, 0.01);
  return 100000.0 / d;
}

// Rayleigh phase: symmetric, peaks both forward and backward equally.
// Responsible for the blue sky (preferential blue scattering).
float atlasRayleighPhase(float cosTheta) {
  return 0.375 * (1.0 + cosTheta * cosTheta);
}

// Mie phase with depth-modulated anisotropy. As atmosphere depth grows
// (low sun, horizon), g shrinks toward zero → scattering becomes isotropic.
// Near zenith with thin atmosphere → strong forward scatter (sun halo).
float atlasMiePhaseSky(float cosTheta, float depth) {
  float g = exp2(-3e-6 * depth);
  return atlasHGPhase(cosTheta, g);
}

// Beer-Lambert scatter integral over a uniform medium. Accurate per-step
// energy accumulation that single-step (1 - exp2(-od)) approximates poorly
// when optical depth is large.
vec3 atlasScatterIntegral(float od, vec3 coeff) {
  vec3 a = -coeff * 1.4426950408;  // 1/ln(2)
  vec3 b = -1.0 / coeff;
  vec3 c =  1.0 / coeff;
  return exp2(a * od) * b + c;
}

// Sample the atmosphere along view direction rd with the sun at sunDir.
// Returns (sky color seen along rd, sun color reaching cloud height as out).
// sunColor is the colour of direct sunlight after atmospheric absorption —
// at noon ~ white, at sunset ~ deep orange/red. This is the keystone idiom
// that fixes "midday cloud lit by sunset palette = unnatural orange".
vec3 atlasAtmosphereScatter(vec3 rd, vec3 sunDir, out vec3 sunColor) {
  const float ln2 = 0.6931472;
  vec3 up = vec3(0.0, 1.0, 0.0);

  float lDotW = dot(sunDir, rd);
  float lDotU = dot(sunDir, up);
  float uDotW = dot(up, rd);

  float odView  = atlasParticleThickness(uDotW);
  float odLight = atlasParticleThickness(lDotU);

  vec3 totalCoeff = atlasRayleighCoeff + atlasMieCoeff;
  vec3 scatterView  = totalCoeff * odView;
  vec3 absorbView   = exp2(-scatterView);
  vec3 scatterLight = totalCoeff * odLight;
  vec3 absorbLight  = exp2(-scatterLight);

  // absorbSun = "Beer's law avg" between scattered + absorbed.
  vec3 absorbSun = abs(absorbLight - absorbView) /
                   max((scatterLight - scatterView) * ln2, vec3(1e-8));

  // Sun color reaching the cloud layer = sunlight × atmosphere absorption.
  // Cloud overlay uses this to light cloud samples.
  sunColor = absorbLight;

  vec3 mieScatter      = atlasMieCoeff      * odView * atlasMiePhaseSky(lDotW, odView);
  vec3 rayleighScatter = atlasRayleighCoeff * odView * atlasRayleighPhase(lDotW);
  vec3 scatterSun = mieScatter + rayleighScatter;

  // Tight sun disc (narrow smoothstep, atmospheric absorption applied).
  vec3 sunSpot = smoothstep(0.9999, 0.99993, lDotW) * absorbView * atlasSunBrightness;

  return (scatterSun * absorbSun + sunSpot) * atlasSunBrightness;
}

// Average sky-light contribution at cloud altitude (for ambient term in cloud
// scattering). Equivalent to robobo's calcAtmosphericScatterTop — uses fixed
// view "straight up" for cheap one-fetch ambient sky term.
vec3 atlasAtmosphereSkyLight(vec3 sunDir) {
  const float ln2 = 0.6931472;
  vec3 up = vec3(0.0, 1.0, 0.0);
  float lDotU = dot(sunDir, up);

  float odView = atlasParticleThickness(1.0);  // fixed "up"
  float odLight = atlasParticleThickness(lDotU);

  vec3 totalCoeff = atlasRayleighCoeff + atlasMieCoeff;
  vec3 scatterView  = totalCoeff * odView;
  vec3 absorbView   = exp2(-scatterView);
  vec3 scatterLight = totalCoeff * odLight;
  vec3 absorbLight  = exp2(-scatterLight);

  vec3 absorbSun = max(abs(absorbLight - absorbView), vec3(1e-3)) /
                   max((scatterLight - scatterView) * ln2, vec3(1e-3));

  vec3 mieScatter      = atlasMieCoeff      * odView * 0.25;
  vec3 rayleighScatter = atlasRayleighCoeff * odView * 0.375;
  vec3 scatterSun = mieScatter + rayleighScatter;

  return scatterSun * absorbSun * atlasSunBrightness;
}

// ---- Volumetric clouds (robobo1221-inspired, independent reimplementation) -
// Sky-background only — meant to be called from the raymarch-miss path so
// clouds appear behind / between all SDF subjects. Single-scatter PBR-ish:
// Beer's law transmittance + Henyey-Greenstein two-lobe phase + powder
// effect on cloud edges + 4-octave non-power-of-2 fBM noise + Bayer dither
// to break raymarch banding. No texture sampler — pure analytic noise.
//
// Source inspiration: https://www.shadertoy.com/view/3sffzj (robobo1221, 2020+)
// Independent implementation; keeps the idiom set, not the code.

// Bayer 2x2 → recursive composition up to 16x16 for stable dither pattern.
float atlasBayer2(vec2 a) {
  a = floor(a);
  return fract(dot(a, vec2(0.5, a.y * 0.75)));
}
float atlasBayer4(vec2 a)  { return atlasBayer2(0.5 * a) * 0.25 + atlasBayer2(a); }
float atlasBayer8(vec2 a)  { return atlasBayer4(0.5 * a) * 0.25 + atlasBayer2(a); }
float atlasBayer16(vec2 a) { return atlasBayer8(0.5 * a) * 0.25 + atlasBayer2(a); }

// Cloud-specific fBM: 4 octaves with non-power-of-2 frequencies (1, 2, 7, 16)
// + per-octave directional time advection. Non-uniform freqs avoid grid
// artifacts; alternating ±t direction prevents the whole sky from scrolling
// in lockstep, gives the wind-shear feel.
float atlasCloudFBM(vec3 p, float t) {
  vec3 mFwd = vec3(t, 0.0, t);
  vec3 mBck = -mFwd;
  float n  = valueNoise3(p + mFwd) * 0.5;
        n += valueNoise3(p * 2.0 + mFwd) * 0.25;
        n += valueNoise3(p * 7.0 + mBck) * 0.125;
        n += valueNoise3((p + mFwd) * 16.0) * 0.0625;
  return n;
}

// Cloud density at world point p. Layer between minH and maxH; falls off at
// both boundaries via the double-exponential threshold idiom:
//   bot = 1 - exp(-b·h)   (builds density from below)
//   top = exp(-t·h)       (fades density above)
// Smoothstep on the noise gives crisp cloud silhouettes (cumulus look);
// raise the lo/hi pair to make sparser / wispier clouds.
float atlasCloudDensity(vec3 p, float minH, float maxH, float density, float t) {
  if (p.y < minH || p.y > maxH) return 0.0;
  vec3 cloudCoord = p * 0.025;  // freq controls horizontal cloud size
  float n = atlasCloudFBM(cloudCoord, t * 0.02);

  float h = p.y - minH;
  float layerH = maxH - minH;
  float bot = 1.0 - exp2(-2.0 * h / layerH);
  float top = exp2(-1.5 * h / layerH);
  float threshold = bot * top;

  float c = smoothstep(0.50, 0.62, n) * threshold;
  return c * density;
}

// Two-lobe HG — combined forward + back. Single HG always looks fake; mixing
// a +0.64 (forward) and -0.4 (back) lobe at 60/40 is the visual "magic" that
// real cloud renderers use. (atlasHGPhase declared above near atmosphere.)
float atlasCloudTwoLobePhase(float costh) {
  float fwd  = atlasHGPhase(costh,  0.64);
  float back = atlasHGPhase(costh, -0.40);
  return mix(back, fwd, 0.6);
}

// Powder effect — fake "sub-surface brightening at edges" of low-density
// regions. Makes cumulus edges glow whiter than centers (matches real photos).
float atlasPowderEffect(float opticalDepth) {
  return 1.0 - exp2(-opticalDepth * 2.0);
}

// Inner self-shadow raymarch. Upgraded from 4 steps to 12 to match robobo1221
// (key magic for cumulus contrast — fewer steps means cloud-bottom shadow
// is too soft, no characteristic dark base). 12 steps × outer 16 = 192 ops
// per cloud-positive pixel — still a third the cost of full robobo1221 path
// because we skip the volumetric light pass.
float atlasCloudSunShadow(vec3 p, vec3 sunDir, float minH, float maxH, float density, float t) {
  float stepLen = (maxH - minH) / 12.0;
  vec3 inc = sunDir * stepLen;
  float od = 0.0;
  for (int i = 0; i < 12; i++) {
    p += inc;
    od += atlasCloudDensity(p, minH, maxH, density, t);
  }
  return exp2(-od * stepLen);
}

// Overlay volumetric clouds on a sky color. Designed for fly3d's raymarch-
// miss path: pass in skyCol (e.g. from sky() / atlasSeaAtmosphere) and get
// skyCol-blended-with-clouds back. Flat-layer model (no earth curvature)
// because fly3d's scale is small and curvature gain is negligible.
//
// fragCoord is needed for Bayer dither (anti-banding); t is u_time.
vec3 atlasCloudOverlay(vec3 skyCol, vec3 rd, vec3 sunDir, vec2 fragCoord, float t) {
  // Looking down → no clouds. Use very small cutoff (avoid div-by-near-zero
  // in tEnter) but DON'T early-return for "nearly horizon" rays — that left
  // a visible grey strip between sea and sky.
  if (rd.y <= 0.001) return skyCol;

  // Cloud layer in fly3d world coords. ~30-70 keeps clouds above all
  // ground-level subjects (carrier deck ~5, lighthouse top ~12).
  const float minH = 30.0;
  const float maxH = 70.0;
  const float density = 0.55;
  const int STEPS = 16;

  // Plane intersections: enter the layer at minH, exit at maxH. At very low
  // rd.y these distances become large; horizonFade below tames the visual.
  float tEnter = minH / rd.y;
  float tExit  = maxH / rd.y;
  vec3 start = rd * tEnter;
  vec3 step  = rd * (tExit - tEnter) / float(STEPS);
  float stepLen = length(step);

  // Hash dither beats Bayer here: Bayer's ordered 16x16 pattern is visible
  // as grid texture on the large smooth cloud planes (cloud occupies tens of
  // thousands of pixels with similar density → ordered offsets become a moiré
  // pattern). Hash noise is per-pixel uncorrelated, banding becomes high-
  // frequency noise indistinguishable from cloud micro-texture.
  float dither = hash21(fragCoord);
  vec3 p = start + step * dither;

  float lDotW = dot(sunDir, rd);
  float phase = atlasCloudTwoLobePhase(lDotW);

  vec3 scattering = vec3(0.0);
  float transmittance = 1.0;

  // ---- Physically-driven lighting (couples cloud to atmosphere) ----
  // Replaces the hand-tuned sunset/midday palette. Sun colour comes from the
  // direct sun attenuated by Rayleigh+Mie absorption at this sun altitude
  // (auto-warm at sunset, white at noon — no hand-coded gradient). Ambient
  // comes from top-of-atmosphere sky scattering, so cloud bottoms inherit
  // the same colour temperature as the visible sky.
  vec3 sunAbsorbColor;
  vec3 atmosphereView = atlasAtmosphereScatter(rd, sunDir, sunAbsorbColor);
  vec3 skyLight = atlasAtmosphereSkyLight(sunDir);
  vec3 sunCol = sunAbsorbColor * 9.0;   // amplify; absorbColor is dim ∈ [0,1]
  vec3 ambCol = skyLight * 12.0;        // skyLight is similarly dim

  // Forward-scatter "silver lining" — when looking near the sun direction,
  // boost cloud highlight. Broader cone (pow=8) and stronger amplitude makes
  // the sun's halo through cumulus much more dramatic.
  float silverLining = pow(max(0.0, lDotW), 8.0);

  for (int i = 0; i < 16; i++) {
    float dens = atlasCloudDensity(p, minH, maxH, density, t);
    if (dens > 0.0) {
      float od = dens * stepLen;
      float powder = atlasPowderEffect(od);
      // Self-shadow: how much sun makes it from outside the cloud to this
      // sample. Gives cumulus their characteristic dark-bottom / bright-top
      // contrast that single-scatter without shadows is missing.
      float sunVis = atlasCloudSunShadow(p, sunDir, minH, maxH, density, t);
      // sunVis^1.5 sharpens the cloud-bottom darkness — gives cumulus their
      // characteristic deep shadow under thick crowns rather than uniform mid-tone.
      float sunVisGamma = pow(sunVis, 1.5);
      vec3 sunL = sunCol * phase * powder * sunVisGamma * 1.9;
      // Silver-lining boost rides on top of (1-sunVisGamma) so it shows
      // through shadowed cloud regions — backlight forcing through dense crown.
      sunL += sunCol * silverLining * powder * (1.0 - sunVisGamma) * 3.0;
      vec3 ambL = ambCol * 0.25;
      // Beer-Lambert scatter integral (robobo1221 idiom). Accurate per-step
      // energy when od is large; falls back to (1 - exp2(-od)) at small od.
      // Coefficient 1.11 is empirical from robobo1221.
      float scatterI = 0.9009 * (1.0 - exp2(-1.6018 * od));
      scattering += (sunL + ambL) * scatterI * transmittance;
      transmittance *= exp2(-od);
    }
    p += step;
    if (transmittance < 0.01) break;
  }

  // Horizon fade — instead of a hard cull at rd.y < 0.02 (which left a grey
  // strip), smoothly ramp cloud contribution from 0 at horizon to 1 above.
  // Clouds near horizon are correctly diminished (most of the ray is below
  // the cloud layer's enter point anyway), no visible seam.
  float horizonFade = smoothstep(0.001, 0.08, rd.y);
  return skyCol * mix(1.0, transmittance, horizonFade) + scattering * horizonFade;
}

// ACES filmic tonemap (Stephen Hill / Krzysztof Narkowicz public-domain fit).
// Crucial for sea visuals: maps the HDR sky+sun output into LDR without the
// flat washed-out look of pow(0.4545) gamma. Applied globally in fly3d main().
vec3 atlasACESTonemap(vec3 color) {
  mat3 m1 = mat3(
    0.59719, 0.07600, 0.02840,
    0.35458, 0.90834, 0.13383,
    0.04823, 0.01566, 0.83777
  );
  mat3 m2 = mat3(
     1.60475, -0.10208, -0.00327,
    -0.53108,  1.10813, -0.07276,
    -0.07367, -0.00605,  1.07602
  );
  vec3 v = m1 * color;
  vec3 a = v * (v + 0.0245786) - 0.000090537;
  vec3 b = v * (0.983729 * v + 0.4329510) + 0.238081;
  return pow(clamp(m2 * (a / b), 0.0, 1.0), vec3(1.0 / 2.2));
}

// =============================================================================
// IQ canonical 3D primitives — P2 batch (2026-05-23)
// Source: https://iquilezles.org/articles/distfunctions/
// All signatures match IQ verbatim.
// =============================================================================

// Sphere cut by horizontal plane at height h.
float sdCutSphere(vec3 p, float r, float h) {
  float w = sqrt(r * r - h * h);
  vec2 q = vec2(length(p.xz), p.y);
  float s = max((h - r) * q.x * q.x + w * w * (h + r - 2.0 * q.y),
                h * q.x - w * q.y);
  if (s < 0.0) return length(q) - r;
  else if (q.x < w) return h - q.y;
  else return length(q - vec2(w, h));
}

// Hollow cut sphere: sphere cap with shell thickness t.
float sdCutHollowSphere(vec3 p, float r, float h, float t) {
  float w = sqrt(r * r - h * h);
  vec2 q = vec2(length(p.xz), p.y);
  return ((h * q.x < w * q.y) ? length(q - vec2(w, h))
                              : abs(length(q) - r)) - t;
}

// "Death Star": sphere ra with sphere rb of distance d carved out.
float sdDeathStar(vec3 p2, float ra, float rb, float d) {
  float a = (ra * ra - rb * rb + d * d) / (2.0 * d);
  float b = sqrt(max(ra * ra - a * a, 0.0));
  vec2 p = vec2(p2.x, length(p2.yz));
  if (p.x * b - p.y * a > d * max(b - p.y, 0.0))
    return length(p - vec2(a, b));
  else
    return max(length(p) - ra, -(length(p - vec2(d, 0.0)) - rb));
}

// Rounded cylinder: ra = body radius, rb = corner-roll radius, h = half-height.
float sdRoundedCylinder(vec3 p, float ra, float rb, float h) {
  vec2 d = vec2(length(p.xz) - 2.0 * ra + rb, abs(p.y) - h);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)) - rb;
}

// Round cone between two arbitrary endpoints a,b with end radii r1,r2.
// IQ's "Round Cone (arbitrary endpoints)" variant.
float sdRoundConeAB(vec3 p, vec3 a, vec3 b, float r1, float r2) {
  vec3 ba = b - a;
  float l2 = dot(ba, ba);
  float rr = r1 - r2;
  float a2 = l2 - rr * rr;
  float il2 = 1.0 / l2;

  vec3 pa = p - a;
  float y = dot(pa, ba);
  float z = y - l2;
  vec3 xv = pa * l2 - ba * y;
  float x2 = dot(xv, xv);
  float y2 = y * y * l2;
  float z2 = z * z * l2;

  float k = sign(rr) * rr * rr * x2;
  if (sign(z) * a2 * z2 > k) return sqrt(x2 + z2) * il2 - r2;
  if (sign(y) * a2 * y2 < k) return sqrt(x2 + y2) * il2 - r1;
  return (sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}

// Vesica segment: lens/eye shape between points a,b with half-width w.
float sdVesicaSegment(in vec3 p, in vec3 a, in vec3 b, in float w) {
  vec3 c = (a + b) * 0.5;
  float l = length(b - a);
  vec3 v = (b - a) / l;
  float y = dot(p - c, v);
  vec2 q = vec2(length(p - c - y * v), abs(y));

  float r = 0.5 * l;
  float d = 0.5 * (r * r - w * w) / w;
  vec3 h = (r * q.x < d * (q.y - r))
    ? vec3(0.0, r, 0.0)
    : vec3(-d, 0.0, d + w);
  return length(q - h.xy) - h.z;
}

// Infinite cylinder: c.xy is axis offset in XZ plane, c.z is radius.
float sdCylinderInf(vec3 p, vec3 c) {
  return length(p.xz - c.xy) - c.z;
}

// Infinite cone: c is sin/cos of half-aperture angle. Tip at origin.
float sdConeInf(vec3 p, vec2 c) {
  vec2 q = vec2(length(p.xz), -p.y);
  float d = length(q - c * max(dot(q, c), 0.0));
  return d * ((q.x * c.y - q.y * c.x < 0.0) ? -1.0 : 1.0);
}

// =============================================================================
// IQ canonical operators — P3 batch
// =============================================================================

// Elongation (correct version -- fixes interior-distance bug of the cheap form).
// Stretches the host primitive by h along each axis. Caller passes the *result*
// of evaluating the inner primitive at the elongated point; this helper only
// returns the elongated coordinate. Usage in our compiler:
//   walk(child, 'opElongate3(p, vec3(hx, hy, hz))')
// IQ correct form needs the inner SDF re-evaluated at max(q,0); we approximate
// by emitting the elongate coordinate. For 2D/3D the small interior core remains;
// acceptable for raymarching exterior visuals (matches IQ "bound" classification).
vec3 opElongate3(vec3 p, vec3 h) {
  return p - clamp(p, -h, h);
}

// Displacement: additive perturbation. d1 = host distance, d2 = perturbation.
// Caller is responsible for keeping perturbation small (else raymarch needs
// smaller step caps).
float opDisplace(float d1, float d2) {
  return d1 + d2;
}

// XOR: in either A or B but not both. Bound (interior over-estimates).
float opXor(float a, float b) {
  return max(min(a, b), -max(a, b));
}

// =============================================================================
// Smooth-min variants — P4 batch (companion to opSmoothUnion / opSmoothSubtract)
// Source: https://iquilezles.org/articles/smin/
// All take (a, b, k); k is the blend "size".
// =============================================================================

// Exponential smin — non-rigid (never reaches a or b exactly). Generalizes to N values.
float opSminExp(float a, float b, float k) {
  k *= 1.0;
  float r = exp2(-a / k) + exp2(-b / k);
  return -k * log2(r);
}

// Root smin — DD family, asymptotic, non-rigid.
float opSminRoot(float a, float b, float k) {
  k *= 2.0;
  float x = b - a;
  return 0.5 * (a + b - sqrt(x * x + k * k));
}

// Cubic-polynomial smin — C2 smoothness, locally supported, rigid.
float opSminCubic(float a, float b, float k) {
  k *= 6.0;
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * h * k * (1.0 / 6.0);
}

// Quartic-polynomial smin — higher-order continuity.
float opSminQuartic(float a, float b, float k) {
  k *= 16.0 / 3.0;
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * h * (4.0 - h) * k * (1.0 / 16.0);
}

// Circular smin — exact-circular fillet profile.
float opSminCircular(float a, float b, float k) {
  k *= 1.0 / (1.0 - sqrt(0.5));
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - k * 0.5 * (1.0 + h - sqrt(1.0 - h * (h - 2.0)));
}

// Circular geometrical smin — locally supported, rigid, slight over-estimate.
float opSminCircGeo(float a, float b, float k) {
  k *= 1.0 / (1.0 - sqrt(0.5));
  return max(k, min(a, b)) - length(max(k - vec2(a, b), 0.0));
}

// Lp norms for rounded-box-like variants
float length2_(vec3 p) { return length(p); }  // L2 (alias for length)
float length6(vec3 p) {
  p = p * p * p; p = p * p;
  return pow(p.x + p.y + p.z, 1.0 / 6.0);
}
float length8(vec3 p) {
  p = p * p; p = p * p; p = p * p;
  return pow(p.x + p.y + p.z, 1.0 / 8.0);
}

// column-3d (Atlas chart atom, charts/data/) — horizontal bar chart.
// Delegates to sdBar3d with axis swap: world (X, Y, Z) → bar input (-Y, X, Z).
// Result: bars stack along world Y (top to bottom), grow along world +X.
float sdColumn3d(vec3 p, float values[32], float count, float barW, float barD, float gap, float maxH);

// bar-3d (Atlas chart atom, charts/data/) — N data-driven bars along X axis,
// each height = values[i] * maxH. Bars sit on y=0 plane (bottom), X-centered.
// MAX 32 bars (GLSL float[32] array literal cap matches JS clamp in bar3dSDF).
float sdBar3d(vec3 p, float values[32], float count, float barW, float barD, float gap, float maxH) {
  float totalX = count * barW + (count - 1.0) * gap;
  float xStart = -totalX * 0.5 + barW * 0.5;
  float minDist = 1e10;
  for (int i = 0; i < 32; i++) {
    if (float(i) >= count) break;
    float v = values[i];
    if (v <= 0.0) continue;
    float h = v * maxH;
    float xc = xStart + float(i) * (barW + gap);
    float yc = h * 0.5;
    float d = sdBox(p - vec3(xc, yc, 0.0), vec3(barW * 0.5, h * 0.5, barD * 0.5));
    minDist = min(minDist, d);
  }
  return minDist;
}

// column-3d body (forward-declared above)
float sdColumn3d(vec3 p, float values[32], float count, float barW, float barD, float gap, float maxH) {
  return sdBar3d(vec3(-p.y, p.x, p.z), values, count, barW, barD, gap, maxH);
}

// cover-3d (Atlas atom, presentation/) — stage + backdrop composition.
// Stage is a horizontal floor plate (top surface at y=0). Backdrop is a
// vertical wall at the back. If backdropHeight==0 OR backdropThickness==0,
// only stage is rendered.
float sdCover3d(vec3 p, float stageW, float stageD, float stageT, float backdropH, float backdropT, float r) {
  float rStage = min(r, min(stageW, min(stageD, stageT)) * 0.5);
  // Stage: floor, top at y=0
  float dStage = sdRoundedBox(p - vec3(0.0, -stageT * 0.5, 0.0), vec3(stageW * 0.5, stageT * 0.5, stageD * 0.5), rStage);
  if (backdropH <= 0.0 || backdropT <= 0.0) return dStage;
  // Backdrop: vertical wall at z = -stageD/2 - backdropT/2
  float rBack = min(r, min(stageW, min(backdropH, backdropT)) * 0.5);
  float dBack = sdRoundedBox(p - vec3(0.0, backdropH * 0.5, -stageD * 0.5 - backdropT * 0.5), vec3(stageW * 0.5, backdropH * 0.5, backdropT * 0.5), rBack);
  return min(dStage, dBack);
}

// business-icon (Atlas icon set, icons/business/) — 10-icon dispatcher.
// id 0=arrow-up, 1=arrow-down, 2=check, 3=x-mark, 4=dollar, 5=percent,
// 6=person, 7=gear, 8=document, 9=calendar. See components/icons/business.js.
float sdBusinessIcon(vec3 p, float iconId, float size, float thickness, float depth) {
  float hs = size * 0.5;
  float r = thickness * 0.5;
  float halfD = depth * 0.5;
  int id = int(iconId + 0.5);

  if (id == 0) {  // arrow-up
    vec3 apex = vec3(0.0, hs, 0.0);
    return min(
      sdCapsule(p, apex, vec3(-hs, -hs * 0.5, 0.0), r),
      sdCapsule(p, apex, vec3(hs, -hs * 0.5, 0.0), r)
    );
  }
  if (id == 1) {  // arrow-down (chevron y-flipped)
    vec3 q = vec3(p.x, -p.y, p.z);
    vec3 apex = vec3(0.0, hs, 0.0);
    return min(
      sdCapsule(q, apex, vec3(-hs, -hs * 0.5, 0.0), r),
      sdCapsule(q, apex, vec3(hs, -hs * 0.5, 0.0), r)
    );
  }
  if (id == 2) {  // check ✓
    return min(
      sdCapsule(p, vec3(-hs * 0.7, -hs * 0.1, 0.0), vec3(-hs * 0.1, -hs * 0.5, 0.0), r),
      sdCapsule(p, vec3(-hs * 0.1, -hs * 0.5, 0.0), vec3(hs * 0.6, hs * 0.5, 0.0), r)
    );
  }
  if (id == 3) {  // x-mark ✗
    return min(
      sdCapsule(p, vec3(-hs, -hs, 0.0), vec3(hs, hs, 0.0), r),
      sdCapsule(p, vec3(-hs, hs, 0.0), vec3(hs, -hs, 0.0), r)
    );
  }
  if (id == 4) {  // dollar $ (vertical bar + 2 hats)
    float d = sdCapsule(p, vec3(0.0, hs, 0.0), vec3(0.0, -hs, 0.0), r);
    d = min(d, sdCapsule(p, vec3(-hs * 0.5, hs * 0.5, 0.0), vec3(hs * 0.5, hs * 0.5, 0.0), r));
    d = min(d, sdCapsule(p, vec3(-hs * 0.5, -hs * 0.5, 0.0), vec3(hs * 0.5, -hs * 0.5, 0.0), r));
    return d;
  }
  if (id == 5) {  // percent (2 spheres + diagonal)
    float sR = thickness * 1.2;
    float d = length(p - vec3(-hs * 0.5, hs * 0.5, 0.0)) - sR;
    d = min(d, length(p - vec3(hs * 0.5, -hs * 0.5, 0.0)) - sR);
    d = min(d, sdCapsule(p, vec3(-hs, -hs, 0.0), vec3(hs, hs, 0.0), r));
    return d;
  }
  if (id == 6) {  // person (head + body)
    float d = length(p - vec3(0.0, hs * 0.4, 0.0)) - hs * 0.35;
    d = min(d, sdRoundedBox(p - vec3(0.0, -hs * 0.4, 0.0), vec3(hs * 0.6, hs * 0.4, halfD), hs * 0.3));
    return d;
  }
  if (id == 7) {  // gear (ring + 6 teeth)
    float lenXY = length(p.xy);
    float outerR = hs * 0.85;
    float innerR = hs * 0.4;
    float discO = lenXY - outerR;
    vec2 wO = vec2(discO, abs(p.z) - halfD);
    float discOExt = min(max(wO.x, wO.y), 0.0) + length(max(wO, vec2(0.0)));
    float discI = lenXY - innerR;
    vec2 wI = vec2(discI, abs(p.z) - halfD);
    float discIExt = min(max(wI.x, wI.y), 0.0) + length(max(wI, vec2(0.0)));
    float d = max(discOExt, -discIExt);
    for (int i = 0; i < 6; i++) {
      float a = float(i) * 1.0471975511965976;  // π/3
      float tx = cos(a) * hs * 0.92;
      float ty = sin(a) * hs * 0.92;
      d = min(d, length(p - vec3(tx, ty, 0.0)) - hs * 0.15);
    }
    return d;
  }
  if (id == 8) {  // document (rounded rect)
    return sdRoundedBox(p, vec3(size * 0.4, size * 0.5, halfD), size * 0.04);
  }
  if (id == 9) {  // calendar (rect + 2 binding bumps)
    float d = sdRoundedBox(p, vec3(size * 0.45, size * 0.45, halfD), size * 0.05);
    d = min(d, sdRoundedBox(p - vec3(-size * 0.2, size * 0.55, 0.0), vec3(size * 0.05, size * 0.1, halfD * 1.5), size * 0.02));
    d = min(d, sdRoundedBox(p - vec3(size * 0.2, size * 0.55, 0.0), vec3(size * 0.05, size * 0.1, halfD * 1.5), size * 0.02));
    return d;
  }
  return 1e6;  // unknown icon id
}

// pie-3d (Atlas chart atom, charts/data/) — disc/donut SDF + Z extrusion.
// Slice values stored in JS-side AST for future material layer (color per
// slice via atan2 lookup), but SDF geometry is just the disc shape. Per-
// slice MIN approach is mathematically INVALID for union SDFs (boundary
// points return 0 instead of radial distance) — see pie-3d.js header.
float sdPie3d(vec3 p, float outerR, float innerR, float thickness) {
  float lenXY = length(p.xy);
  float radial = lenXY - outerR;
  if (innerR > 0.0) {
    radial = max(radial, -(lenXY - innerR));
  }
  // IQ 2D→3D extrusion along Z
  vec2 w = vec2(radial, abs(p.z) - thickness * 0.5);
  return min(max(w.x, w.y), 0.0) + length(max(w, vec2(0.0)));
}

// line-3d (Atlas chart atom, charts/data/) — polyline + sphere markers.
// N points at (xStart + i*spacing, values[i]*maxH, 0), connected by N-1
// capsule segments. Optional closed loop. closedFlag passed as float (0/1).
float sdLine3d(vec3 p, float values[32], float count, float pointSpacing, float pointRadius, float lineThickness, float maxH, float closedFlag) {
  float totalX = (count - 1.0) * pointSpacing;
  float xStart = -totalX * 0.5;
  float minDist = 1e10;

  // Point markers (skip if pointRadius == 0)
  if (pointRadius > 0.0) {
    for (int i = 0; i < 32; i++) {
      if (float(i) >= count) break;
      vec3 pi = vec3(xStart + float(i) * pointSpacing, values[i] * maxH, 0.0);
      float d = length(p - pi) - pointRadius;
      minDist = min(minDist, d);
    }
  }

  // Line segments (skip if lineThickness == 0 or only 1 point)
  if (lineThickness > 0.0 && count > 1.0) {
    for (int i = 0; i < 31; i++) {
      if (float(i) >= count - 1.0) break;
      vec3 a = vec3(xStart + float(i) * pointSpacing, values[i] * maxH, 0.0);
      vec3 b = vec3(xStart + float(i + 1) * pointSpacing, values[i + 1] * maxH, 0.0);
      float d = sdCapsule(p, a, b, lineThickness);
      minDist = min(minDist, d);
    }
    // Closed loop: last → first.
    // GLSL ES 1.00 disallows non-const array indexing (e.g. values[lastIdx]
    // where lastIdx is a runtime int). Use a for-loop iterator pattern —
    // i IS the array index, allowed by the spec, and we early-break when we
    // hit the actual last valid index.
    if (closedFlag > 0.5 && count > 2.0) {
      for (int i = 0; i < 32; i++) {
        if (i == int(count) - 1) {
          vec3 a = vec3(xStart + float(i) * pointSpacing, values[i] * maxH, 0.0);
          vec3 b = vec3(xStart, values[0] * maxH, 0.0);
          minDist = min(minDist, sdCapsule(p, a, b, lineThickness));
          break;
        }
      }
    }
  }

  return minDist;
}

// pyramid-3d (Atlas chart atom, charts/hierarchy/) — stacked N-level pyramid
// with linear width taper from baseW (bottom) to topW (top), centered at origin.
// Loop bounded to 20 levels (matches JS clamp in pyramid3dSDF).
float sdPyramid3d(vec3 p, float levels, float baseW, float topW, float layerH, float gap, float depth) {
  float totalH = levels * layerH + (levels - 1.0) * gap;
  float minDist = 1e10;
  for (int i = 0; i < 20; i++) {
    if (float(i) >= levels) break;
    float t = levels > 1.0 ? float(i) / (levels - 1.0) : 0.0;
    float w = baseW + t * (topW - baseW);
    float yc = float(i) * (layerH + gap) - totalH * 0.5 + layerH * 0.5;
    float d = sdBox(p - vec3(0.0, yc, 0.0), vec3(w * 0.5, layerH * 0.5, depth * 0.5));
    minDist = min(minDist, d);
  }
  return minDist;
}
`;

// =============================================================================
// SDF2 GLSL library — used by revolve / extrude ops to emit 2D distance
// functions. Function names prefixed sd2* to avoid collision with 3D family.
// Source primitives mirror src/sdf/d2.js (the JS-side library).
// =============================================================================

export const SDF2_GLSL = /* glsl */ `
float sd2Circle(vec2 p, float r) { return length(p) - r; }

float sd2Box(vec2 p, vec2 b) {
  vec2 q = abs(p) - b;
  return length(max(q, vec2(0.0))) + min(max(q.x, q.y), 0.0);
}

// Uniform-corner rounded rect.
float sd2RoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, vec2(0.0))) + min(max(q.x, q.y), 0.0) - r;
}

// 2D capsule (line segment with rounded ends, half-width r).
float sd2Segment(vec2 p, vec2 a, vec2 b, float r) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

float sd2Ring(vec2 p, float r, float thickness) {
  return abs(length(p) - r) - thickness * 0.5;
}

// IQ canonical 2D partial-arc — https://iquilezles.org/articles/distfunctions2d/
//   sc = (sin(halfAperture), cos(halfAperture))
//   ra = ring radius (to tube centerline)
//   rb = tube half-thickness
// Mirrors the JS arc() in d2.js — used by text2dSDF glyphs (digits 0/2/3/5/6/9)
// when those glyphs are extruded to 3D via text-3d-extruded.
float sd2Arc(vec2 p, vec2 sc, float ra, float rb) {
  p.x = abs(p.x);
  return ((sc.y * p.x > sc.x * p.y) ? length(p - sc * ra) : abs(length(p) - ra)) - rb;
}

// IQ exact ellipse — https://iquilezles.org/articles/ellipsedist/
// Expects ab.x <= ab.y after the swap (caller need not pre-swap; we handle it).
float sd2Ellipse(vec2 p, vec2 ab) {
  p = abs(p);
  if (p.x > p.y) { p = p.yx; ab = ab.yx; }
  float l = ab.y * ab.y - ab.x * ab.x;
  float m = ab.x * p.x / l;
  float n = ab.y * p.y / l;
  float m2 = m * m, n2 = n * n;
  float c = (m2 + n2 - 1.0) / 3.0;
  float c3 = c * c * c;
  float q = c3 + m2 * n2 * 2.0;
  float d = c3 + m2 * n2;
  float g = m + m * n2;
  float co;
  if (d < 0.0) {
    float h = acos(q / c3) / 3.0;
    float s = cos(h);
    float t = sin(h) * sqrt(3.0);
    float rx = sqrt(-c * (s + t + 2.0) + m2);
    float ry = sqrt(-c * (s - t + 2.0) + m2);
    co = (ry + sign(l) * rx + abs(g) / (rx * ry) - m) / 2.0;
  } else {
    float h = 2.0 * m * n * sqrt(d);
    float s = sign(q + h) * pow(abs(q + h), 1.0 / 3.0);
    float u = sign(q - h) * pow(abs(q - h), 1.0 / 3.0);
    float rx = -s - u - c * 4.0 + 2.0 * m2;
    float ry = (s - u) * sqrt(3.0);
    float rm = sqrt(rx * rx + ry * ry);
    co = (ry / sqrt(rm - rx) + 2.0 * g / rm - m) / 2.0;
  }
  vec2 r = vec2(ab.x * co, ab.y * sqrt(1.0 - co * co));
  return length(r - p) * sign(p.y - r.y);
}

// Extrude helper: given the 2D-evaluated distance d2 at point (p.xy), and the
// z-coordinate + half-height h, produce the 3D extruded distance.
// IQ canonical form. Used by 'extrude' op in the compiler.
float opExtrusion(float d2, float pz, float h) {
  vec2 w = vec2(d2, abs(pz) - h);
  return min(max(w.x, w.y), 0.0) + length(max(w, vec2(0.0)));
}
`;

// =============================================================================
// Primitive registry (for T4 compiler and tooling)
// -----------------------------------------------------------------------------
// 列出 SDF3_GLSL 里所有可用的 primitive 名字。T4 compiler 用它来：
//   1. 校验 JS AST 里的 primitive 在 GLSL 端是否存在
//   2. 决定参数转换规则（e.g. d3.box(size=full) → sdBox(b=half)）
// =============================================================================

export const SDF3_GLSL_PRIMITIVES = [
  // IQ primitives
  'sdPlane',
  'sdSphere',
  'sdBox',
  'sdBoxFrame',
  'sdEllipsoid',
  'sdTorus',
  'sdCappedTorus',
  'sdHexPrism',
  'sdOctogonPrism',
  'sdCapsule',
  'sdRoundCone',
  'sdTriPrism',
  'sdCylinder',
  'sdCone',
  'sdCappedCone',
  'sdSolidAngle',
  'sdLink',
  'sdOctahedron',
  'sdPyramid',
  'sdRhombus',
  'sdHorseshoe',
  'sdU',
  // d3.js extensions
  'sdRoundedBox',
  'sdTetrahedron',
  'sdDodecahedron',
  'sdIcosahedron',
  // time-aware
  'sdWaves',
  'sdSeaSurface',
  // procedural composites
  'sdCanalBuilding',
  'sdCanalWindows',
  'sdCanalBridge',
  'sdCanalLampBulb',
  'sdTerrainHeightmap',
  // Forest sprint
  'sdMapleLeaf2D',
  'sdMapleLeaf3D',
  'sdWavyCapsule',
  'sdStylizedTree',
  'sdForestFlower',
  'sdMeteorStreak',
  'sdGrassField',
  // 2026-05-23 IQ P2 batch
  'sdCutSphere',
  'sdCutHollowSphere',
  'sdDeathStar',
  'sdRoundedCylinder',
  'sdRoundConeAB',
  'sdVesicaSegment',
  'sdCylinderInf',
  'sdConeInf',
];

export const SDF3_GLSL_OPS = [
  'opUnion',
  'opIntersect',
  'opDifference',
  'opSmoothUnion',
  'opSmoothIntersect',
  'opSmoothDifference',
  'opShell',
  'opDilate',
  'opErode',
  // 2026-05-23 IQ P3 batch
  'opElongate3',
  'opDisplace',
  'opXor',
  // 2026-05-23 IQ P4 smin variants
  'opSminExp',
  'opSminRoot',
  'opSminCubic',
  'opSminQuartic',
  'opSminCircular',
  'opSminCircGeo',
  // Lp norms
  'length6',
  'length8',
];

export const SDF2_GLSL_PRIMITIVES = [
  'sd2Circle',
  'sd2Box',
  'sd2RoundBox',
  'sd2Segment',
  'sd2Ring',
  'sd2Arc',
  'sd2Ellipse',
  // polygon emitted per-instance as sd2Polygon_HASH(vec2)
];

export const SDF2_GLSL_OPS = [
  // pseudo-3D ops backed by SDF2 distance:
  'opExtrusion', // 2D → 3D extrusion
];

export const SDF3_GLSL_TRANSFORMS = [
  'opTranslate',
  'opScale',
  'opTwist',
  'opBend',
  'rotX',
  'rotY',
  'rotZ',
  'rotX_inv',
  'rotY_inv',
  'rotZ_inv',
  'rep3',
  'repL3',
];
