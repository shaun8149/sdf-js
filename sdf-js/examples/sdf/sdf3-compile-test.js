// =============================================================================
// SDF3 → GLSL compile smoke test
// -----------------------------------------------------------------------------
// 跑 compileSDF3ToGLSL，把结果灌进真 WebGL fragment shader 渲染一帧。
// 通过 = T3 (SDF3_GLSL 库) + T4 (compileSDF3ToGLSL) 都工作。
//
// 多个 preset 用来覆盖不同 op / primitive 组合。每个 preset 独立 compile + render。
// =============================================================================

import {
  sphere, box, torus, cylinder, capsule, cone, capped_cone,
  ellipsoid, rounded_box, tetrahedron, octahedron, dodecahedron, icosahedron,
  pyramid, wireframe_box, twist, bend,
} from '../../src/sdf/d3.js';
import { union, difference, intersection, blend, dilate, shell } from '../../src/sdf/dn.js';
import { compileSDF3ToGLSL } from '../../src/sdf/sdf3.compile.js';

// =============================================================================
// PRESETS — each one tests a different combo of primitives + ops
// =============================================================================

const PI = Math.PI;

const PRESETS = [
  {
    name: 'smooth_union',
    source:
`union(
  sphere(0.4).translate([-0.3, 0, 0]),
  box(0.5).translate([0.3, 0, 0]).rotate(Math.PI/6, [0, 1, 0]),
  { k: 0.15 }
)`,
    build: () => union(
      sphere(0.4).translate([-0.3, 0, 0]),
      box(0.5).translate([0.3, 0, 0]).rotate(PI / 6, [0, 1, 0]),
      { k: 0.15 },
    ),
  },
  {
    name: 'difference + torus rotate',
    source:
`box(0.7).translate([0,0,0])
  .difference(torus(0.5, 0.15).rotate(Math.PI/2, [1,0,0]))`,
    build: () => box(0.7).difference(
      torus(0.5, 0.15).rotate(PI / 2, [1, 0, 0]),
    ),
  },
  {
    name: 'twist + shell',
    source:
`box([0.25, 0.7, 0.25]).twist(3.0).shell(0.04)`,
    build: () => box([0.25, 0.7, 0.25]).twist(3.0).shell(0.04),
  },
  {
    name: 'platonic stack',
    source:
`union(
  icosahedron(0.3).translate([-0.55, 0.3, 0]),
  dodecahedron(0.3).translate([0, 0.3, 0]),
  octahedron(0.3).translate([0.55, 0.3, 0]),
  tetrahedron(0.4).translate([0, -0.4, 0]),
  { k: 0.05 }
)`,
    build: () => union(
      icosahedron(0.3).translate([-0.55, 0.3, 0]),
      dodecahedron(0.3).translate([0, 0.3, 0]),
      octahedron(0.3).translate([0.55, 0.3, 0]),
      tetrahedron(0.4).translate([0, -0.4, 0]),
      { k: 0.05 },
    ),
  },
  {
    name: 'capsule chain',
    source:
`union(
  capsule([-0.5, -0.4, 0], [0.5, 0.4, 0], 0.08),
  capsule([0.5, 0.4, 0], [-0.3, 0.5, 0.3], 0.08),
  capsule([-0.3, 0.5, 0.3], [-0.4, -0.3, -0.2], 0.08),
  { k: 0.05 }
)`,
    build: () => union(
      capsule([-0.5, -0.4, 0], [0.5, 0.4, 0], 0.08),
      capsule([0.5, 0.4, 0], [-0.3, 0.5, 0.3], 0.08),
      capsule([-0.3, 0.5, 0.3], [-0.4, -0.3, -0.2], 0.08),
      { k: 0.05 },
    ),
  },
  {
    name: 'rounded_box + difference cylinder',
    source:
`rounded_box([0.9, 0.6, 0.6], 0.08)
  .difference(cylinder(0.18, 1.0).rotate(Math.PI/2, [1,0,0]))`,
    build: () => rounded_box([0.9, 0.6, 0.6], 0.08).difference(
      cylinder(0.18, 1.0).rotate(PI / 2, [1, 0, 0]),
    ),
  },
  {
    name: 'wireframe_box + sphere',
    source:
`union(
  wireframe_box(1.1, 0.025),
  sphere(0.35)
)`,
    build: () => union(
      wireframe_box(1.1, 0.025),
      sphere(0.35),
    ),
  },
  {
    name: 'cone + ellipsoid',
    source:
`union(
  cone(0.7, 0.4).translate([0, -0.05, 0]),
  ellipsoid([0.35, 0.2, 0.25]).translate([0, 0.5, 0]),
  { k: 0.08 }
)`,
    build: () => union(
      cone(0.7, 0.4).translate([0, -0.05, 0]),
      ellipsoid([0.35, 0.2, 0.25]).translate([0, 0.5, 0]),
      { k: 0.08 },
    ),
  },
];

// =============================================================================
// WebGL setup (one-time)
// =============================================================================

const canvas = document.getElementById('cv');
const gl = canvas.getContext('webgl');
if (!gl) {
  setStatus('No WebGL support in this browser.', false);
  throw new Error('no webgl');
}

const VS_SRC = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

// Vertex buffer (full-screen triangle strip)
const vbuf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vbuf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

// Compile + cache vertex shader once
const vs = compileShader(VS_SRC, gl.VERTEX_SHADER);

let currentProgram = null;
let lastError = null;

// =============================================================================
// Per-preset compile + render
// =============================================================================

function renderPreset(preset) {
  document.getElementById('src').textContent = preset.source;

  // ---- 1. Build SDF expression ----
  let sdf;
  try {
    sdf = preset.build();
  } catch (e) {
    setStatus(`JS build failed: ${e.message}`, false);
    return;
  }

  // ---- 2. Compile to GLSL ----
  const full = compileSDF3ToGLSL(sdf, { sceneFnName: 'sceneSDF', includeLibrary: true });
  if (full.error) {
    setStatus(`Compile failed: ${full.error}`, false);
    return;
  }
  const sceneOnly = compileSDF3ToGLSL(sdf, { sceneFnName: 'sceneSDF', includeLibrary: false });
  document.getElementById('glsl').textContent = sceneOnly.glsl;

  // ---- 3. Build fragment shader ----
  const FS_SRC = `#ifdef GL_ES
precision highp float;
#endif

${full.glsl}

uniform vec2 u_resolution;
// u_time 由 SDF3_GLSL 自己声明，这里不重复

vec3 calcNormal(vec3 p) {
  const float e = 0.0005;
  return normalize(vec3(
    sceneSDF(p + vec3(e, 0.0, 0.0)) - sceneSDF(p - vec3(e, 0.0, 0.0)),
    sceneSDF(p + vec3(0.0, e, 0.0)) - sceneSDF(p - vec3(0.0, e, 0.0)),
    sceneSDF(p + vec3(0.0, 0.0, e)) - sceneSDF(p - vec3(0.0, 0.0, e))
  ));
}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution) / u_resolution.y;
  // 简单 orbital camera：让物体绕 Y 慢转，确认 GLSL rotate 正确
  float ang = u_time * 0.4;
  vec3 ro = vec3(2.2 * sin(ang), 0.4, -2.2 * cos(ang));
  vec3 ww = normalize(vec3(0.0, 0.0, 0.0) - ro);
  vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
  vec3 vv = cross(uu, ww);
  vec3 rd = normalize(uv.x * uu + uv.y * vv + 1.7 * ww);

  float t = 0.0;
  bool hit = false;
  for (int i = 0; i < 100; i++) {
    vec3 p = ro + rd * t;
    float d = sceneSDF(p);
    if (d < 0.001) { hit = true; break; }
    if (t > 8.0) break;
    t += d;
  }

  vec3 col = vec3(0.99, 0.97, 0.92);
  if (hit) {
    vec3 p = ro + rd * t;
    vec3 n = calcNormal(p);
    vec3 lig = normalize(vec3(0.5, 0.7, -0.4));
    float diff = max(dot(n, lig), 0.0);
    float amb = 0.3;
    float fres = pow(1.0 - max(dot(n, -rd), 0.0), 2.0);
    col = vec3(0.78, 0.66, 0.52) * (amb + diff * 0.7) + 0.2 * fres;
  }
  gl_FragColor = vec4(col, 1.0);
}`;

  // ---- 4. Compile + link program ----
  let fs;
  try {
    fs = compileShader(FS_SRC, gl.FRAGMENT_SHADER);
  } catch (e) {
    setStatus(`Fragment shader compile failed:\n${e.message}`, false);
    console.error('Full fragment shader source was:\n', FS_SRC);
    return;
  }

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(prog);
    setStatus(`Program link failed:\n${log}`, false);
    return;
  }

  if (currentProgram) gl.deleteProgram(currentProgram);
  currentProgram = prog;

  gl.useProgram(prog);
  const a_pos = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(a_pos);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbuf);
  gl.vertexAttribPointer(a_pos, 2, gl.FLOAT, false, 0, 0);
  gl.uniform2f(gl.getUniformLocation(prog, 'u_resolution'), canvas.width, canvas.height);

  const u_time = gl.getUniformLocation(prog, 'u_time');

  // ---- 5. Animate ----
  let raf = null;
  const start = performance.now();
  cancelAnimationFrame(window._smokeRaf);
  function draw() {
    gl.uniform1f(u_time, (performance.now() - start) / 1000);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    raf = requestAnimationFrame(draw);
    window._smokeRaf = raf;
  }
  draw();

  setStatus(
    `OK  preset='${preset.name}'  GLSL ${full.glsl.length} chars  rendering at 60fps`,
    true,
  );
}

// =============================================================================
// Helpers
// =============================================================================

function compileShader(src, type) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(log);
  }
  return sh;
}

function setStatus(msg, ok) {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.className = ok ? 'ok' : 'err';
}

// =============================================================================
// Init
// =============================================================================

const btns = document.getElementById('presets');
PRESETS.forEach((p, i) => {
  const b = document.createElement('button');
  b.textContent = p.name;
  b.onclick = () => {
    [...btns.children].forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    renderPreset(p);
  };
  if (i === 0) b.classList.add('active');
  btns.appendChild(b);
});

// Start with first preset
renderPreset(PRESETS[0]);
