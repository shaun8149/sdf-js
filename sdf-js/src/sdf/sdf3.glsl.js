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
  'sdPlane', 'sdSphere', 'sdBox', 'sdBoxFrame', 'sdEllipsoid',
  'sdTorus', 'sdCappedTorus', 'sdHexPrism', 'sdOctogonPrism',
  'sdCapsule', 'sdRoundCone', 'sdTriPrism', 'sdCylinder',
  'sdCone', 'sdCappedCone', 'sdSolidAngle', 'sdLink', 'sdOctahedron',
  'sdPyramid', 'sdRhombus', 'sdHorseshoe', 'sdU',
  // d3.js extensions
  'sdRoundedBox', 'sdTetrahedron', 'sdDodecahedron', 'sdIcosahedron',
  // time-aware
  'sdWaves',
  'sdSeaSurface',
  // procedural composites
  'sdCanalBuilding',
  'sdCanalWindows',
  'sdCanalBridge',
  'sdCanalLampBulb',
];

export const SDF3_GLSL_OPS = [
  'opUnion', 'opIntersect', 'opDifference',
  'opSmoothUnion', 'opSmoothIntersect', 'opSmoothDifference',
  'opShell', 'opDilate', 'opErode',
];

export const SDF3_GLSL_TRANSFORMS = [
  'opTranslate', 'opScale', 'opTwist', 'opBend',
  'rotX', 'rotY', 'rotZ', 'rotX_inv', 'rotY_inv', 'rotZ_inv',
  'rep3', 'repL3',
];
