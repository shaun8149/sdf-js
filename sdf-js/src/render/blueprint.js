// =============================================================================
// blueprint —— Atlas 4-视图工程图 renderer (Sprint 3 / 2026-05-24)
// -----------------------------------------------------------------------------
// 一帧出 4 个 SDF 投影视图（top + side + front + isometric），用经典蓝图配色
// （深青背景 + 白色轮廓 + 网格）。
//
// Thesis 落地: Point #2 (语义组合) 最强 visual hook — 同一份 SDF spec 同时
// 投影成 4 个视角，证明 SDF 范式独有的 "one specification → multiple
// viewpoints" 能力，diffusion 没法在一张图里做。
//
// 跟 FLY 3D 共用 canvas + WebGL2 context；compositor 在 renderer-pills 里
// 加 "blueprint" pill 切换。SDF 编译走同一 compileSDF3ToGLSL 路径。
// =============================================================================

import { compileSDF3ToGLSL, canCompileSDF3 } from '../sdf/sdf3.compile.js';

const VS_SRC = `attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`;

// -----------------------------------------------------------------------------
// Fragment shader: 4-quadrant blueprint
// -----------------------------------------------------------------------------
function buildFragmentShader(sceneGlsl) {
  return `#ifdef GL_ES
precision highp float;
#endif

${sceneGlsl}

uniform vec2  u_resolution;
uniform vec3  u_modelCenter;   // 模型 bbox 中心，4 视图都围绕这个
uniform float u_modelExtent;   // 模型 bbox 半边长，决定正交视图缩放
uniform vec3  u_lightPos;
// NOTE: u_time MUST NOT be redeclared here — compileSDF3ToGLSL emits it as
// part of sceneSDF prelude when scene has time-aware primitives. Redefining
// would error on shaders that include it twice.

#define MAX_STEPS    100
#define MAX_DIST     200.0
#define EPS          0.001

// Scene compile 出来的 sceneSDF 是全场景 SDF。
float map(vec3 p) { return sceneSDF(p); }

vec3 calcNormal(vec3 p) {
  vec2 e = vec2(EPS, 0.0);
  return normalize(vec3(
    map(p + e.xyy) - map(p - e.xyy),
    map(p + e.yxy) - map(p - e.yxy),
    map(p + e.yyx) - map(p - e.yyx)
  ));
}

// Raymarch sceneSDF along (ro, rd). Return vec4(hit, t, normal.x, normal.y)
// where hit = 1 / 0. Stores normal in xy + computed depth in alpha for later
// use. Simplified — we only need silhouette + shaded value, not full PBR.
vec4 march(vec3 ro, vec3 rd) {
  float t = 0.0;
  for (int i = 0; i < MAX_STEPS; i++) {
    vec3 p = ro + rd * t;
    float d = map(p);
    if (d < EPS) {
      vec3 n = calcNormal(p);
      return vec4(1.0, t, n.x, n.y);
    }
    t += d;
    if (t > MAX_DIST) break;
  }
  return vec4(0.0, MAX_DIST, 0.0, 0.0);
}

// For a given quadrant UV (in [-1, 1]^2), build (ro, rd) for one of 4 views.
// viewIdx: 0=TOP (Y-down ortho), 1=SIDE (X+ ortho), 2=FRONT (Z+ ortho), 3=ISO (perspective)
void buildView(int viewIdx, vec2 uv, out vec3 ro, out vec3 rd) {
  vec3 c = u_modelCenter;
  float r = u_modelExtent * 1.15;   // padding
  if (viewIdx == 0) {
    // TOP view: camera high above, looking -Y. uv.x → world.X, uv.y → world.Z
    ro = c + vec3(uv.x * r, r * 3.0, -uv.y * r);
    rd = vec3(0.0, -1.0, 0.0);
  } else if (viewIdx == 1) {
    // SIDE view: camera at +X, looking -X. uv.x → -world.Z, uv.y → world.Y
    ro = c + vec3(r * 3.0, uv.y * r, uv.x * r);
    rd = vec3(-1.0, 0.0, 0.0);
  } else if (viewIdx == 2) {
    // FRONT view: camera at +Z, looking -Z. uv.x → world.X, uv.y → world.Y
    ro = c + vec3(uv.x * r, uv.y * r, r * 3.0);
    rd = vec3(0.0, 0.0, -1.0);
  } else {
    // ISO view: perspective. Tightened so model fills the quadrant similarly
    // to the 3 ortho views. Earlier camera at 2× extent with focal=1.5 made
    // the model appear ~half size vs the ortho views.
    vec3 camPos = c + vec3(r * 1.4, r * 1.2, r * 1.4);
    vec3 fwd = normalize(c - camPos);
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
    vec3 up = cross(fwd, right);
    float focal = 2.5;
    ro = camPos;
    rd = normalize(uv.x * right + uv.y * up + focal * fwd);
  }
}

// Blueprint palette helpers
vec3 bpBg() {
  // Deep cyan-blue with subtle vertical gradient
  return mix(vec3(0.08, 0.18, 0.30), vec3(0.05, 0.13, 0.24), gl_FragCoord.y / u_resolution.y);
}

float bpGrid(vec2 uvLocal) {
  // Fine + coarse grid. uvLocal in [-1, 1] within a quadrant.
  vec2 scaled = uvLocal * 8.0;  // 8 cells per quadrant
  vec2 g = abs(fract(scaled) - 0.5);
  float fine = 1.0 - smoothstep(0.0, 0.02, min(g.x, g.y));
  vec2 coarseScaled = uvLocal * 2.0;
  vec2 gC = abs(fract(coarseScaled) - 0.5);
  float coarse = 1.0 - smoothstep(0.0, 0.01, min(gC.x, gC.y));
  return max(fine * 0.10, coarse * 0.20);
}

float bpLabel(vec2 uv, int viewIdx) {
  // Reserved for future label rendering. Currently just returns 0.
  return 0.0;
}

void main() {
  vec2 fc = gl_FragCoord.xy;
  vec2 uv = fc / u_resolution;  // [0,1] x [0,1]

  // Quadrant border (white divider lines)
  float xDist = min(uv.x, 1.0 - uv.x);
  float yDist = min(uv.y, 1.0 - uv.y);
  float midX = abs(uv.x - 0.5);
  float midY = abs(uv.y - 0.5);
  float divider = (1.0 - smoothstep(0.0, 1.5 / u_resolution.x, midX))
                + (1.0 - smoothstep(0.0, 1.5 / u_resolution.y, midY));
  divider = clamp(divider, 0.0, 1.0);

  // Map fc to quadrant + local uv [-1,1]
  int viewIdx;
  vec2 qUV;  // local [-1, 1] within the quadrant
  if (uv.x < 0.5 && uv.y >= 0.5) {
    viewIdx = 0;  // top-left: TOP
    qUV = vec2((uv.x - 0.25) * 4.0, (uv.y - 0.75) * 4.0);
  } else if (uv.x >= 0.5 && uv.y >= 0.5) {
    viewIdx = 1;  // top-right: SIDE
    qUV = vec2((uv.x - 0.75) * 4.0, (uv.y - 0.75) * 4.0);
  } else if (uv.x < 0.5 && uv.y < 0.5) {
    viewIdx = 2;  // bottom-left: FRONT
    qUV = vec2((uv.x - 0.25) * 4.0, (uv.y - 0.25) * 4.0);
  } else {
    viewIdx = 3;  // bottom-right: ISO
    qUV = vec2((uv.x - 0.75) * 4.0, (uv.y - 0.25) * 4.0);
  }
  // Aspect-correct local UV (each quadrant is square-ish on a square canvas)
  qUV.x *= u_resolution.x / u_resolution.y;  // canvas aspect; usually 1.0

  // Per-quadrant ray construction + raymarch
  vec3 ro, rd;
  buildView(viewIdx, qUV, ro, rd);
  vec4 hit = march(ro, rd);

  vec3 col;
  if (hit.x > 0.5) {
    // Hit surface. White-ish line drawing: shade by N·L
    vec3 n = vec3(hit.z, hit.w, sqrt(max(0.0, 1.0 - hit.z*hit.z - hit.w*hit.w)));
    vec3 toLight = normalize(u_lightPos - (ro + rd * hit.y));
    float ndl = max(0.3, dot(n, toLight));
    // White line drawing on dark blue background
    col = mix(bpBg(), vec3(0.92, 0.96, 1.0), ndl * 0.85);

    // Manual 4-neighbor silhouette edge detection — sample the SDF 1px around
    // (ro, rd) in screen space by approximating: a pixel is "edge" if 1+ of
    // its 4 neighbors fall on background. Cheap proxy: compare hit.y depth
    // delta when shifting rd by 1/canvasRes screen offset.
    // NOTE: we can't call dFdx/dFdy — WebGL2's ES 1.00 mode doesn't expose
    // the OES_standard_derivatives extension. Manual offset sampling instead.
    // For Sprint 3 first ship, skip the 4-march cost and use a flat N.Z
    // silhouette approximation: surfaces facing toward the camera (high
    // normalZ in view space) get bright; grazing surfaces (low) get edge tint.
    float silhouette = 1.0 - smoothstep(0.05, 0.30, abs(n.z));
    col = mix(col, vec3(0.98, 0.99, 1.0), silhouette * 0.4);
  } else {
    // Sky: just bg + grid
    col = bpBg();
  }
  // Grid overlay
  col += vec3(0.7, 0.85, 0.95) * bpGrid(qUV);

  // Quadrant divider on top of everything
  col = mix(col, vec3(0.6, 0.75, 0.9), divider * 0.55);

  // Outer frame border
  float border = (1.0 - step(2.0, fc.x))
               + (1.0 - step(2.0, u_resolution.x - fc.x))
               + (1.0 - step(2.0, fc.y))
               + (1.0 - step(2.0, u_resolution.y - fc.y));
  col = mix(col, vec3(0.7, 0.85, 0.95), clamp(border, 0.0, 1.0) * 0.6);

  gl_FragColor = vec4(col, 1.0);
}`;
}

// =============================================================================
// Renderer factory — public API matches FLY 3D / BOB GPU
// =============================================================================

export function createBlueprintRenderer({ canvas, getControls, onFps }) {
  // Try WebGL2 first (matches FLY 3D). dFdx/dFdy is a WebGL1 extension
  // (OES_standard_derivatives) but WebGL2 includes it natively.
  let gl = canvas.getContext('webgl2', { antialias: true, preserveDrawingBuffer: false });
  if (!gl) {
    gl = canvas.getContext('webgl', { antialias: true, preserveDrawingBuffer: false });
    if (gl) gl.getExtension('OES_standard_derivatives');
  }
  if (!gl) throw new Error('[blueprint] WebGL not supported');
  // Sprint 12: enable LINEAR filtering for RGBA32F (Rune heightmap sampler).
  // Idempotent — if FLY 3D already enabled it on the shared context, no-op.
  if (gl.getExtension) gl.getExtension('OES_texture_float_linear');

  // Shared full-screen quad VBO + vertex shader (compiled once).
  const vbuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbuf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

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
  const vs = compileShader(VS_SRC, gl.VERTEX_SHADER);

  // Program cache (same idiom as FLY 3D)
  const programCache = new Map();
  const PROGRAM_CACHE_MAX = 4;
  let program = null;
  let uniformsCache = {};
  let rafId = null;
  let pendingRender = null;
  const startTime = performance.now();

  // Model bbox heuristic — passed in via opts.modelCenter / modelExtent.
  // Compositor can supply these from scene.cameraStatic.targetX/Y/Z + distance.
  let modelCenter = [0, 0, 0];
  let modelExtent = 10;

  function uploadSDF(sdf) {
    const result = compileSDF3ToGLSL(sdf, {
      sceneFnName: 'sceneSDF',
      includeLibrary: true,
      emitObjectIndex: false,
    });
    if (result.error) throw new Error(`[blueprint] compileSDF3ToGLSL: ${result.error}`);
    const fragSource = buildFragmentShader(result.glsl);
    let entry = programCache.get(fragSource);
    if (!entry) {
      let fs;
      try {
        fs = compileShader(fragSource, gl.FRAGMENT_SHADER);
      } catch (e) {
        throw new Error(`[blueprint] frag compile: ${e.message}`);
      }
      const prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error(`[blueprint] link: ${gl.getProgramInfoLog(prog)}`);
      }
      if (programCache.size >= PROGRAM_CACHE_MAX) {
        const oldKey = programCache.keys().next().value;
        const old = programCache.get(oldKey);
        gl.detachShader(old.prog, vs);
        gl.detachShader(old.prog, old.fs);
        gl.deleteShader(old.fs);
        gl.deleteProgram(old.prog);
        programCache.delete(oldKey);
      }
      entry = { prog, fs };
      programCache.set(fragSource, entry);
    }
    program = entry.prog;
    gl.useProgram(program);
    uniformsCache = {};
    for (const name of [
      'u_resolution',
      'u_modelCenter',
      'u_modelExtent',
      'u_lightPos',
      'u_time',
      'u_heightmap',
      'u_runeActive',
    ]) {
      // Sprint 12 Rune erosion
      uniformsCache[name] = gl.getUniformLocation(program, name);
    }
    return fragSource.length;
  }

  // Sprint 12 Rune erosion heightmap. Same pipeline as flyLambert.setRuneHeightmap.
  let runeHeightmapTex = null;
  let runeHeightmapW = 0,
    runeHeightmapH = 0;

  function lightFromSpherical(azim, alt, dist) {
    return [
      dist * Math.sin(azim) * Math.cos(alt),
      dist * Math.sin(alt),
      -dist * Math.cos(azim) * Math.cos(alt),
    ];
  }

  let frameCount = 0,
    fpsLast = performance.now();
  function draw() {
    if (!program) return;
    const c = getControls();
    const lpos = lightFromSpherical(c.lightAzim, c.lightAlt, c.lightDist);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    const a_pos = gl.getAttribLocation(program, 'a_pos');
    gl.enableVertexAttribArray(a_pos);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbuf);
    gl.vertexAttribPointer(a_pos, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(uniformsCache.u_resolution, canvas.width, canvas.height);
    gl.uniform3f(uniformsCache.u_modelCenter, modelCenter[0], modelCenter[1], modelCenter[2]);
    gl.uniform1f(uniformsCache.u_modelExtent, modelExtent);
    gl.uniform3f(uniformsCache.u_lightPos, lpos[0], lpos[1], lpos[2]);
    if (uniformsCache.u_time != null) {
      gl.uniform1f(uniformsCache.u_time, (performance.now() - startTime) / 1000);
    }
    // Sprint 12: bind Rune heightmap if scene has terrain-eroded-rune.
    if (runeHeightmapTex != null && uniformsCache.u_heightmap != null) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, runeHeightmapTex);
      gl.uniform1i(uniformsCache.u_heightmap, 1);
    } else if (uniformsCache.u_heightmap != null) {
      // Defensive: point sampler at unit 7 (unused) so it doesn't default
      // to unit 0. Same reasoning as flyLambert.
      gl.uniform1i(uniformsCache.u_heightmap, 7);
    }
    if (uniformsCache.u_runeActive != null) {
      gl.uniform1f(uniformsCache.u_runeActive, runeHeightmapTex != null ? 1.0 : 0.0);
    }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

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
    rafId = requestAnimationFrame(loop);
  }

  return {
    render(sdf) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.flush();
      const fragSource = buildFragmentShader(
        compileSDF3ToGLSL(sdf, {
          sceneFnName: 'sceneSDF',
          includeLibrary: true,
          emitObjectIndex: false,
        }).glsl,
      );
      const bytes = fragSource.length;
      if (pendingRender != null) cancelAnimationFrame(pendingRender);
      pendingRender = requestAnimationFrame(() => {
        pendingRender = null;
        try {
          uploadSDF(sdf);
        } catch (e) {
          console.error('[blueprint] upload failed:', e);
          return;
        }
        if (!rafId) {
          fpsLast = performance.now();
          frameCount = 0;
          loop();
        }
      });
      return { bytes };
    },
    unmount() {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      if (pendingRender != null) {
        cancelAnimationFrame(pendingRender);
        pendingRender = null;
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    },
    canRender(sdf) {
      return canCompileSDF3(sdf);
    },
    // Sprint 12 Rune erosion: upload CPU-baked heightmap from compile.js as
    // a WebGL2 RGBA32F texture for sdTerrainErodedRune sampling. null clears.
    setRuneHeightmap(baked) {
      if (!baked) {
        if (runeHeightmapTex) gl.deleteTexture(runeHeightmapTex);
        runeHeightmapTex = null;
        runeHeightmapW = 0;
        runeHeightmapH = 0;
        return;
      }
      const { data, width, height } = baked;
      if (!(data instanceof Float32Array) || data.length !== width * height * 4) {
        throw new Error(
          `[blueprint] setRuneHeightmap: bad data shape ${data?.length} vs ${width * height * 4}`,
        );
      }
      if (!runeHeightmapTex || width !== runeHeightmapW || height !== runeHeightmapH) {
        if (runeHeightmapTex) gl.deleteTexture(runeHeightmapTex);
        runeHeightmapTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, runeHeightmapTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, data);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        runeHeightmapW = width;
        runeHeightmapH = height;
      } else {
        gl.bindTexture(gl.TEXTURE_2D, runeHeightmapTex);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, width, height, gl.RGBA, gl.FLOAT, data);
      }
    },
    /**
     * Set model bbox so the 4 ortho views frame the scene correctly. Compositor
     * derives these from scene.cameraStatic (targetX/Y/Z + distance).
     */
    setModelBounds(center, extent) {
      modelCenter = [...center];
      modelExtent = extent;
    },
    // No-op stubs to match FLY 3D public API (so compositor pill switch
    // doesn't have to special-case blueprint).
    setCamState() {},
    getCamState() {
      return { position: [...modelCenter], yaw: 0, pitch: 0 };
    },
    setPostFx() {},
    setSequence() {},
    setVolumes() {},
    setSequenceTime() {},
    setSequencePaused() {},
    getSequenceTime() {
      return 0;
    },
    getSequenceDuration() {
      return 0;
    },
    isSequenceActive() {
      return false;
    },
    resetCamera() {},
  };
}
