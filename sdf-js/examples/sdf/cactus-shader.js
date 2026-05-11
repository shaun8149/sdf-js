// =============================================================================
// BOB scene 1 用 WebGL fragment shader 渲染
// -----------------------------------------------------------------------------
// 与 cactus.js 的 JS 版逐行对照。两个版本的 SDF 表达完全一致，只是这版跑在 GPU。
//
// shader 结构：
//   1. SDF2_GLSL 基础库（来自 src/sdf2.glsl.js）—— 镜像 d2.js 的所有 primitive
//   2. 场景 SDF：sdCactus / sdMoon / sdGround / sdGate （手写组合表达式）
//   3. main(): 多层 alpha 合成，带 1px smoothstep 抗锯齿
// =============================================================================

import { SDF2_GLSL } from '../../src/sdf/sdf2.glsl.js';

// ---- 场景 SDF（与 cactus.js 完全等价）-----------------------------------
// cactus.js 是 .scale(1/1.5).translate([0, 0.2]) 链式形式；
// 这里展开成：先把 p 平移 (-0, -0.2)，再缩放 1.5 倍（即 p / (1/1.5) = p * 1.5）
const SCENE_GLSL = /* glsl */ `
// --- cactus -----------------------------------------------------------------
float sdCactus(vec2 p) {
  // 链式 .scale(1/1.5).translate([0, 0.2]) 的 inverse：先减偏移、再放大 1.5
  p = (p - vec2(0.0, 0.2)) * 1.5;
  // 5 个圆角矩形 union（注意 GLSL 用半边长，所以 size 全部除以 2）
  float trunk     = sdRoundedRectangle(p,                          vec2(0.15, 0.80), vec4(0.15, 0.0, 0.15, 0.0));
  float armR      = sdRoundedRectangle(p - vec2( 0.30,  0.10),     vec2(0.10, 0.40), vec4(0.10, 0.0, 0.10, 0.0));
  float armL      = sdRoundedRectangle(p - vec2(-0.30, -0.10),     vec2(0.10, 0.40), vec4(0.10, 0.0, 0.10, 0.0));
  float elbowR    = sdRoundedRectangle(p - vec2( 0.20,  0.40),     vec2(0.10, 0.10), vec4(0.05));
  float elbowL    = sdRoundedRectangle(p - vec2(-0.20,  0.20),     vec2(0.10, 0.10), vec4(0.05));
  float d = opUnion(trunk, opUnion(armR, opUnion(armL, opUnion(elbowR, elbowL))));
  // .scale(s) 在 SDF 上还要乘 min(s) 补距离，这里 s = 1/1.5 → 乘 1/1.5
  return d / 1.5;
}

// --- moon -------------------------------------------------------------------
// JS: circle(0.16).difference(circle(0.18).translate([-0.06, 0.04])).translate([-0.65, 0.55])
float sdMoon(vec2 p) {
  p -= vec2(-0.65, 0.55);
  float big   = sdCircle(p, 0.16);
  float small = sdCircle(p - vec2(-0.06, 0.04), 0.18);
  return opDifference(big, small);
}

// --- ground -----------------------------------------------------------------
// JS: line([0, -1], [0, -0.45])
float sdGround(vec2 p) {
  return sdLine(p, vec2(0.0, -1.0), vec2(0.0, -0.45));
}

// --- gate -------------------------------------------------------------------
// JS: rectangle([0.20,0.20]).difference(rectangle([0.16,0.16])).rotate(π/4).scale([0.5,1]).translate([0.85,-0.15])
float sdGate(vec2 p) {
  // inverse 顺序：translate → scale → rotate
  p -= vec2(0.85, -0.15);
  p /= vec2(0.5, 1.0);                                     // .scale([0.5, 1]) 的 inverse
  p = opRotate(p, -3.14159265 / 4.0);                      // .rotate(π/4) 的 inverse 是 -π/4
  float outer = sdRectangle(p, vec2(0.10, 0.10));
  float inner = sdRectangle(p, vec2(0.08, 0.08));
  float d = opDifference(outer, inner);
  return d * min(0.5, 1.0);                                // scale 距离补偿
}
`;

// ---- 主着色器 -------------------------------------------------------------
const FRAG_SRC = /* glsl */ `
precision highp float;

uniform vec2 uResolution;
uniform float uViewHalf;                                   // 世界坐标半宽
uniform vec3 uSkyTop;
uniform vec3 uSkyBot;
uniform vec3 uGroundColor;
uniform vec3 uMoonColor;
uniform vec3 uCactusColor;
uniform vec3 uGateColor;

${SDF2_GLSL}
${SCENE_GLSL}

void main() {
  // 像素 → 世界（保持 1:1 aspect，y 朝上）
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec2 p = (uv * 2.0 - 1.0) * uViewHalf;

  // 一像素的世界宽度，做抗锯齿
  float aa = uViewHalf * 2.0 / uResolution.x;

  // 起手：天空垂直渐变
  float skyT = uv.y;                                       // 0 (底) → 1 (顶)
  vec3 col = mix(uSkyBot, uSkyTop, skyT);

  // 自底向上叠图层；smoothstep 给 1 像素 AA
  col = mix(col, uGroundColor, smoothstep(aa, -aa, sdGround(p)));
  col = mix(col, uMoonColor,   smoothstep(aa, -aa, sdMoon(p)));
  col = mix(col, uCactusColor, smoothstep(aa, -aa, sdCactus(p)));
  col = mix(col, uGateColor,   smoothstep(aa, -aa, sdGate(p)));

  gl_FragColor = vec4(col, 1.0);
}
`;

const VERT_SRC = /* glsl */ `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

// ---- WebGL boilerplate ---------------------------------------------------

const canvas = document.getElementById('c');
const stats = document.getElementById('stats');
const gl = canvas.getContext('webgl', { antialias: false });
if (!gl) {
  stats.textContent = 'WebGL not available';
  throw new Error('no webgl');
}

function compile(type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    console.error('shader compile failed:', log);
    console.error('source:\n', src);
    throw new Error(log);
  }
  return sh;
}

const prog = gl.createProgram();
gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT_SRC));
gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG_SRC));
gl.linkProgram(prog);
if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
  throw new Error('link fail: ' + gl.getProgramInfoLog(prog));
}
gl.useProgram(prog);

// 全屏覆盖三角形（一个三角形比两个矩形快一点）
const buf = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buf);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
  -1, -1,
   3, -1,
  -1,  3,
]), gl.STATIC_DRAW);
const aPos = gl.getAttribLocation(prog, 'aPos');
gl.enableVertexAttribArray(aPos);
gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

// uniform 设置
const setVec3 = (name, v) =>
  gl.uniform3f(gl.getUniformLocation(prog, name), v[0] / 255, v[1] / 255, v[2] / 255);
gl.uniform2f(gl.getUniformLocation(prog, 'uResolution'), canvas.width, canvas.height);
gl.uniform1f(gl.getUniformLocation(prog, 'uViewHalf'), 1.2);
setVec3('uSkyTop',     [219, 198, 175]);
setVec3('uSkyBot',     [240, 198, 168]);
setVec3('uGroundColor',[196, 138, 92]);
setVec3('uMoonColor',  [248, 232, 195]);
setVec3('uCactusColor',[76,  118, 88]);
setVec3('uGateColor',  [54,  36,  28]);

// 单帧渲染（场景静态）
const t0 = performance.now();
gl.viewport(0, 0, canvas.width, canvas.height);
gl.drawArrays(gl.TRIANGLES, 0, 3);
gl.flush();
const elapsed = performance.now() - t0;

stats.textContent = `${canvas.width}×${canvas.height} · ${elapsed.toFixed(1)} ms (GPU)`;

// 把完整 shader 源码 dump 到 details 里方便调试
document.getElementById('shader-source').textContent = FRAG_SRC.trim();
