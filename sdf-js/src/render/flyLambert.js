// =============================================================================
// flyLambert —— GPU shader Lambert + pointer-lock fly camera 渲染器
// -----------------------------------------------------------------------------
// 2026-05-17 MOVE from examples/mvp/fly3d-renderer.js → src/render/flyLambert.js
// MVP 切到 'fly3d' mode 时调用 render(sdf)；切走时 unmount()。examples/sdf 里
// 的独立 demo 页 shader-lambert-browser.js 用同样的 shader template + fly-controls。
// =============================================================================

import { compileSDF3ToGLSL, canCompileSDF3, IMIN_GLSL } from '../sdf/sdf3.compile.js';
import { attachFlyControls } from '../input/fly-controls.js';

const VS_SRC = `attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`;

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
uniform float u_shadowsOn;
uniform float u_groundOn;
uniform float u_checkerOn;

#define MAX_STEPS 128
#define MAX_DIST  40.0
#define EPS       0.0008
#define GROUND_Y  -1.0

// ---- Scene mapping (with optional infinite ground plane) ------------------
vec2 mapWithGround(vec3 p) {
  float d_obj = sceneSDF(p);
  if (u_groundOn < 0.5) return vec2(d_obj, 2.0);
  float d_gnd = p.y - GROUND_Y;
  if (d_obj < d_gnd) return vec2(d_obj, 2.0);
  return vec2(d_gnd, 1.0);
}

// IQ-style tetrahedral normal — half the texture taps of axis-aligned + smoother
vec3 calcNormal(vec3 p) {
  const float e = 0.0007;
  vec2 k = vec2(1.0, -1.0);
  return normalize(
    k.xyy * mapWithGround(p + k.xyy * e).x +
    k.yyx * mapWithGround(p + k.yyx * e).x +
    k.yxy * mapWithGround(p + k.yxy * e).x +
    k.xxx * mapWithGround(p + k.xxx * e).x
  );
}

// IQ "Improved" softShadow — penumbra control via k. Higher k = sharper.
float softShadow(vec3 ro, vec3 rd, float mint, float maxt, float k) {
  float res = 1.0;
  float t = mint;
  float ph = 1e10;
  for (int i = 0; i < 32; i++) {
    if (t >= maxt) break;
    float h = mapWithGround(ro + rd * t).x;
    if (h < 0.00012) return 0.0;
    float y = h * h / (2.0 * ph);
    float d = sqrt(h * h - y * y);
    res = min(res, k * d / max(0.0, t - y));
    ph = h;
    t += clamp(h, 0.015, 0.25);
  }
  return clamp(res, 0.0, 1.0);
}

// IQ AO — 5 samples along the normal, short distance, exponential falloff
float calcAO(vec3 p, vec3 n) {
  float occ = 0.0;
  float sca = 1.0;
  for (int i = 0; i < 5; i++) {
    float h = 0.012 + 0.14 * float(i) / 4.0;
    float d = mapWithGround(p + h * n).x;
    occ += (h - d) * sca;
    sca *= 0.92;
  }
  return clamp(1.0 - 2.6 * occ, 0.0, 1.0);
}

// 3-stop sky gradient (horizon haze → blue belt → zenith) + warm sun disk + halo
vec3 sky(vec3 rd, vec3 sunDir) {
  float t = clamp(rd.y, -0.2, 1.0);
  vec3 horizon = vec3(0.94, 0.88, 0.76);
  vec3 mid     = vec3(0.55, 0.70, 0.92);
  vec3 zenith  = vec3(0.18, 0.34, 0.66);
  vec3 col = mix(horizon, mid, smoothstep(0.0, 0.30, t));
  col = mix(col, zenith, smoothstep(0.30, 0.95, t));
  // Sun disk + halo (only when sun is above horizon)
  float sd = max(dot(rd, sunDir), 0.0);
  col += vec3(1.00, 0.92, 0.72) * pow(sd, 380.0) * 2.5;   // bright disc
  col += vec3(1.00, 0.78, 0.50) * pow(sd, 8.0)  * 0.12;   // soft halo
  return col;
}

float checker(vec2 p) {
  vec2 i = floor(p);
  return mod(i.x + i.y, 2.0);
}

// Hash-noise per pixel for free stochastic AA. Jitter initial ray t by a
// fraction of a step; silhouette edges that would land between pixels get
// distributed across them. Flat-surface noise is below gamma-tonemap threshold.
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// Gamma + clip. Reinhard was too aggressive — it pulled white down to 0.5
// before gamma, leaving everything washed-out. Diffuse-mostly scenes don't
// need HDR compression (lighting tops out near 1.5); we just clamp + gamma.
vec3 tonemap(vec3 c) {
  return pow(clamp(c, 0.0, 1.0), vec3(0.4545));
}

// IQ cosine palette — per-subject color from leaf index. Golden-ratio hash
// gives maximum perceptual separation between adjacent indices (no two
// neighbors share a hue). a/b/c/d tuned for warm-leaning editorial palette
// with enough amplitude that subjects don't all collapse to mid-grey.
vec3 objectColor(float idx) {
  float h = fract(idx * 0.6180339887);
  vec3 a = vec3(0.50, 0.50, 0.52);             // mid
  vec3 b = vec3(0.55, 0.55, 0.50);             // amplitude — bumped from 0.42 to keep saturation post-shading
  vec3 c = vec3(0.85, 1.00, 1.18);             // per-channel frequency — produces hue variation, not just lightness
  vec3 d = vec3(0.00, 0.33, 0.67);             // phase
  return a + b * cos(6.28318530718 * (c * h + d));
}

void main() {
  vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution) / u_resolution.y;
  vec3 rd = normalize(uv.x * u_camRight + uv.y * u_camUp + u_focal * u_camFwd);
  vec3 ro = u_camPos;
  vec3 sunDir = normalize(u_lightPos);

  // ---- Raymarch ----
  // Stochastic AA: offset starting t by sub-step noise per pixel. Free
  // antialiasing on silhouettes — neighboring pixels sample slightly different
  // depths along the same ray so the visibility boundary dithers across them.
  float t = hash12(gl_FragCoord.xy) * 0.012;
  float matId = 0.0;
  float hitIdx = 0.0;  // captured at hit; downstream sceneSDF calls clobber minIndex
  bool hit = false;
  for (int i = 0; i < MAX_STEPS; i++) {
    vec3 p = ro + rd * t;
    vec2 dm = mapWithGround(p);
    if (dm.x < EPS * (1.0 + 0.4 * t)) {
      hit = true; matId = dm.y;
      hitIdx = minIndex;  // capture immediately — normal/shadow/AO calls below will overwrite
      break;
    }
    if (t > MAX_DIST) break;
    t += dm.x;
  }

  vec3 col;
  if (!hit) {
    col = sky(rd, sunDir);
  } else {
    // ---- Shading ----
    vec3 p = ro + rd * t;
    vec3 n = calcNormal(p);
    vec3 toLight = normalize(u_lightPos - p);
    vec3 V = -rd;
    vec3 H = normalize(toLight + V);

    float diff = max(dot(n, toLight), 0.0);
    float spec = pow(max(dot(n, H), 0.0), 24.0);
    float ao   = calcAO(p, n);
    float skyL = clamp(0.5 + 0.5 * n.y, 0.0, 1.0);                 // hemispheric sky light
    float rim  = pow(1.0 - max(dot(n, V), 0.0), 4.0);              // fresnel rim
    float bnc  = clamp(0.5 - 0.5 * n.y, 0.0, 1.0);                 // bounce light from ground

    float shadowK = 1.0;
    if (u_shadowsOn > 0.5) {
      float lightDist = length(u_lightPos - p);
      shadowK = softShadow(p + n * 0.002, toLight, 0.02, lightDist, 12.0);
    }

    // Base albedo per material:
    //   - object hits (matId=2): IQ cosine palette indexed by hit subject's
    //     position in the flatlist. Adjacent subjects get distinct hues.
    //   - ground (matId=1): cool neutral or checker
    vec3 base;
    if (matId > 1.5) {
      base = objectColor(hitIdx);
    } else if (u_checkerOn > 0.5) {
      float c = checker(p.xz);
      base = mix(vec3(0.90, 0.86, 0.78), vec3(0.74, 0.70, 0.62), c);
    } else {
      base = vec3(0.78, 0.76, 0.70);
    }

    // Light colors
    vec3 sunCol    = vec3(1.05, 0.96, 0.84);
    vec3 skyCol    = vec3(0.50, 0.62, 0.84);
    vec3 bounceCol = vec3(0.55, 0.48, 0.40);
    vec3 rimCol    = vec3(0.55, 0.66, 0.80);

    // Compose lighting (IQ-style multi-source)
    vec3 lin = vec3(0.0);
    lin += base * sunCol    * diff * shadowK * 1.35;
    lin += base * skyCol    * skyL * ao      * 0.42;
    lin += base * bounceCol * bnc  * ao      * 0.18;
    lin += spec * sunCol    * shadowK        * 0.45;
    lin += rimCol * rim * ao                 * 0.18;

    // Atmospheric perspective: tint distant surfaces toward sky
    float fog = clamp((t - 2.0) * 0.025, 0.0, 0.65);
    col = mix(lin, sky(rd, sunDir), fog);
  }

  gl_FragColor = vec4(tonemap(col), 1.0);
}`;
}

// =============================================================================
// Controller
// =============================================================================

export function createFly3DRenderer({ canvas, getControls, onCamUpdate, onFps }) {
  const gl = canvas.getContext('webgl', { antialias: true, preserveDrawingBuffer: false });
  if (!gl) throw new Error('WebGL not supported');

  canvas.addEventListener('webglcontextlost', (e) => {
    console.error('[fly3d] WebGL context lost', e);
    e.preventDefault();
  });
  canvas.addEventListener('webglcontextrestored', () => {
    console.warn('[fly3d] WebGL context restored — re-upload required');
  });

  const camState = { position: [0, 0.3, -3.0], yaw: 0, pitch: 0 };
  const defaultCam = { position: [...camState.position], yaw: 0, pitch: 0 };

  let program = null;
  let uniformsCache = {};
  let rafId = null;
  let flyHandle = null;

  // ---- one-time vbuf + vs ----
  const vbuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const vs = compileShader(VS_SRC, gl.VERTEX_SHADER);

  // ---- camera math ----
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

  // ---- shader compile ----
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

  function uploadSDF(sdf) {
    // emitObjectIndex: true → scene() updates `minIndex` global with the closest
    // leaf's index. Fragment shader uses minIndex to pick per-subject color via
    // an IQ cosine palette — fixes the "everything is grey" look.
    const result = compileSDF3ToGLSL(sdf, {
      sceneFnName: 'sceneSDF',
      includeLibrary: true,
      emitObjectIndex: true,
    });
    if (result.error) throw new Error(`compileSDF3ToGLSL: ${result.error}`);

    let fs;
    try {
      fs = compileShader(buildFragmentShader(result.glsl), gl.FRAGMENT_SHADER);
    } catch (e) {
      console.error('Fragment shader source was:\n', buildFragmentShader(result.glsl));
      throw new Error(`GLSL shader compile failed: ${e.message}`);
    }

    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(`Program link failed: ${gl.getProgramInfoLog(prog)}`);
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

    return result.glsl.length;
  }

  let _debugFirstDraw = true;
  function draw() {
    if (!program) return;
    const c = getControls();

    const fwd = computeFwd(camState.yaw, camState.pitch);
    const right = computeRight(fwd);
    const up = cross(fwd, right);
    const lpos = lightFromSpherical(c.lightAzim, c.lightAlt, c.lightDist);

    // Defensive state reset — WebGL context is shared with other renderers
    // (e.g. bobShader) on the same canvas; their leftover state (FBO binding,
    // depth/blend, vertex attrib pointers) would silently break our draw.
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.BLEND);
    gl.disable(gl.SCISSOR_TEST);
    gl.colorMask(true, true, true, true);
    gl.useProgram(program);
    const a_pos = gl.getAttribLocation(program, 'a_pos');
    gl.enableVertexAttribArray(a_pos);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbuf);
    gl.vertexAttribPointer(a_pos, 2, gl.FLOAT, false, 0, 0);

    gl.viewport(0, 0, canvas.width, canvas.height);
    // Black clear (shader covers every pixel; clear is a safety net for blank
    // frames when context state is bad — black is less alarming than magenta).
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(uniformsCache.u_resolution, canvas.width, canvas.height);
    gl.uniform3f(uniformsCache.u_camPos, camState.position[0], camState.position[1], camState.position[2]);
    gl.uniform3f(uniformsCache.u_camFwd, fwd[0], fwd[1], fwd[2]);
    gl.uniform3f(uniformsCache.u_camRight, right[0], right[1], right[2]);
    gl.uniform3f(uniformsCache.u_camUp, up[0], up[1], up[2]);
    gl.uniform1f(uniformsCache.u_focal, c.fov);
    gl.uniform3f(uniformsCache.u_lightPos, lpos[0], lpos[1], lpos[2]);
    gl.uniform1f(uniformsCache.u_shadowsOn, c.shadowsOn ? 1.0 : 0.0);
    gl.uniform1f(uniformsCache.u_groundOn,  c.groundOn  ? 1.0 : 0.0);
    gl.uniform1f(uniformsCache.u_checkerOn, c.checkerOn ? 1.0 : 0.0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    if (_debugFirstDraw) {
      _debugFirstDraw = false;
      const err = gl.getError();
      const errName = err === gl.NO_ERROR ? 'NO_ERROR'
        : err === gl.INVALID_ENUM ? 'INVALID_ENUM'
        : err === gl.INVALID_VALUE ? 'INVALID_VALUE'
        : err === gl.INVALID_OPERATION ? 'INVALID_OPERATION'
        : err === gl.INVALID_FRAMEBUFFER_OPERATION ? 'INVALID_FRAMEBUFFER_OPERATION'
        : err === gl.OUT_OF_MEMORY ? 'OUT_OF_MEMORY'
        : err === gl.CONTEXT_LOST_WEBGL ? 'CONTEXT_LOST_WEBGL'
        : `0x${err.toString(16)}`;
      console.log('%c[fly3d] first frame drawn', 'color:#7fa97f; font-weight:600', {
        glError: errName,
        canvasW: canvas.width, canvasH: canvas.height,
        canvasVisible: canvas.style.display,
        camPos: camState.position,
        camYaw: camState.yaw, camPitch: camState.pitch,
        a_pos_loc: a_pos,
      });
    }
  }

  let frameCount = 0;
  let fpsLast = performance.now();

  function loop() {
    draw();
    frameCount++;
    const now = performance.now();
    if (now - fpsLast > 500) {
      const fps = frameCount / ((now - fpsLast) / 1000);
      if (onFps) onFps(fps);
      frameCount = 0;
      fpsLast = now;
    }
    if (onCamUpdate) onCamUpdate(camState);
    rafId = requestAnimationFrame(loop);
  }

  // ---- public API ----
  return {
    /**
     * Compile new SDF and start rendering. Idempotent — re-call to swap SDF.
     * Throws on compile / shader / link failure.
     */
    render(sdf) {
      const bytes = uploadSDF(sdf);
      if (!flyHandle) {
        flyHandle = attachFlyControls(canvas, () => camState, (patch) => Object.assign(camState, patch), {
          speed: 1.5,
          speedBoost: 4.0,
          onReset: () => {
            camState.position = [...defaultCam.position];
            camState.yaw = defaultCam.yaw;
            camState.pitch = defaultCam.pitch;
          },
        });
      }
      _debugFirstDraw = true;
      if (!rafId) {
        fpsLast = performance.now();
        frameCount = 0;
        loop();
      }
      return { bytes };
    },

    /**
     * Stop rendering, release pointer lock, detach input handlers. WebGL
     * resources kept so re-mount is cheap (just call render() again).
     */
    unmount() {
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      if (flyHandle) { flyHandle.detach(); flyHandle = null; }
    },

    resetCamera() {
      camState.position = [...defaultCam.position];
      camState.yaw = defaultCam.yaw;
      camState.pitch = defaultCam.pitch;
    },

    setCamState(patch) {
      if (patch.position) camState.position = [...patch.position];
      if (patch.yaw != null)   camState.yaw   = patch.yaw;
      if (patch.pitch != null) camState.pitch = patch.pitch;
    },

    /**
     * dry-run: 不真编译 GLSL，只 walk AST 判断 SDF 能不能 compile。
     * 用来在 dispatch 前先 check，给 user friendlier error message。
     */
    canRender(sdf) {
      return canCompileSDF3(sdf);
    },

    getCamState() { return { ...camState, position: [...camState.position] }; },
  };
}
