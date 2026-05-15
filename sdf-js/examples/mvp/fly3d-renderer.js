// =============================================================================
// fly3d-renderer —— MVP 的 Fly 3D pill 后端
// -----------------------------------------------------------------------------
// 封装 WebGL pipeline + shader-Lambert + pointer-lock fly camera。
// MVP 主 dispatcher 切到 'fly3d' mode 时调用 render(sdf)；切走时 unmount()。
//
// 跟 examples/sdf/shader-lambert-browser.js 共享同一 shader template + 同一
// fly-controls。区别：那个是独立 demo 页有自己 UI，这个 wrapper 留给 MVP 接入。
// =============================================================================

import { compileSDF3ToGLSL, canCompileSDF3 } from '../../src/sdf/sdf3.compile.js';
import { attachFlyControls } from '../sdf/helpers/fly-controls.js';

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

#define MAX_STEPS 120
#define MAX_DIST  20.0
#define EPS       0.001
#define GROUND_Y  -1.0

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
    lin += base * skyTint * 0.15;
    float fog = 1.0 - exp(-0.02 * t * t);
    col = mix(lin, sky(rd), fog);
  }

  col = pow(col, vec3(0.4545));
  gl_FragColor = vec4(col, 1.0);
}`;
}

// =============================================================================
// Controller
// =============================================================================

export function createFly3DRenderer({ canvas, getControls, onCamUpdate, onFps }) {
  const gl = canvas.getContext('webgl', { antialias: true, preserveDrawingBuffer: false });
  if (!gl) throw new Error('WebGL not supported');

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
    const result = compileSDF3ToGLSL(sdf, { sceneFnName: 'sceneSDF', includeLibrary: true });
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

  function draw() {
    if (!program) return;
    const c = getControls();

    const fwd = computeFwd(camState.yaw, camState.pitch);
    const right = computeRight(fwd);
    const up = cross(fwd, right);
    const lpos = lightFromSpherical(c.lightAzim, c.lightAlt, c.lightDist);

    gl.useProgram(program);
    gl.viewport(0, 0, canvas.width, canvas.height);
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
