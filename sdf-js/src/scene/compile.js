// =============================================================================
// scene/compile.js — SceneData → SDF tree + camera/light/shadow specs + regionFn
// -----------------------------------------------------------------------------
// Public:
//   compile(sceneData) → {
//     sdf, ground, groundSdf, subjects, regionFn,
//     cameraStatic, evalCamera, lightStatic, evalLight,
//     shadowStatic, evalShadow, meta
//   }
//
// Subject animations are baked into the SDF tree as TimeExpr (consumed by
// sdf3.compile emitTimeExpr on GPU path; evaluated at t=0 for CPU initial).
// Camera/light/shadow animations are returned as `eval*(t)` functions for the
// renderer to call per frame and update uniforms.
// =============================================================================

import { SDF2, SDF3 } from '../sdf/core.js';
import {
  circle, ellipse, rectangle, rounded_rectangle, line, segment, arc, ring,
  equilateral_triangle, hexagon, polygon, triangle, trapezoid, flower,
  heart, star, moon, cross, rounded_cross, pie, pie_slice, horseshoe, egg,
  oriented_box, isosceles_trapezoid, parallelogram, rhombus, quadratic_bezier,
  slab, rounded_x, vesica,
  extrude, extrude_to, revolve,
} from '../sdf/d2.js';
import {
  sphere, box, plane, capsule,
  torus, cylinder, capped_cylinder, ellipsoid, rounded_box,
  cone, capped_cone,
  tetrahedron, octahedron, dodecahedron, icosahedron,
  pyramid, slab3, wireframe_box, tri_prism, waves,
  rotateXYZ, twist, bend,
} from '../sdf/d3.js';
import { solidAngleSDF } from './components/community/iq-solid-angle.js';
import { linkSDF } from './components/community/iq-link.js';
import { cappedTorusSDF } from './components/community/iq-capped-torus.js';
import { hexPrismSDF } from './components/community/iq-hex-prism.js';
import { octagonPrismSDF } from './components/community/iq-octagon-prism.js';
import { roundConeSDF } from './components/community/iq-round-cone.js';
import { rhombusSDF } from './components/community/iq-rhombus.js';
import { horseshoeSDF } from './components/community/iq-horseshoe.js';
import { uShapeSDF } from './components/community/iq-u-shape.js';
import {
  moonSDF, starSDF, sunSDF, cloudPuffSDF,
  pineTreeSDF, broadleafTreeSDF,
  cottageSDF, flagOnPoleSDF, birdSilhouetteSDF,
} from './components/atoms/scene-atoms.js';
import {
  union, difference, intersection, rep,
  unionChamfer, intersectionChamfer, differenceChamfer,
  unionRound,   intersectionRound,   differenceRound,
} from '../sdf/dn.js';
import { evalT, isTimeExpr } from '../sdf/time.js';
import { validate, PRIMITIVE_TYPES, BOOLEAN_OPS, DOMAIN_OPS, resolveMaterial } from './spec.js';
import { normalizeChannel } from './expr.js';

// =============================================================================
// Primitive dispatch
// -----------------------------------------------------------------------------
// Each entry is a factory `(args) => SDF2 | SDF3` that maps spec args to the
// sdf-js function signature. args values can be number or TimeExpr; the
// underlying factories accept both (see src/sdf/d3.js, src/sdf/d2.js).
// =============================================================================

const PRIMITIVE_FACTORIES = {
  // -- 2D --
  circle:           (a) => circle(a.radius ?? 1, a.center),
  ellipse:          (a) => ellipse(a.rx ?? 1, a.ry ?? 1, a.center),
  rectangle:        (a) => rectangle(a.dims ?? a.size ?? 1, a.center, a.a, a.b),
  rounded_rectangle:(a) => rounded_rectangle(a.dims ?? a.size ?? 1, a.cornerR ?? a.radius ?? 0, a.center),
  triangle:         (a) => triangle(a.a ?? a.p0, a.b ?? a.p1, a.c ?? a.p2),
  hexagon:          (a) => hexagon(a.radius ?? 1),
  polygon:          (a) => polygon(a.points ?? []),
  star:             (a) => star(a.points ?? 5, a.outerR ?? 0.5, a.innerR),
  heart:            (a) => heart(a.scale ?? 0.4),
  arc:              (a) => arc(a.radius ?? 1, a.halfAperture ?? Math.PI / 2, a.thickness ?? 0.05, a.center),
  segment:          (a) => segment(a.a, a.b, a.radius ?? a.r ?? 0.05),
  ring:             (a) => ring(a.radius ?? 1, a.thickness ?? 0.05, a.center),
  moon:             (a) => moon(a.thickness ?? 0.12, a.size ?? 0.4),
  cross:            (a) => cross(a.armLength ?? 0.4, a.halfT ?? a.halfThickness ?? 0.1, a.cornerR ?? a.cornerRadius ?? 0),
  rounded_cross:    (a) => rounded_cross(a.armLength ?? 0.4, a.halfT ?? a.halfThickness ?? 0.1, a.cornerR ?? a.cornerRadius ?? 0.025),
  pie:              (a) => pie(a.halfAperture ?? Math.PI / 4, a.radius ?? 0.5),
  pie_slice:        (a) => pie_slice(a.halfAperture ?? Math.PI / 4, a.radius ?? 0.5),
  horseshoe:        (a) => horseshoe(a.openAngle ?? Math.PI / 3, a.radius ?? a.r ?? 0.4, a.thickness ?? 0.08),
  egg:              (a) => egg(a.ra ?? 0.4, a.rb ?? 0.15),
  trapezoid:        (a) => trapezoid(a.a, a.b, a.ra, a.rb),
  isosceles_trapezoid: (a) => isosceles_trapezoid(a.r1 ?? 0.2, a.r2 ?? 0.4, a.h ?? 0.3),
  parallelogram:    (a) => parallelogram(a.halfWidth ?? a.w ?? 0.3, a.halfHeight ?? a.h ?? 0.2, a.skew ?? 0.1),
  rhombus:          (a) => rhombus(a.halfWidth ?? a.w ?? 0.3, a.halfHeight ?? a.h ?? 0.2),
  oriented_box:     (a) => oriented_box(a.a, a.b, a.thickness ?? 0.1),
  quadratic_bezier: (a) => quadratic_bezier(a.A, a.B, a.C, a.thickness ?? a.t ?? 0.02),
  flower:           (a) => flower(a.amp ?? 0.12, a.freq ?? 10, a.offset ?? 20, a.baseR ?? 0.2),
  line:             (a) => line(a.normal, a.point),
  slab:             (a) => slab(a),
  rounded_x:        (a) => rounded_x(a.w ?? 0.4, a.r ?? 0.05),
  vesica:           (a) => vesica(a),

  // -- 3D --
  sphere:        (a) => sphere(a.radius ?? 1, a.center),
  box:           (a) => box(a.dims ?? a.size ?? 1, a.center),
  rounded_box:   (a) => rounded_box(a.dims ?? a.size ?? 0.6, a.cornerR ?? a.radius ?? 0.05),
  torus:         (a) => torus(a.majorR ?? a.radius ?? 0.4, a.minorR ?? a.thickness ?? 0.1),
  capsule:       (a) => capsule(a.a, a.b, a.radius ?? a.r ?? 0.1),
  cylinder:      (a) => cylinder(a.radius ?? 0.3, a.height ?? 1.0),
  capped_cylinder: (a) => capped_cylinder(a.a, a.b, a.radius ?? 0.1),
  cone:          (a) => cone(a.height ?? 0.5, a.baseRadius ?? a.radius ?? 0.3),
  capped_cone:   (a) => capped_cone(a.a, a.b, a.r1 ?? a.ra ?? 0.3, a.r2 ?? a.rb ?? 0.1),
  ellipsoid:     (a) => ellipsoid(a.dims ?? a.radii ?? [0.4, 0.3, 0.4]),
  plane:         (a) => plane(a.normal ?? [0, 1, 0], a.point ?? a.offset ?? [0, 0, 0]),
  pyramid:       (a) => pyramid(a.height ?? a.h ?? 0.5),
  slab3:         (a) => slab3(a),
  wireframe_box: (a) => wireframe_box(a.dims ?? a.size ?? 0.6, a.edgeR ?? a.thickness ?? 0.04),
  tri_prism:     (a) => tri_prism(a.halfWidth ?? 0.3, a.halfLength ?? 0.1),
  prism:         (a) => tri_prism(a.halfWidth ?? 0.3, a.halfLength ?? 0.1),
  tetrahedron:   (a) => tetrahedron(a.radius ?? a.r ?? 0.4),
  octahedron:    (a) => octahedron(a.radius ?? a.r ?? 0.4),
  dodecahedron:  (a) => dodecahedron(a.radius ?? a.r ?? 0.4),
  icosahedron:   (a) => icosahedron(a.radius ?? a.r ?? 0.4),

  // -- Community-ported (see src/scene/components/community/) --
  'solid-angle': (a) => solidAngleSDF({
    halfAperture: a.halfAperture ?? Math.PI / 6,
    radius:       a.radius       ?? 0.5,
  }),
  link: (a) => linkSDF({
    halfLength: a.halfLength ?? a.le         ?? 0.13,
    majorR:     a.majorR     ?? a.radius     ?? 0.1,
    minorR:     a.minorR     ?? a.thickness  ?? 0.02,
  }),
  'capped-torus': (a) => cappedTorusSDF({
    capAngle: a.capAngle ?? a.halfAperture ?? Math.PI / 2,
    majorR:   a.majorR   ?? a.radius       ?? 0.4,
    minorR:   a.minorR   ?? a.thickness    ?? 0.1,
  }),
  'hex-prism': (a) => hexPrismSDF({
    apothem:    a.apothem    ?? a.radius     ?? 0.3,
    halfHeight: a.halfHeight ?? a.halfLength ?? 0.5,
  }),
  'octagon-prism': (a) => octagonPrismSDF({
    apothem:    a.apothem    ?? a.radius     ?? 0.3,
    halfHeight: a.halfHeight ?? a.halfLength ?? 0.5,
  }),
  'round-cone': (a) => roundConeSDF({
    baseRadius: a.baseRadius ?? a.r1 ?? 0.3,
    topRadius:  a.topRadius  ?? a.r2 ?? 0.1,
    height:     a.height     ?? a.h  ?? 0.6,
  }),
  rhombus: (a) => rhombusSDF({
    la:      a.la      ?? 0.4,
    lb:      a.lb      ?? 0.2,
    h:       a.h       ?? a.halfHeight ?? 0.05,
    cornerR: a.cornerR ?? a.ra         ?? 0.02,
  }),
  horseshoe: (a) => horseshoeSDF({
    openAngle: a.openAngle ?? Math.PI / 3,
    radius:    a.radius    ?? a.r  ?? 0.4,
    length:    a.length    ?? a.le ?? 0.1,
    halfWidth: a.halfWidth ?? 0.08,
    halfDepth: a.halfDepth ?? 0.04,
  }),
  'u-shape': (a) => uShapeSDF({
    radius:    a.radius    ?? a.r  ?? 0.3,
    legLength: a.legLength ?? a.le ?? 0.2,
    halfWidth: a.halfWidth ?? 0.06,
    halfDepth: a.halfDepth ?? 0.04,
  }),

  // -- Atlas scene atoms (high-semantic composites of primitives, hand-authored) --
  moon:  (a) => moonSDF({ radius: a.radius ?? 0.4 }),
  star:  (a) => starSDF({ radius: a.radius ?? 0.08, shape: a.shape ?? 'octahedron' }),
  sun:   (a) => sunSDF({ radius: a.radius ?? 0.4, haloThickness: a.haloThickness ?? 0.06 }),
  'cloud-puff': (a) => cloudPuffSDF({
    width:  a.width  ?? a.dims?.[0] ?? 1.0,
    height: a.height ?? a.dims?.[1] ?? 0.45,
    depth:  a.depth  ?? a.dims?.[2] ?? 0.6,
  }),
  'tree-pine': (a) => pineTreeSDF({
    trunkHeight:   a.trunkHeight   ?? 0.5,
    trunkRadius:   a.trunkRadius   ?? 0.1,
    foliageHeight: a.foliageHeight ?? 1.4,
    foliageBaseR:  a.foliageBaseR  ?? a.foliageR ?? 0.55,
    layers:        a.layers        ?? 3,
  }),
  'tree-broadleaf': (a) => broadleafTreeSDF({
    trunkHeight: a.trunkHeight ?? 0.7,
    trunkRadius: a.trunkRadius ?? 0.09,
    foliageR:    a.foliageR    ?? a.foliageRadius ?? 0.55,
  }),
  cottage: (a) => cottageSDF({
    width:      a.width      ?? a.size ?? 0.8,
    height:     a.height     ?? 0.6,
    roofHeight: a.roofHeight ?? a.roofPitch ?? 0.45,
  }),
  'flag-on-pole': (a) => flagOnPoleSDF({
    poleHeight: a.poleHeight ?? a.height    ?? 2.0,
    poleRadius: a.poleRadius ?? 0.04,
    flagWidth:  a.flagWidth  ?? a.width     ?? 0.5,
    flagHeight: a.flagHeight ?? 0.3,
    flagSide:   a.flagSide   ?? 1,
  }),
  'bird-silhouette': (a) => birdSilhouetteSDF({
    bodyLength: a.bodyLength ?? 0.18,
    bodyRadius: a.bodyRadius ?? 0.025,
    wingSpan:   a.wingSpan   ?? 0.45,
    wingRise:   a.wingRise   ?? 0.1,
  }),

  // -- Time-aware --
  waves:         (a) => waves(a.freq ?? 2, a.amp ?? 0.5, a.angle ?? 0, a.speed ?? 0),

  // -- 2D → 3D pseudo-primitives (handled separately because of `source` field) --
  // Marker entries; actual compile happens in compilePseudoPrimitive.
  extrude:      null,
  extrude_to:   null,
  revolve:      null,
};

const PSEUDO_PRIMITIVES = new Set(['extrude', 'revolve', 'extrude_to']);

// =============================================================================
// Public API
// =============================================================================

/**
 * Compile SceneData v1 into rendering resources.
 *
 * @param {object} sceneData
 * @returns {{
 *   sdf: import('../sdf/core.js').SDF3 | import('../sdf/core.js').SDF2 | null,
 *   ground: { y: number, region: string } | null,
 *   groundSdf: import('../sdf/core.js').SDF3 | null,
 *   subjects: Array<{id: string, region: string, sdf: any}>,
 *   regionFn: (p: number[]) => string,
 *   cameraStatic: object,
 *   evalCamera: (t: number) => object,
 *   lightStatic: object,
 *   evalLight: (t: number) => object,
 *   shadowStatic: object | null,
 *   evalShadow: ((t: number) => object) | null,
 *   meta: object,
 * }}
 */
export function compile(sceneData) {
  const result = validate(sceneData);
  if (!result.ok) {
    throw new Error(`SceneData validation failed:\n  - ${result.errors.join('\n  - ')}`);
  }

  // Compile each subject
  const subjectInfos = []; // { id, region, sdf } flat list (post-compile)
  const topLevelSdfs = []; // top-level SDFs for the final union

  for (const subj of sceneData.subjects) {
    const compiled = compileSubject(subj, 'object', subjectInfos);
    if (compiled.sdf != null) {
      // Tag the post-transform top-level SDF with its resolved material.
      // sdf3.compile.js flattenUnion propagates this down to all descendant
      // leaves (including atoms that internally union N parts). null tag =
      // renderer falls back to hash-palette per leaf.
      compiled.sdf._subjectMaterial = resolveMaterial(subj.material);
      topLevelSdfs.push(compiled.sdf);
    }
  }

  // Top-level union (could be empty if subjects=[])
  let sdf = null;
  if (topLevelSdfs.length === 1) {
    sdf = topLevelSdfs[0];
  } else if (topLevelSdfs.length > 1) {
    sdf = union(...topLevelSdfs);
  }

  // Ground
  let groundInfo = null;
  let groundSdf = null;
  if (sceneData.ground) {
    groundInfo = {
      y: sceneData.ground.y ?? -1,
      region: sceneData.ground.region ?? 'ground',
    };
    // sdf-js plane SDF: d(p) = (pt - p) · normal.
    // For "above ground = outside" (standard SDF), need normal pointing DOWN.
    // Otherwise normal=[0,1,0] would make above-ground inside (d<0) → raymarch
    // sees camera as already inside an infinite half-space and renders sky.
    groundSdf = plane([0, -1, 0], [0, groundInfo.y, 0]);
  }

  // Camera / light / shadow
  const cameraStatic = pickCamera(sceneData.defaults.camera);
  const evalCamera = makeEvaluator(sceneData.defaults.camera, cameraStatic);

  const lightStatic = pickLight(sceneData.defaults.light);
  const evalLight = makeEvaluator(sceneData.defaults.light, lightStatic);

  let shadowStatic = null;
  let evalShadow = null;
  if (sceneData.defaults.shadow) {
    shadowStatic = pickShadow(sceneData.defaults.shadow);
    evalShadow = makeEvaluator(sceneData.defaults.shadow, shadowStatic);
  }

  // regionFn — canvas2D-style flat dispatch
  const regionFn = makeRegionFn(subjectInfos, groundInfo);

  return {
    sdf,
    ground: groundInfo,
    groundSdf,
    subjects: subjectInfos,
    regionFn,
    cameraStatic,
    evalCamera,
    lightStatic,
    evalLight,
    shadowStatic,
    evalShadow,
    meta: {
      id: sceneData.id,
      name: sceneData.name,
      hash: sceneData.hash,
      source: sceneData.source,
      palette: sceneData.defaults?.palette,
    },
  };
}

// =============================================================================
// Subject dispatch
// =============================================================================

function compileSubject(subj, defaultRegion, subjectInfos) {
  if (PRIMITIVE_TYPES.has(subj.type)) {
    if (PSEUDO_PRIMITIVES.has(subj.type)) {
      return compilePseudoPrimitive(subj, defaultRegion, subjectInfos);
    }
    return compilePrimitive(subj, defaultRegion, subjectInfos);
  }
  if (BOOLEAN_OPS.has(subj.type)) {
    return compileBoolean(subj, defaultRegion, subjectInfos);
  }
  if (DOMAIN_OPS.has(subj.type)) {
    return compileDomain(subj, defaultRegion, subjectInfos);
  }
  throw new Error(`compile: unknown subject type "${subj.type}"`);
}

// =============================================================================
// PrimitiveLeaf compile
// =============================================================================

function compilePrimitive(subj, defaultRegion, subjectInfos) {
  // 1. Resolve animated args
  const resolvedArgs = resolveAnimatedArgs(subj);

  // 2. Build base SDF
  const factory = PRIMITIVE_FACTORIES[subj.type];
  if (!factory) throw new Error(`compile: no factory for primitive "${subj.type}"`);
  let sdf = factory(resolvedArgs);

  // 3. Apply transform
  sdf = applyTransform(sdf, subj.transform, subj.animation);

  // 4. Region tracking
  const region = subj.region ?? defaultRegion;
  subjectInfos.push({ id: subj.id, region, sdf });

  return { sdf, region };
}

function compilePseudoPrimitive(subj, defaultRegion, subjectInfos) {
  // extrude / revolve / extrude_to wrap a 2D source
  const source = compileSubject(subj.source, defaultRegion, []);  // don't track source in flat list
  const args = resolveAnimatedArgs(subj);

  let sdf;
  if (subj.type === 'extrude') {
    sdf = extrude(source.sdf, args.height ?? args.h ?? 1, args.easing);
  } else if (subj.type === 'revolve') {
    sdf = revolve(source.sdf, args.offset ?? 0);
  } else if (subj.type === 'extrude_to') {
    // extrude_to(other_sdf, h, easing) — requires `other` as another 2D SDF.
    // For now require args.target to be another inline-compiled 2D.
    if (!subj.target) throw new Error(`extrude_to "${subj.id}" requires target field`);
    const target = compileSubject(subj.target, defaultRegion, []);
    sdf = extrude_to(source.sdf, target.sdf, args.height ?? args.h ?? 1, args.easing);
  }

  sdf = applyTransform(sdf, subj.transform, subj.animation);
  const region = subj.region ?? defaultRegion;
  subjectInfos.push({ id: subj.id, region, sdf });
  return { sdf, region };
}

// =============================================================================
// BooleanGroup compile
// =============================================================================

function compileBoolean(subj, defaultRegion, subjectInfos) {
  // children may have their own regions; BooleanGroup.region OVERRIDES (Rule A in SPEC.md).
  const groupRegion = subj.region ?? defaultRegion;
  const children = subj.children.map(c => compileSubject(c, groupRegion, []));  // children regions discarded for SubjectInfo
  // Unwrap if single child (Rule 5 warning case)
  if (children.length === 1) {
    let sdf = applyTransform(children[0].sdf, subj.transform, subj.animation);
    subjectInfos.push({ id: subj.id, region: groupRegion, sdf });
    return { sdf, region: groupRegion };
  }

  const k = subj.args?.k;
  const r = subj.args?.r ?? 0.05;
  const childSdfs = children.map(c => c.sdf);
  let sdf;
  if (subj.type === 'union') {
    sdf = union(...childSdfs);
  } else if (subj.type === 'difference') {
    sdf = difference(...childSdfs);
  } else if (subj.type === 'intersection') {
    sdf = intersection(...childSdfs);
  } else if (subj.type === 'smoothUnion') {
    sdf = union(...childSdfs, { k: k ?? 0.05 });
  } else if (subj.type === 'smoothDifference') {
    sdf = difference(...childSdfs, { k: k ?? 0.05 });
  } else if (subj.type === 'unionChamfer') {
    sdf = unionChamfer(...childSdfs, { r });
  } else if (subj.type === 'intersectionChamfer') {
    sdf = intersectionChamfer(...childSdfs, { r });
  } else if (subj.type === 'differenceChamfer') {
    sdf = differenceChamfer(...childSdfs, { r });
  } else if (subj.type === 'unionRound') {
    sdf = unionRound(...childSdfs, { r });
  } else if (subj.type === 'intersectionRound') {
    sdf = intersectionRound(...childSdfs, { r });
  } else if (subj.type === 'differenceRound') {
    sdf = differenceRound(...childSdfs, { r });
  } else {
    throw new Error(`compile: unknown boolean op "${subj.type}"`);
  }

  sdf = applyTransform(sdf, subj.transform, subj.animation);
  subjectInfos.push({ id: subj.id, region: groupRegion, sdf });
  return { sdf, region: groupRegion };
}

// =============================================================================
// DomainGroup compile
// =============================================================================

function compileDomain(subj, defaultRegion, subjectInfos) {
  const region = subj.region ?? defaultRegion;
  const source = compileSubject(subj.source, region, []);  // source-level region passed through

  const args = subj.args ?? {};
  let sdf;

  if (subj.type === 'rep') {
    // rep(sdf, period, options?)
    sdf = rep(source.sdf, args.period, args.count != null ? { count: args.count } : (args.padding != null ? { padding: args.padding } : undefined));
  } else if (subj.type === 'mirror') {
    sdf = applyMirror(source.sdf, args.axis);
  } else if (subj.type === 'twist') {
    sdf = twist(source.sdf, args.k);
  } else if (subj.type === 'bend') {
    sdf = bend(source.sdf, args.k);
  } else {
    throw new Error(`compile: unknown domain op "${subj.type}"`);
  }

  sdf = applyTransform(sdf, subj.transform, subj.animation);
  subjectInfos.push({ id: subj.id, region, sdf });
  return { sdf, region };
}

// Mirror is not a chain op in sdf-js currently. v0: CPU-only wrapper.
// TODO: M0 Day 4-5 — extend src/sdf/dn.js with `mirror()` chain op + GLSL emit.
function applyMirror(sourceSdf, axis) {
  const idx = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
  if (sourceSdf instanceof SDF3 || (sourceSdf && sourceSdf.f && sourceSdf.f.length === 1)) {
    return new SDF3((p) => {
      const q = [...p];
      q[idx] = Math.abs(q[idx]);
      return sourceSdf.f(q);
    });
  }
  return new SDF2((p) => {
    const q = [p[0], p[1]];
    if (idx < 2) q[idx] = Math.abs(q[idx]);
    return sourceSdf.f(q);
  });
}

// =============================================================================
// Args resolution: subj.args + subj.animation → resolved args (number | TimeExpr)
// -----------------------------------------------------------------------------
// Animation channel `args.<key>` REPLACES the static value. User who wants
// additive animation writes the static in the expression (e.g. expr "0.3 + 0.05 * sin(t)").
// =============================================================================

function resolveAnimatedArgs(subj) {
  const args = { ...(subj.args || {}) };
  if (!Array.isArray(subj.animation)) return args;

  for (const ch of subj.animation) {
    if (typeof ch.channel !== 'string' || !ch.channel.startsWith('args.')) continue;
    const expr = normalizeChannel(ch);
    if (expr == null) continue;  // skip incomplete channels (validator warned)
    const key = ch.channel.slice('args.'.length);
    args[key] = expr;
  }
  return args;
}

// =============================================================================
// Transform: { translate?, rotate?, scale? } + subject.animation → composed SDF
// -----------------------------------------------------------------------------
// Composition order S → R → T (matches SPEC.md TRS).
// Per-component animation channels: 'transform.translate.x', 'transform.rotate.z',
// 'transform.scale' (uniform only — array scale animations not in v1).
// =============================================================================

function applyTransform(sdf, transform, animation) {
  if (!transform && !hasTransformAnim(animation)) return sdf;
  const t = transform || {};
  const animMap = collectTransformAnims(animation);

  // Scale
  let scaleVal = t.scale;
  if (animMap['transform.scale'] != null) scaleVal = animMap['transform.scale'];
  if (scaleVal != null && !(typeof scaleVal === 'number' && scaleVal === 1)) {
    sdf = sdf.scale(scaleVal);
  }

  // Rotate (Euler XYZ)
  const rotVec = resolveVec3Field(t.rotate, animMap, 'transform.rotate', [0, 0, 0]);
  if (!isVec3Zero(rotVec)) {
    if (rotVec.every(c => typeof c === 'number')) {
      sdf = rotateXYZ(sdf, rotVec);
    } else {
      // Time-modulated axis-aligned rotation: compose X then Y then Z
      if (!isComponentZero(rotVec[0])) sdf = sdf.rotate(rotVec[0], [1, 0, 0]);
      if (!isComponentZero(rotVec[1])) sdf = sdf.rotate(rotVec[1], [0, 1, 0]);
      if (!isComponentZero(rotVec[2])) sdf = sdf.rotate(rotVec[2], [0, 0, 1]);
    }
  }

  // Translate
  const transVec = resolveVec3Field(t.translate, animMap, 'transform.translate', [0, 0, 0]);
  if (!isVec3Zero(transVec)) {
    // For SDF2, translate is a 2-vector; sdf-js .translate auto-handles both.
    if (sdf instanceof SDF2) {
      sdf = sdf.translate([transVec[0], transVec[1]]);
    } else {
      sdf = sdf.translate(transVec);
    }
  }

  return sdf;
}

function hasTransformAnim(animation) {
  if (!Array.isArray(animation)) return false;
  return animation.some(ch => typeof ch.channel === 'string' && ch.channel.startsWith('transform.'));
}

function collectTransformAnims(animation) {
  const map = {};
  if (!Array.isArray(animation)) return map;
  for (const ch of animation) {
    if (typeof ch.channel === 'string' && ch.channel.startsWith('transform.')) {
      const expr = normalizeChannel(ch);
      if (expr != null) map[ch.channel] = expr;
    }
  }
  return map;
}

function resolveVec3Field(staticVec, animMap, prefix, defaultVec) {
  const base = Array.isArray(staticVec) && staticVec.length === 3 ? [...staticVec] : [...defaultVec];
  const axes = ['x', 'y', 'z'];
  for (let i = 0; i < 3; i++) {
    const channelKey = `${prefix}.${axes[i]}`;
    if (animMap[channelKey] != null) base[i] = animMap[channelKey];
  }
  return base;
}

function isVec3Zero(v) {
  return v.every(c => typeof c === 'number' && c === 0);
}

function isComponentZero(c) {
  return typeof c === 'number' && c === 0;
}

// =============================================================================
// Camera / Light / Shadow extraction + evaluator
// =============================================================================

function pickCamera(cam) {
  return {
    yaw: cam.yaw ?? 0,
    pitch: cam.pitch ?? 0,
    distance: cam.distance ?? 3,
    focal: cam.focal ?? 1.5,
    targetX: cam.targetX ?? 0,
    targetY: cam.targetY ?? 0,
    targetZ: cam.targetZ ?? 0,
  };
}

function pickLight(light) {
  return {
    azimuth: light.azimuth ?? 0.5,
    altitude: light.altitude ?? 0.6,
    distance: light.distance ?? 5,
    intensity: light.intensity ?? 1,
  };
}

function pickShadow(shadow) {
  return {
    enabled: shadow.enabled ?? true,
    mode: shadow.mode ?? 'channelSwap',
    strength: shadow.strength ?? 0.35,
  };
}

/**
 * Returns a function `(t) => animatedStaticCopy` that overlays time-evaluated
 * animation channels on the static state. If no animations on this spec,
 * returns a function that just returns the static state.
 */
function makeEvaluator(spec, staticState) {
  const channels = Array.isArray(spec.animation)
    ? spec.animation
        .map(ch => ({ field: ch.channel, timeExpr: normalizeChannel(ch) }))
        .filter(c => c.timeExpr != null)  // skip incomplete channels (validator warned)
    : [];

  if (channels.length === 0) {
    return (_t) => ({ ...staticState });
  }

  return (t) => {
    const out = { ...staticState };
    for (const ch of channels) {
      out[ch.field] = typeof ch.timeExpr === 'number' ? ch.timeExpr : evalT(ch.timeExpr, t);
    }
    return out;
  };
}

// =============================================================================
// Region function (canvas2D-style)
// -----------------------------------------------------------------------------
// For a query point p, scan compiled subjectInfos in order; the first subject
// whose SDF contains p (sdf(p) <= eps) wins. Falls back to ground (if ground
// SDF inside) then 'background'.
// =============================================================================

const REGION_EPS = 1e-3;

function makeRegionFn(subjectInfos, groundInfo) {
  return (p) => {
    for (const info of subjectInfos) {
      const d = info.sdf.f ? info.sdf.f(p) : info.sdf(p);
      // Some SDFs return 1xN arrays; normalize
      const dv = typeof d === 'number' ? d : (d.length === 1 ? d[0] : d[0][0]);
      if (dv <= REGION_EPS) return info.region;
    }
    if (groundInfo && p[1] !== undefined && p[1] <= groundInfo.y + REGION_EPS) {
      return groundInfo.region;
    }
    return 'background';
  };
}
