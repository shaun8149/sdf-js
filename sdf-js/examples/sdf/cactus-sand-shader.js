// =============================================================================
// 仙人掌沙画 —— fragment shader 版
// -----------------------------------------------------------------------------
// 用 GPU 实现 JS 版"每帧抽 1000 个随机点画"的沙画累积效果：
//
//   每帧 fragment shader 跑一次完整 fullscreen pass：
//     - 每个 pixel 用 hash(gl_FragCoord, time) 算个伪随机数
//     - 数值 > uGrainRate 的 pixel 直接 discard → 保留上一帧颜色
//     - 数值 ≤ uGrainRate 的 pixel 求 SDF 距离 → 涂上"内/外/边界"三色
//
// preserveDrawingBuffer: true 让 canvas 不被自动清空，所以新画上的色点会
// 跟之前的累积起来。多帧之后整张图被沙粒铺满。
// =============================================================================

import { SDF2_GLSL } from '../../src/sdf/sdf2.glsl.js';

// ---- 仙人掌场景的 SDF（与 cactus-shader.js 同款，只取 cactus 一项）------
const CACTUS_GLSL = /* glsl */ `
float sdCactus(vec2 p) {
  // 链式 .scale(1/1.5).translate([0, 0.2]) 的 inverse
  p = (p - vec2(0.0, 0.2)) * 1.5;
  float trunk  = sdRoundedRectangle(p,                          vec2(0.15, 0.80), vec4(0.15, 0.0, 0.15, 0.0));
  float armR   = sdRoundedRectangle(p - vec2( 0.30,  0.10),     vec2(0.10, 0.40), vec4(0.10, 0.0, 0.10, 0.0));
  float armL   = sdRoundedRectangle(p - vec2(-0.30, -0.10),     vec2(0.10, 0.40), vec4(0.10, 0.0, 0.10, 0.0));
  float elbowR = sdRoundedRectangle(p - vec2( 0.20,  0.40),     vec2(0.10, 0.10), vec4(0.05));
  float elbowL = sdRoundedRectangle(p - vec2(-0.20,  0.20),     vec2(0.10, 0.10), vec4(0.05));
  float d = opUnion(trunk, opUnion(armR, opUnion(armL, opUnion(elbowR, elbowL))));
  return d / 1.5;
}
`;

// ---- 主 fragment shader -------------------------------------------------
const FRAG_SRC = /* glsl */ `
precision highp float;

uniform vec2  uResolution;
uniform float uViewHalf;
uniform float uTime;                                       // 帧计数 (秒)
uniform float uGrainRate;                                  // 每帧每像素被涂概率 (0..1)

${SDF2_GLSL}
${CACTUS_GLSL}

// 经典 GLSL hash：基于 sin × 大常数取 fract
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  // 抽签：每帧每像素一个新随机数
  float r = hash(gl_FragCoord.xy + vec2(uTime * 13.7, uTime * 17.3));
  if (r > uGrainRate) {
    discard;                                               // 没抽中 → 保留旧像素
  }

  // 抽中 → 求 SDF，按距离上色
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec2 p = (uv * 2.0 - 1.0) * uViewHalf;                   // [-view, view]，Y 向上
  float d = sdCactus(p);

  vec3 col;
  if (d < -0.01)      col = vec3(0.0,  0.4,  0.8);          // 内：蓝 (#06c)
  else if (d > 0.01)  col = vec3(1.0,  0.53, 0.0);          // 外：橙 (#f80)
  else                col = vec3(0.96, 0.96, 0.96);         // 边界：浅灰 (#f5f5f5)

  gl_FragColor = vec4(col, 1.0);
}
`;

const VERT_SRC = /* glsl */ `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

// ---- WebGL boilerplate --------------------------------------------------
const canvas = document.getElementById('c');
const stats = document.getElementById('stats');
// preserveDrawingBuffer:true 是沙画累积的关键 —— canvas 不被自动清空
const gl = canvas.getContext('webgl', {
  antialias: false,
  preserveDrawingBuffer: true,
});
if (!gl) {
  stats.textContent = 'WebGL 不可用';
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

// 全屏覆盖三角形
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

// uniform locations
const uResolution = gl.getUniformLocation(prog, 'uResolution');
const uViewHalf   = gl.getUniformLocation(prog, 'uViewHalf');
const uTime       = gl.getUniformLocation(prog, 'uTime');
const uGrainRate  = gl.getUniformLocation(prog, 'uGrainRate');

gl.uniform2f(uResolution, canvas.width, canvas.height);
gl.uniform1f(uViewHalf, 1.0);

// 初始背景：用户原版 #432 (深暖棕)
const BG = [0x44 / 255, 0x33 / 255, 0x22 / 255];
function clearToBg() {
  gl.clearColor(BG[0], BG[1], BG[2], 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);
}
clearToBg();

gl.viewport(0, 0, canvas.width, canvas.height);

// ---- 渲染循环 -----------------------------------------------------------
let grainRate = 0.005;
let frameCount = 0;
let paused = false;
let rafId = 0;
const startTime = performance.now();

function frame() {
  if (paused) return;
  const t = (performance.now() - startTime) / 1000;
  gl.uniform1f(uTime, t);
  gl.uniform1f(uGrainRate, grainRate);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  frameCount++;
  if (frameCount % 30 === 0) {
    stats.textContent =
      `grain rate ${(grainRate * 100).toFixed(1)}% · ${frameCount} frames painted · ` +
      `~${Math.round(grainRate * canvas.width * canvas.height)} grains/frame`;
  }
  rafId = requestAnimationFrame(frame);
}
rafId = requestAnimationFrame(frame);

// ---- 控件 ---------------------------------------------------------------
document.getElementById('reset').addEventListener('click', () => {
  clearToBg();
  frameCount = 0;
});

const pauseBtn = document.getElementById('pause');
pauseBtn.addEventListener('click', () => {
  paused = !paused;
  pauseBtn.textContent = paused ? '继续' : '暂停';
  if (!paused) rafId = requestAnimationFrame(frame);
});

const rateInput = document.getElementById('rate');
const rateVal = document.getElementById('rate-val');
rateInput.addEventListener('input', () => {
  grainRate = parseFloat(rateInput.value);
  rateVal.textContent = (grainRate * 100).toFixed(1) + '%';
});
