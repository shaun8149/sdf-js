// =============================================================================
// 2D SDF library —— GLSL 版本
// -----------------------------------------------------------------------------
// 与 d2.js 一一对应。GLSL 没有 closure 也没有运算符重载，所以"链式"在 shader 里
// 退化成"嵌套调用 + 显式传 p"：
//   JS:   circle(0.5).translate([1, 2])         即 (p) => sdCircle(p - [1,2], 0.5)
//   GLSL: sdCircle(p - vec2(1.0, 2.0), 0.5)
//
// 与 IQ 文章对齐的 GLSL 惯例：
//   - rectangle / rounded_rectangle 接的是"半边长" b（不是全尺寸 size）
//     → 在 d2.js 里你写 rectangle([0.3, 1.6])，GLSL 里写 sdRectangle(p, vec2(0.15, 0.8))
//   - 半径 r 是 vec4(tl, tr, bl, br)（与 d2.js 一致）
//
// 用法：把这个字符串直接 prepend 到你的 fragment shader 源码里。
// =============================================================================

export const SDF2_GLSL = /* glsl */ `
// ---- Primitives ----------------------------------------------------------

float sdCircle(vec2 p, float r) {
  return length(p) - r;
}

// IQ 标准 box：q = abs(p) - b；外部欧氏距离 + 内部 Chebyshev 近似
float sdRectangle(vec2 p, vec2 b) {
  vec2 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
}

// 圆角矩形：r = (r0, r1, r2, r3)，按象限索引（与 d2.js 一致）
//   r0: x>0, y>0     r1: x>0, y<0     r2: x<0, y>0     r3: x<0, y<0
float sdRoundedRectangle(vec2 p, vec2 b, vec4 r) {
  r.xy = (p.x > 0.0) ? r.xy : r.zw;
  float rr = (p.y > 0.0) ? r.x : r.y;
  vec2 q = abs(p) - b + rr;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - rr;
}

// 半平面：normal 朝外，point 是平面上一点
float sdLine(vec2 p, vec2 normal, vec2 point) {
  return dot(point - p, normalize(normal));
}

// 等边三角形（单位大小，朝上）
float sdEquilateralTriangle(vec2 p) {
  const float k = 1.7320508;                                  // sqrt(3)
  p.x = abs(p.x) - 1.0;
  p.y = p.y + 1.0 / k;
  if (p.x + k * p.y > 0.0) {
    p = vec2(p.x - k * p.y, -k * p.x - p.y) / 2.0;
  }
  p.x -= clamp(p.x, -2.0, 0.0);
  return -length(p) * sign(p.y);
}

// 正六边形，r 是外接圆半径（与 d2.js 一致）
float sdHexagon(vec2 p, float r) {
  r *= 0.8660254;                                             // sqrt(3) / 2
  const vec3 k = vec3(-0.8660254, 0.5, 0.5773503);            // (-sqrt(3)/2, 1/2, tan(π/6))
  p = abs(p);
  p -= 2.0 * min(dot(k.xy, p), 0.0) * k.xy;
  p -= vec2(clamp(p.x, -k.z * r, k.z * r), r);
  return length(p) * sign(p.y);
}

// 任意三角形（3 个顶点）。polygon 在 GLSL 里因为变长数组限制不好写，
// 但固定 3 个点可以展开成手写
float sdTriangle(vec2 p, vec2 a, vec2 b, vec2 c) {
  vec2 e0 = b - a, e1 = c - b, e2 = a - c;
  vec2 v0 = p - a, v1 = p - b, v2 = p - c;
  vec2 pq0 = v0 - e0 * clamp(dot(v0, e0) / dot(e0, e0), 0.0, 1.0);
  vec2 pq1 = v1 - e1 * clamp(dot(v1, e1) / dot(e1, e1), 0.0, 1.0);
  vec2 pq2 = v2 - e2 * clamp(dot(v2, e2) / dot(e2, e2), 0.0, 1.0);
  float s = sign(e0.x * e2.y - e0.y * e2.x);
  vec2 d = min(min(
    vec2(dot(pq0, pq0), s * (v0.x * e0.y - v0.y * e0.x)),
    vec2(dot(pq1, pq1), s * (v1.x * e1.y - v1.y * e1.x))),
    vec2(dot(pq2, pq2), s * (v2.x * e2.y - v2.y * e2.x)));
  return -sqrt(d.x) * sign(d.y);
}

// 梯形：a/b 是上下圆盘圆心，ra/rb 对应半径
float sdTrapezoid(vec2 p, vec2 a, vec2 b, float ra, float rb) {
  p.y = -p.y;
  float rba = rb - ra;
  float baba = dot(b - a, b - a);
  float papa = dot(p - a, p - a);
  float paba = dot(p - a, b - a) / baba;
  float x = sqrt(max(0.0, papa - paba * paba * baba));
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

// ---- Boolean / decoration ops --------------------------------------------

float opUnion(float a, float b)        { return min(a, b); }
float opIntersect(float a, float b)    { return max(a, b); }
float opDifference(float a, float b)   { return max(a, -b); }

// IQ 多项式 smooth 版本
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

float opShell(float d, float thickness)  { return abs(d) - thickness * 0.5; }
float opDilate(float d, float r)         { return d - r; }
float opErode(float d, float r)          { return d + r; }

// ---- Transform helpers (作用在 p 上, 返回新的 p) -------------------------

// 平移：传 p - offset 给 primitive
vec2 opTranslate(vec2 p, vec2 offset) {
  return p - offset;
}

// 2D 旋转
vec2 opRotate(vec2 p, float angle) {
  float c = cos(angle), s = sin(angle);
  return mat2(c, -s, s, c) * p;
}

// 缩放：注意 SDF 调用结果还要乘 min(s) 才精确（仅缩放矩阵 GLSL 不带这个）
// 用法： float d = sdCircle(opScale(p, vec2(2.0, 1.0)), 0.5) * min(2.0, 1.0);
vec2 opScale(vec2 p, vec2 s) {
  return p / s;
}
`;
