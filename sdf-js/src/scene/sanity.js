// =============================================================================
// scene/sanity.js — geometry sanity checker (Track 5.1, M5 prereq)
// -----------------------------------------------------------------------------
// LLM-emitted SceneData has recurring failure modes that compile() doesn't
// catch: huge XYZ typos (10 → 1000), absurd scales (radius=200), NaN/Inf
// from runaway arithmetic, duplicate ids that confuse motionSlots, camera
// pointing into empty space, sun underground. For 8 hand-curated demos this
// is manually editable; for M5 1→N variant expansion it's untenable —
// validator must catch them.
//
// Returns { errors, warnings, all }. compile() auto-runs and console.warns;
// caller can also invoke sanityCheck(scene, compiled) directly.
//
// 8 v1 rules — pick that maximize value × low false-positive:
//   1. large-position    (high)  any |translate[i]| > 200
//   2. large-or-tiny-arg (high/med)  args.dims/size/radius/etc > 50 or < 0.001
//   3. non-finite        (high)  NaN/Inf anywhere in args/transform
//   4. duplicate-id      (high)  same id used by two subjects
//   5. camera-target-out (med)   targetXYZ outside scene bbox + 50 margin
//   6. camera-inside     (med)   camera position falls inside a subject bbox
//   7. light-altitude    (low)   altitude outside [-π/2, π/2]
//   8. subject-count     (med/high)  top-level subjects.length > 50 warn / > 100 error
//      (Generator-S Phase 2: array/scatter with high count blows up perf;
//       50 = soft cap, 100 = hard cap. Run AFTER expandVariants.)
// =============================================================================

const SUBJECT_COUNT_WARN = 50;
const SUBJECT_COUNT_ERROR = 100;

// Large-arg whitelist (v3.15 — 6 cumulative false-positives drove this):
// runways, aprons, canyons, roads — infrastructure naturally extends 80-200m.
// LLM-emitted scenes with hand-built `runway` boxes or atom-emitted
// `terrain-canyon` primitives shouldn't trip rule 2.
const LARGE_ARG_ID_WHITELIST =
  /^(runway|apron|tarmac|road|highway|pier|quay|dock|stream|river|coastline|shoreline)(\b|[-_])/i;
const LARGE_ARG_TYPE_WHITELIST = new Set([
  'terrain-canyon',
  'terrain-heightmap',
  'terrain-elevated',
  'terrain-with-lakes',
  'terrain-eroded-rune',
  'procedural-city',
  'sea-surface',
  'waves',
  'stream-segment',
]);
const LARGE_ARG_RELAXED_THRESHOLD = 200; // whitelisted subjects: warn at >200
const LARGE_ARG_DEFAULT_THRESHOLD = 50; // everyone else: warn at >50

function isLargeArgWhitelisted(subj) {
  if (!subj || typeof subj !== 'object') return false;
  if (typeof subj.id === 'string' && LARGE_ARG_ID_WHITELIST.test(subj.id)) return true;
  if (typeof subj.type === 'string' && LARGE_ARG_TYPE_WHITELIST.has(subj.type)) return true;
  return false;
}

const HALF_PI = Math.PI / 2;

// ---------------------------------------------------------------------------
// Approximate per-subject bbox in WORLD space. Best effort across primitive
// types — unknown types fall back to a 1-unit cube around their translate.
// This is intentionally conservative: false bbox = false warning is worse
// than missing one.
// ---------------------------------------------------------------------------
function subjectBbox(subj) {
  const t = (subj.transform && subj.transform.translate) || [0, 0, 0];
  const a = subj.args || {};
  let halfX = 1,
    halfY = 1,
    halfZ = 1;

  if (Array.isArray(a.dims) && a.dims.length >= 3) {
    halfX = Math.abs(a.dims[0]) * 0.5;
    halfY = Math.abs(a.dims[1]) * 0.5;
    halfZ = Math.abs(a.dims[2]) * 0.5;
  } else if (Array.isArray(a.size) && a.size.length >= 3) {
    halfX = Math.abs(a.size[0]) * 0.5;
    halfY = Math.abs(a.size[1]) * 0.5;
    halfZ = Math.abs(a.size[2]) * 0.5;
  } else if (Array.isArray(a.boxSize) && a.boxSize.length >= 3) {
    halfX = Math.abs(a.boxSize[0]);
    halfY = Math.abs(a.boxSize[1]);
    halfZ = Math.abs(a.boxSize[2]);
  } else if (Array.isArray(a.a) && Array.isArray(a.b) && typeof a.radius === 'number') {
    // capsule: bbox covers a→b with radius padding
    // ORDER MATTERS: this check must precede the generic `a.radius` check
    // below, otherwise it's unreachable (caught by ESLint no-dupe-else-if
    // 2026-06-16).
    const r = a.radius;
    halfX = Math.max(Math.abs(a.a[0]), Math.abs(a.b[0])) + r;
    halfY = Math.max(Math.abs(a.a[1]), Math.abs(a.b[1])) + r;
    halfZ = Math.max(Math.abs(a.a[2]), Math.abs(a.b[2])) + r;
  } else if (typeof a.radius === 'number' && typeof a.height === 'number') {
    halfX = a.radius;
    halfY = a.height * 0.5;
    halfZ = a.radius;
  } else if (typeof a.radius === 'number') {
    halfX = halfY = halfZ = a.radius;
  }
  // Apply transform.scale (uniform or per-axis), if present
  const s = subj.transform && subj.transform.scale;
  if (typeof s === 'number') {
    halfX *= s;
    halfY *= s;
    halfZ *= s;
  } else if (Array.isArray(s) && s.length >= 3) {
    halfX *= Math.abs(s[0]);
    halfY *= Math.abs(s[1]);
    halfZ *= Math.abs(s[2]);
  }

  return {
    min: [t[0] - halfX, t[1] - halfY, t[2] - halfZ],
    max: [t[0] + halfX, t[1] + halfY, t[2] + halfZ],
  };
}

// Union bbox of all subjects (recursive over children + source).
function sceneBbox(subjects) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  function walk(subs) {
    for (const s of subs || []) {
      const b = subjectBbox(s);
      for (let i = 0; i < 3; i++) {
        if (Number.isFinite(b.min[i])) min[i] = Math.min(min[i], b.min[i]);
        if (Number.isFinite(b.max[i])) max[i] = Math.max(max[i], b.max[i]);
      }
      if (Array.isArray(s.children)) walk(s.children);
      if (s.source) walk([s.source]);
    }
  }
  walk(subjects);
  // Degenerate: no subjects → return zero box
  for (let i = 0; i < 3; i++) {
    if (!Number.isFinite(min[i])) min[i] = 0;
    if (!Number.isFinite(max[i])) max[i] = 0;
  }
  return { min, max };
}

// ---------------------------------------------------------------------------
// Rule 1: large position — any translate component > 200
// Rule 2: large/tiny args — primitive args way out of typical range
// Rule 3: non-finite — NaN/Inf anywhere in args/transform
// (Walked together to share the recursion.)
// ---------------------------------------------------------------------------
function walkSubjectChecks(subjects, issues) {
  function walk(subs, parentPath) {
    if (!Array.isArray(subs)) return;
    for (let i = 0; i < subs.length; i++) {
      const s = subs[i];
      const path = `${parentPath}[${i}]`;
      if (!s || typeof s !== 'object') continue;

      // Rule 1: large position
      const t = s.transform && s.transform.translate;
      if (Array.isArray(t)) {
        for (let k = 0; k < Math.min(3, t.length); k++) {
          if (typeof t[k] === 'number' && Math.abs(t[k]) > 200) {
            issues.push({
              path: `${path}.transform.translate[${k}]`,
              severity: 'high',
              rule: 'large-position',
              message: `subject "${s.id || s.type}" .translate[${'xyz'[k]}] = ${t[k].toFixed(2)} (|v| > 200 — likely typo, scenes typically fit in [-100, 100])`,
              suggestion: 'verify intent; clamp to ±100 if accidental',
            });
          }
        }
      }

      // Rule 2: large / tiny args. Walk args for common scalar fields.
      // v3.15: whitelist for runway/apron/canyon/terrain-* style large infra
      // subjects (6 cumulative pre-fix false-positives). Whitelisted subjects
      // get threshold 200; others stay 50.
      const largeThreshold = isLargeArgWhitelisted(s)
        ? LARGE_ARG_RELAXED_THRESHOLD
        : LARGE_ARG_DEFAULT_THRESHOLD;
      if (s.args && typeof s.args === 'object') {
        const scalarFields = [
          'radius',
          'height',
          'length',
          'width',
          'depth',
          'thickness',
          'r',
          'r1',
          'r2',
          'majorR',
          'minorR',
          'cornerR',
          'edgeR',
          'halfLen',
          'halfWidth',
          'halfLength',
          'amplitude',
          'frequency',
          'k',
          'amount',
        ];
        for (const f of scalarFields) {
          const v = s.args[f];
          if (typeof v === 'number') {
            if (v > largeThreshold) {
              issues.push({
                path: `${path}.args.${f}`,
                severity: 'high',
                rule: 'large-arg',
                message: `${s.type || s.id} .args.${f} = ${v.toFixed(2)} (> ${largeThreshold}; scale typo? typical objects fit in 1-30)`,
                suggestion:
                  'verify intent; values way above threshold usually indicate missed decimal point',
              });
            } else if (v > 0 && v < 0.001) {
              issues.push({
                path: `${path}.args.${f}`,
                severity: 'med',
                rule: 'tiny-arg',
                message: `${s.type || s.id} .args.${f} = ${v.toExponential(2)} (< 0.001; nearly invisible)`,
                suggestion: 'check if value should be larger',
              });
            }
          }
        }
        // Vector fields (dims, size, etc.)
        const vecFields = ['dims', 'size', 'boxSize', 'a', 'b', 'normal', 'point'];
        for (const f of vecFields) {
          const v = s.args[f];
          if (Array.isArray(v)) {
            for (let k = 0; k < v.length; k++) {
              if (typeof v[k] === 'number' && Math.abs(v[k]) > largeThreshold) {
                issues.push({
                  path: `${path}.args.${f}[${k}]`,
                  severity: 'high',
                  rule: 'large-arg',
                  message: `${s.type || s.id} .args.${f}[${k}] = ${v[k].toFixed(2)} (|v| > ${largeThreshold})`,
                  suggestion: 'verify intent',
                });
              }
            }
          }
        }
      }

      // Rule 3: non-finite (NaN/Inf) scan
      function scanFinite(val, where) {
        if (typeof val === 'number') {
          if (!Number.isFinite(val)) {
            issues.push({
              path: where,
              severity: 'high',
              rule: 'non-finite',
              message: `non-finite number (${val}) at ${where}`,
              suggestion:
                'check arithmetic / source expression for divide-by-zero or NaN propagation',
            });
          }
        } else if (Array.isArray(val)) {
          for (let k = 0; k < val.length; k++) scanFinite(val[k], `${where}[${k}]`);
        } else if (val && typeof val === 'object' && !val.kind /* skip enums */) {
          // Shallow: only args + transform (not material / pattern which are
          // strings or simple HSV objects — non-finite in those won't render
          // anyway and would clutter output).
        }
      }
      if (s.args) {
        for (const k in s.args) scanFinite(s.args[k], `${path}.args.${k}`);
      }
      if (s.transform) {
        for (const k of ['translate', 'scale']) {
          if (s.transform[k] !== undefined) scanFinite(s.transform[k], `${path}.transform.${k}`);
        }
        if (Array.isArray(s.transform.rotate)) {
          scanFinite(s.transform.rotate, `${path}.transform.rotate`);
        }
      }

      // Recurse
      if (Array.isArray(s.children)) walk(s.children, `${path}.children`);
      if (s.source) walk([s.source], `${path}.source`);
    }
  }
  walk(subjects, 'subjects');
}

// ---------------------------------------------------------------------------
// Rule 4: duplicate IDs
// ---------------------------------------------------------------------------
function checkDuplicateIds(subjects, issues) {
  const seen = new Map(); // id → first path
  function walk(subs, parentPath) {
    if (!Array.isArray(subs)) return;
    for (let i = 0; i < subs.length; i++) {
      const s = subs[i];
      if (!s || typeof s !== 'object') continue;
      const path = `${parentPath}[${i}]`;
      if (typeof s.id === 'string' && s.id.length > 0) {
        if (seen.has(s.id)) {
          issues.push({
            path,
            severity: 'high',
            rule: 'duplicate-id',
            message: `duplicate subject id "${s.id}" (first seen at ${seen.get(s.id)})`,
            suggestion: 'rename one — motionSlots / setSubjectBaseTargets use id as key',
          });
        } else {
          seen.set(s.id, path);
        }
      }
      if (Array.isArray(s.children)) walk(s.children, `${path}.children`);
      if (s.source) walk([s.source], `${path}.source`);
    }
  }
  walk(subjects, 'subjects');
}

// ---------------------------------------------------------------------------
// Rule 5: camera target outside scene bbox + margin
// Rule 6: camera position inside a subject bbox
// ---------------------------------------------------------------------------
function checkCamera(sceneData, compiled, issues) {
  const cam = compiled && compiled.cameraStatic;
  if (!cam || typeof cam.targetX !== 'number') return;
  const target = [cam.targetX, cam.targetY, cam.targetZ];
  // Camera position from spherical (matches sphericalToCamState convention).
  const sp = Math.sin(cam.pitch),
    cp = Math.cos(cam.pitch);
  const sy = Math.sin(cam.yaw),
    cyc = Math.cos(cam.yaw);
  const pos = [
    cam.targetX - cam.distance * sy * cp,
    cam.targetY + cam.distance * sp,
    cam.targetZ - cam.distance * cyc * cp,
  ];

  // Rule 5: target outside scene bbox + margin
  const bb = sceneBbox(sceneData.subjects);
  const MARGIN = 50;
  for (let i = 0; i < 3; i++) {
    if (target[i] < bb.min[i] - MARGIN || target[i] > bb.max[i] + MARGIN) {
      issues.push({
        path: 'defaults.camera',
        severity: 'med',
        rule: 'camera-target-out',
        message: `camera.target${'XYZ'[i]} = ${target[i].toFixed(1)} is outside scene bbox [${bb.min[i].toFixed(1)}, ${bb.max[i].toFixed(1)}] + margin ${MARGIN}. Camera will look at empty space.`,
        suggestion: 'move target into scene bounds or extend scene with more subjects',
      });
      break; // only flag once
    }
  }

  // Rule 6: camera position inside a subject bbox
  function walk(subs, parentPath) {
    if (!Array.isArray(subs)) return;
    for (let i = 0; i < subs.length; i++) {
      const s = subs[i];
      if (!s || typeof s !== 'object') continue;
      const path = `${parentPath}[${i}]`;
      const b = subjectBbox(s);
      if (
        pos[0] >= b.min[0] &&
        pos[0] <= b.max[0] &&
        pos[1] >= b.min[1] &&
        pos[1] <= b.max[1] &&
        pos[2] >= b.min[2] &&
        pos[2] <= b.max[2]
      ) {
        issues.push({
          path,
          severity: 'med',
          rule: 'camera-inside-subject',
          message: `camera position [${pos.map((v) => v.toFixed(1)).join(',')}] is inside the bbox of subject "${s.id || s.type}" — view will be inside-out or all-black`,
          suggestion: 'move camera target / increase camera.distance',
        });
      }
      if (Array.isArray(s.children)) walk(s.children, `${path}.children`);
    }
  }
  walk(sceneData.subjects, 'subjects');
}

// ---------------------------------------------------------------------------
// Rule 7: light altitude out of [-π/2, π/2]
// ---------------------------------------------------------------------------
function checkLight(sceneData, issues) {
  const light = sceneData && sceneData.defaults && sceneData.defaults.light;
  if (!light || typeof light.altitude !== 'number') return;
  if (light.altitude < -HALF_PI - 0.01 || light.altitude > HALF_PI + 0.01) {
    issues.push({
      path: 'defaults.light.altitude',
      severity: 'low',
      rule: 'light-altitude-out',
      message: `light.altitude = ${light.altitude.toFixed(3)} is outside [-π/2, π/2] = [-1.57, 1.57] (sun underground / above zenith)`,
      suggestion: 'clamp to [-π/2, π/2]; typical sunset 0.1-0.3, noon ~1.0',
    });
  }
}

// ---------------------------------------------------------------------------
// Rule 8: subject count exceeded (post-expand)
// Run after Generator-S has expanded variants. Compounds easily: array
// count=10 nested inside a scatter count=10 → 100 subjects → editor lag.
// ---------------------------------------------------------------------------
function checkSubjectCount(subjects, issues) {
  if (!Array.isArray(subjects)) return;
  const n = subjects.length;
  if (n > SUBJECT_COUNT_ERROR) {
    issues.push({
      path: 'subjects',
      severity: 'high',
      rule: 'subject-count-exceeded',
      message: `top-level subjects.length = ${n} (> hard cap ${SUBJECT_COUNT_ERROR}; GPU SDF eval scales O(N) per ray, will tank fps)`,
      suggestion: `reduce array/scatter count; use SDF-domain rep for >${SUBJECT_COUNT_ERROR} identical copies`,
    });
  } else if (n > SUBJECT_COUNT_WARN) {
    issues.push({
      path: 'subjects',
      severity: 'med',
      rule: 'subject-count-high',
      message: `top-level subjects.length = ${n} (> soft warn ${SUBJECT_COUNT_WARN}; render perf may suffer)`,
      suggestion: `consider lowering count or using SDF-domain rep for identical copies`,
    });
  }
}

// ---------------------------------------------------------------------------
// Main entry. Returns { errors, warnings, all, summary }.
// ---------------------------------------------------------------------------
export function sanityCheck(sceneData, compiled) {
  const issues = [];
  if (sceneData && Array.isArray(sceneData.subjects)) {
    walkSubjectChecks(sceneData.subjects, issues);
    checkDuplicateIds(sceneData.subjects, issues);
    checkSubjectCount(sceneData.subjects, issues);
  }
  checkCamera(sceneData, compiled, issues);
  checkLight(sceneData, issues);

  const errors = issues.filter((i) => i.severity === 'high');
  const warnings = issues.filter((i) => i.severity !== 'high');
  // Compact summary string for one-line console + regression tally
  const counts = {};
  for (const i of issues) counts[i.rule] = (counts[i.rule] || 0) + 1;
  const summary = Object.keys(counts).length
    ? Object.entries(counts)
        .map(([k, v]) => `${k}×${v}`)
        .join(' ')
    : 'clean';
  return { errors, warnings, all: issues, summary };
}

// ---------------------------------------------------------------------------
// console.warn formatter — used by compile() to emit warnings inline.
// ---------------------------------------------------------------------------
export function logSanityIssues(issues, { prefix = '[sanity]' } = {}) {
  for (const i of issues) {
    const tag = i.severity === 'high' ? '✗' : i.severity === 'med' ? '⚠' : '·';
    const suffix = i.suggestion ? `\n    ↳ ${i.suggestion}` : '';
    // Use console.warn for everything so it's filterable in browser DevTools
    console.warn(`${prefix} ${tag} ${i.rule} @ ${i.path}: ${i.message}${suffix}`);
  }
}
