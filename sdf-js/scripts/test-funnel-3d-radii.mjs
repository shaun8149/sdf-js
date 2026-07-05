// sdf-js/scripts/test-funnel-3d-radii.mjs
import { funnel3dSDF } from '../src/scene/components/charts/data/funnel-3d.js';

let pass = 0,
  fail = 0;
const ok = (c, n) => (c ? (pass++, console.log(`  ✓ ${n}`)) : (fail++, console.log(`  ✗ ${n}`)));
console.log('=== funnel-3d radii ===\n');

// no radii → still builds (linear taper path unchanged)
ok(funnel3dSDF({ stages: 4 }) != null, 'linear taper path still builds');

// radii given → builds
const sdf = funnel3dSDF({ stages: 3, radii: [1.4, 1.2, 0.5, 0.1], stageHeight: 0.4, gap: 0.06 });
ok(sdf != null, 'radii path builds');

// radii actually drives geometry. totalH = 3*0.4 + 2*0.06 = 1.32; stage 0 spans
// y 0.66→0.26, centre y=0.46 where the radii cone is (1.4+1.2)/2 = 1.3 wide. The
// default linear taper (0.95→0.22 over 3 stages) is ~0.83 at the same point. So a
// probe at x=1.1 is INSIDE with radii, OUTSIDE with the default taper.
const noRadii = funnel3dSDF({ stages: 3, stageHeight: 0.4, gap: 0.06 });
const probe = [1.1, 0.46, 0];
ok(sdf.f(probe) < 0, 'radii widen the top stage (probe inside)');
ok(noRadii.f(probe) > 0, 'default taper is narrower at the same probe (outside)');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
