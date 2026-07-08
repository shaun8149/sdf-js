// bake-decor-freeze.mjs — Sprint 59: the FREEZE instrument.
// Records a digest of every v1 family's draw-ops stream (family × seed ×
// personality) into decor-freeze-v1.json. test-decor.mjs replays these and
// asserts byte-identity — turning the DECOR_V freeze discipline from a
// comment into a CI invariant. Regenerate ONLY when a new family is added
// (new keys); changing an existing digest is by definition a freeze break.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { DECOR_FAMILIES, drawDecor } from '../src/present/decor/registry.js';

const here = dirname(fileURLToPath(import.meta.url));

export function opsDigest(ops) {
  const str = JSON.stringify(ops);
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = ((h ^ str.charCodeAt(i)) * 16777619) | 0;
  return (h >>> 0).toString(16);
}

export function digestCtx() {
  const rec = { ops: [] };
  const push =
    (name) =>
    (...a) =>
      rec.ops.push([
        name,
        ...a.map((v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : String(v))),
      ]);
  const ctx = new Proxy(
    {},
    {
      get: (t, k) => {
        if (k === '__rec') return rec;
        if (k === 'measureText') return () => ({ width: 40 });
        if (k === 'createLinearGradient' || k === 'createRadialGradient')
          return (...a) => {
            push(String(k))(...a);
            return { addColorStop: (o, c) => push('addColorStop')(o, c) };
          };
        return push(String(k));
      },
      set: (t, k, v) => {
        rec.ops.push(['set', String(k), String(v)]);
        return true;
      },
    },
  );
  return ctx;
}

export const FREEZE_PALETTE = {
  accent: [38, 70, 130],
  colors: [
    [200, 60, 60],
    [60, 160, 120],
    [220, 170, 60],
  ],
  bg: [248, 246, 240],
};

export function bakeFreezeMap() {
  const map = {};
  for (const family of Object.keys(DECOR_FAMILIES)) {
    for (const seed of [7, 4242]) {
      for (const personality of ['balanced', 'wild']) {
        const ctx = digestCtx();
        drawDecor(
          ctx,
          { family, seed, personality, v: 1 },
          { palette: FREEZE_PALETTE, x: 0, y: 0, w: 640, h: 360, intensity: 'subtle' },
        );
        map[`${family}|${seed}|${personality}`] = opsDigest(ctx.__rec.ops);
      }
    }
  }
  return map;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const map = bakeFreezeMap();
  const out = join(here, 'decor-freeze-v1.json');
  writeFileSync(out, JSON.stringify(map, null, 1));
  console.log(`baked ${Object.keys(map).length} v1 digests → ${out}`);
}
