#!/usr/bin/env node
// =============================================================================
// gen-graphics-products.mjs — the FEW PresentationLoad "Graphics" products that
// are genuinely 3D-geometric (the rest of that category is flat infographics /
// illustration / layouts — the vector/diffusion domain, not Atlas's geometric
// SDF wheelhouse). Dark dramatic studio covers from primitives.
//   - Isometric City     → skyline grid of box "buildings" (varying heights)
//   - Mountain Path       → cone peaks + summit flag
//   - Isometric Business  → cluster of iso business objects (box/cube/cyl/sphere)
//
// Usage: node sdf-js/scripts/gen-graphics-products.mjs
// =============================================================================

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '../examples/compositor/demo-lifts');

const M = {
  grey: { hue: 0.6, sat: 0.05, value: 0.42, metal: 0.45, glow: 0 },
  slate: { hue: 0.6, sat: 0.14, value: 0.5, metal: 0.3, glow: 0 },
  blue: { hue: 0.58, sat: 0.85, value: 0.75, metal: 0.3, glow: 0 },
  teal: { hue: 0.5, sat: 0.72, value: 0.7, metal: 0.28, glow: 0 },
  orange: { hue: 0.07, sat: 0.88, value: 0.85, metal: 0.25, glow: 0 },
  green: { hue: 0.33, sat: 0.78, value: 0.6, metal: 0.2, glow: 0 },
  red: { hue: 0.0, sat: 0.82, value: 0.65, metal: 0.2, glow: 0.1 },
  white: { hue: 0.6, sat: 0.04, value: 0.9, metal: 0.2, glow: 0 },
};

const S = (type, args, translate, material, rotate) => ({
  type,
  args,
  transform: rotate ? { translate, rotate } : { translate },
  material,
});

// Skyline grid of box buildings, varying heights, sitting on the ground.
function skyline() {
  const heights = [1.6, 0.9, 1.3, 2.0, 1.1, 1.8, 0.8, 1.5, 1.9, 1.0, 1.4, 0.7];
  const cols = 4;
  const stride = 0.92;
  const out = [];
  heights.forEach((h, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const x = (c - (cols - 1) / 2) * stride;
    const z = (r - 1) * stride;
    const tall = h > 1.7;
    out.push(
      S('box', { size: [0.58, h, 0.58] }, [x, h / 2, z], tall ? M.blue : c % 2 ? M.teal : M.slate),
    );
  });
  return out;
}

const SCENES = {
  'graphics-isometric-city': {
    title: 'Isometric City · Skyline grid',
    cat: 'graphics',
    subjects: skyline(),
  },
  'graphics-mountain': {
    title: 'Mountain Path · Peaks + summit flag',
    cat: 'graphics',
    subjects: [
      S('cone', { height: 2.4, baseRadius: 1.2 }, [0, 1.2, 0], M.slate),
      S('cone', { height: 1.6, baseRadius: 0.85 }, [-1.7, 0.8, 0.4], M.grey),
      S('cone', { height: 1.9, baseRadius: 0.95 }, [1.5, 0.95, -0.2], M.grey),
      // snow caps (small white cones near the apexes)
      S('cone', { height: 0.55, baseRadius: 0.32 }, [0, 2.25, 0], M.white),
      S('cone', { height: 0.42, baseRadius: 0.24 }, [1.5, 1.78, -0.2], M.white),
      // summit flag: pole + pennant
      S('box', { size: [0.04, 0.5, 0.04] }, [0, 2.65, 0], M.grey),
      S('box', { size: [0.34, 0.2, 0.02] }, [0.17, 2.8, 0], M.red),
    ],
  },
  'graphics-isometric-business': {
    title: 'Isometric Business · Object cluster',
    cat: 'graphics',
    subjects: [
      S('box', { size: [0.75, 1.6, 0.75] }, [-1.2, 0.8, 0], M.blue),
      S('box', { size: [0.7, 0.7, 0.7] }, [0.2, 0.35, 0.3], M.teal),
      S('cylinder', { radius: 0.4, height: 1.1 }, [1.3, 0.55, -0.2], M.orange),
      S('sphere', { radius: 0.46 }, [0.35, 1.45, -0.4], M.green),
    ],
  },
};

// ---- build + write + register -----------------------------------------------
const indexPath = `${OUT_DIR}/index.json`;
const index = JSON.parse(readFileSync(indexPath, 'utf8'));
let wrote = 0;
for (const [id, def] of Object.entries(SCENES)) {
  const ys = def.subjects.map((s) => s.transform.translate[1]);
  const ty = ys.reduce((a, b) => a + b, 0) / ys.length;
  const entry = {
    id,
    title: def.title,
    prompt: `${def.cat}: ${def.title}`,
    code2d: `// vision-authored Graphics product cover (the 3D-geometric subset).`,
    sceneData: {
      v: 1,
      name: def.title,
      source: { format: 'vision-authored', prompt: `${def.cat} product` },
      subjects: def.subjects.map((s, i) => ({ id: `s${i}`, ...s })),
      defaults: {
        camera: {
          yaw: 0.5,
          pitch: 0.32,
          distance: 11,
          focal: 1.5,
          targetX: 0,
          targetY: ty,
          targetZ: 0,
        },
        light: { azimuth: 0.6, altitude: 0.55, distance: 25, intensity: 1.2 },
        shadow: { enabled: true, mode: 'darken', strength: 0.4 },
        studioBg: 'dark',
      },
    },
    meta: { generatedAt: '2026-06-21', model: 'vision-authored', pattern: def.cat, costUSD: 0 },
  };
  writeFileSync(`${OUT_DIR}/${id}.json`, JSON.stringify(entry, null, 2) + '\n');
  wrote++;
  if (!index.demos.some((d) => d.id === id)) {
    index.demos.push({
      id,
      title: def.title,
      thesisPoint: `Graphics category — the 3D-geometric subset (rest is flat illustration, out of Atlas scope).`,
      category: 'graphics-product',
      status: 'ready',
      file: `${id}.json`,
      renderer: 'studio',
      prompt: def.title,
    });
  }
}
writeFileSync(indexPath, JSON.stringify(index, null, 2) + '\n');
console.log(`wrote ${wrote} graphics-product scenes; index now ${index.demos.length} demos`);
