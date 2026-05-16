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
  'sdCone', 'sdCappedCone', 'sdSolidAngle', 'sdOctahedron',
  'sdPyramid', 'sdRhombus', 'sdHorseshoe', 'sdU',
  // d3.js extensions
  'sdRoundedBox', 'sdTetrahedron', 'sdDodecahedron', 'sdIcosahedron',
  // time-aware
  'sdWaves',
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
