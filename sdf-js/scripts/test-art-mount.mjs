// test-art-mount.mjs — authentic-art mount render-option guardrails
import { artMountOpts } from '../src/present/art-mount.js';

let passed = 0;
let failed = 0;
function ok(cond, msg) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.log(`  ✗ ${msg}`);
  }
}

const cover = { width: 10, height: 10 };
const strip = [
  { id: 'a', width: 4, height: 4 },
  { id: 'b', width: 4, height: 4 },
  { id: 'c', width: 4, height: 4 },
];
const mount = { id: 'mint', name: 'Mint', cover, strip };

// 1. no cover/banner atom means the renderer has nowhere to paint mount art;
//    returning null preserves the normal subtle decor layer.
{
  const slot = {
    slotIdx: 0,
    sceneData: { subjects: [{ type: 'kpi-card', x: 40, y: 160, w: 360, h: 160 }] },
  };
  ok(artMountOpts(mount, slot, 'content') === null, 'mount does not suppress decor on no-cover slides');
}

// 2. content slides with a banner cover atom get promoted to section banners.
{
  const slot = {
    slotIdx: 1,
    sceneData: {
      subjects: [
        { type: 'cover', x: 0, y: 0, w: 1280, h: 120 },
        { type: 'bullet-list', x: 80, y: 180, w: 640, h: 300 },
      ],
    },
  };
  const opts = artMountOpts(mount, slot, 'content');
  ok(opts?.decorRole === 'section', 'content banner slides are promoted to section art role');
  ok(opts?.decorArt === cover, 'cover artwork is passed through');
  ok(opts?.decorArtStrip?.[0] === strip[1], 'strip rotates by slotIdx');
}

// 3. pure cover slides keep their cover role for full-bleed artwork.
{
  const slot = {
    slotIdx: 0,
    sceneData: { subjects: [{ type: 'cover', x: 0, y: 0, w: 1280, h: 720 }] },
  };
  const opts = artMountOpts(mount, slot, 'cover');
  ok(opts?.decorRole === 'cover', 'pure cover slides keep cover role');
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
