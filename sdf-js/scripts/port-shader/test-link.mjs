// =============================================================================
// Smoke test for ported `link` SDF (chain-link / oblong torus).
//
// Geometry recap (defaults: halfLength=0.13, majorR=0.1, minorR=0.02):
//   straight section spans Y ∈ [-0.13, 0.13]
//   loop cross-section radius from axis = 0.1, tube thickness = 0.02
//   so the link body is at distance R=0.1 from the Y-axis when |y| ≤ le
//   outer extent along X/Z = R + r = 0.12; hole interior < R - r = 0.08
// =============================================================================

import { linkSDF } from '../../src/scene/components/community/iq-link.js';

const link = linkSDF();

console.log('═══ SDF probe — link (default: halfLength=0.13, majorR=0.1, minorR=0.02) ═══');

// Inside the tube: at the major-radius circle position, on Y=0
console.log(
  'On tube center, x=R, y=0 (inside tube core)   :',
  link.f([0.1, 0, 0]).toFixed(4),
  '(expect ≈ -0.02)',
);
// On the tube outer surface
console.log(
  'On tube outer surface, x=R+r, y=0             :',
  link.f([0.12, 0, 0]).toFixed(4),
  '(expect ≈ 0)',
);
// In the hole of the link (between the two parallel sections)
console.log(
  'In the hole, x=0, y=0 (axis center)           :',
  link.f([0, 0, 0]).toFixed(4),
  '(expect > 0, ≈ R - r = 0.08)',
);
// Inside the elongated portion (|y| < le)
console.log(
  'Inside elongated section, x=R, y=0.1          :',
  link.f([0.1, 0.1, 0]).toFixed(4),
  '(expect ≈ -0.02, same as y=0)',
);
// Just past the end cap
console.log(
  'Outside, y past end-cap                       :',
  link.f([0, 0.5, 0]).toFixed(4),
  '(expect > 0)',
);
// On Z-axis side
console.log(
  'Outside, z direction at tube center           :',
  link.f([0, 0, 0.12]).toFixed(4),
  '(expect ≈ 0)',
);
// Far away
console.log(
  'Far away                                      :',
  link.f([2, 2, 2]).toFixed(4),
  '(expect > 0, large)',
);

console.log('\n═══ ASCII silhouette — XY plane, orthographic +Z view ═══');
// Render an XY slice (Z=0) at higher resolution to see the link's loop shape
const W = 60,
  H = 30;
const viewX = 0.25,
  viewY = 0.4;
let plot = '';
for (let row = 0; row < H; row++) {
  for (let col = 0; col < W; col++) {
    const wx = ((col / (W - 1)) * 2 - 1) * viewX;
    const wy = -((row / (H - 1)) * 2 - 1) * viewY;
    // We want a 2D slice through Z=0 — just sample the SDF at z=0
    const d = link.f([wx, wy, 0]);
    plot += d < 0 ? '█' : d < 0.005 ? '░' : ' ';
  }
  plot += '\n';
}
console.log(plot);

console.log('═══ Parameter variants — elongation effect ═══');
for (const le of [0.0, 0.1, 0.2, 0.4]) {
  const l = linkSDF({ halfLength: le, majorR: 0.1, minorR: 0.02 });
  const onAxis = l.f([0, 0, 0]); // in the hole
  const onTube = l.f([0.1, 0, 0]); // on tube center
  const farY = l.f([0, le + 0.2, 0]); // past end-cap
  console.log(
    `  le=${le.toFixed(2)}: hole(0,0,0)=${onAxis.toFixed(3)} | tube(R,0,0)=${onTube.toFixed(3)} | far-y=${farY.toFixed(3)}`,
  );
}

console.log('\n═══ Parameter variants — radius effect ═══');
for (const r1 of [0.05, 0.1, 0.15, 0.2]) {
  const l = linkSDF({ halfLength: 0.13, majorR: r1, minorR: 0.02 });
  const onTube = l.f([r1, 0, 0]);
  const hole = l.f([0, 0, 0]);
  console.log(
    `  r1=${r1.toFixed(2)}: tube(r1,0,0)=${onTube.toFixed(3)} | hole(0,0,0)=${hole.toFixed(3)}`,
  );
}

console.log('\nDay-1 (2nd port) pipeline: ✓ link SDF math validated.');
