// =============================================================================
// fourd.js — the 4D SDF toy. Exploration, deliberately un-productized.
// -----------------------------------------------------------------------------
// A 2D screen shows a 3D world through projection + motion; a (future)
// spherical volumetric display would show 4D the same way. Until then, the
// fourth dimension enters intuition through MOTION: sliding the w-slice and
// spinning the three w-planes (xw / yw / zw) — rotations impossible in 3D.
//
// Three viewing modes, one distance field d(x,y,z,w):
//   slice  — d3(p) = d4(R·(p,w0)): a razor cross-section. The staple
//            (Miegakure / 4D Toys): shapes grow, morph and vanish as w slides.
//   thick  — d3(p) = min over w∈[-W,W] of d4: the whole 4D body flattened
//            into 3D (the "shadow"). Hit points are colored by the w that was
//            closest — a DEPTH MAP OF THE FOURTH DIMENSION in hue.
//   onion  — a few translucent slices at once: the poor man's volumetric
//            display, w expressed as layered ghosts.
//
// Everything is a plain WebGL2 raymarcher with the stone white-model shading —
// zero dependency on the Present pipeline, no perf gate, pure playground.
// =============================================================================

const canvas = document.getElementById('c');
const gl = canvas.getContext('webgl2', { antialias: true });
if (!gl) throw new Error('WebGL2 required');

const FRAG = `#version 300 es
precision highp float;
out vec4 fragColor;

uniform vec2  u_res;
uniform float u_time;
uniform vec3  u_camPos;
uniform vec3  u_camTarget;
uniform mat4  u_rot;    // 4D rotation (composition of the six plane rotations)
uniform float u_w;      // slice height along the 4th axis
uniform int   u_shape;
uniform int   u_mode;   // 0 slice | 1 thick | 2 onion
uniform int   u_factorA; // duoprism: 2D SDF factor in the xy-plane
uniform int   u_factorB; // duoprism: 2D SDF factor in the zw-plane
uniform float u_ngonA;   // side count when factor A is an n-gon (4=square … ∞=circle)
uniform float u_ngonB;   // side count when factor B is an n-gon

// ---- 4D primitives ----------------------------------------------------------
float sdHypersphere(vec4 p, float r) { return length(p) - r; }

float sdTesseract(vec4 p, vec4 h, float rr) {
  vec4 q = abs(p) - h;
  return length(max(q, 0.0)) + min(max(max(q.x, q.y), max(q.z, q.w)), 0.0) - rr;
}

// duocylinder: the product of two discs — |xy| <= r1 AND |zw| <= r2
float sdDuocylinder(vec4 p, float r1, float r2) {
  vec2 d = vec2(length(p.xy) - r1, length(p.zw) - r2);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

// spheritorus: a 2-sphere swept around a circle that extends into w
float sdSpheritorus(vec4 p, float R, float r) {
  return length(vec2(length(p.xyz) - R, p.w)) - r;
}

// duotorus (inflated Clifford torus): |xy| = r1 circle × |zw| = r2 circle
float sdDuotorus(vec4 p, float r1, float r2, float r) {
  return length(vec2(length(p.xy) - r1, length(p.zw) - r2)) - r;
}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

// ---- 2D SDF factors: each is one half of a duoprism ------------------------
// The product of any two of these is a valid 4D body. The whole platform's
// language→2D-SDF ability plugs in here — every shape you can draw is a factor.

// regular n-gon by apothem r; n is a float so it can slide 3→∞ (∞ = circle).
// exact Lipschitz-1 (intersection of half-planes) — the safe, headline factor.
float sdNgon(vec2 p, float r, float n) {
  n = max(n, 3.0);
  float an = 3.14159265358979 / n; // half-sector
  float a = atan(p.x, p.y);
  a = mod(a + an, 2.0 * an) - an; // fold into one sector
  return cos(a) * length(p) - r;
}

// iq's 5-point star (exact)
float sdStar5(vec2 p, float r, float rf) {
  const vec2 k1 = vec2(0.809016994375, -0.587785252292);
  const vec2 k2 = vec2(-k1.x, k1.y);
  p.x = abs(p.x);
  p -= 2.0 * max(dot(k1, p), 0.0) * k1;
  p -= 2.0 * max(dot(k2, p), 0.0) * k2;
  p.x = abs(p.x);
  p.y -= r;
  vec2 ba = rf * vec2(-k1.y, k1.x) - vec2(0.0, 1.0);
  float h = clamp(dot(p, ba) / dot(ba, ba), 0.0, r);
  return length(p - ba * h) * sign(p.y * ba.x - p.x * ba.y);
}

// gear: a disc with teeth (radial modulation). Not exact — scaled to stay
// a conservative under-estimate so the raymarch step is safe.
float sdGear(vec2 p, float r, float teeth, float depth) {
  float a = atan(p.y, p.x);
  float sq = smoothstep(-0.25, 0.25, cos(teeth * a));
  return (length(p) - (r + depth * sq)) * 0.55;
}

// flower: lobed disc — a soft-cornered rotational silhouette
float sdFlower(vec2 p, float r, float petals) {
  float a = atan(p.y, p.x);
  return (length(p) - r * (0.72 + 0.28 * cos(petals * a))) * 0.6;
}

// iq's heart (exact), scaled to radius s
float dot2(vec2 v) { return dot(v, v); }
float sdHeart(vec2 q, float s) {
  vec2 p = q / s;
  p.y += 0.5;
  p.x = abs(p.x);
  float d;
  if (p.y + p.x > 1.0) d = sqrt(dot2(p - vec2(0.25, 0.75))) - sqrt(2.0) / 4.0;
  else
    d = sqrt(min(dot2(p - vec2(0.0, 1.0)), dot2(p - 0.5 * max(p.x + p.y, 0.0)))) *
        sign(p.x - p.y);
  return d * s;
}

float sdFactor(int id, vec2 p, float n) {
  if (id == 0) return sdNgon(p, 0.90, n);
  if (id == 1) return sdStar5(p, 0.98, 0.45);
  if (id == 2) return sdGear(p, 0.78, 9.0, 0.16);
  if (id == 3) return sdFlower(p, 0.86, 5.0);
  return sdHeart(p, 1.05);
}

float sd4(vec4 q) {
  vec4 p = u_rot * q;
  if (u_shape == 0) return sdHypersphere(p, 1.15);
  if (u_shape == 1) return sdTesseract(p, vec4(0.78), 0.06);
  if (u_shape == 2) return sdDuocylinder(p, 0.95, 0.95);
  if (u_shape == 3) return sdSpheritorus(p, 1.0, 0.34);
  if (u_shape == 4) return sdDuotorus(p, 0.85, 0.85, 0.28);
  if (u_shape == 6) {
    // duoprism: (2D shape in xy) × (2D shape in zw), glued by the box combinator
    float du = sdFactor(u_factorA, p.xy, u_ngonA);
    float dv = sdFactor(u_factorB, p.zw, u_ngonB);
    return min(max(du, dv), 0.0) + length(max(vec2(du, dv), 0.0));
  }
  // blend: a hypersphere orbiting THROUGH a tesseract in the w axis — the
  // union breathes as the sphere passes through the slice
  float a = sdTesseract(p, vec4(0.62), 0.05);
  vec4 c = vec4(0.9 * cos(u_time * 0.6), 0.3 * sin(u_time * 0.4), 0.0, 0.9 * sin(u_time * 0.6));
  float b = sdHypersphere(p - c, 0.55);
  return smin(a, b, 0.28);
}

// ---- 3D fields (the three viewing modes) -------------------------------------
#define THICK 1.6
float g_hitW; // thick mode: which w was closest at the hit (4th-dim depth)

float mapSlice(vec3 p) { return sd4(vec4(p, u_w)); }

float mapThick(vec3 p) {
  float best = 1e9;
  float bw = 0.0;
  for (int i = 0; i < 13; i++) {
    float w = mix(-THICK, THICK, float(i) / 12.0);
    float d = sd4(vec4(p, w));
    if (d < best) { best = d; bw = w; }
  }
  g_hitW = bw;
  return best;
}

float map(vec3 p) { return (u_mode == 1) ? mapThick(p) : mapSlice(p); }

vec3 calcN(vec3 p) {
  const vec2 e = vec2(0.0015, -0.0015);
  return normalize(
    e.xyy * map(p + e.xyy) + e.yyx * map(p + e.yyx) + e.yxy * map(p + e.yxy) + e.xxx * map(p + e.xxx));
}

float calcAO(vec3 p, vec3 n) {
  float occ = 0.0;
  float sca = 1.0;
  for (int i = 0; i < 5; i++) {
    float h = 0.02 + 0.11 * float(i);
    occ += (h - map(p + n * h)) * sca;
    sca *= 0.85;
  }
  return clamp(1.0 - 2.2 * occ, 0.0, 1.0);
}

vec3 hueOfW(float w) {
  // 4th-dimension depth → hue: -W blue, 0 white-ish, +W vermilion
  float t = clamp(w / THICK * 0.5 + 0.5, 0.0, 1.0);
  vec3 cold = vec3(0.35, 0.55, 1.0);
  vec3 mid = vec3(0.92, 0.93, 0.96);
  vec3 hot = vec3(1.0, 0.42, 0.2);
  return t < 0.5 ? mix(cold, mid, t * 2.0) : mix(mid, hot, t * 2.0 - 1.0);
}

vec3 shade(vec3 p, vec3 rd, float t, vec3 alb) {
  vec3 n = calcN(p);
  vec3 sun = normalize(vec3(0.55, 0.7, 0.4));
  float dif = max(dot(n, sun), 0.0);
  float ao = calcAO(p, n);
  vec3 lin = alb * (0.35 + 0.75 * dif) * vec3(1.06, 1.01, 0.94);
  lin += alb * (0.6 + 0.4 * n.y) * ao * 0.5;
  lin *= mix(1.0, ao, 0.6);
  return lin * exp(-0.028 * t);
}

vec4 marchField(vec3 ro, vec3 rd) { // returns (color, alpha-hit)
  float t = 0.02;
  for (int i = 0; i < 160; i++) {
    vec3 p = ro + rd * t;
    float d = map(p);
    if (d < 0.001 * (1.0 + t)) {
      vec3 alb = (u_mode == 1) ? hueOfW(g_hitW) : vec3(0.88, 0.89, 0.92);
      return vec4(shade(p, rd, t, alb), 1.0);
    }
    if (t > 24.0) break;
    t += d;
  }
  return vec4(0.0);
}

// onion: N translucent slices composited front-to-back, each its own w-hue
vec4 marchOnion(vec3 ro, vec3 rd) {
  vec3 acc = vec3(0.0);
  float trans = 1.0;
  for (int layer = 0; layer < 5; layer++) {
    float w = mix(-1.2, 1.2, float(layer) / 4.0);
    float t = 0.02;
    for (int i = 0; i < 90; i++) {
      vec3 p = ro + rd * t;
      float d = sd4(vec4(p, w));
      if (d < 0.0012 * (1.0 + t)) {
        // cheap per-layer shading: normal via the SLICE field at this w
        vec3 n;
        {
          const vec2 e = vec2(0.002, -0.002);
          n = normalize(
            e.xyy * sd4(vec4(p + e.xyy, w)) + e.yyx * sd4(vec4(p + e.yyx, w)) +
            e.yxy * sd4(vec4(p + e.yxy, w)) + e.xxx * sd4(vec4(p + e.xxx, w)));
        }
        vec3 sun = normalize(vec3(0.55, 0.7, 0.4));
        vec3 col = hueOfW(w) * (0.4 + 0.7 * max(dot(n, sun), 0.0)) * exp(-0.028 * t);
        float a = 0.42;
        acc += trans * a * col;
        trans *= (1.0 - a);
        break;
      }
      if (t > 24.0) break;
      t += d;
    }
    if (trans < 0.04) break;
  }
  return vec4(acc, 1.0 - trans);
}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - u_res) / u_res.y;
  vec3 fwd = normalize(u_camTarget - u_camPos);
  vec3 right = normalize(cross(fwd, vec3(0.0, 1.0, 0.0)));
  vec3 up = cross(right, fwd);
  vec3 rd = normalize(uv.x * right + uv.y * up + 1.7 * fwd);
  vec3 ro = u_camPos;

  vec3 bg = mix(vec3(0.085, 0.10, 0.13), vec3(0.014, 0.018, 0.028), clamp(uv.y * 0.5 + 0.5, 0.0, 1.0));
  vec4 s = (u_mode == 2) ? marchOnion(ro, rd) : marchField(ro, rd);
  vec3 col = mix(bg, s.rgb, s.a);

  // gentle vignette + gamma (self-contained page: no postfx pipeline here)
  col *= 1.0 - 0.25 * dot(uv * 0.5, uv * 0.5);
  col = pow(max(col, 0.0), vec3(0.4545));
  fragColor = vec4(col, 1.0);
}
`;

const VERT = `#version 300 es
in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

function compile(type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
  return sh;
}
const prog = gl.createProgram();
gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
gl.linkProgram(prog);
if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
gl.useProgram(prog);

const buf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
const aPos = gl.getAttribLocation(prog, 'a_pos');
gl.enableVertexAttribArray(aPos);
gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

const U = {};
for (const n of [
  'u_res',
  'u_time',
  'u_camPos',
  'u_camTarget',
  'u_rot',
  'u_w',
  'u_shape',
  'u_mode',
  'u_factorA',
  'u_factorB',
  'u_ngonA',
  'u_ngonB',
])
  U[n] = gl.getUniformLocation(prog, n);

// ---- 4D rotation: compose six plane rotations from absolute angles ------------
// (build from angles each frame — no incremental drift)
const PLANES = [
  [0, 1], // xy
  [0, 2], // xz
  [1, 2], // yz
  [0, 3], // xw
  [1, 3], // yw
  [2, 3], // zw
];
function rot4(angles) {
  // column-major 4x4 identity
  let m = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const mul = (a, b) => {
    const o = new Array(16).fill(0);
    for (let c = 0; c < 4; c++)
      for (let r = 0; r < 4; r++)
        for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
    return o;
  };
  angles.forEach((th, i) => {
    if (!th) return;
    const [u, v] = PLANES[i];
    const R = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    const c = Math.cos(th);
    const s = Math.sin(th);
    R[u * 4 + u] = c;
    R[v * 4 + v] = c;
    R[u * 4 + v] = s;
    R[v * 4 + u] = -s;
    m = mul(m, R);
  });
  return new Float32Array(m);
}

// ---- state + UI ----------------------------------------------------------------
const state = {
  shape: 6, // land in the duoprism — the new thing
  mode: 0,
  w: 0,
  wanim: false,
  speeds: [0, 0, 0, 0.25, 0, 0], // xw gently spinning by default — the 4D hello-world
  angles: [0, 0, 0, 0, 0, 0],
  factorA: 0, // n-gon
  factorB: 0, // n-gon
  ngonA: 4, // square × square = tesseract; slide toward ∞ to melt into duocylinder
  ngonB: 4,
  cam: { yaw: 0.6, pitch: 0.35, dist: 5.2 },
};

const $ = (id) => document.getElementById(id);
// factor 0 is the n-gon; only then is the side-count slider meaningful
const syncDuoUI = () => {
  $('duo').style.display = state.shape === 6 ? 'block' : 'none';
  $('ngonArow').style.display = state.shape === 6 && state.factorA === 0 ? 'flex' : 'none';
  $('ngonBrow').style.display = state.shape === 6 && state.factorB === 0 ? 'flex' : 'none';
};
$('shape').onchange = (e) => {
  state.shape = Number(e.target.value);
  syncDuoUI();
};
$('factorA').onchange = (e) => {
  state.factorA = Number(e.target.value);
  syncDuoUI();
};
$('factorB').onchange = (e) => {
  state.factorB = Number(e.target.value);
  syncDuoUI();
};
$('ngonA').oninput = (e) => {
  state.ngonA = Number(e.target.value);
  $('ngonAval').textContent = state.ngonA >= 24 ? '∞' : String(state.ngonA);
};
$('ngonB').oninput = (e) => {
  state.ngonB = Number(e.target.value);
  $('ngonBval').textContent = state.ngonB >= 24 ? '∞' : String(state.ngonB);
};
for (const m of [0, 1, 2])
  $(`mode${m}`).onclick = () => {
    state.mode = m;
    for (const k of [0, 1, 2]) $(`mode${k}`).classList.toggle('on', k === m);
  };
$('w').oninput = (e) => {
  state.w = Number(e.target.value);
  state.wanim = false;
  $('wanim').checked = false;
};
$('wanim').onchange = (e) => (state.wanim = e.target.checked);
['rxy', 'rxz', 'ryz', 'rxw', 'ryw', 'rzw'].forEach((id, i) => {
  $(id).oninput = (e) => (state.speeds[i] = Number(e.target.value));
});
$('reset').onclick = () => {
  state.angles = [0, 0, 0, 0, 0, 0];
  state.speeds = [0, 0, 0, 0, 0, 0];
  state.w = 0;
  state.wanim = false;
  $('wanim').checked = false;
  $('w').value = '0';
  ['rxy', 'rxz', 'ryz', 'rxw', 'ryw', 'rzw'].forEach((id) => ($(id).value = '0'));
};
syncDuoUI();

// orbit camera
let dragging = false;
let lastXY = null;
canvas.addEventListener('pointerdown', (e) => {
  dragging = true;
  lastXY = [e.clientX, e.clientY];
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastXY[0];
  const dy = e.clientY - lastXY[1];
  lastXY = [e.clientX, e.clientY];
  state.cam.yaw -= dx * 0.006;
  state.cam.pitch = Math.max(-1.4, Math.min(1.4, state.cam.pitch + dy * 0.006));
});
canvas.addEventListener('pointerup', () => (dragging = false));
canvas.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    state.cam.dist = Math.max(2.2, Math.min(14, state.cam.dist * (1 + e.deltaY * 0.001)));
  },
  { passive: false },
);

// ---- loop -----------------------------------------------------------------------
const hud = document.getElementById('hud');
let frames = 0;
let fpsLast = performance.now();
let tPrev = performance.now();

function frame(now) {
  const dt = Math.min(0.05, (now - tPrev) / 1000);
  tPrev = now;
  const t = now / 1000;

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.floor(canvas.clientWidth * dpr);
  const h = Math.floor(canvas.clientHeight * dpr);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  gl.viewport(0, 0, w, h);

  state.angles = state.angles.map((a, i) => a + state.speeds[i] * dt);
  if (state.wanim) {
    state.w = Math.sin(t * 0.5) * 1.3;
    $('w').value = String(state.w.toFixed(2));
  }
  document.getElementById('wval').textContent = state.w.toFixed(2);

  const { yaw, pitch, dist } = state.cam;
  const cp = [
    Math.sin(yaw) * Math.cos(pitch) * dist,
    Math.sin(pitch) * dist,
    Math.cos(yaw) * Math.cos(pitch) * dist,
  ];

  gl.uniform2f(U.u_res, w, h);
  gl.uniform1f(U.u_time, t);
  gl.uniform3f(U.u_camPos, cp[0], cp[1], cp[2]);
  gl.uniform3f(U.u_camTarget, 0, 0, 0);
  gl.uniformMatrix4fv(U.u_rot, false, rot4(state.angles));
  gl.uniform1f(U.u_w, state.w);
  gl.uniform1i(U.u_shape, state.shape);
  gl.uniform1i(U.u_mode, state.mode);
  gl.uniform1i(U.u_factorA, state.factorA);
  gl.uniform1i(U.u_factorB, state.factorB);
  gl.uniform1f(U.u_ngonA, state.ngonA >= 24 ? 200.0 : state.ngonA);
  gl.uniform1f(U.u_ngonB, state.ngonB >= 24 ? 200.0 : state.ngonB);
  gl.drawArrays(gl.TRIANGLES, 0, 3);

  frames++;
  if (now - fpsLast > 500) {
    hud.textContent = `${(frames / ((now - fpsLast) / 1000)).toFixed(0)} fps`;
    frames = 0;
    fpsLast = now;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
