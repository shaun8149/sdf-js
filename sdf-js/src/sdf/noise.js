// =============================================================================
// noise.js — procedural noise toolkit with analytic derivatives (IQ articles).
// -----------------------------------------------------------------------------
// Wave 2 of the IQ-shader program. Recipe-only ports of Inigo Quilez:
//   value noise + derivatives    https://iquilezles.org/articles/morenoise/
//   gradient noise + derivatives https://iquilezles.org/articles/gradientnoise/
//   fbm (+ derivatives)          https://iquilezles.org/articles/fbm/
//   domain warping               https://iquilezles.org/articles/warp/
//   voronoise                    https://iquilezles.org/articles/voronoise/
//   smooth voronoi               https://iquilezles.org/articles/smoothvoronoi/
//   voronoi edges                https://iquilezles.org/articles/voronoilines/
//
// JS (CPU/testable) + a GLSL mirror string (NOISE_GLSL). The GLSL hashes use
// private names (nh21/nh31/nh22) so the library can co-exist with the older
// noise.glsl.js (which defines hash21/31/22) without redefinition errors.
//
// Quintic interpolation (6t⁵−15t⁴+10t³) is used everywhere so the analytic
// derivatives are themselves smooth — tested against central finite differences.
//
// License: PolyForm Noncommercial 1.0.0 (Atlas reimplementation).
// =============================================================================

const fract = (x) => x - Math.floor(x);
const smoothstep = (e0, e1, x) => {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// ---- Hashes (Hoskins "Hash without Sine", deterministic, [0,1]) -------------

function hash21(x, y) {
  let px = fract(x * 0.1031),
    py = fract(y * 0.1031),
    pz = fract(x * 0.1031);
  const d = px * (py + 33.33) + py * (pz + 33.33) + pz * (px + 33.33);
  px += d;
  py += d;
  pz += d;
  return fract((px + py) * pz);
}

function hash31(x, y, z) {
  let px = fract(x * 0.1031),
    py = fract(y * 0.1031),
    pz = fract(z * 0.1031);
  const d = px * (pz + 31.32) + py * (py + 31.32) + pz * (px + 31.32);
  px += d;
  py += d;
  pz += d;
  return fract((px + py) * pz);
}

function hash22(x, y) {
  let px = fract(x * 0.1031),
    py = fract(y * 0.103),
    pz = fract(x * 0.0973);
  const d = px * (py + 33.33) + py * (pz + 33.33) + pz * (px + 33.33);
  px += d;
  py += d;
  pz += d;
  return [fract((px + py) * pz), fract((px + pz) * py)];
}

// Gradient vector in [-1,1]² for a lattice corner.
function grad22(x, y) {
  const h = hash22(x, y);
  return [-1 + 2 * h[0], -1 + 2 * h[1]];
}

// ---- Value noise + derivatives ----------------------------------------------

/** Value noise in [0,1] with analytic gradient → [value, d/dx, d/dy]. */
export function valueNoiseD2(x, y) {
  const ix = Math.floor(x),
    iy = Math.floor(y);
  const fx = x - ix,
    fy = y - iy;
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const dux = 30 * fx * fx * (fx * (fx - 2) + 1);
  const duy = 30 * fy * fy * (fy * (fy - 2) + 1);
  const a = hash21(ix, iy);
  const b = hash21(ix + 1, iy);
  const c = hash21(ix, iy + 1);
  const d = hash21(ix + 1, iy + 1);
  const k0 = a,
    k1 = b - a,
    k2 = c - a,
    k3 = a - b - c + d;
  const v = k0 + k1 * ux + k2 * uy + k3 * ux * uy;
  return [v, dux * (k1 + k3 * uy), duy * (k2 + k3 * ux)];
}

/** Value noise in [0,1] with analytic gradient → [value, d/dx, d/dy, d/dz]. */
export function valueNoiseD3(x, y, z) {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    iz = Math.floor(z);
  const fx = x - ix,
    fy = y - iy,
    fz = z - iz;
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const uz = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
  const dux = 30 * fx * fx * (fx * (fx - 2) + 1);
  const duy = 30 * fy * fy * (fy * (fy - 2) + 1);
  const duz = 30 * fz * fz * (fz * (fz - 2) + 1);
  const a = hash31(ix, iy, iz);
  const b = hash31(ix + 1, iy, iz);
  const c = hash31(ix, iy + 1, iz);
  const d = hash31(ix + 1, iy + 1, iz);
  const e = hash31(ix, iy, iz + 1);
  const f = hash31(ix + 1, iy, iz + 1);
  const g = hash31(ix, iy + 1, iz + 1);
  const h = hash31(ix + 1, iy + 1, iz + 1);
  const k0 = a;
  const k1 = b - a,
    k2 = c - a,
    k3 = e - a;
  const k4 = a - b - c + d,
    k5 = a - c - e + g,
    k6 = a - b - e + f;
  const k7 = -a + b + c - d + e - f - g + h;
  const v =
    k0 +
    k1 * ux +
    k2 * uy +
    k3 * uz +
    k4 * ux * uy +
    k5 * uy * uz +
    k6 * uz * ux +
    k7 * ux * uy * uz;
  return [
    v,
    dux * (k1 + k4 * uy + k6 * uz + k7 * uy * uz),
    duy * (k2 + k5 * uz + k4 * ux + k7 * uz * ux),
    duz * (k3 + k6 * ux + k5 * uy + k7 * ux * uy),
  ];
}

/** Plain value noise (value channel only). */
export const valueNoise2 = (x, y) => valueNoiseD2(x, y)[0];
export const valueNoise3 = (x, y, z) => valueNoiseD3(x, y, z)[0];

// ---- Gradient (Perlin-style) noise + derivatives ----------------------------

/** Signed gradient noise ~[-1,1] with analytic gradient → [value, d/dx, d/dy]. */
export function gradientNoiseD2(x, y) {
  const ix = Math.floor(x),
    iy = Math.floor(y);
  const fx = x - ix,
    fy = y - iy;
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const dux = 30 * fx * fx * (fx * (fx - 2) + 1);
  const duy = 30 * fy * fy * (fy * (fy - 2) + 1);
  const ga = grad22(ix, iy);
  const gb = grad22(ix + 1, iy);
  const gc = grad22(ix, iy + 1);
  const gd = grad22(ix + 1, iy + 1);
  const va = ga[0] * fx + ga[1] * fy;
  const vb = gb[0] * (fx - 1) + gb[1] * fy;
  const vc = gc[0] * fx + gc[1] * (fy - 1);
  const vd = gd[0] * (fx - 1) + gd[1] * (fy - 1);
  const m = va - vb - vc + vd;
  const v = va + ux * (vb - va) + uy * (vc - va) + ux * uy * m;
  const dx =
    ga[0] +
    ux * (gb[0] - ga[0]) +
    uy * (gc[0] - ga[0]) +
    ux * uy * (ga[0] - gb[0] - gc[0] + gd[0]) +
    dux * (uy * m + (vb - va));
  const dy =
    ga[1] +
    ux * (gb[1] - ga[1]) +
    uy * (gc[1] - ga[1]) +
    ux * uy * (ga[1] - gb[1] - gc[1] + gd[1]) +
    duy * (ux * m + (vc - va));
  return [v, dx, dy];
}

// ---- fbm with derivatives ---------------------------------------------------

/** fbm of gradient noise, accumulating value (→ ~[0,1]) + gradient. */
export function fbmD2(x, y, octaves = 5) {
  let amp = 0.5,
    freq = 1.0,
    v = 0,
    dx = 0,
    dy = 0;
  for (let i = 0; i < octaves; i++) {
    const n = gradientNoiseD2(x * freq, y * freq); // signed
    v += amp * 0.5 * (n[0] + 1.0);
    dx += amp * 0.5 * n[1] * freq;
    dy += amp * 0.5 * n[2] * freq;
    amp *= 0.5;
    freq *= 2.0;
  }
  return [v, dx, dy];
}

// ---- Domain warping ---------------------------------------------------------

function fbmVal2(x, y) {
  let v = 0,
    amp = 0.5,
    freq = 1;
  for (let i = 0; i < 4; i++) {
    v += amp * valueNoise2(x * freq, y * freq);
    amp *= 0.5;
    freq *= 2;
  }
  return v;
}

/** IQ domain warp: fbm(p + 4·fbm(p + 4·fbm(p))) — organic marble/cloud field [0,1]. */
export function domainWarp2(x, y) {
  const qx = fbmVal2(x, y);
  const qy = fbmVal2(x + 5.2, y + 1.3);
  const rx = fbmVal2(x + 4 * qx + 1.7, y + 4 * qy + 9.2);
  const ry = fbmVal2(x + 4 * qx + 8.3, y + 4 * qy + 2.8);
  return fbmVal2(x + 4 * rx, y + 4 * ry);
}

// ---- Voronoise / smooth voronoi / voronoi edges -----------------------------

function hash3of2(x, y) {
  return [hash21(x, y), hash21(x + 19.1, y + 7.3), hash21(x + 3.7, y + 23.9)];
}

/** IQ voronoise: u blends cell↔grid position, v blends value↔cell weighting. [0,1]. */
export function voronoise2(x, y, u, v) {
  const k = 1 + 63 * Math.pow(1 - v, 4);
  const ix = Math.floor(x),
    iy = Math.floor(y);
  const fx = x - ix,
    fy = y - iy;
  let sum = 0,
    wsum = 0;
  for (let gy = -2; gy <= 2; gy++) {
    for (let gx = -2; gx <= 2; gx++) {
      const o = hash3of2(ix + gx, iy + gy);
      const dx = gx - fx + o[0] * u;
      const dy = gy - fy + o[1] * u;
      const len = Math.sqrt(dx * dx + dy * dy);
      const w = Math.pow(1 - smoothstep(0, 1.414, len), k);
      sum += o[2] * w;
      wsum += w;
    }
  }
  return sum / Math.max(wsum, 1e-6);
}

/** IQ smooth voronoi: exponential smooth-min over cell distances (continuous). */
export function voronoiSmooth2(x, y, falloff = 8) {
  const ix = Math.floor(x),
    iy = Math.floor(y);
  const fx = x - ix,
    fy = y - iy;
  let res = 0;
  for (let gy = -2; gy <= 2; gy++) {
    for (let gx = -2; gx <= 2; gx++) {
      const o = hash22(ix + gx, iy + gy);
      const rx = gx - fx + o[0];
      const ry = gy - fy + o[1];
      res += Math.exp(-falloff * (rx * rx + ry * ry));
    }
  }
  return Math.max(0, -(1 / falloff) * Math.log(res));
}

/** IQ voronoi edges (two-pass): → [F1 cell distance, distance to nearest border]. */
export function voronoiEdges2(x, y) {
  const nx = Math.floor(x),
    ny = Math.floor(y);
  const fx = x - nx,
    fy = y - ny;
  let mgx = 0,
    mgy = 0,
    mrx = 0,
    mry = 0,
    md = 8.0;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const o = hash22(nx + i, ny + j);
      const rx = i + o[0] - fx;
      const ry = j + o[1] - fy;
      const d = rx * rx + ry * ry;
      if (d < md) {
        md = d;
        mrx = rx;
        mry = ry;
        mgx = i;
        mgy = j;
      }
    }
  }
  const cellF1 = Math.sqrt(md);
  let edge = 8.0;
  for (let j = -2; j <= 2; j++) {
    for (let i = -2; i <= 2; i++) {
      const gx = mgx + i,
        gy = mgy + j;
      const o = hash22(nx + gx, ny + gy);
      const rx = gx + o[0] - fx;
      const ry = gy + o[1] - fy;
      const dfx = mrx - rx,
        dfy = mry - ry;
      if (dfx * dfx + dfy * dfy > 1e-5) {
        const mx = 0.5 * (mrx + rx),
          my = 0.5 * (mry + ry);
        let nvx = rx - mrx,
          nvy = ry - mry;
        const ln = Math.sqrt(nvx * nvx + nvy * nvy);
        nvx /= ln;
        nvy /= ln;
        edge = Math.min(edge, mx * nvx + my * nvy);
      }
    }
  }
  return [cellF1, Math.max(0, edge)];
}

// -----------------------------------------------------------------------------
// GLSL mirror. Private hashes (nh*) avoid clashing with the older noise.glsl.js.
// -----------------------------------------------------------------------------
export const NOISE_GLSL = /* glsl */ `
float nh21(vec2 p){ vec3 p3=fract(p.xyx*0.1031); p3+=dot(p3,p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float nh31(vec3 pin){ vec3 p3=fract(pin*0.1031); p3+=dot(p3,p3.zyx+31.32); return fract((p3.x+p3.y)*p3.z); }
vec2 nh22(vec2 p){ vec3 p3=fract(p.xyx*vec3(0.1031,0.1030,0.0973)); p3+=dot(p3,p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
vec2 ngrad22(vec2 p){ return -1.0 + 2.0*nh22(p); }

vec3 valueNoiseD2(vec2 x){
  vec2 i=floor(x), f=fract(x);
  vec2 u=f*f*f*(f*(f*6.0-15.0)+10.0);
  vec2 du=30.0*f*f*(f*(f-2.0)+1.0);
  float a=nh21(i), b=nh21(i+vec2(1,0)), c=nh21(i+vec2(0,1)), d=nh21(i+vec2(1,1));
  float k0=a, k1=b-a, k2=c-a, k3=a-b-c+d;
  float v=k0+k1*u.x+k2*u.y+k3*u.x*u.y;
  return vec3(v, du.x*(k1+k3*u.y), du.y*(k2+k3*u.x));
}
vec4 valueNoiseD3(vec3 x){
  vec3 i=floor(x), f=fract(x);
  vec3 u=f*f*f*(f*(f*6.0-15.0)+10.0);
  vec3 du=30.0*f*f*(f*(f-2.0)+1.0);
  float a=nh31(i+vec3(0,0,0)), b=nh31(i+vec3(1,0,0)), c=nh31(i+vec3(0,1,0)), d=nh31(i+vec3(1,1,0));
  float e=nh31(i+vec3(0,0,1)), g=nh31(i+vec3(1,0,1)), h=nh31(i+vec3(0,1,1)), j=nh31(i+vec3(1,1,1));
  float k0=a, k1=b-a, k2=c-a, k3=e-a;
  float k4=a-b-c+d, k5=a-c-e+h, k6=a-b-e+g;
  float k7=-a+b+c-d+e-g-h+j;
  float v=k0+k1*u.x+k2*u.y+k3*u.z+k4*u.x*u.y+k5*u.y*u.z+k6*u.z*u.x+k7*u.x*u.y*u.z;
  return vec4(v,
    du.x*(k1+k4*u.y+k6*u.z+k7*u.y*u.z),
    du.y*(k2+k5*u.z+k4*u.x+k7*u.z*u.x),
    du.z*(k3+k6*u.x+k5*u.y+k7*u.x*u.y));
}
vec3 gradientNoiseD2(vec2 x){
  vec2 i=floor(x), f=fract(x);
  vec2 u=f*f*f*(f*(f*6.0-15.0)+10.0);
  vec2 du=30.0*f*f*(f*(f-2.0)+1.0);
  vec2 ga=ngrad22(i), gb=ngrad22(i+vec2(1,0)), gc=ngrad22(i+vec2(0,1)), gd=ngrad22(i+vec2(1,1));
  float va=dot(ga, f-vec2(0,0));
  float vb=dot(gb, f-vec2(1,0));
  float vc=dot(gc, f-vec2(0,1));
  float vd=dot(gd, f-vec2(1,1));
  float m=va-vb-vc+vd;
  float v=va+u.x*(vb-va)+u.y*(vc-va)+u.x*u.y*m;
  vec2 dv=ga+u.x*(gb-ga)+u.y*(gc-ga)+u.x*u.y*(ga-gb-gc+gd)
         +du*(vec2(u.y,u.x)*m + vec2(vb,vc) - va);
  return vec3(v, dv);
}
vec3 fbmD2(vec2 x, int octaves){
  float amp=0.5, freq=1.0, v=0.0; vec2 d=vec2(0.0);
  for(int i=0;i<12;i++){
    if(i>=octaves) break;
    vec3 n=gradientNoiseD2(x*freq);
    v += amp*0.5*(n.x+1.0);
    d += amp*0.5*n.yz*freq;
    amp*=0.5; freq*=2.0;
  }
  return vec3(v, d);
}
float nfbmVal2(vec2 x){
  float v=0.0, amp=0.5, freq=1.0;
  for(int i=0;i<4;i++){ v+=amp*valueNoiseD2(x*freq).x; amp*=0.5; freq*=2.0; }
  return v;
}
float domainWarp2(vec2 p){
  vec2 q=vec2(nfbmVal2(p), nfbmVal2(p+vec2(5.2,1.3)));
  vec2 r=vec2(nfbmVal2(p+4.0*q+vec2(1.7,9.2)), nfbmVal2(p+4.0*q+vec2(8.3,2.8)));
  return nfbmVal2(p+4.0*r);
}
vec3 nh3of2(vec2 p){ return vec3(nh21(p), nh21(p+vec2(19.1,7.3)), nh21(p+vec2(3.7,23.9))); }
float voronoise2(vec2 x, float u, float v){
  float k=1.0+63.0*pow(1.0-v,4.0);
  vec2 i=floor(x), f=fract(x);
  float sum=0.0, wsum=0.0;
  for(int gy=-2;gy<=2;gy++) for(int gx=-2;gx<=2;gx++){
    vec2 g=vec2(float(gx),float(gy));
    vec3 o=nh3of2(i+g);
    vec2 d=g-f+o.xy*u;
    float w=pow(1.0-smoothstep(0.0,1.414,length(d)), k);
    sum+=o.z*w; wsum+=w;
  }
  return sum/max(wsum,1e-6);
}
float voronoiSmooth2(vec2 x, float falloff){
  vec2 i=floor(x), f=fract(x);
  float res=0.0;
  for(int gy=-2;gy<=2;gy++) for(int gx=-2;gx<=2;gx++){
    vec2 g=vec2(float(gx),float(gy));
    vec2 r=g-f+nh22(i+g);
    res+=exp(-falloff*dot(r,r));
  }
  return max(0.0, -(1.0/falloff)*log(res));
}
vec2 voronoiEdges2(vec2 x){
  vec2 n=floor(x), f=fract(x);
  vec2 mg=vec2(0.0), mr=vec2(0.0); float md=8.0;
  for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){
    vec2 g=vec2(float(i),float(j));
    vec2 r=g+nh22(n+g)-f;
    float d=dot(r,r);
    if(d<md){ md=d; mr=r; mg=g; }
  }
  float cellF1=sqrt(md);
  float edge=8.0;
  for(int j=-2;j<=2;j++) for(int i=-2;i<=2;i++){
    vec2 g=mg+vec2(float(i),float(j));
    vec2 r=g+nh22(n+g)-f;
    vec2 df=mr-r;
    if(dot(df,df)>1e-5){
      edge=min(edge, dot(0.5*(mr+r), normalize(r-mr)));
    }
  }
  return vec2(cellF1, max(0.0,edge));
}
`;
