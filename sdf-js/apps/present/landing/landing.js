// =============================================================================
// apps/present/landing/landing.js — Atlas Present LANDING shell (three.js).
// -----------------------------------------------------------------------------
// Front door, in the spirit of LUSION:LABS: a moody industrial space with a
// monumental screen on the far wall playing a LIVE shader (Star Nest), a female
// human silhouette for scale, a wet reflective floor, graded with bloom +
// vignette + grain. Click → camera pushes INTO the screen → fade → studio deck.
//
// ⚠️ QUARANTINE (locked): three.js is allowed ONLY in this landing shell. NEVER in
//    src/ or the deck/product runtime (studio/SDF).
// Screen shader: "Star Nest" by Pablo Roman Andrioli — License: MIT (credit kept).
// =============================================================================

import * as THREE from 'https://esm.sh/three@0.160.0';
import { Reflector } from 'https://esm.sh/three@0.160.0/examples/jsm/objects/Reflector.js';
import { EffectComposer } from 'https://esm.sh/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://esm.sh/three@0.160.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://esm.sh/three@0.160.0/examples/jsm/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'https://esm.sh/three@0.160.0/examples/jsm/postprocessing/BokehPass.js';
import { ShaderPass } from 'https://esm.sh/three@0.160.0/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'https://esm.sh/three@0.160.0/examples/jsm/postprocessing/OutputPass.js';

// Click the screen (or anywhere) → fly INTO it → hand off to the default deck.
const DEFAULT_DECK_ID = 'deck-studio-keynote';
const deckUrl = (id) => `../index.html?deck=${id}`;
let targetDeckHref = deckUrl(DEFAULT_DECK_ID);

const W = () => window.innerWidth;
const H = () => window.innerHeight;

const canvas = document.getElementById('c-landing');
const fadeEl = document.getElementById('fade');
const loadingEl = document.getElementById('loading');
let bootFrames = 0;
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  powerPreference: 'high-performance', // use the discrete GPU (5090), not the iGPU
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(W(), H());
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x04060a);
// hazy air — enough to catch the screen light, but thin enough that the real
// industrial room (walls, pillars, trusses) stays visible → a believable cinema.
scene.fog = new THREE.FogExp2(0x070c15, 0.0115);

const camera = new THREE.PerspectiveCamera(40, W() / H(), 0.1, 200);
camera.position.set(0.8, 2.4, 17); // starts FAR — slowly dollies toward the screen

const ROOM_W = 18, // narrower → side walls frame the view (cinema feel)
  ROOM_H = 11,
  ROOM_D = 34,
  BACK = -13;
const mat = (hex, rough = 0.7, metal = 0.0) =>
  new THREE.MeshStandardMaterial({ color: hex, roughness: rough, metalness: metal });

// ---- room shell -----------------------------------------------------------
const wallMat = mat(0x1e2733, 0.85);
const back = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_H), wallMat);
back.position.set(0, ROOM_H / 2, BACK);
scene.add(back);
const mkSide = (sx) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_D, ROOM_H), wallMat);
  m.rotation.y = -sx * (Math.PI / 2);
  m.position.set((sx * ROOM_W) / 2, ROOM_H / 2, BACK + ROOM_D / 2);
  scene.add(m);
};
mkSide(-1);
mkSide(1);
const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_D), mat(0x070a11, 0.95));
ceil.rotation.x = Math.PI / 2;
ceil.position.set(0, ROOM_H, BACK + ROOM_D / 2);
scene.add(ceil);

// industrial structure
const lineMat = new THREE.MeshBasicMaterial({ color: 0x161f2c });
for (let y = 1.5; y < ROOM_H; y += 1.6) {
  const ln = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, 0.025), lineMat);
  ln.position.set(0, y, BACK + 0.02);
  scene.add(ln);
}
const pillarMat = mat(0x0e131c, 0.8, 0.25);
for (const sx of [-1, 1]) {
  for (const z of [BACK + 5, BACK + 13, BACK + 21, BACK + 29]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.7, ROOM_H, 0.5), pillarMat);
    p.position.set(sx * (ROOM_W / 2 - 0.45), ROOM_H / 2, z);
    scene.add(p);
  }
}
const trussMat = mat(0x0c1018, 0.55, 0.55);
for (let i = 0; i < 9; i++) {
  const beam = new THREE.Mesh(new THREE.BoxGeometry(ROOM_W * 0.92, 0.18, 0.18), trussMat);
  beam.position.set(0, ROOM_H - 0.4, BACK + 2 + i * 3.6);
  scene.add(beam);
}
for (const x of [-6, 6]) {
  const s = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, ROOM_D * 0.85), trussMat);
  s.position.set(x, ROOM_H - 0.55, BACK + ROOM_D / 2);
  scene.add(s);
}

// floor — CineShader-style reflection: a real mirror of the screen, but DIM
// (dark tint) so it reads as a subtle wet-floor reflection, not a bright mirror.
const floor = new Reflector(new THREE.PlaneGeometry(ROOM_W, ROOM_D), {
  textureWidth: 2048,
  textureHeight: 2048,
  color: 0x0b0e14, // darker tint → subtle wet sheen, not a bright mirror
});
floor.rotation.x = -Math.PI / 2;
floor.position.set(0, 0, BACK + ROOM_D / 2);
scene.add(floor);

// ---- the monumental screen, playing a LIVE Star Nest shader ---------------
// "Seascape" by Alexander Alekseev aka TDM (2014) — License: MIT.
// https://www.shadertoy.com/view/Ms2SD1 — the MIT ocean our own sea-surface is
// based on. Realtime (unlike Happy Jumping); a calm, dim sea reads as cinematic.
const SCREEN_FRAG = `
  uniform float iTime; uniform vec3 iResolution; varying vec2 vUv;
  const int NUM_STEPS = 7;
  const float PI = 3.141592;
  const int ITER_GEOMETRY = 3;
  const int ITER_FRAGMENT = 5;
  const float SEA_HEIGHT = 0.6;
  const float SEA_CHOPPY = 4.0;
  const float SEA_SPEED = 0.8;
  const float SEA_FREQ = 0.16;
  const vec3 SEA_BASE = vec3(0.0,0.09,0.18);
  const vec3 SEA_WATER_COLOR = vec3(0.48,0.54,0.36);
  const mat2 octave_m = mat2(1.6,1.2,-1.2,1.6);
  mat3 fromEuler(vec3 ang){ vec2 a1=vec2(sin(ang.x),cos(ang.x)); vec2 a2=vec2(sin(ang.y),cos(ang.y)); vec2 a3=vec2(sin(ang.z),cos(ang.z)); mat3 m; m[0]=vec3(a1.y*a3.y+a1.x*a2.x*a3.x,a1.y*a2.x*a3.x+a3.y*a1.x,-a2.y*a3.x); m[1]=vec3(-a2.y*a1.x,a1.y*a2.y,a2.x); m[2]=vec3(a3.y*a1.x*a2.x+a1.y*a3.x,a1.x*a3.x-a1.y*a3.y*a2.x,a2.y*a3.y); return m; }
  float hash(vec2 p){ float h=dot(p,vec2(127.1,311.7)); return fract(sin(h)*43758.5453123); }
  float noise(in vec2 p){ vec2 i=floor(p); vec2 f=fract(p); vec2 u=f*f*(3.0-2.0*f); return -1.0+2.0*mix(mix(hash(i+vec2(0.0,0.0)),hash(i+vec2(1.0,0.0)),u.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x),u.y); }
  float diffuse(vec3 n,vec3 l,float p){ return pow(dot(n,l)*0.4+0.6,p); }
  float specular(vec3 n,vec3 l,vec3 e,float s){ float nrm=(s+8.0)/(PI*8.0); return pow(max(dot(reflect(e,n),l),0.0),s)*nrm; }
  vec3 getSkyColor(vec3 e){ e.y=(max(e.y,0.0)*0.8+0.2)*0.8; return vec3(pow(1.0-e.y,2.0),1.0-e.y,0.6+(1.0-e.y)*0.4)*1.1; }
  float sea_octave(vec2 uv,float choppy){ uv+=noise(uv); vec2 wv=1.0-abs(sin(uv)); vec2 swv=abs(cos(uv)); wv=mix(wv,swv,wv); return pow(1.0-pow(wv.x*wv.y,0.65),choppy); }
  float map(vec3 p){ float freq=SEA_FREQ; float amp=SEA_HEIGHT; float choppy=SEA_CHOPPY; vec2 uv=p.xz; uv.x*=0.75; float d, h=0.0; float st=1.0+iTime*SEA_SPEED; for(int i=0;i<ITER_GEOMETRY;i++){ d=sea_octave((uv+st)*freq,choppy); d+=sea_octave((uv-st)*freq,choppy); h+=d*amp; uv=octave_m*uv; freq*=1.9; amp*=0.22; choppy=mix(choppy,1.0,0.2); } return p.y-h; }
  float map_detailed(vec3 p){ float freq=SEA_FREQ; float amp=SEA_HEIGHT; float choppy=SEA_CHOPPY; vec2 uv=p.xz; uv.x*=0.75; float d, h=0.0; float st=1.0+iTime*SEA_SPEED; for(int i=0;i<ITER_FRAGMENT;i++){ d=sea_octave((uv+st)*freq,choppy); d+=sea_octave((uv-st)*freq,choppy); h+=d*amp; uv=octave_m*uv; freq*=1.9; amp*=0.22; choppy=mix(choppy,1.0,0.2); } return p.y-h; }
  vec3 getSeaColor(vec3 p,vec3 n,vec3 l,vec3 eye,vec3 dist){ float fresnel=clamp(1.0-dot(n,-eye),0.0,1.0); fresnel=min(fresnel*fresnel*fresnel,0.5); vec3 reflected=getSkyColor(reflect(eye,n)); vec3 refracted=SEA_BASE+diffuse(n,l,80.0)*SEA_WATER_COLOR*0.12; vec3 color=mix(refracted,reflected,fresnel); float atten=max(1.0-dot(dist,dist)*0.001,0.0); color+=SEA_WATER_COLOR*(p.y-SEA_HEIGHT)*0.18*atten; color+=vec3(specular(n,l,eye,60.0)); return color; }
  vec3 getNormal(vec3 p,float eps){ vec3 n; n.y=map_detailed(p); n.x=map_detailed(vec3(p.x+eps,p.y,p.z))-n.y; n.z=map_detailed(vec3(p.x,p.y,p.z+eps))-n.y; n.y=eps; return normalize(n); }
  float heightMapTracing(vec3 ori,vec3 dir,out vec3 p){ float tm=0.0; float tx=1000.0; float hx=map(ori+dir*tx); if(hx>0.0){ p=ori+dir*tx; return tx; } float hm=map(ori); float tmid=0.0; for(int i=0;i<NUM_STEPS;i++){ tmid=mix(tm,tx,hm/(hm-hx)); p=ori+dir*tmid; float hmid=map(p); if(hmid<0.0){ tx=tmid; hx=hmid; } else { tm=tmid; hm=hmid; } } return tmid; }
  vec3 getPixel(in vec2 coord, float time){ vec2 uv=coord/iResolution.xy; uv=uv*2.0-1.0; uv.x*=iResolution.x/iResolution.y; vec3 ang=vec3(sin(time*3.0)*0.1,sin(time)*0.2+0.3,time); vec3 ori=vec3(0.0,3.5,time*5.0); vec3 dir=normalize(vec3(uv.xy,-2.0)); dir.z+=length(uv)*0.14; dir=normalize(dir)*fromEuler(ang); vec3 p; heightMapTracing(ori,dir,p); vec3 dist=p-ori; vec3 n=getNormal(p,dot(dist,dist)*(0.1/iResolution.x)); vec3 light=normalize(vec3(0.0,1.0,0.8)); return mix(getSkyColor(dir),getSeaColor(p,n,light,dir,dist),pow(smoothstep(0.0,-0.02,dir.y),0.2)); }
  void main(){ vec2 fragCoord=vUv*iResolution.xy; float time=iTime*0.3; vec3 color=max(getPixel(fragCoord,time), 0.0); color=pow(color,vec3(0.66)); color*=1.02; float mx=max(color.r,max(color.g,color.b)); color=mix(color, vec3(mx), smoothstep(0.8,1.08,mx)*0.85); color*=mix(1.0, 0.62, smoothstep(0.5, 1.0, vUv.y)); gl_FragColor=vec4(clamp(color,0.0,1.0),1.0); }`;
// Render the screen shader ONCE per frame to a fixed low-res offscreen target —
// cost is independent of screen size / DPR. The screen (and the 片头) then just
// sample this texture (cheap). This is the pattern for ANY renderer on the screen.
const RT_W = 1600,
  RT_H = 900;
const shaderRT = new THREE.WebGLRenderTarget(RT_W, RT_H, { minFilter: THREE.LinearFilter });
const fxScene = new THREE.Scene();
const fxCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const fxMat = new THREE.ShaderMaterial({
  uniforms: { iTime: { value: 0 }, iResolution: { value: new THREE.Vector3(RT_W, RT_H, 1) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }',
  fragmentShader: SCREEN_FRAG,
});
fxScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), fxMat));

// The screen isn't a flat texture — it's a physical LCD panel: a fine pixel /
// RGB-subpixel grid (visible as the camera dollies in), backlight edge falloff,
// and a soft glass sheen. The pixels foreshorten with the panel's angle, so it
// reads as a real lit surface in the room.
const screenMat = new THREE.ShaderMaterial({
  uniforms: {
    map: { value: shaderRT.texture },
    uGrid: { value: new THREE.Vector2(168, 94) }, // pixel grid (16:9-ish)
  },
  vertexShader:
    'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D map; uniform vec2 uGrid; varying vec2 vUv;
    void main(){
      vec3 col = texture2D(map, vUv).rgb;
      // pixel grid: faint dark gaps between cells
      vec2 g = fract(vUv * uGrid);
      float lx = smoothstep(0.0, 0.12, g.x) * smoothstep(1.0, 0.88, g.x);
      float ly = smoothstep(0.0, 0.12, g.y) * smoothstep(1.0, 0.88, g.y);
      col *= mix(0.84, 1.0, lx * ly);
      // RGB subpixel columns (subtle — blurs to neutral at distance)
      float s = mod(floor(vUv.x * uGrid.x * 3.0), 3.0);
      vec3 sub = vec3(s < 0.5 ? 1.0 : 0.6, (s >= 0.5 && s < 1.5) ? 1.0 : 0.6, s >= 1.5 ? 1.0 : 0.6);
      col *= mix(vec3(1.0), sub, 0.09);
      // backlight edge falloff
      vec2 e = abs(vUv - 0.5) * 2.0;
      col *= 1.0 - smoothstep(0.84, 1.0, max(e.x, e.y)) * 0.22;
      // soft glass sheen across the panel surface
      float sheen = smoothstep(0.5, 0.0, abs(vUv.x - vUv.y * 0.55 - 0.2));
      col += sheen * 0.035 * vec3(0.72, 0.84, 1.0);
      gl_FragColor = vec4(col, 1.0);
    }`,
});
const SCREEN_W = 12.8,
  SCREEN_H = 7.2,
  SCREEN_Y = 3.7;
const screen = new THREE.Mesh(new THREE.PlaneGeometry(SCREEN_W, SCREEN_H), screenMat);
screen.position.set(0, SCREEN_Y, BACK + 0.06);
scene.add(screen);
const frame = new THREE.Mesh(
  new THREE.PlaneGeometry(SCREEN_W + 0.7, SCREEN_H + 0.7),
  mat(0x01030a, 0.4, 0.6),
);
frame.position.set(0, SCREEN_Y, BACK + 0.03);
scene.add(frame);
// front bezel — crops the shader/bloom hard at the screen edge (so it never spills)
const bezelMat = mat(0x05070c, 0.5, 0.3);
const bezelBar = (w, h, x, y) => {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.12), bezelMat);
  b.position.set(x, SCREEN_Y + y, BACK + 0.14);
  scene.add(b);
};
bezelBar(SCREEN_W + 0.6, 0.3, 0, SCREEN_H / 2); // top
bezelBar(SCREEN_W + 0.6, 0.3, 0, -SCREEN_H / 2); // bottom
bezelBar(0.3, SCREEN_H + 0.6, -SCREEN_W / 2, 0); // left
bezelBar(0.3, SCREEN_H + 0.6, SCREEN_W / 2, 0); // right
// short range so the glow pools around the screen only — side walls stay dark
const screenLight = new THREE.PointLight(0xa8c6ff, 46, 10, 2.0);
screenLight.position.set(0, SCREEN_Y, BACK + 2.5); // closer to the wall → glow halo around the screen
scene.add(screenLight);
for (const sx of [-1, 1]) {
  const wl = new THREE.PointLight(0x2f6fff, 3.5, 7, 2.2);
  wl.position.set(sx * (SCREEN_W / 2 + 1.0), SCREEN_Y, BACK + 1.2);
  scene.add(wl);
}

// post-click 片头: the same ocean texture, fullscreen. The cut from "camera inside
// the screen" → fullscreen is seamless (identical content).
const introScene = new THREE.Scene();
const introCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
const introMat = new THREE.MeshBasicMaterial({ map: shaderRT.texture });
introScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), introMat));

// cinema entrance: two dim doorways at the BACK of the room, on both side walls
for (const sx of [-1, 1]) {
  const door = new THREE.Mesh(
    new THREE.PlaneGeometry(0.05, 3.0),
    new THREE.MeshBasicMaterial({ color: 0x14304e }),
  );
  door.rotation.y = -sx * (Math.PI / 2);
  door.position.set(sx * (ROOM_W / 2 - 0.06), 1.6, BACK + ROOM_D - 6);
  scene.add(door);
  const dl = new THREE.PointLight(0x2a5078, 4, 9, 2);
  dl.position.set(sx * (ROOM_W / 2 - 1), 1.8, BACK + ROOM_D - 6);
  scene.add(dl);
}

// ---- the viewer: a lone figure standing before the screen ------------------
// Built from primitives (no fragile Mixamo skinning) so it ALWAYS reads as a
// clean human silhouette against the bright screen — the "someone in the cinema"
// that sells the space as real. ~1.75 m, near-black, standing, facing the screen.
function makeFigure() {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0x010206, roughness: 1.0, metalness: 0.0 });
  const add = (geo, x, y, z = 0, rz = 0) => {
    const o = new THREE.Mesh(geo, skin);
    o.position.set(x, y, z);
    o.rotation.z = rz;
    g.add(o);
  };
  add(new THREE.CapsuleGeometry(0.078, 0.6, 4, 8), -0.095, 0.42); // left leg
  add(new THREE.CapsuleGeometry(0.078, 0.6, 4, 8), 0.095, 0.42); // right leg
  add(new THREE.CapsuleGeometry(0.145, 0.32, 4, 10), 0, 0.98); // lower torso
  add(new THREE.CapsuleGeometry(0.16, 0.24, 4, 10), 0, 1.28); // chest / shoulders
  add(new THREE.CapsuleGeometry(0.05, 0.5, 4, 8), -0.205, 1.05, 0.02, 0.07); // left arm
  add(new THREE.CapsuleGeometry(0.05, 0.5, 4, 8), 0.205, 1.05, 0.02, -0.07); // right arm
  add(new THREE.CapsuleGeometry(0.045, 0.07, 4, 8), 0, 1.5); // neck
  add(new THREE.SphereGeometry(0.11, 16, 16), 0, 1.64); // head
  return g;
}
const FIGURE_POS = new THREE.Vector3(-0.8, 0, BACK + 15);
const figure = makeFigure();
figure.scale.setScalar(1.2);
figure.position.copy(FIGURE_POS);
scene.add(figure);

for (const [x, z, s] of [
  [-9.5, BACK + 5, 1.1],
  [-9.0, BACK + 6.6, 0.7],
  [9.6, BACK + 8, 0.9],
]) {
  const crate = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), mat(0x0a0f17, 0.8, 0.3));
  crate.position.set(x, s / 2, z);
  scene.add(crate);
}

// ---- dust motes: fine particles adrift in the screen's light -----------------
// Denser toward the screen (where the light pools). Additive + no depth-write so
// they read as glints of light, not solid specks. This is the "alive air" that a
// dry CineShader room lacks.
const DUST_N = 550;
const dustPos = new Float32Array(DUST_N * 3);
const dustPhase = new Float32Array(DUST_N);
for (let i = 0; i < DUST_N; i++) {
  // bias z toward the screen (BACK) with a squared random → more motes in the glow
  const zt = Math.pow(Math.random(), 1.7);
  dustPos[i * 3 + 0] = (Math.random() * 2 - 1) * 8.5;
  dustPos[i * 3 + 1] = Math.random() * (ROOM_H - 0.5) + 0.25;
  dustPos[i * 3 + 2] = BACK + 1.5 + zt * (ROOM_D * 0.7);
  dustPhase[i] = Math.random() * Math.PI * 2;
}
const dustGeo = new THREE.BufferGeometry();
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
const dust = new THREE.Points(
  dustGeo,
  new THREE.PointsMaterial({
    color: 0xbcd6ff,
    size: 0.04,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: true,
  }),
);
scene.add(dust);

// tag the main screen so a click routes it to the default deck
screen.userData.deckId = DEFAULT_DECK_ID;

scene.add(new THREE.AmbientLight(0x24333f, 1.7));
scene.add(new THREE.HemisphereLight(0x51708f, 0x0a1018, 2.6)); // industrial room reads dimly — a real space, not a void
// a cool grazing rim from the back of the room rakes the side walls / pillars so
// the architecture has form (a real massive room, not a flat black backdrop)
const rimL = new THREE.DirectionalLight(0x3f5f88, 0.6);
rimL.position.set(-8, 6, BACK + ROOM_D);
scene.add(rimL);
const rimR = new THREE.DirectionalLight(0x2c4a6e, 0.45);
rimR.position.set(8, 5, BACK + ROOM_D);
scene.add(rimR);

// ---- post: bloom + grade --------------------------------------------------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
// depth of field: the screen (and its wall) stay crisp; foreground pillars, floor
// edge and far corners fall soft — the single biggest "filmic camera" cue.
const bokeh = new BokehPass(scene, camera, { focus: 19.0, aperture: 0.00062, maxblur: 0.014 });
composer.addPass(bokeh);
composer.addPass(new UnrealBloomPass(new THREE.Vector2(W(), H()), 0.46, 0.72, 0.86));
composer.addPass(new OutputPass());

// ---- volumetric god-rays: light shafts stream out of the bright screen -------
// Crepuscular rays — march each pixel toward the screen's screen-space position,
// accumulating only bright samples (the screen). Through the dusty haze this
// reads as beams of light filling the room. The shot a dry CineShader can't do.
const SCREEN_CENTER = new THREE.Vector3(0, SCREEN_Y, BACK);
const godrays = new ShaderPass({
  uniforms: {
    tDiffuse: { value: null },
    uLightPos: { value: new THREE.Vector2(0.5, 0.6) },
    uStrength: { value: 0.4 },
  },
  vertexShader:
    'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec2 uLightPos; uniform float uStrength; varying vec2 vUv;
    void main(){
      vec3 base = texture2D(tDiffuse, vUv).rgb;
      const int N = 48;
      vec2 delta = (vUv - uLightPos) / float(N) * 0.92;
      vec2 coord = vUv;
      float illum = 1.0;
      vec3 rays = vec3(0.0);
      for(int i=0;i<N;i++){
        coord -= delta;
        vec3 s = texture2D(tDiffuse, coord).rgb;
        float luma = dot(s, vec3(0.299,0.587,0.114));
        s *= smoothstep(0.55, 0.95, luma);   // only the bright screen throws light
        rays += s * illum;
        illum *= 0.955;                        // decay along the shaft
      }
      rays *= uStrength / float(N);
      gl_FragColor = vec4(base + rays * vec3(0.86, 0.94, 1.12), 1.0); // cool-tinted beams
    }`,
});
composer.addPass(godrays);
const gradePass = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 } },
  vertexShader:
    'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime; varying vec2 vUv;
    void main(){
      vec3 c = texture2D(tDiffuse, vUv).rgb;
      float l = dot(c, vec3(0.299,0.587,0.114));
      c = mix(c, vec3(l), 0.20);
      c *= vec3(0.92, 0.97, 1.08);
      vec2 q = vUv - 0.5;
      float vig = smoothstep(1.15, 0.45, length(q));
      c *= mix(0.86, 1.0, vig);
      float g = fract(sin(dot(vUv*(1.0+fract(uTime)), vec2(12.9898,78.233)))*43758.5453);
      c += (g-0.5)*0.028;
      gl_FragColor = vec4(c, 1.0);
    }`,
});
composer.addPass(gradePass);

// ---- entry sequence: room → entering → intro(片头+logo) → deck -------------
// Cinema framing: the camera sits OBLIQUE (off to the side, like a cinema seat),
// dollying slowly toward the screen. Click → it accelerates and flies INTO the
// screen → seamlessly becomes a fullscreen Star Nest flight (片头) → ATLAS logo
// reveal → hands off to the studio deck (the real 3D scene).
let state = 'room'; // 'room' | 'entering' | 'intro' | 'done'
let enterProg = 0;
let introStart = 0;
let lastT = performance.now() * 0.001;
// cinematic steadicam: the camera travels/arcs around the viewer at eye height,
// always framing the figure against the screen, then flies INTO the screen on click.
const ENTER_TARGET = new THREE.Vector3(0, SCREEN_Y, BACK + 3.0);
const clickFrom = new THREE.Vector3(); // camera pos captured the instant of click
const lookNow = new THREE.Vector3(); // current idle look target
const enterLookAt = new THREE.Vector3(0, SCREEN_Y, BACK);
const logoEl = document.getElementById('enter-logo');

function animate() {
  requestAnimationFrame(animate);
  const time = performance.now() * 0.001;
  const dt = Math.min(0.05, time - lastT);
  lastT = time;
  gradePass.uniforms.uTime.value = time;

  // render the ocean to its fixed low-res target (feeds the screen + the 片头)
  fxMat.uniforms.iTime.value = time;
  renderer.setRenderTarget(shaderRT);
  renderer.render(fxScene, fxCam);
  renderer.setRenderTarget(null);

  // 片头: fullscreen Star Nest flight + logo reveal, then hand off to the deck
  if (state === 'intro' || state === 'done') {
    renderer.render(introScene, introCam);
    if (state === 'intro') {
      const e = time - introStart;
      if (e > 0.8) logoEl.classList.add('on');
      if (e > 4.6) fadeEl.classList.add('on');
      if (e > 5.5) {
        state = 'done';
        window.location.href = targetDeckHref; // routes to whichever poster/screen was clicked
      }
    }
    return;
  }

  const entering = state === 'entering';
  if (!entering) {
    // steadicam: a slow arc around the viewer at human eye height. The figure's
    // silhouette drifts across the bright screen as the angle changes — the shot
    // reads as a real camera moving through the room, not a static webpage.
    // varied shots without ever throwing the figure off the screen: the lateral
    // arc stays gentle, but the DOLLY (near intimate ↔ far establishing) and the
    // CRANE (low looking up ↔ high looking down) swing widely — different angles
    // on the same viewer + screen, like a real camera working the room.
    const sweep = Math.sin(time * 0.08) * 0.32;
    const rad = 8.6 + Math.sin(time * 0.045) * 2.6; // dolly: close-up ↔ wide establishing
    const camY = 1.55 + Math.sin(time * 0.063) * 0.85; // crane: low ↔ high
    camera.position.set(
      FIGURE_POS.x + Math.sin(sweep) * rad + 0.2,
      camY,
      FIGURE_POS.z + Math.cos(sweep) * rad + 1.2,
    );
    camera.fov = 40;
    clickFrom.copy(camera.position); // ready for an instant fly-in
    // look target rises/falls a touch with the crane so the framing stays alive
    lookNow.set(FIGURE_POS.x * 0.6, SCREEN_Y - 1.0 + Math.sin(time * 0.05) * 0.5, BACK);
    camera.lookAt(lookNow);
  } else {
    enterProg = Math.min(1, enterProg + dt * 0.6);
    const e = enterProg * enterProg * (3 - 2 * enterProg); // smoothstep ease
    camera.position.lerpVectors(clickFrom, ENTER_TARGET, e);
    camera.fov = 40 - e * 8;
    camera.lookAt(enterLookAt);
    if (enterProg >= 0.999) {
      state = 'intro';
      introStart = time;
    }
  }
  camera.updateProjectionMatrix();

  // dust drifts gently through the light; keep the figure/screen plane in focus
  dust.rotation.y = time * 0.008;
  dust.position.y = Math.sin(time * 0.1) * 0.12;
  bokeh.uniforms['focus'].value = camera.position.distanceTo(entering ? enterLookAt : lookNow);

  // steer the god-rays from the screen's current screen-space position
  const sp = SCREEN_CENTER.clone().project(camera);
  godrays.uniforms.uLightPos.value.set(sp.x * 0.5 + 0.5, sp.y * 0.5 + 0.5);

  composer.render();
  // once the room + the screen's renderer have a few frames up, reveal the page
  if (loadingEl && ++bootFrames === 14) loadingEl.classList.add('done');
}
animate();

// ---- raycaster: main screen or poster → intro fly-in → that deck's URL -----
// Backward compat: clicks that miss all clickables (walls, floor, model, empty
// space) still enter the DEFAULT deck (deck-studio-keynote) — matches the prior
// "click anywhere to enter" UX. Poster clicks mutate targetDeckHref so the same
// push-in intro lands on that hero deck instead of the studio keynote.
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const clickables = [screen];

function pickDeckId(event) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(clickables, false);
  return hits.length > 0 ? hits[0].object.userData.deckId || DEFAULT_DECK_ID : DEFAULT_DECK_ID;
}

function enter(deckId) {
  if (state !== 'room') return;
  targetDeckHref = deckUrl(deckId || DEFAULT_DECK_ID);
  state = 'entering';
  document.body.classList.add('entering'); // hide the room UI during the 片头
}

canvas.addEventListener('click', (event) => enter(pickDeckId(event)));
document
  .querySelectorAll('[data-enter]')
  .forEach((el) => el.addEventListener('click', () => enter(DEFAULT_DECK_ID)));

// hover cursor: pointer when over a clickable poster or the main screen
canvas.addEventListener('mousemove', (event) => {
  if (state !== 'room') return;
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(clickables, false);
  document.body.style.cursor = hits.length > 0 ? 'pointer' : '';
});

window.addEventListener('resize', () => {
  camera.aspect = W() / H();
  camera.updateProjectionMatrix();
  renderer.setSize(W(), H());
  composer.setSize(W(), H());
});
