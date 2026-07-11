// =============================================================================
// analytic.js — the ANALYTIC WHITE-MODEL renderer: ray/primitive intersection,
// zero marching.
// -----------------------------------------------------------------------------
// WHY: sphere tracing pays per STEP × per LEAF, and sparse scenes (constella-
// tions) collapse the step size on every grazing ray — the network station ran
// 8-17fps with the full PBR path and still ~14fps in stone mode. But every
// primitive the presentation product uses (box, sphere, capsule, ellipsoid,
// cylinder) has a CLOSED-FORM ray intersection. One root-solve per primitive
// per pixel, O(N) with tiny constants, no iteration — the IQ sphere-AO demo's
// architecture (user-locked direction: perf first, beauty later).
//
// WHAT: compileAnalyticFrag(subjects) → { ok, fragSource } | { ok:false,
// reason }. Pure string generation (node-testable). Shading is the stone
// recipe: warm key + hemispheric sky + occlusion + distance fade, albedo kept
// (black-rock motif / gold emphasis read as before). Occlusion is the IQ
// analytic sphere-occlusion sum over per-subject proxy spheres — that ALSO
// gives the soft contact shadow on the floor for free (the whole point of the
// reference shadertoy).
//
// Scope guards (unsupported → caller falls back to the stone raymarcher):
//   • types outside box/rounded_box/sphere/capsule/ellipsoid/cylinder
//     (unions flatten; funnel-3d etc. reject)
//   • rotations other than yaw
//   • animation channels other than transform.translate.y/z whose exprs are
//     not GLSL-safe (smoothstep/sin/numbers only)
// =============================================================================

const SUPPORTED = new Set([
  'box',
  'rounded_box',
  'sphere',
  'capsule',
  'ellipsoid',
  'cylinder',
  'funnel-3d',
]);
const EXPR_SAFE = /^[\d\s+\-*/().,]|smoothstep|sin|t$/; // per-token check below

const flt = (x) => {
  const s = Number(x).toFixed(4);
  return s === '-0.0000' ? '0.0000' : s;
};

// hsv2rgb in JS — albedo bakes to constants (no LUT machinery needed)
function hsv2rgb(h, s, v) {
  const k = (n) => (n + h * 6) % 6;
  const f = (n) => v - v * s * Math.max(0, Math.min(k(n), 4 - k(n), 1));
  return [f(5), f(3), f(1)];
}

// Animation expr → GLSL: bare `t` tokens become u_time. The exprs are machine-
// generated (renderers + assembleDeck shifter), so a strict token whitelist is
// both safe and honest — anything unexpected rejects to the raymarch fallback.
function exprToGLSL(expr) {
  const tokens = String(expr).match(/[A-Za-z_]\w*|\d+\.?\d*|[+\-*/(),]|\s+/g) || [];
  if (tokens.join('') !== String(expr)) return null;
  const out = [];
  for (const tok of tokens) {
    if (/^\s+$/.test(tok) || /^[+\-*/(),]$/.test(tok)) out.push(tok);
    else if (/^\d/.test(tok)) out.push(/\./.test(tok) ? tok : `${tok}.0`);
    else if (tok === 't') out.push('u_time');
    else if (tok === 'smoothstep' || tok === 'sin') out.push(tok);
    else return null;
  }
  return out.join('');
}

// Flatten unions one level (parent transform/material/animation + child args).
function flatten(subjects) {
  const out = [];
  for (const s of subjects || []) {
    if (s.type === 'union' && Array.isArray(s.children)) {
      for (const c of s.children) {
        const ct = (c.transform && c.transform.translate) || [0, 0, 0];
        const cr = c.transform && c.transform.rotate;
        if (cr && (cr[0] || cr[1] || cr[2])) return { unsupported: `union child rotate (${s.id})` };
        const pt = (s.transform && s.transform.translate) || [0, 0, 0];
        out.push({
          ...c,
          transform: {
            translate: [pt[0] + ct[0], pt[1] + ct[1], pt[2] + ct[2]],
            ...(s.transform && s.transform.rotate ? { rotate: s.transform.rotate } : {}),
          },
          material: c.material || s.material,
          animation: s.animation, // parent build-in moves the assembly
          _childOffY: ct[1], // parent-channel anim replaces parent Y; child offset rides on top
          _childOffZ: ct[2],
        });
      }
    } else out.push(s);
  }
  return { subjects: out };
}

const GLSL_LIB = `
// ---- IQ analytic intersectors (https://iquilezles.org/articles/intersectors) ----
float iPlaneY(vec3 ro, vec3 rd) { return rd.y < -1e-6 ? -ro.y / rd.y : -1.0; }

float iSphere(vec3 ro, vec3 rd, float r) {
  float b = dot(ro, rd);
  float c = dot(ro, ro) - r * r;
  float h = b * b - c;
  if (h < 0.0) return -1.0;
  return -b - sqrt(h);
}

float iBox(vec3 ro, vec3 rd, vec3 h, out vec3 n) {
  vec3 m = 1.0 / rd;
  vec3 nv = m * ro;
  vec3 k = abs(m) * h;
  vec3 t1 = -nv - k;
  vec3 t2 = -nv + k;
  float tN = max(max(t1.x, t1.y), t1.z);
  float tF = min(min(t2.x, t2.y), t2.z);
  if (tN > tF || tF < 0.0) return -1.0;
  n = -sign(rd) * step(t1.yzx, t1.xyz) * step(t1.zxy, t1.xyz);
  return tN;
}

float iEllipsoid(vec3 ro, vec3 rd, vec3 r) {
  vec3 ocn = ro / r;
  vec3 rdn = rd / r;
  float a = dot(rdn, rdn);
  float b = dot(ocn, rdn);
  float c = dot(ocn, ocn);
  float h = b * b - a * (c - 1.0);
  if (h < 0.0) return -1.0;
  return (-b - sqrt(h)) / a;
}
vec3 nEllipsoid(vec3 p, vec3 r) { return normalize(p / (r * r)); }

float iCapsule(vec3 ro, vec3 rd, vec3 pa, vec3 pb, float r) {
  vec3 ba = pb - pa;
  vec3 oa = ro - pa;
  float baba = dot(ba, ba);
  float bard = dot(ba, rd);
  float baoa = dot(ba, oa);
  float rdoa = dot(rd, oa);
  float oaoa = dot(oa, oa);
  float a = baba - bard * bard;
  float b = baba * rdoa - baoa * bard;
  float c = baba * oaoa - baoa * baoa - r * r * baba;
  float h = b * b - a * c;
  if (h >= 0.0) {
    float t = (-b - sqrt(h)) / a;
    float y = baoa + t * bard;
    if (y > 0.0 && y < baba) return t;
    vec3 oc = (y <= 0.0) ? oa : ro - pb;
    b = dot(rd, oc);
    c = dot(oc, oc) - r * r;
    h = b * b - c;
    if (h > 0.0) return -b - sqrt(h);
  }
  return -1.0;
}
vec3 nCapsule(vec3 p, vec3 pa, vec3 pb, float r) {
  vec3 ba = pb - pa;
  float h = clamp(dot(p - pa, ba) / dot(ba, ba), 0.0, 1.0);
  return (p - pa - h * ba) / r;
}

// capped Y cylinder centred at origin: radius ra, half-height he
float iCylinderY(vec3 ro, vec3 rd, float ra, float he, out vec3 n) {
  float k2 = 1.0 - rd.y * rd.y;
  float k1 = dot(ro, rd) - ro.y * rd.y;
  float k0 = dot(ro, ro) - ro.y * ro.y - ra * ra;
  float h = k1 * k1 - k2 * k0;
  if (h < 0.0) return -1.0;
  h = sqrt(h);
  float t = (-k1 - h) / k2;
  float y = ro.y + t * rd.y;
  if (t > 0.0 && abs(y) < he) {
    n = normalize(vec3(ro.x + t * rd.x, 0.0, ro.z + t * rd.z) / ra);
    return t;
  }
  t = ((rd.y < 0.0 ? he : -he) - ro.y) / rd.y; // cap disc
  if (t > 0.0 && length(vec2(ro.x + t * rd.x, ro.z + t * rd.z)) < ra) {
    n = vec3(0.0, -sign(rd.y), 0.0);
    return t;
  }
  return -1.0;
}

// IQ capped cone (truncated cone with caps): returns vec4(t, normal)
float dot2(vec3 v) { return dot(v, v); }
vec4 iCappedCone(vec3 ro, vec3 rd, vec3 pa, vec3 pb, float ra, float rb) {
  vec3 ba = pb - pa;
  vec3 oa = ro - pa;
  vec3 ob = ro - pb;
  float m0 = dot(ba, ba);
  float m1 = dot(oa, ba);
  float m2 = dot(rd, ba);
  float m3 = dot(rd, oa);
  float m5 = dot(oa, oa);
  float m9 = dot(ob, ba);
  if (m1 < 0.0) {
    if (dot2(oa * m2 - rd * m1) < (ra * ra * m2 * m2))
      return vec4(-m1 / m2, -ba * inversesqrt(m0));
  } else if (m9 > 0.0) {
    float t = -m9 / m2;
    if (dot2(ob + rd * t) < (rb * rb)) return vec4(t, ba * inversesqrt(m0));
  }
  float rr = ra - rb;
  float hy = m0 + rr * rr;
  float k2 = m0 * m0 - m2 * m2 * hy;
  float k1 = m0 * m0 * m3 - m1 * m2 * hy + m0 * ra * (rr * m2 * 1.0);
  float k0 = m0 * m0 * m5 - m1 * m1 * hy + m0 * ra * (rr * m1 * 2.0 - m0 * ra);
  float h = k1 * k1 - k2 * k0;
  if (h < 0.0) return vec4(-1.0);
  float t = (-k1 - sqrt(h)) / k2;
  float y = m1 + t * m2;
  if (y < 0.0 || y > m0) return vec4(-1.0);
  return vec4(t, normalize(m0 * (m0 * (oa + t * rd) + rr * ba * ra) - ba * hy * y));
}

// IQ analytic sphere occlusion (approximated form — cheap, NaN-safe)
float sphOcc(vec3 pos, vec3 nor, vec4 sph) {
  vec3 di = sph.xyz - pos;
  float l = max(length(di), sph.w * 0.25);
  float nl = dot(nor, di / l);
  float h = l / sph.w;
  float h2 = h * h;
  float res = max(0.0, nl) / h2;
  float k2 = 1.0 - h2 * nl * nl;
  if (k2 > 0.001 && h > 1.0) {
    res = (nl * h + 1.0) / h2;
    res = 0.33 * res * res;
  }
  return clamp(res, 0.0, 1.0);
}
`;

/**
 * Compile a flattened SceneData.subjects list into an analytic white-model
 * fragment shader. Returns { ok:true, fragSource, count } or { ok:false, reason }.
 */
export function compileAnalyticFrag(subjects, opts = {}) {
  const flat = flatten(subjects);
  if (flat.unsupported) return { ok: false, reason: flat.unsupported };
  const subs = flat.subjects;
  if (!subs.length) return { ok: false, reason: 'empty scene' };

  let body = '';
  let occBody = '';
  let idx = 0;

  for (const s of subs) {
    if (!SUPPORTED.has(s.type)) return { ok: false, reason: `type ${s.type} (${s.id})` };
    const rot = s.transform && s.transform.rotate;
    if (rot && (rot[0] || rot[2])) return { ok: false, reason: `non-yaw rotate (${s.id})` };
    const yaw = rot ? Number(rot[1]) || 0 : 0;
    const T = (s.transform && s.transform.translate) || [0, 0, 0];
    const a = s.args || {};
    const m = s.material || {};
    const [cr, cg, cb] = hsv2rgb(m.hue ?? 0.6, m.sat ?? 0.1, m.value ?? 0.8);
    const glow = m.glow ?? 0;

    // animated translate channels → GLSL exprs (else baked constants)
    let ty = flt(T[1]);
    let tz = flt(T[2]);
    for (const an of s.animation || []) {
      const g = exprToGLSL(an.expr);
      if (!g) return { ok: false, reason: `animation expr (${s.id})` };
      if (an.channel === 'transform.translate.y')
        ty = s._childOffY != null ? `(${g}) + ${flt(s._childOffY)}` : `(${g})`;
      else if (an.channel === 'transform.translate.z')
        tz = s._childOffZ != null ? `(${g}) + ${flt(s._childOffZ)}` : `(${g})`;
      else return { ok: false, reason: `channel ${an.channel} (${s.id})` };
    }

    const k = idx++;
    let localRo = `ro - vec3(${flt(T[0])}, ty${k}, tz${k})`;
    let localRd = 'rd';
    let nBack = `n${k}`;
    if (yaw !== 0) {
      // world→local: rotate by -yaw around Y (baked sin/cos); normal rotates back
      const c = flt(Math.cos(yaw));
      const sn = flt(Math.sin(yaw));
      localRo = `rotY(${localRo}, ${c}, ${flt(-Math.sin(yaw))})`;
      localRd = `rotY(rd, ${c}, ${flt(-Math.sin(yaw))})`;
      nBack = `rotY(n${k}, ${c}, ${sn})`;
    }

    // proxy sphere for the occlusion sum (also drives the floor contact shadow)
    let proxyR;
    let hitStmt;
    body += `  {\n    float ty${k} = ${ty};\n    float tz${k} = ${tz};\n`;
    body += `    vec3 q = ${localRo};\n    vec3 dq = ${localRd};\n    vec3 n${k} = vec3(0.0);\n`;
    if (s.type === 'sphere') {
      proxyR = a.radius ?? 0.5;
      hitStmt = `float tk = iSphere(q, dq, ${flt(a.radius ?? 0.5)});`;
      body += `    ${hitStmt}\n    if (tk > 0.0 && tk < tHit) { tHit = tk; nHit = normalize(q + dq * tk); alb = vec3(${flt(cr)}, ${flt(cg)}, ${flt(cb)}); glowK = ${flt(glow)}; hitId = ${flt(k)}; }\n`;
    } else if (s.type === 'box' || s.type === 'rounded_box') {
      const d = a.dims || [1, 1, 1];
      proxyR = Math.hypot(d[0], d[1], d[2]) * 0.33;
      body += `    float tk = iBox(q, dq, vec3(${flt(d[0] / 2)}, ${flt(d[1] / 2)}, ${flt(d[2] / 2)}), n${k});\n`;
      body += `    if (tk > 0.0 && tk < tHit) { tHit = tk; nHit = ${nBack}; alb = vec3(${flt(cr)}, ${flt(cg)}, ${flt(cb)}); glowK = ${flt(glow)}; hitId = ${flt(k)}; }\n`;
    } else if (s.type === 'ellipsoid') {
      const d = a.dims || [1, 1, 1];
      proxyR = (d[0] + d[1] + d[2]) / 3 * 0.8;
      body += `    float tk = iEllipsoid(q, dq, vec3(${flt(d[0])}, ${flt(d[1])}, ${flt(d[2])}));\n`;
      body += `    if (tk > 0.0 && tk < tHit) { tHit = tk; nHit = nEllipsoid(q + dq * tk, vec3(${flt(d[0])}, ${flt(d[1])}, ${flt(d[2])})); alb = vec3(${flt(cr)}, ${flt(cg)}, ${flt(cb)}); glowK = ${flt(glow)}; hitId = ${flt(k)}; }\n`;
    } else if (s.type === 'capsule') {
      const pa = a.a || [0, 0, 0];
      const pb = a.b || [0, 1, 0];
      const r = a.radius ?? 0.1;
      proxyR = r + Math.hypot(pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]) * 0.25;
      const paS = `vec3(${flt(pa[0])}, ${flt(pa[1])}, ${flt(pa[2])})`;
      const pbS = `vec3(${flt(pb[0])}, ${flt(pb[1])}, ${flt(pb[2])})`;
      body += `    float tk = iCapsule(q, dq, ${paS}, ${pbS}, ${flt(r)});\n`;
      body += `    if (tk > 0.0 && tk < tHit) { tHit = tk; nHit = nCapsule(q + dq * tk, ${paS}, ${pbS}, ${flt(r)}); alb = vec3(${flt(cr)}, ${flt(cg)}, ${flt(cb)}); glowK = ${flt(glow)}; hitId = ${flt(k)}; }\n`;
    } else if (s.type === 'cylinder') {
      const r = a.radius ?? 0.5;
      const he = (a.height ?? 1) / 2;
      proxyR = Math.max(r * 0.7, he);
      body += `    float tk = iCylinderY(q, dq, ${flt(r)}, ${flt(he)}, n${k});\n`;
      body += `    if (tk > 0.0 && tk < tHit) { tHit = tk; nHit = ${nBack}; alb = vec3(${flt(cr)}, ${flt(cg)}, ${flt(cb)}); glowK = ${flt(glow)}; hitId = ${flt(k)}; }\n`;
    } else if (s.type === 'funnel-3d') {
      // Mirror funnel3dSDF's layout math: N stacked truncated cones. Each
      // slice is one closed-form iCappedCone; they share the subject's
      // (possibly animated) frame, material and hit id.
      const stages = Math.max(1, Math.floor(a.stages ?? a.count ?? 4));
      const rTop = a.topRadius ?? 0.95;
      const rBot = a.bottomRadius ?? 0.22;
      const stageH = a.stageHeight ?? 0.4;
      const gap = a.gap ?? 0.06;
      const radii = Array.isArray(a.radii) && a.radii.length >= stages + 1 ? a.radii : null;
      const radAt = (f) => rTop + f * (rBot - rTop);
      const totalH = stages * stageH + (stages - 1) * gap;
      let maxR = 0;
      for (let j = 0; j < stages; j++) {
        const rT = radii ? radii[j] : radAt(j / stages);
        const rB = radii ? radii[j + 1] : radAt((j + 1) / stages);
        maxR = Math.max(maxR, rT, rB);
        const yT = totalH / 2 - j * (stageH + gap);
        const yB = yT - stageH;
        body += `    { vec4 cc = iCappedCone(q, dq, vec3(0.0, ${flt(yT)}, 0.0), vec3(0.0, ${flt(yB)}, 0.0), ${flt(rT)}, ${flt(rB)});\n`;
        body += `      if (cc.x > 0.0 && cc.x < tHit) { tHit = cc.x; n${k} = cc.yzw; nHit = ${nBack}; alb = vec3(${flt(cr)}, ${flt(cg)}, ${flt(cb)}); glowK = ${flt(glow)}; hitId = ${flt(k)}; } }\n`;
      }
      proxyR = Math.max(maxR * 0.75, totalH * 0.5);
    }
    body += '  }\n';

    // occlusion proxy: centre follows the (possibly animated) translate.
    // Skip tiny/huge proxies: breadcrumbs don't shade, horizon hills would
    // darken the whole stage.
    if (proxyR > 0.15 && proxyR < 8.0) {
      occBody += `  { float ty${k} = ${ty}; float tz${k} = ${tz}; if (hitId != ${flt(k)}) occ += sphOcc(pos, nor, vec4(${flt(T[0])}, ty${k}, tz${k}, ${flt(proxyR)})); }\n`;
    }
  }

  const fragSource = `#version 300 es
precision highp float;
out vec4 fragColor;

uniform vec2  u_resolution;
uniform vec3  u_camPos;
uniform vec3  u_camFwd;
uniform vec3  u_camRight;
uniform vec3  u_camUp;
uniform float u_focal;
uniform vec3  u_lightPos;
uniform float u_time;
uniform float u_studioBg;
uniform float u_groundOn;
uniform float u_ambientScale;

#define MAX_DIST 200.0

vec3 rotY(vec3 p, float c, float s) { return vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z); }

${GLSL_LIB}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution) / u_resolution.y;
  vec3 rd = normalize(uv.x * u_camRight + uv.y * u_camUp + u_focal * u_camFwd);
  vec3 ro = u_camPos;
  vec3 sunDir = normalize(u_lightPos);

  float tHit = MAX_DIST;
  vec3 nHit = vec3(0.0, 1.0, 0.0);
  vec3 alb = vec3(0.0);
  float glowK = 0.0;
  float hitId = -1.0;

${body}

  // ground plane
  if (u_groundOn > 0.5) {
    float tg = iPlaneY(ro, rd);
    if (tg > 0.0 && tg < tHit) {
      tHit = tg;
      nHit = vec3(0.0, 1.0, 0.0);
      alb = (u_studioBg > 0.5) ? vec3(0.052, 0.056, 0.07) : vec3(0.72, 0.73, 0.76);
      glowK = 0.0;
      hitId = -1.0;
    }
  }

  vec3 col;
  if (tHit >= MAX_DIST - 0.001) {
    col = (u_studioBg > 0.5)
      ? mix(vec3(0.085, 0.10, 0.13), vec3(0.014, 0.018, 0.028), clamp(rd.y, 0.0, 1.0))
      : mix(vec3(0.66, 0.69, 0.74), vec3(0.50, 0.54, 0.62), clamp(rd.y, 0.0, 1.0));
    fragColor = vec4(col, 1.0);
    return;
  }

  vec3 pos = ro + rd * tHit;
  vec3 nor = nHit;
  float diff = max(dot(nor, sunDir), 0.0);

  // analytic occlusion sum over proxy spheres — soft contact shadows on the
  // floor AND crevice grounding on the bodies, zero marching (the IQ demo)
  float occ = 0.0;
${occBody}
  // 0.82 cap: stacked proxies (hub clusters) otherwise saturate to pitch
  // black — a contact shadow should ground, not punch a hole in the floor
  float ao = clamp(1.0 - occ * 0.82, 0.08, 1.0);

  vec3 lin = alb * (0.38 + 0.72 * diff) * vec3(1.06, 1.01, 0.94);
  lin += alb * (0.6 + 0.4 * nor.y) * ao * (0.4 + 0.25 * u_ambientScale);
  lin *= mix(1.0, ao, 0.75);
  col = lin * exp(-0.03 * tHit);
  col += alb * glowK * 1.4;

  if (col.r != col.r) col.r = 0.0;
  if (col.g != col.g) col.g = 0.0;
  if (col.b != col.b) col.b = 0.0;
  col = clamp(col, vec3(0.0), vec3(100.0));
  fragColor = vec4(col, clamp(tHit / MAX_DIST, 0.0, 1.0));
}
`;

  return { ok: true, fragSource, count: idx };
}
