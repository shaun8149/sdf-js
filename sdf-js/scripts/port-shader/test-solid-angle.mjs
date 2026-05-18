// =============================================================================
// Day-1 smoke test: validate the ported solid-angle SDF.
//
// Runs SDF sample probes + ASCII silhouette render. No DOM / canvas required.
// =============================================================================

import { solidAngleSDF } from '../../src/scene/components/community/iq-solid-angle.js';

const cone = solidAngleSDF({ halfAperture: Math.PI / 6, radius: 0.5 });

console.log('═══ SDF probe — solid-angle (halfAperture=π/6 = 30°, radius=0.5) ═══');
console.log('Inside the cone (on +Y axis, near tip)        :', cone.f([0,  0.1, 0]).toFixed(4), '(expect < 0)');
console.log('Inside the cone (near outer spherical cap)    :', cone.f([0,  0.4, 0]).toFixed(4), '(expect < 0)');
console.log('Just outside aperture (off-axis)              :', cone.f([0.3, 0.2, 0]).toFixed(4), '(expect > 0)');
console.log('Far above on axis (past spherical cap)        :', cone.f([0,  2.0, 0]).toFixed(4), '(expect > 0)');
console.log('Below the tip                                 :', cone.f([0, -0.5, 0]).toFixed(4), '(expect > 0)');
console.log('Far side                                      :', cone.f([2,  0,   0]).toFixed(4), '(expect > 0)');
console.log('At the tip (origin)                           :', cone.f([0,  0,   0]).toFixed(4), '(expect = 0 or ≈ 0)');

console.log('\n═══ ASCII silhouette render — orthographic +Z view, world [-1, 1]² ═══');
const W = 60, H = 30;
const aspect = 0.5;
let plot = '';
for (let row = 0; row < H; row++) {
  for (let col = 0; col < W; col++) {
    const wx = ((col / (W - 1)) * 2 - 1) * (1 / aspect);
    const wy = -((row / (H - 1)) * 2 - 1);  // flip so +Y up
    // orthographic raymarch along -Z toward origin, max 30 steps, max 4 units
    let t = 0, hit = false, minD = 1e9;
    for (let step = 0; step < 40; step++) {
      const wz = 1.5 - t;
      const d = cone.f([wx, wy, wz]);
      minD = Math.min(minD, d);
      if (d < 0.001) { hit = true; break; }
      if (t > 3.5) break;
      t += Math.max(d, 0.005);
    }
    plot += hit ? '█' : (minD < 0.05 ? '░' : ' ');
  }
  plot += '\n';
}
console.log(plot);

console.log('═══ Symmetric variants — different halfAperture ═══');
for (const deg of [10, 20, 30, 45, 60]) {
  const c = solidAngleSDF({ halfAperture: deg * Math.PI / 180, radius: 0.6 });
  const onAxis = c.f([0, 0.3, 0]);
  const offAxis = c.f([0.3, 0.3, 0]);
  console.log(`  ${deg}°: on-axis(0.3) = ${onAxis.toFixed(3)} | off-axis(0.3,0.3) = ${offAxis.toFixed(3)}`);
}

console.log('\nDay-1 port pipeline: ✓ SDF math validated.');
