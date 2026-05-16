// =============================================================================
// SDF3 shader Lambert scene browser —— T5 完成版本
// -----------------------------------------------------------------------------
// 整合：
//   - compileSDF3ToGLSL（T4）把 JS SDF 表达式 compile 到 GLSL
//   - SDF3_GLSL 库（T3）做 primitive 提供
//   - fly-controls（pointer lock + WASD + mouse look）控制 free-fly camera
//   - WebGL fragment shader 做 raymarch + Lambert lighting + soft shadow + checker
//
// 跟 test-pasma-capsules.js 关系：那个是 CPU SDF + hatch streamline + 拖动延迟
// ~1s/frame；这个是 GPU shader Lambert + 鼠标拖一直 60fps。同样的 SDF 在两个
// 不同 renderer（光栅 vs 矢量线）下都能工作 = renderer-as-preset 架构验证。
// =============================================================================

import {
  sphere, box, plane, capsule,
  torus, cylinder, capped_cylinder, ellipsoid, rounded_box,
  cone, capped_cone,
  tetrahedron, octahedron, dodecahedron, icosahedron,
  pyramid, wireframe_box,
  twist, bend,
} from '../../src/sdf/d3.js';
import {
  union, intersection, difference,
  blend, dilate, erode, shell, negate,
} from '../../src/sdf/dn.js';
import { compileSDF3ToGLSL } from '../../src/sdf/sdf3.compile.js';
import { attachFlyControls } from '../../src/input/fly-controls.js';

// =============================================================================
// PRESETS — startup library of scenes
// =============================================================================

const PRESETS = [
  {
    name: 'wine bottle on table',
    src: `// 桌面 + 酒瓶（test-pasma 同款，3D form/render 解耦验证）
const table = rounded_box([2.0, 0.06, 1.2], 0.02).translate([0, -0.6, 0]);
const bottleBody = capped_cone([0,-0.55,0],[0,-0.05,0],0.13,0.13);
const neck       = cylinder(0.04, 0.30).translate([0, 0.15, 0]);
const shoulder   = sphere(0.08).translate([0, -0.02, 0]);
const cap        = cylinder(0.045, 0.04).translate([0, 0.32, 0]);
const bottle = union(bottleBody, shoulder, neck, cap, { k: 0.03 });
return union(table, bottle);`,
  },
  {
    name: 'platonic stack',
    src: `return union(
  icosahedron(0.3).translate([-0.55, 0.3, 0]),
  dodecahedron(0.3).translate([0,     0.3, 0]),
  octahedron(0.3).translate([0.55,    0.3, 0]),
  tetrahedron(0.4).translate([0,     -0.4, 0]),
  { k: 0.05 }
);`,
  },
  {
    name: 'twisted column',
    src: `// box + twist + shell = Pasma 经典 surface ribbon
return box([0.3, 0.9, 0.3]).twist(2.5).shell(0.04);`,
  },
  {
    name: 'capsule robot',
    src: `// 多 capsule joint 拼简单机器人
const head = sphere(0.16).translate([0, 0.55, 0]);
const body = capsule([0, 0.05, 0], [0, 0.4, 0], 0.13);
const arm1 = capsule([0, 0.35, 0], [0.32, 0.15, 0], 0.05);
const arm2 = capsule([0, 0.35, 0], [-0.32, 0.15, 0], 0.05);
const leg1 = capsule([0, 0.05, 0], [0.10, -0.35, 0], 0.06);
const leg2 = capsule([0, 0.05, 0], [-0.10, -0.35, 0], 0.06);
return union(head, body, arm1, arm2, leg1, leg2, { k: 0.04 });`,
  },
  {
    name: 'ring with stone',
    src: `// 戒指 + 宝石（diffusion 做不出 editable vector 3D，验证 Point 4）
const band  = torus(0.45, 0.08);
const stone = octahedron(0.18).translate([0, 0.45, 0]).rotate(Math.PI/4, [0,1,0]);
const claws = union(
  cylinder(0.03, 0.20).translate([ 0.16, 0.40, 0]),
  cylinder(0.03, 0.20).translate([-0.16, 0.40, 0]),
  cylinder(0.03, 0.20).translate([0, 0.40,  0.16]),
  cylinder(0.03, 0.20).translate([0, 0.40, -0.16]),
);
return union(band, stone, claws, { k: 0.02 });`,
  },
  {
    name: 'vase (cone diff cylinder)',
    src: `// 花瓶：用 cone 外形 + 内挖圆柱
const outer = capped_cone([0,-0.6,0],[0,0.5,0], 0.35, 0.22);
const inner = cylinder(0.18, 1.05).translate([0, 0.05, 0]);
return outer.difference(inner);`,
  },
  {
    name: 'box frame + sphere',
    src: `return union(
  wireframe_box(1.1, 0.025),
  sphere(0.35)
);`,
  },
  {
    name: 'smooth blob soup',
    src: `// 多球 smooth-union，验证 k 参数
return union(
  sphere(0.30).translate([-0.30, 0.10, 0]),
  sphere(0.25).translate([ 0.25, 0.10, 0.15]),
  sphere(0.20).translate([ 0.05, 0.30, -0.20]),
  sphere(0.22).translate([ 0.00, -0.20, 0.10]),
  { k: 0.20 }
);`,
  },
];

// =============================================================================
// State
// =============================================================================

const camState = {
  position: [0, 0.3, -3.0],
  yaw: 0,
  pitch: 0,
};
const defaultCam = { position: [...camState.position], yaw: camState.yaw, pitch: camState.pitch };

let compiledGLSL = null;     // 最近一次成功 compile 出来的 SDF3 GLSL（不含库）
let program = null;          // 当前 WebGL program
let uniformsCache = {};      // uniform location cache
let dirty = true;            // 需要重绘（连续 raf 一直 true）

// =============================================================================
// DOM
// =============================================================================

const $ = (id) => document.getElementById(id);
const canvas = $('cv');
const gl = canvas.getContext('webgl', { antialias: true, preserveDrawingBuffer: false });
if (!gl) {
  setStatus('No WebGL support', false);
  throw new Error('webgl unavailable');
}

const presetSel = $('preset');
PRESETS.forEach((p, i) => {
  const opt = document.createElement('option');
  opt.value = i;
  opt.textContent = p.name;
  presetSel.appendChild(opt);
});

const sceneSrc = $('scene-src');
sceneSrc.value = PRESETS[0].src;
presetSel.addEventListener('change', () => {
  sceneSrc.value = PRESETS[+presetSel.value].src;
  compileScene();
});

$('compile').addEventListener('click', compileScene);
sceneSrc.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault();
    compileScene();
  }
});

// Sliders
const SLIDERS = ['light-azim', 'light-alt', 'light-dist', 'fov'];
SLIDERS.forEach((id) => {
  const el = $(id);
  const update = () => { $(id + '-val').textContent = (+el.value).toFixed(2); };
  el.addEventListener('input', update);
  update();
});

$('cam-reset').addEventListener('click', resetCamera);

// =============================================================================
// Eval user scene source
// =============================================================================

// 在 textarea 上下文里暴露的 SDF binding
const SCENE_API = {
  sphere, box, plane, capsule,
  torus, cylinder, capped_cylinder, ellipsoid, rounded_box,
  cone, capped_cone,
  tetrahedron, octahedron, dodecahedron, icosahedron,
  pyramid, wireframe_box,
  twist, bend,
  union, intersection, difference,
  blend, dilate, erode, shell, negate,
  Math,
};
const SCENE_KEYS = Object.keys(SCENE_API);

function evalSceneSource(src) {
  const body = `"use strict";\n${src}`;
  const fn = new Function(...SCENE_KEYS, body);
  return fn(...SCENE_KEYS.map((k) => SCENE_API[k]));
}

// =============================================================================
// Compile scene → shader
// =============================================================================

function compileScene() {
  let sdf;
  try {
    sdf = evalSceneSource(sceneSrc.value);
  } catch (e) {
    setStatus(`JS eval failed:\n${e.message}`, false);
    return;
  }
  if (!sdf || typeof sdf.f !== 'function') {
    setStatus('Scene did not return an SDF3 (use `return ...` at the end)', false);
    return;
  }

  const result = compileSDF3ToGLSL(sdf, { sceneFnName: 'sceneSDF', includeLibrary: true });
  if (result.error) {
    setStatus(`compile error:\n${result.error}`, false);
    return;
  }

  compiledGLSL = result.glsl;
  if (rebuildProgram()) {
    const sceneOnly = compileSDF3ToGLSL(sdf, { sceneFnName: 'sceneSDF', includeLibrary: false });
    const lines = (sceneOnly.glsl || '').split('\n').length;
    setStatus(`OK · ${lines}-line scene fn · ${(result.glsl.length / 1024).toFixed(1)} KB GLSL total`, true);
  }
}

function setStatus(msg, ok) {
  const el = $('compile-status');
  el.textContent = msg;
  el.className = ok ? 'ok' : 'err';
}

// =============================================================================
// WebGL pipeline
// =============================================================================

const VS_SRC = `attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`;

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

const vbuf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vbuf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

const vs = compileShader(VS_SRC, gl.VERTEX_SHADER);

// 主 fragment shader 模板（${SCENE_GLSL} = compiledGLSL，含 SDF3_GLSL + sceneSDF）
function buildFragmentShader(sceneGlsl) {
  return `#ifdef GL_ES
precision highp float;
#endif

${sceneGlsl}

uniform vec2  u_resolution;
uniform vec3  u_camPos;
uniform vec3  u_camFwd;
uniform vec3  u_camRight;
uniform vec3  u_camUp;
uniform float u_focal;
uniform vec3  u_lightPos;
uniform float u_shadowsOn;   // 0 / 1
uniform float u_groundOn;    // 0 / 1
uniform float u_checkerOn;   // 0 / 1

#define MAX_STEPS 120
#define MAX_DIST  20.0
#define EPS       0.001
#define GROUND_Y  -1.0

// 加 ground plane（y = -1）的合并 SDF。返回 (dist, materialId)
// materialId: 0 = sky, 1 = ground, 2 = object
vec2 mapWithGround(vec3 p) {
  float d_obj = sceneSDF(p);
  if (u_groundOn < 0.5) return vec2(d_obj, 2.0);
  float d_gnd = p.y - GROUND_Y;
  if (d_obj < d_gnd) return vec2(d_obj, 2.0);
  return vec2(d_gnd, 1.0);
}

vec3 calcNormal(vec3 p) {
  const float e = 0.0008;
  return normalize(vec3(
    mapWithGround(p + vec3(e, 0.0, 0.0)).x - mapWithGround(p - vec3(e, 0.0, 0.0)).x,
    mapWithGround(p + vec3(0.0, e, 0.0)).x - mapWithGround(p - vec3(0.0, e, 0.0)).x,
    mapWithGround(p + vec3(0.0, 0.0, e)).x - mapWithGround(p - vec3(0.0, 0.0, e)).x
  ));
}

// IQ-style soft shadow
float softShadow(vec3 ro, vec3 rd, float mint, float maxt) {
  float res = 1.0;
  float t = mint;
  for (int i = 0; i < 24; i++) {
    if (t >= maxt) break;
    float h = mapWithGround(ro + rd * t).x;
    if (h < 0.0005) return 0.0;
    res = min(res, 8.0 * h / t);
    t += clamp(h, 0.01, 0.2);
  }
  return clamp(res, 0.0, 1.0);
}

vec3 sky(vec3 rd) {
  float t = 0.5 * (rd.y + 1.0);
  return mix(vec3(0.98, 0.95, 0.88), vec3(0.55, 0.70, 0.90), t);
}

float checker(vec2 p) {
  vec2 i = floor(p);
  return mod(i.x + i.y, 2.0);
}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution) / u_resolution.y;
  vec3 rd = normalize(uv.x * u_camRight + uv.y * u_camUp + u_focal * u_camFwd);
  vec3 ro = u_camPos;

  // ---- Raymarch ----
  float t = 0.0;
  float matId = 0.0;
  bool hit = false;
  for (int i = 0; i < MAX_STEPS; i++) {
    vec3 p = ro + rd * t;
    vec2 dm = mapWithGround(p);
    if (dm.x < EPS) { hit = true; matId = dm.y; break; }
    if (t > MAX_DIST) break;
    t += dm.x;
  }

  vec3 col;
  if (!hit) {
    col = sky(rd);
  } else {
    vec3 p = ro + rd * t;
    vec3 n = calcNormal(p);
    vec3 toLight = normalize(u_lightPos - p);
    float diff = max(dot(n, toLight), 0.0);

    float shadowK = 1.0;
    if (u_shadowsOn > 0.5) {
      float lightDist = length(u_lightPos - p);
      shadowK = softShadow(p + n * 0.002, toLight, 0.02, lightDist);
    }

    // 物体色：暖灰陶土；地面：checker 或纯灰
    vec3 base;
    if (matId > 1.5) {
      base = vec3(0.85, 0.72, 0.55);
    } else {
      if (u_checkerOn > 0.5) {
        float c = checker(p.xz * 1.0);
        base = mix(vec3(0.90, 0.86, 0.78), vec3(0.78, 0.72, 0.62), c);
      } else {
        base = vec3(0.85, 0.81, 0.74);
      }
    }

    float amb = 0.28;
    vec3 skyTint = sky(reflect(rd, n));
    vec3 lin = base * (amb * 0.6 + diff * shadowK * 0.85);
    lin += base * skyTint * 0.15;  // 软天光填充
    // 远雾
    float fog = 1.0 - exp(-0.02 * t * t);
    col = mix(lin, sky(rd), fog);
  }

  // gamma
  col = pow(col, vec3(0.4545));
  gl_FragColor = vec4(col, 1.0);
}`;
}

function rebuildProgram() {
  let fs;
  try {
    fs = compileShader(buildFragmentShader(compiledGLSL), gl.FRAGMENT_SHADER);
  } catch (e) {
    setStatus(`Fragment shader compile failed:\n${e.message}`, false);
    console.error('Full FS source:\n', buildFragmentShader(compiledGLSL));
    return false;
  }

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    setStatus(`Link failed:\n${gl.getProgramInfoLog(prog)}`, false);
    return false;
  }

  if (program) gl.deleteProgram(program);
  program = prog;

  gl.useProgram(program);
  const a_pos = gl.getAttribLocation(program, 'a_pos');
  gl.enableVertexAttribArray(a_pos);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbuf);
  gl.vertexAttribPointer(a_pos, 2, gl.FLOAT, false, 0, 0);

  uniformsCache = {};
  for (const name of [
    'u_resolution', 'u_camPos', 'u_camFwd', 'u_camRight', 'u_camUp', 'u_focal',
    'u_lightPos', 'u_shadowsOn', 'u_groundOn', 'u_checkerOn',
  ]) {
    uniformsCache[name] = gl.getUniformLocation(program, name);
  }
  return true;
}

// =============================================================================
// Camera math (镜像 fly-controls 的 convention)
// =============================================================================

function computeFwd(yaw, pitch) {
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const cy = Math.cos(yaw),   sy = Math.sin(yaw);
  return [sy * cp, -sp, cy * cp];
}
function computeRight(fwd) {
  const m = Math.hypot(fwd[2], fwd[0]);
  if (m < 1e-6) return [1, 0, 0];
  return [fwd[2] / m, 0, -fwd[0] / m];
}
function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function lightFromSpherical(azim, alt, dist) {
  return [
    dist * Math.sin(azim) * Math.cos(alt),
    dist * Math.sin(alt),
    -dist * Math.cos(azim) * Math.cos(alt),
  ];
}

// =============================================================================
// Frame loop
// =============================================================================

function draw() {
  if (!program) return;

  // build camera basis
  const fwd = computeFwd(camState.yaw, camState.pitch);
  const right = computeRight(fwd);
  const up = cross(fwd, right);  // world-y-up; cross 顺序 fwd×right 保证 up 跟 world up 同号
  const focal = +$('fov').value;

  // light position from spherical
  const lpos = lightFromSpherical(+$('light-azim').value, +$('light-alt').value, +$('light-dist').value);

  gl.useProgram(program);
  gl.uniform2f(uniformsCache.u_resolution, canvas.width, canvas.height);
  gl.uniform3f(uniformsCache.u_camPos, camState.position[0], camState.position[1], camState.position[2]);
  gl.uniform3f(uniformsCache.u_camFwd, fwd[0], fwd[1], fwd[2]);
  gl.uniform3f(uniformsCache.u_camRight, right[0], right[1], right[2]);
  gl.uniform3f(uniformsCache.u_camUp, up[0], up[1], up[2]);
  gl.uniform1f(uniformsCache.u_focal, focal);
  gl.uniform3f(uniformsCache.u_lightPos, lpos[0], lpos[1], lpos[2]);
  gl.uniform1f(uniformsCache.u_shadowsOn, $('shadow-on').checked ? 1.0 : 0.0);
  gl.uniform1f(uniformsCache.u_groundOn,  $('ground-on').checked  ? 1.0 : 0.0);
  gl.uniform1f(uniformsCache.u_checkerOn, $('checker-on').checked ? 1.0 : 0.0);

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

let frameCount = 0;
let fpsLast = performance.now();

function loop() {
  draw();
  frameCount++;
  const now = performance.now();
  if (now - fpsLast > 500) {
    const fps = frameCount / ((now - fpsLast) / 1000);
    $('fps').textContent = `FPS: ${fps.toFixed(0)}`;
    frameCount = 0;
    fpsLast = now;
  }
  updateReadouts();
  requestAnimationFrame(loop);
}

function updateReadouts() {
  const p = camState.position;
  $('pos-readout').textContent = `${p[0].toFixed(2)} ${p[1].toFixed(2)} ${p[2].toFixed(2)}`;
  const yd = (camState.yaw   * 180 / Math.PI).toFixed(0);
  const pd = (camState.pitch * 180 / Math.PI).toFixed(0);
  $('yp-readout').textContent = `${yd}° / ${pd}°`;
}

function resetCamera() {
  camState.position = [...defaultCam.position];
  camState.yaw = defaultCam.yaw;
  camState.pitch = defaultCam.pitch;
}

// =============================================================================
// Wire up fly controls
// =============================================================================

attachFlyControls(canvas, () => camState, (patch) => Object.assign(camState, patch), {
  speed: 1.5,
  speedBoost: 4.0,
  onReset: resetCamera,
});

// =============================================================================
// Init
// =============================================================================

compileScene();
loop();
