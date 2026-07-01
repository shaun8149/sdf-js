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
import { sumT, uniformT } from '../sdf/time.js';
import {
  circle,
  ellipse,
  rectangle,
  rounded_rectangle,
  line,
  segment,
  arc,
  ring,
  hexagon,
  polygon,
  triangle,
  trapezoid,
  heart,
  // flower / star / moon / horseshoe / rhombus removed 2026-06-16:
  //   their SceneData factories are now the community ports
  //   (flowerSDF / starSDF / moonSDF / horseshoeSDF / rhombusSDF) defined
  //   below — the d2 versions were shadowed by JS object key dedup.
  cross,
  rounded_cross,
  pie,
  pie_slice,
  egg,
  oriented_box,
  isosceles_trapezoid,
  parallelogram,
  quadratic_bezier,
  slab,
  rounded_x,
  vesica,
  extrude,
  extrude_to,
  revolve,
} from '../sdf/d2.js';
import {
  sphere,
  box,
  plane,
  capsule,
  torus,
  cylinder,
  capped_cylinder,
  ellipsoid,
  rounded_box,
  cone,
  capped_cone,
  tetrahedron,
  octahedron,
  dodecahedron,
  icosahedron,
  pyramid,
  slab3,
  wireframe_box,
  tri_prism,
  waves,
  rotateXYZ,
  twist,
  bend,
  curve,
  modPolar,
  mirrorOctant,
  // 2026-05-23 IQ P2 batch (8 new primitives)
  cutSphere,
  cutHollowSphere,
  deathStar,
  roundedCylinder,
  roundConeAB,
  vesicaSegment,
  cylinderInf,
  coneInf,
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
import { seaSurfaceSDF } from './components/community/aflext-sea-surface.js';
import {
  canalBuildingSDF,
  canalWindowsSDF,
  canalBridgeSDF,
  canalLampBulbSDF,
} from './components/atoms/canal-building.js';
import { terrainHeightmapSDF } from './components/community/iq-terrain.js';
import { terrainElevatedSDF } from './components/community/kk-elevated.js';
import { terrainWithLakesSDF } from './components/community/iq-rainforest-lakes.js';
import { archBridgeSDF } from './components/community/iq-arch-bridge.js';
import { pyramid3dSDF } from './components/charts/hierarchy/pyramid-3d.js';
import { bar3dSDF } from './components/charts/data/bar-3d.js';
import { column3dSDF } from './components/charts/data/column-3d.js';
import { line3dSDF } from './components/charts/data/line-3d.js';
import { pie3dSDF } from './components/charts/data/pie-3d.js';
import { kpiCard3dSDF } from './components/charts/data/kpi-card-3d.js';
import { businessIconSDF } from './components/icons/business.js';
import { cover3dSDF } from './components/presentation/cover-3d.js';
import { text3dExtrudedSDF, text3dPipeSDF } from './components/typography/text-3d.js';
import { cube3dSDF } from './components/shapes/cube-3d.js';
import { sphereFill3dSDF } from './components/shapes/sphere-fill-3d.js';
import { sphereNetwork3dSDF } from './components/shapes/sphere-network-3d.js';
import { sphereTree3dSDF } from './components/shapes/sphere-tree-3d.js';
import { sphereSegmented3dSDF } from './components/shapes/sphere-segmented-3d.js';
import { arrow3dSDF } from './components/shapes/arrow-3d.js';
import { diamond3dSDF } from './components/shapes/diamond-3d.js';
import { gear3dSDF } from './components/shapes/gear-3d.js';
import { cubeSegmented3dSDF } from './components/shapes/cube-segmented-3d.js';
import { circleFrame3dSDF } from './components/shapes/circle-frame-3d.js';
import { circleStack3dSDF } from './components/shapes/circle-stack-3d.js';
import { circleSegmented3dSDF } from './components/shapes/circle-segmented-3d.js';
import { mountain3dSDF } from './components/shapes/mountain-3d.js';
import { iconGrid3dSDF } from './components/shapes/icon-grid-3d.js';
import { deviceMockup3dSDF } from './components/shapes/device-mockup-3d.js';
import { circleLoop3dSDF } from './components/shapes/circle-loop-3d.js';
import { relationshipGraph3dSDF } from './components/charts/diagrams/relationship-graph-3d.js';
import { orgChart3dSDF } from './components/charts/diagrams/org-chart-3d.js';
import { flowChart3dSDF } from './components/charts/diagrams/flow-chart-3d.js';
import { treeDiagram3dSDF } from './components/charts/diagrams/tree-diagram-3d.js';
import { mindmap3dSDF } from './components/charts/diagrams/mindmap-3d.js';
import { timeline3dSDF } from './components/charts/diagrams/timeline-3d.js';
import { matrixGrid3dSDF } from './components/charts/matrix/matrix-grid-3d.js';
import { progression3dSDF } from './components/charts/progression/progression-3d.js';
import { agendaList3dSDF } from './components/charts/agenda/agenda-list-3d.js';
import { layerStack3dSDF } from './components/charts/layers/layer-stack-3d.js';
import { bulletList3dSDF } from './components/charts/lists/bullet-list-3d.js';
import { funnel3dSDF } from './components/charts/data/funnel-3d.js';
import { venn3dSDF } from './components/charts/data/venn-3d.js';
import { waterfall3dSDF } from './components/charts/data/waterfall-3d.js';
import { scatter3dSDF } from './components/charts/data/scatter-3d.js';
import { gantt3dSDF } from './components/charts/data/gantt-3d.js';
import { gauge3dSDF } from './components/charts/data/gauge-3d.js';
import { fishbone3dSDF } from './components/charts/diagrams/fishbone-3d.js';
import { trafficLight3dSDF } from './components/charts/data/traffic-light-3d.js';
import { radialSpoke3dSDF } from './components/charts/data/radial-spoke-3d.js';
import { puzzlePiece3dSDF } from './components/shapes/puzzle-piece-3d.js';
import { terrainCanyonSDF } from './components/community/iq-canyon.js';
import { proceduralCitySDF } from './components/community/otavio-skyline.js';
import { terrainErodedRuneSDF, bakeHeightmap } from './components/community/rune-erosion-filter.js';
import { cutDiskSDF } from './components/community/gbms-cut-disk.js';
import { pentagonSDF } from './components/community/gbms-pentagon.js';
import { octogonSDF } from './components/community/gbms-octogon.js';
import { hexagramSDF } from './components/community/gbms-hexagram.js';
import { chamferBoxSDF } from './components/community/gbms-chamfer-box.js';
import { parabolaSDF } from './components/community/gbms-parabola.js';
import { Random } from '../util/random.js';
import { sanityCheck, logSanityIssues } from './sanity.js';
import {
  stylizedTreeSDF,
  mapleLeafSDF,
  forestFlowerSDF,
  meteorStreakSDF,
  grassFieldSDF,
} from './components/atoms/forest-scene.js';
import {
  moonSDF,
  starSDF,
  sunSDF,
  cloudPuffSDF,
  pineTreeSDF,
  broadleafTreeSDF,
  cottageSDF,
  flagOnPoleSDF,
  birdSilhouetteSDF,
} from './components/atoms/scene-atoms.js';
import {
  // animals
  cowSDF,
  horseSDF,
  pigSDF,
  dogSDF,
  sheepSDF,
  catSDF,
  // landscape
  rockBoulderSDF,
  fenceSectionSDF,
  hillMoundSDF,
  streamSegmentSDF,
  // architecture
  towerSquareSDF,
  churchSpireSDF,
  gazeboSDF,
  wellSDF,
  fountainSDF,
  // vehicles
  sailboatSmallSDF,
  carSimpleSDF,
  wagonSDF,
  biplaneSDF,
  // furniture
  chairSDF,
  tableRoundSDF,
  lampStandingSDF,
  bookshelfSDF,
  wineBottleSDF,
  // mechanical
  gearFlatSDF,
  pipeLBendSDF,
  smokestackSDF,
  windmillSDF,
  // plants
  flowerSDF,
  mushroomSDF,
  bushSDF,
  vineSDF,
  grassTuftSDF,
} from './components/atoms/scene-atoms-extra.js';
import {
  union,
  difference,
  intersection,
  rep,
  unionChamfer,
  intersectionChamfer,
  differenceChamfer,
  unionRound,
  intersectionRound,
  differenceRound,
  unionSoft,
  unionStairs,
  intersectionStairs,
  differenceStairs,
  unionColumns,
  intersectionColumns,
  differenceColumns,
  pipe,
  engrave,
  groove,
  tongue,
} from '../sdf/dn.js';
import { evalT } from '../sdf/time.js';
import {
  validate,
  PRIMITIVE_TYPES,
  BOOLEAN_OPS,
  DOMAIN_OPS,
  normalizeType,
  resolveMaterial,
  resolvePattern,
} from './spec.js';
import { expandCompositeAtoms } from './composite-atoms.js';
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
  circle: (a) => circle(a.radius ?? 1, a.center),
  ellipse: (a) => ellipse(a.rx ?? 1, a.ry ?? 1, a.center),
  rectangle: (a) => rectangle(a.dims ?? a.size ?? 1, a.center, a.a, a.b),
  rounded_rectangle: (a) =>
    rounded_rectangle(a.dims ?? a.size ?? 1, a.cornerR ?? a.radius ?? 0, a.center),
  triangle: (a) => triangle(a.a ?? a.p0, a.b ?? a.p1, a.c ?? a.p2),
  hexagon: (a) => hexagon(a.radius ?? 1),
  polygon: (a) => polygon(a.points ?? []),
  // NOTE: star/moon/horseshoe/rhombus/flower factories are defined below in
  // the "Community 2D ports" block (lines ~335-460). They take a different
  // arg shape (radius / shape / la / lb / ...) and supersede any earlier
  // d2-style entries here. Do NOT re-add d2-style versions for these names
  // — JS object key dedup silently picks the later one and ESLint flags it
  // (no-dupe-keys). Removed 2026-06-16 per Wave 2 audit.
  heart: (a) => heart(a.scale ?? 0.4),
  arc: (a) => arc(a.radius ?? 1, a.halfAperture ?? Math.PI / 2, a.thickness ?? 0.05, a.center),
  segment: (a) => segment(a.a, a.b, a.radius ?? a.r ?? 0.05),
  ring: (a) => ring(a.radius ?? 1, a.thickness ?? 0.05, a.center),
  cross: (a) =>
    cross(a.armLength ?? 0.4, a.halfT ?? a.halfThickness ?? 0.1, a.cornerR ?? a.cornerRadius ?? 0),
  rounded_cross: (a) =>
    rounded_cross(
      a.armLength ?? 0.4,
      a.halfT ?? a.halfThickness ?? 0.1,
      a.cornerR ?? a.cornerRadius ?? 0.025,
    ),
  pie: (a) => pie(a.halfAperture ?? Math.PI / 4, a.radius ?? 0.5),
  pie_slice: (a) => pie_slice(a.halfAperture ?? Math.PI / 4, a.radius ?? 0.5),
  egg: (a) => egg(a.ra ?? 0.4, a.rb ?? 0.15),
  trapezoid: (a) => trapezoid(a.a, a.b, a.ra, a.rb),
  isosceles_trapezoid: (a) => isosceles_trapezoid(a.r1 ?? 0.2, a.r2 ?? 0.4, a.h ?? 0.3),
  parallelogram: (a) =>
    parallelogram(a.halfWidth ?? a.w ?? 0.3, a.halfHeight ?? a.h ?? 0.2, a.skew ?? 0.1),
  oriented_box: (a) => oriented_box(a.a, a.b, a.thickness ?? 0.1),
  quadratic_bezier: (a) => quadratic_bezier(a.A, a.B, a.C, a.thickness ?? a.t ?? 0.02),
  line: (a) => line(a.normal, a.point),
  slab: (a) => slab(a),
  rounded_x: (a) => rounded_x(a.w ?? 0.4, a.r ?? 0.05),
  vesica: (a) => vesica(a),

  // -- Community 2D ports (Track 4 — /port-shader pipeline dogfood) --
  'cut-disk': (a) => cutDiskSDF({ radius: a.radius ?? 0.5, cut: a.cut ?? 0 }),
  // -- Community 2D ports (Track 4 batch — 2026-05-27, gbms pentagon family + parabola + chamfer) --
  pentagon: (a) => pentagonSDF({ radius: a.radius ?? 0.5 }),
  octogon: (a) => octogonSDF({ radius: a.radius ?? 0.5 }),
  hexagram: (a) => hexagramSDF({ radius: a.radius ?? 0.5 }),
  'chamfer-box': (a) =>
    chamferBoxSDF({ dims: a.dims ?? a.size ?? [0.5, 0.3], chamfer: a.chamfer ?? 0.08 }),
  parabola: (a) => parabolaSDF({ k: a.k ?? 1.0 }),

  // -- 3D --
  sphere: (a) => sphere(a.radius ?? 1, a.center),
  box: (a) => box(a.dims ?? a.size ?? 1, a.center),
  rounded_box: (a) => rounded_box(a.dims ?? a.size ?? 0.6, a.cornerR ?? a.radius ?? 0.05),
  torus: (a) => torus(a.majorR ?? a.radius ?? 0.4, a.minorR ?? a.thickness ?? 0.1),
  capsule: (a) => capsule(a.a, a.b, a.radius ?? a.r ?? 0.1),
  cylinder: (a) => cylinder(a.radius ?? 0.3, a.height ?? 1.0),
  capped_cylinder: (a) => capped_cylinder(a.a, a.b, a.radius ?? 0.1),
  cone: (a) => cone(a.height ?? 0.5, a.baseRadius ?? a.radius ?? 0.3),
  capped_cone: (a) => capped_cone(a.a, a.b, a.r1 ?? a.ra ?? 0.3, a.r2 ?? a.rb ?? 0.1),
  ellipsoid: (a) => ellipsoid(a.dims ?? a.radii ?? [0.4, 0.3, 0.4]),
  plane: (a) => plane(a.normal ?? [0, 1, 0], a.point ?? a.offset ?? [0, 0, 0]),
  pyramid: (a) => pyramid(a.height ?? a.h ?? 0.5),
  slab3: (a) => slab3(a),
  wireframe_box: (a) => wireframe_box(a.dims ?? a.size ?? 0.6, a.edgeR ?? a.thickness ?? 0.04),
  tri_prism: (a) => tri_prism(a.halfWidth ?? 0.3, a.halfLength ?? 0.1),
  prism: (a) => tri_prism(a.halfWidth ?? 0.3, a.halfLength ?? 0.1),
  tetrahedron: (a) => tetrahedron(a.radius ?? a.r ?? 0.4),
  octahedron: (a) => octahedron(a.radius ?? a.r ?? 0.4),
  dodecahedron: (a) => dodecahedron(a.radius ?? a.r ?? 0.4),
  icosahedron: (a) => icosahedron(a.radius ?? a.r ?? 0.4),

  // -- Community-ported (see src/scene/components/community/) --
  'solid-angle': (a) =>
    solidAngleSDF({
      halfAperture: a.halfAperture ?? Math.PI / 6,
      radius: a.radius ?? 0.5,
    }),

  // -- Atlas chart atoms (see src/scene/components/charts/) --
  'pyramid-3d': (a) =>
    pyramid3dSDF({
      levels: a.levels ?? 5,
      baseWidth: a.baseWidth ?? a.base ?? 2.0,
      topWidth: a.topWidth ?? a.top ?? 0.4,
      layerHeight: a.layerHeight ?? a.thickness ?? 0.3,
      gap: a.gap ?? 0.05,
      depth: a.depth ?? 0.6,
      colors: a.colors ?? null,
    }),
  'bar-3d': (a) =>
    bar3dSDF({
      values: a.values ?? a.data ?? [0.3, 0.7, 1.0, 0.5, 0.8],
      count: a.count ?? null,
      barWidth: a.barWidth ?? a.width ?? 0.4,
      barDepth: a.barDepth ?? a.depth ?? 0.4,
      gap: a.gap ?? 0.1,
      maxHeight: a.maxHeight ?? a.scale ?? 2.0,
      colors: a.colors ?? null,
    }),
  'column-3d': (a) =>
    column3dSDF({
      values: a.values ?? a.data ?? [0.3, 0.5, 0.7, 0.4, 0.8],
      count: a.count ?? null,
      barWidth: a.barWidth ?? a.thickness ?? 0.4,
      barDepth: a.barDepth ?? a.depth ?? 0.4,
      gap: a.gap ?? 0.1,
      maxHeight: a.maxHeight ?? a.length ?? a.scale ?? 2.0,
    }),
  'line-3d': (a) =>
    line3dSDF({
      values: a.values ?? a.data ?? [0.3, 0.5, 0.7, 0.4, 0.8, 0.9],
      count: a.count ?? null,
      pointSpacing: a.pointSpacing ?? a.spacing ?? 0.5,
      pointRadius: a.pointRadius ?? a.markerSize ?? 0.08,
      lineThickness: a.lineThickness ?? a.thickness ?? 0.04,
      maxHeight: a.maxHeight ?? a.scale ?? 2.0,
      closed: a.closed ?? false,
    }),
  'pie-3d': (a) =>
    pie3dSDF({
      values: a.values ?? a.data ?? [0.3, 0.2, 0.15, 0.2, 0.15],
      count: a.count ?? null,
      outerRadius: a.outerRadius ?? a.radius ?? 1.0,
      innerRadius: a.innerRadius ?? a.holeRadius ?? 0,
      thickness: a.thickness ?? a.depth ?? 0.3,
      startAngle: a.startAngle ?? Math.PI / 2,
      clockwise: a.clockwise ?? true,
    }),
  'kpi-card-3d': (a) =>
    kpiCard3dSDF({
      width: a.width ?? 1.6,
      height: a.height ?? 1.0,
      depth: a.depth ?? a.thickness ?? 0.15,
      cornerRadius: a.cornerRadius ?? a.radius ?? 0.08,
      value: a.value ?? 0,
      label: a.label ?? '',
      unit: a.unit ?? '',
      trend: a.trend ?? 'flat',
      trendValue: a.trendValue ?? 0,
    }),
  'business-icon': (a) =>
    businessIconSDF({
      name: a.name ?? 'check',
      size: a.size ?? 1.0,
      thickness: a.thickness ?? 0.15,
      depth: a.depth ?? 0.15,
    }),
  'cover-3d': (a) =>
    cover3dSDF({
      stageWidth: a.stageWidth ?? a.width ?? 4.0,
      stageDepth: a.stageDepth ?? a.depth ?? 2.0,
      stageThickness: a.stageThickness ?? a.floorThickness ?? 0.2,
      backdropHeight: a.backdropHeight ?? a.wallHeight ?? 2.5,
      backdropThickness: a.backdropThickness ?? a.wallThickness ?? 0.15,
      cornerRadius: a.cornerRadius ?? a.radius ?? 0.1,
      title: a.title ?? '',
      subtitle: a.subtitle ?? '',
    }),
  'text-3d-extruded': (a) =>
    text3dExtrudedSDF({
      text: a.text ?? '',
      strokeWidth: a.strokeWidth ?? a.weight ?? 0.12,
      height: a.height ?? a.size ?? 1.0,
      depth: a.depth ?? a.thickness ?? 0.2,
      letterSpacing: a.letterSpacing ?? a.spacing ?? 0,
      align: a.align ?? 'center',
    }),
  'text-3d-pipe': (a) => {
    // Defensive clamp: pipeRadius < 0.04 renders as a thin wire that
    // visually disappears at any reasonable camera distance. Lift v3.16
    // prompt documents this as Trap 1, but enforce at runtime too — LLM
    // hallucination of `pipeRadius: 0.01` would otherwise silently fail.
    const requestedR = a.pipeRadius ?? a.tubeRadius ?? 0.06;
    const PIPE_RADIUS_MIN = 0.04;
    const safeR = Math.max(requestedR, PIPE_RADIUS_MIN);
    if (safeR !== requestedR) {
      console.warn(
        `[compile] text-3d-pipe pipeRadius clamped ${requestedR} → ${safeR} (Trap 1: thin pipe disappears at distance)`,
      );
    }
    return text3dPipeSDF({
      text: a.text ?? '',
      pipeRadius: safeR,
      height: a.height ?? a.size ?? 1.0,
      letterSpacing: a.letterSpacing ?? a.spacing ?? 0,
      align: a.align ?? 'center',
    });
  },
  'cube-3d': (a) => cube3dSDF(a),
  'sphere-fill-3d': (a) =>
    sphereFill3dSDF({
      levels: a.levels ?? a.fills ?? [0.25, 0.5, 0.75, 1.0],
      count: a.count ?? null,
      radius: a.radius ?? 0.6,
      spacing: a.spacing ?? a.gap ?? 0.3,
      colors: a.colors ?? null,
      radii: a.radii ?? null,
      cage: a.cage ?? true,
      cageThickness: a.cageThickness ?? 0.025,
      fillScale: a.fillScale ?? 0.92,
    }),
  'sphere-network-3d': (a) =>
    sphereNetwork3dSDF({
      count: a.count ?? 6,
      hubRadius: a.hubRadius ?? 0.5,
      satelliteRadius: a.satelliteRadius ?? a.nodeRadius ?? 0.28,
      radius: a.radius ?? a.orbit ?? 1.5,
      linkThickness: a.linkThickness ?? a.thickness ?? 0.05,
      arrangement: a.arrangement ?? 'ring',
    }),
  'sphere-tree-3d': (a) =>
    sphereTree3dSDF({
      levels: a.levels ?? a.depth ?? 3,
      branching: a.branching ?? a.fanout ?? 2,
      rootRadius: a.rootRadius ?? a.radius ?? 0.4,
      radiusFalloff: a.radiusFalloff ?? 0.78,
      levelHeight: a.levelHeight ?? 1.0,
      spread: a.spread ?? a.width ?? 3.0,
      linkThickness: a.linkThickness ?? a.thickness ?? 0.045,
    }),
  'sphere-segmented-3d': (a) =>
    sphereSegmented3dSDF({
      segments: a.segments ?? a.count ?? 6,
      radius: a.radius ?? 0.7,
      explode: a.explode ?? a.gap ?? 0.12,
      gapAngle: a.gapAngle ?? 0.06,
    }),
  'arrow-3d': (a) =>
    arrow3dSDF({
      length: a.length ?? 1.6,
      shaftWidth: a.shaftWidth ?? a.width ?? 0.18,
      headLength: a.headLength ?? 0.5,
      headWidth: a.headWidth ?? 0.5,
      depth: a.depth ?? 0.3,
      double: a.double ?? false,
    }),
  'diamond-3d': (a) =>
    diamond3dSDF({
      width: a.width ?? 0.9,
      crownHeight: a.crownHeight ?? 0.3,
      pavilionHeight: a.pavilionHeight ?? 0.7,
      tableRatio: a.tableRatio ?? 0.45,
    }),
  'gear-3d': (a) =>
    gear3dSDF({
      teeth: a.teeth ?? 12,
      radius: a.radius ?? 0.7,
      thickness: a.thickness ?? a.depth ?? 0.25,
      toothDepth: a.toothDepth ?? 0.16,
      toothWidth: a.toothWidth ?? 0.18,
      holeRadius: a.holeRadius ?? 0.22,
    }),
  'cube-segmented-3d': (a) =>
    cubeSegmented3dSDF({
      segments: a.segments ?? a.count ?? 4,
      size: a.size ?? 1.2,
      gap: a.gap ?? 0.08,
      axis: a.axis ?? 'x',
    }),
  'circle-frame-3d': (a) =>
    circleFrame3dSDF({
      radius: a.radius ?? 0.7,
      frameWidth: a.frameWidth ?? a.tube ?? 0.12,
      backDepth: a.backDepth ?? a.depth ?? 0.06,
      back: a.back ?? true,
    }),
  'circle-stack-3d': (a) =>
    circleStack3dSDF({
      count: a.count ?? 4,
      radius: a.radius ?? 0.7,
      taper: a.taper ?? 0.85,
      diskHeight: a.diskHeight ?? a.thickness ?? 0.18,
      gap: a.gap ?? 0.06,
      colors: a.colors ?? null,
    }),
  'mountain-3d': (a) =>
    mountain3dSDF({
      height: a.height ?? 2.4,
      baseRadius: a.baseRadius ?? 1.5,
      sidePeaks: a.sidePeaks ?? 2,
      spread: a.spread ?? 1.7,
      sideScale: a.sideScale ?? 0.6,
      pathMarkers: a.pathMarkers ?? 4,
      markerRadius: a.markerRadius ?? 0.13,
    }),
  'icon-grid-3d': (a) =>
    iconGrid3dSDF({
      rows: a.rows ?? 2,
      cols: a.cols ?? 4,
      tileSize: a.tileSize ?? 0.8,
      gap: a.gap ?? 0.22,
      tileDepth: a.tileDepth ?? 0.22,
      glyphs: a.glyphs ?? null,
    }),
  'device-mockup-3d': (a) =>
    deviceMockup3dSDF({
      device: a.device ?? 'phone',
      scale: a.scale ?? 1,
      depth: a.depth ?? 0.16,
      bezel: a.bezel ?? 0.1,
    }),
  'circle-segmented-3d': (a) =>
    circleSegmented3dSDF({
      segments: a.segments ?? a.count ?? 6,
      radius: a.radius ?? 0.8,
      innerRatio: a.innerRatio ?? 0.55,
      thickness: a.thickness ?? a.depth ?? 0.2,
      gapWidth: a.gapWidth ?? 0.12,
    }),
  'circle-loop-3d': (a) =>
    circleLoop3dSDF({
      segments: a.segments ?? a.count ?? 4,
      radius: a.radius ?? 0.7,
      tube: a.tube ?? 0.07,
      headLength: a.headLength ?? 0.34,
      headRadius: a.headRadius ?? 0.16,
    }),
  'relationship-graph-3d': (a) =>
    relationshipGraph3dSDF({
      count: a.count ?? 6,
      radius: a.radius ?? 1.3,
      nodeRadius: a.nodeRadius ?? 0.26,
      linkThickness: a.linkThickness ?? a.thickness ?? 0.05,
      edges: a.edges ?? null,
    }),
  'org-chart-3d': (a) =>
    orgChart3dSDF({
      levels: a.levels ?? a.depth ?? 3,
      branching: a.branching ?? a.fanout ?? 2,
      nodeW: a.nodeW ?? 0.5,
      nodeH: a.nodeH ?? 0.3,
      nodeD: a.nodeD ?? 0.18,
      levelHeight: a.levelHeight ?? 0.9,
      spread: a.spread ?? a.width ?? 3.4,
      linkThickness: a.linkThickness ?? a.thickness ?? 0.04,
    }),
  'flow-chart-3d': (a) =>
    flowChart3dSDF({
      steps: a.steps ?? a.count ?? 4,
      nodeW: a.nodeW ?? 0.6,
      nodeH: a.nodeH ?? 0.4,
      nodeD: a.nodeD ?? 0.2,
      gap: a.gap ?? 0.55,
      linkThickness: a.linkThickness ?? a.thickness ?? 0.05,
    }),
  'tree-diagram-3d': (a) =>
    treeDiagram3dSDF({
      levels: a.levels ?? a.depth ?? 3,
      branching: a.branching ?? a.fanout ?? 2,
      nodeRadius: a.nodeRadius ?? 0.18,
      levelWidth: a.levelWidth ?? 0.95,
      spread: a.spread ?? 2.6,
      linkThickness: a.linkThickness ?? a.thickness ?? 0.04,
    }),
  'mindmap-3d': (a) =>
    mindmap3dSDF({
      branches: a.branches ?? a.count ?? 5,
      centerRadius: a.centerRadius ?? 0.34,
      branchRadius: a.branchRadius ?? 0.2,
      leafRadius: a.leafRadius ?? 0.12,
      mainDist: a.mainDist ?? 1.1,
      leafDist: a.leafDist ?? 0.55,
      leavesPerBranch: a.leavesPerBranch ?? 2,
      linkThickness: a.linkThickness ?? a.thickness ?? 0.04,
    }),
  'timeline-3d': (a) =>
    timeline3dSDF({
      count: a.count ?? a.milestones ?? 5,
      axisLength: a.axisLength ?? 3.4,
      axisRadius: a.axisRadius ?? 0.05,
      markerRadius: a.markerRadius ?? 0.16,
      stemHeight: a.stemHeight ?? 0.45,
      stemThickness: a.stemThickness ?? 0.035,
      alternate: a.alternate ?? true,
    }),
  'matrix-grid-3d': (a) =>
    matrixGrid3dSDF({
      rows: a.rows ?? 2,
      cols: a.cols ?? 2,
      cardW: a.cardW ?? 0.9,
      cardH: a.cardH ?? 0.7,
      cardD: a.cardD ?? a.depth ?? 0.18,
      gap: a.gap ?? 0.18,
    }),
  'progression-3d': (a) =>
    progression3dSDF({
      steps: a.steps ?? a.count ?? 5,
      run: a.run ?? 0.5,
      stepRise: a.stepRise ?? 0.3,
      depth: a.depth ?? 0.5,
    }),
  'agenda-list-3d': (a) =>
    agendaList3dSDF({
      items: a.items ?? a.count ?? 5,
      rowHeight: a.rowHeight ?? 0.5,
      chipSize: a.chipSize ?? 0.34,
      lineW: a.lineW ?? 2.0,
      lineH: a.lineH ?? 0.22,
      depth: a.depth ?? 0.12,
    }),
  'layer-stack-3d': (a) =>
    layerStack3dSDF({
      layers: a.layers ?? a.count ?? 4,
      layerW: a.layerW ?? 1.8,
      layerD: a.layerD ?? 1.2,
      layerH: a.layerH ?? 0.22,
      gap: a.gap ?? 0.12,
      taper: a.taper ?? 1.0,
      colors: a.colors ?? null,
    }),
  'bullet-list-3d': (a) =>
    bulletList3dSDF({
      items: a.items ?? a.count ?? 5,
      rowHeight: a.rowHeight ?? 0.45,
      bulletRadius: a.bulletRadius ?? 0.11,
      lineW: a.lineW ?? 1.8,
      lineH: a.lineH ?? 0.16,
      depth: a.depth ?? 0.1,
    }),
  'funnel-3d': (a) =>
    funnel3dSDF({
      stages: a.stages ?? a.count ?? 4,
      topRadius: a.topRadius ?? 0.95,
      bottomRadius: a.bottomRadius ?? 0.22,
      stageHeight: a.stageHeight ?? 0.4,
      gap: a.gap ?? 0.06,
      colors: a.colors ?? null,
    }),
  'venn-3d': (a) =>
    venn3dSDF({
      sets: a.sets ?? a.count ?? 3,
      radius: a.radius ?? 0.7,
      tube: a.tube ?? 0.07,
      overlap: a.overlap ?? 0.45,
    }),
  'waterfall-3d': (a) =>
    waterfall3dSDF({
      count: a.count ?? 5,
      deltas: a.deltas ?? null,
      barW: a.barW ?? 0.5,
      gap: a.gap ?? 0.12,
      depth: a.depth ?? 0.4,
    }),
  'scatter-3d': (a) =>
    scatter3dSDF({
      count: a.count ?? 12,
      spread: a.spread ?? 1.4,
      dotRadius: a.dotRadius ?? 0.09,
      axes: a.axes ?? true,
      axisRadius: a.axisRadius ?? 0.03,
    }),
  'gantt-3d': (a) =>
    gantt3dSDF({
      tasks: a.tasks ?? a.count ?? 4,
      segments: a.segments ?? null,
      rowHeight: a.rowHeight ?? 0.42,
      barH: a.barH ?? 0.26,
      depth: a.depth ?? 0.18,
      trackLength: a.trackLength ?? 3.0,
    }),
  'gauge-3d': (a) =>
    gauge3dSDF({
      value: a.value ?? 0.7,
      radius: a.radius ?? 0.9,
      tube: a.tube ?? 0.1,
      needleLen: a.needleLen ?? 0.8,
      needleWidth: a.needleWidth ?? 0.07,
      depth: a.depth ?? 0.2,
    }),
  'fishbone-3d': (a) =>
    fishbone3dSDF({
      ribs: a.ribs ?? a.count ?? 6,
      spineLength: a.spineLength ?? 2.8,
      spineRadius: a.spineRadius ?? 0.05,
      ribLength: a.ribLength ?? 0.7,
      ribThickness: a.ribThickness ?? 0.04,
      headSize: a.headSize ?? 0.3,
    }),
  'traffic-light-3d': (a) =>
    trafficLight3dSDF({
      lights: a.lights ?? a.count ?? 3,
      lightRadius: a.lightRadius ?? 0.22,
      spacing: a.spacing ?? 0.55,
      housingPad: a.housingPad ?? 0.12,
      depth: a.depth ?? 0.3,
      colors: a.colors ?? null,
    }),
  'radial-spoke-3d': (a) =>
    radialSpoke3dSDF({
      spokes: a.spokes ?? a.count ?? 8,
      hubRadius: a.hubRadius ?? 0.25,
      spokeThickness: a.spokeThickness ?? 0.05,
      minLen: a.minLen ?? 0.55,
      maxLen: a.maxLen ?? 1.2,
      nodeRadius: a.nodeRadius ?? 0.1,
    }),
  'puzzle-piece-3d': (a) =>
    puzzlePiece3dSDF({
      size: a.size ?? 1.0,
      depth: a.depth ?? 0.25,
      knob: a.knob ?? 0.24,
    }),
  link: (a) =>
    linkSDF({
      halfLength: a.halfLength ?? a.le ?? 0.13,
      majorR: a.majorR ?? a.radius ?? 0.1,
      minorR: a.minorR ?? a.thickness ?? 0.02,
    }),
  'capped-torus': (a) =>
    cappedTorusSDF({
      capAngle: a.capAngle ?? a.halfAperture ?? Math.PI / 2,
      majorR: a.majorR ?? a.radius ?? 0.4,
      minorR: a.minorR ?? a.thickness ?? 0.1,
    }),
  'hex-prism': (a) =>
    hexPrismSDF({
      apothem: a.apothem ?? a.radius ?? 0.3,
      halfHeight: a.halfHeight ?? a.halfLength ?? 0.5,
    }),
  'octagon-prism': (a) =>
    octagonPrismSDF({
      apothem: a.apothem ?? a.radius ?? 0.3,
      halfHeight: a.halfHeight ?? a.halfLength ?? 0.5,
    }),
  'round-cone': (a) =>
    roundConeSDF({
      baseRadius: a.baseRadius ?? a.r1 ?? 0.3,
      topRadius: a.topRadius ?? a.r2 ?? 0.1,
      height: a.height ?? a.h ?? 0.6,
    }),
  rhombus: (a) =>
    rhombusSDF({
      la: a.la ?? 0.4,
      lb: a.lb ?? 0.2,
      h: a.h ?? a.halfHeight ?? 0.05,
      cornerR: a.cornerR ?? a.ra ?? 0.02,
    }),
  horseshoe: (a) =>
    horseshoeSDF({
      openAngle: a.openAngle ?? Math.PI / 3,
      radius: a.radius ?? a.r ?? 0.4,
      length: a.length ?? a.le ?? 0.1,
      halfWidth: a.halfWidth ?? 0.08,
      halfDepth: a.halfDepth ?? 0.04,
    }),
  'u-shape': (a) =>
    uShapeSDF({
      radius: a.radius ?? a.r ?? 0.3,
      legLength: a.legLength ?? a.le ?? 0.2,
      halfWidth: a.halfWidth ?? 0.06,
      halfDepth: a.halfDepth ?? 0.04,
    }),

  // -- Atlas scene atoms (high-semantic composites of primitives, hand-authored) --
  moon: (a) => moonSDF({ radius: a.radius ?? 0.4 }),
  star: (a) => starSDF({ radius: a.radius ?? 0.08, shape: a.shape ?? 'octahedron' }),
  sun: (a) => sunSDF({ radius: a.radius ?? 0.4, haloThickness: a.haloThickness ?? 0.06 }),
  'cloud-puff': (a) =>
    cloudPuffSDF({
      width: a.width ?? a.dims?.[0] ?? 1.0,
      height: a.height ?? a.dims?.[1] ?? 0.45,
      depth: a.depth ?? a.dims?.[2] ?? 0.6,
    }),
  'tree-pine': (a) =>
    pineTreeSDF({
      trunkHeight: a.trunkHeight ?? 0.5,
      trunkRadius: a.trunkRadius ?? 0.1,
      foliageHeight: a.foliageHeight ?? 1.4,
      foliageBaseR: a.foliageBaseR ?? a.foliageR ?? 0.55,
      layers: a.layers ?? 3,
    }),
  'tree-broadleaf': (a) =>
    broadleafTreeSDF({
      trunkHeight: a.trunkHeight ?? 0.7,
      trunkRadius: a.trunkRadius ?? 0.09,
      foliageR: a.foliageR ?? a.foliageRadius ?? 0.55,
    }),
  cottage: (a) =>
    cottageSDF({
      width: a.width ?? a.size ?? 0.8,
      height: a.height ?? 0.6,
      roofHeight: a.roofHeight ?? a.roofPitch ?? 0.45,
    }),
  'flag-on-pole': (a) =>
    flagOnPoleSDF({
      poleHeight: a.poleHeight ?? a.height ?? 2.0,
      poleRadius: a.poleRadius ?? 0.04,
      flagWidth: a.flagWidth ?? a.width ?? 0.5,
      flagHeight: a.flagHeight ?? 0.3,
      flagSide: a.flagSide ?? 1,
    }),
  'bird-silhouette': (a) =>
    birdSilhouetteSDF({
      bodyLength: a.bodyLength ?? 0.18,
      bodyRadius: a.bodyRadius ?? 0.025,
      wingSpan: a.wingSpan ?? 0.45,
      wingRise: a.wingRise ?? 0.1,
    }),

  // -- v3.0 atom expansion — animals --
  cow: (a) => cowSDF({ scale: a.scale ?? 1 }),
  horse: (a) => horseSDF({ scale: a.scale ?? 1 }),
  pig: (a) => pigSDF({ scale: a.scale ?? 1 }),
  dog: (a) => dogSDF({ scale: a.scale ?? 1 }),
  sheep: (a) => sheepSDF({ scale: a.scale ?? 1 }),
  cat: (a) => catSDF({ scale: a.scale ?? 1 }),
  // -- landscape --
  'rock-boulder': (a) => rockBoulderSDF({ scale: a.scale ?? 1 }),
  'fence-section': (a) => fenceSectionSDF({ length: a.length ?? 1.5, height: a.height ?? 0.5 }),
  'hill-mound': (a) => hillMoundSDF({ radius: a.radius ?? 1.5, height: a.height ?? 0.5 }),
  'stream-segment': (a) =>
    streamSegmentSDF({ length: a.length ?? 2.0, width: a.width ?? 0.3, depth: a.depth ?? 0.05 }),
  // -- architecture --
  'tower-square': (a) =>
    towerSquareSDF({
      width: a.width ?? 1.0,
      height: a.height ?? 4.0,
      roofHeight: a.roofHeight ?? 0.8,
    }),
  'church-spire': (a) =>
    churchSpireSDF({
      width: a.width ?? 0.8,
      baseHeight: a.baseHeight ?? 1.5,
      spireHeight: a.spireHeight ?? 2.5,
    }),
  gazebo: (a) =>
    gazeboSDF({
      radius: a.radius ?? 0.8,
      height: a.height ?? 1.2,
      roofHeight: a.roofHeight ?? 0.6,
    }),
  well: (a) => wellSDF({ radius: a.radius ?? 0.4, wallHeight: a.wallHeight ?? 0.5 }),
  fountain: (a) => fountainSDF({ radius: a.radius ?? 0.7, basinHeight: a.basinHeight ?? 0.3 }),
  // -- vehicles --
  'sailboat-small': (a) => sailboatSmallSDF({ scale: a.scale ?? 1 }),
  'car-simple': (a) => carSimpleSDF({ scale: a.scale ?? 1 }),
  wagon: (a) => wagonSDF({ scale: a.scale ?? 1 }),
  biplane: (a) => biplaneSDF({ scale: a.scale ?? 1 }),
  // -- furniture --
  chair: (a) => chairSDF({ scale: a.scale ?? 1 }),
  'table-round': (a) => tableRoundSDF({ radius: a.radius ?? 0.5, height: a.height ?? 0.5 }),
  'lamp-standing': (a) => lampStandingSDF({ scale: a.scale ?? 1 }),
  bookshelf: (a) =>
    bookshelfSDF({ width: a.width ?? 0.8, height: a.height ?? 1.5, depth: a.depth ?? 0.25 }),
  'wine-bottle': (a) => wineBottleSDF({ scale: a.scale ?? 1 }),
  // -- mechanical --
  'gear-flat': (a) =>
    gearFlatSDF({ radius: a.radius ?? 0.5, thickness: a.thickness ?? 0.08, teeth: a.teeth ?? 12 }),
  'pipe-l-bend': (a) => pipeLBendSDF({ scale: a.scale ?? 1 }),
  smokestack: (a) => smokestackSDF({ radius: a.radius ?? 0.25, height: a.height ?? 3.0 }),
  windmill: (a) => windmillSDF({ scale: a.scale ?? 1 }),
  // -- plants --
  flower: (a) => flowerSDF({ stemHeight: a.stemHeight ?? 0.6, bloomRadius: a.bloomRadius ?? 0.12 }),
  mushroom: (a) =>
    mushroomSDF({ stemHeight: a.stemHeight ?? 0.15, capRadius: a.capRadius ?? 0.12 }),
  bush: (a) => bushSDF({ radius: a.radius ?? 0.4 }),
  vine: (a) => vineSDF({ length: a.length ?? 1.0, thickness: a.thickness ?? 0.02 }),
  'grass-tuft': (a) => grassTuftSDF({ count: a.count ?? 5, height: a.height ?? 0.15 }),

  // -- Time-aware --
  waves: (a) => waves(a.freq ?? 2, a.amp ?? 0.5, a.angle ?? 0, a.speed ?? 0),

  // -- Heightfield-as-SDF (afl_ext-inspired open-ocean) --
  // Auto-attaches material.kind='sea' downstream so the renderer routes hits
  // through its sea-shading branch (fresnel + atmosphere reflection + sun glint).
  // Authors can also override colour by passing an explicit material with a
  // custom kind value, but defaults already give the iconic open-ocean look.
  'sea-surface': (a) => seaSurfaceSDF({ depth: a.depth ?? 1.0, scale: a.scale ?? 0.6 }),

  // -- Venice-style procedural building (canal sprint Day 1) --
  'canal-building': (a) =>
    canalBuildingSDF({
      width: a.width ?? 2.0,
      height: a.height ?? 6.0,
      winX: a.winX ?? 5,
      winY: a.winY ?? 8,
    }),
  'canal-windows': (a) =>
    canalWindowsSDF({
      width: a.width ?? 2.0,
      height: a.height ?? 6.0,
      winX: a.winX ?? 5,
      winY: a.winY ?? 8,
      density: a.density ?? 0.4,
      seed: a.seed ?? 1.0,
    }),
  'canal-bridge': (a) =>
    canalBridgeSDF({
      span: a.span ?? 8.0,
      archR: a.archR ?? 1.6,
      thickness: a.thickness ?? 1.2,
    }),
  'canal-lamp-bulb': (a) =>
    canalLampBulbSDF({
      bulbY: a.bulbY ?? 4.0,
      bulbR: a.bulbR ?? 0.3,
    }),
  'terrain-heightmap': (a) =>
    terrainHeightmapSDF({
      maxHeight: a.maxHeight ?? 30.0,
      hwRatio: a.hwRatio ?? 0.08,
    }),
  'terrain-elevated': (a) =>
    terrainElevatedSDF({
      maxHeight: a.maxHeight ?? 60.0,
      scale: a.scale ?? 0.012,
      ridgePower: a.ridgePower ?? 2.4,
      mountainness: a.mountainness ?? 0.4,
      cliffStart: a.cliffStart ?? 600.0,
      cliffEnd: a.cliffEnd ?? 600.0,
      cliffJump: a.cliffJump ?? 0.0,
      canopyAmount: a.canopyAmount ?? 0.0,
    }),
  'terrain-with-lakes': (a) =>
    terrainWithLakesSDF({
      maxHeight: a.maxHeight ?? 60.0,
      scale: a.scale ?? 0.012,
      ridgePower: a.ridgePower ?? 2.4,
      mountainness: a.mountainness ?? 0.4,
      waterLevel: a.waterLevel ?? 0.0,
      lakeScale: a.lakeScale ?? 0.0008,
      lakeAmount: a.lakeAmount ?? 0.3,
    }),
  'arch-bridge': (a) =>
    archBridgeSDF({
      bridgeLen: a.bridgeLen ?? a.length ?? 30.0,
      bridgeWidth: a.bridgeWidth ?? a.width ?? 4.0,
      archH: a.archH ?? a.archHeight ?? 6.0,
      railH: a.railH ?? a.railHeight ?? 1.5,
      cornerOff: a.cornerOff ?? a.cornerOffset ?? 10.0,
    }),
  'terrain-canyon': (a) =>
    terrainCanyonSDF({
      maxHeight: a.maxHeight ?? 35.0,
      scale: a.scale ?? 0.015,
      ridgePower: a.ridgePower ?? 2.0,
      mountainness: a.mountainness ?? 0.2,
      displaceAmt: a.displaceAmt ?? 4.0,
      yStretch: a.yStretch ?? 4.0,
    }),
  'procedural-city': (a) =>
    proceduralCitySDF({
      blockSize: a.blockSize ?? 1.0,
      maxHeight: a.maxHeight ?? 18.0,
      downtownK: a.downtownK ?? 4.0,
    }),
  'terrain-eroded-rune': (a) =>
    terrainErodedRuneSDF({
      boxSize: a.boxSize ?? [0.5, 1.0, 0.5],
      waterHeight: a.waterHeight ?? 0.46,
    }),

  // -- Forest sprint (stylized-tree + maple-leaf + flower + meteor) --
  'stylized-tree': (a) =>
    stylizedTreeSDF({
      trunkLen: a.trunkLen ?? a.trunkHeight ?? 5.0,
      trunkRad: a.trunkRad ?? a.trunkRadius ?? 0.4,
      leafSize: a.leafSize ?? 0.18,
      windK: a.windK ?? a.wind ?? 0.12,
    }),
  'maple-leaf': (a) =>
    mapleLeafSDF({
      scale: a.scale ?? 0.15,
      rand: a.rand ?? a.seed ?? 0.5,
    }),
  'forest-flower': (a) =>
    forestFlowerSDF({
      stemH: a.stemH ?? a.stemHeight ?? 1.0,
      bloomR: a.bloomR ?? a.bloomRadius ?? 0.16,
    }),
  'grass-field': (a) =>
    grassFieldSDF({
      bladeHeight: a.bladeHeight ?? a.height ?? 0.4,
      density: a.density ?? a.cellSize ?? 0.1,
    }),
  'meteor-streak': (a) =>
    meteorStreakSDF({
      origin: a.origin ?? [-15, 18, 25],
      velocity: a.velocity ?? [3.5, -2.5, 0.5],
      trailLen: a.trailLen ?? a.length ?? 1.4,
      period: a.period ?? 7.0,
      activeFrac: a.activeFrac ?? 0.5,
      phase: a.phase ?? 0.0,
    }),

  // -- 2026-05-23 IQ P2 batch — 8 new 3D primitives ----------------------
  'cut-sphere': (a) => cutSphere(a.radius ?? a.r ?? 0.5, a.h ?? a.height ?? 0.0),
  'cut-hollow-sphere': (a) =>
    cutHollowSphere(a.radius ?? a.r ?? 0.5, a.h ?? a.height ?? 0.0, a.t ?? a.thickness ?? 0.02),
  'death-star': (a) => deathStar(a.ra ?? 0.5, a.rb ?? 0.35, a.d ?? a.distance ?? 0.5),
  'rounded-cylinder': (a) =>
    roundedCylinder(a.ra ?? a.radius ?? 0.3, a.rb ?? a.cornerR ?? 0.05, a.h ?? a.height ?? 0.5),
  'round-cone-ab': (a) =>
    roundConeAB(a.a ?? [0, 0, 0], a.b ?? [0, 1, 0], a.r1 ?? a.ra ?? 0.2, a.r2 ?? a.rb ?? 0.1),
  'vesica-segment': (a) => vesicaSegment(a.a ?? [0, 0, 0], a.b ?? [0, 1, 0], a.w ?? a.width ?? 0.2),
  'cylinder-inf': (a) => cylinderInf(a.axisXZ ?? a.axis ?? [0, 0], a.radius ?? a.r ?? 0.3),
  'cone-inf': (a) => coneInf(a.halfAperture ?? a.angle ?? Math.PI / 6),

  // Sprint 3: p5-sketch is rendered by 2d-p5 iframe sandbox, NOT compiled to
  // SDF. visual-panel detects this subject type before compile() and routes
  // to mountP5Renderer. compile() callers (e.g., CPU renderers) shouldn't be
  // asked to render p5-sketch directly — if they are, this returns a sentinel
  // "always outside" SDF so the renderer produces an empty image rather than
  // crashing.
  'p5-sketch': () => () => 1e9, // SDF that returns large positive (always outside)

  // -- 2D → 3D pseudo-primitives (handled separately because of `source` field) --
  // Marker entries; actual compile happens in compilePseudoPrimitive.
  extrude: null,
  extrude_to: null,
  revolve: null,
};

const PSEUDO_PRIMITIVES = new Set(['extrude', 'revolve', 'extrude_to']);

// Exported for the registry-sync test (scripts/test-primitive-registry-sync.mjs):
// the canonical types that have a real factory, and the pseudo (2D-source-wrap)
// types. Lets the test assert spec.PRIMITIVE_TYPES ↔ factories stay in sync so a
// type can't pass validate() but then throw in compile() for a missing factory.
export const PRIMITIVE_FACTORY_TYPES = Object.keys(PRIMITIVE_FACTORIES).filter(
  (k) => PRIMITIVE_FACTORIES[k] != null,
);
export const PSEUDO_PRIMITIVE_TYPES = [...PSEUDO_PRIMITIVES];

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
export function compile(sceneData, options = {}) {
  // Pre-pass: composite atoms (Track 5.4a). Replaces `carrier-strike-group` /
  // `airport-apron` / `harbor-quay` subjects with their peer-subject
  // expansions PLUS optional cinematic patches (postFx + camera + volumes).
  // Idempotent: no-op when no composite types present.
  sceneData = expandCompositeAtoms(sceneData);

  const result = validate(sceneData);
  if (!result.ok) {
    throw new Error(`SceneData validation failed:\n  - ${result.errors.join('\n  - ')}`);
  }

  // -------------------------------------------------------------------------
  // Resolve PRNG for hash-derived bakes (terrain-eroded-rune, future NFT-style
  // primitives). Priority: explicit options.rng > options.tokenHash >
  // sceneData.defaults.seed > fixed fallback. Hash format: 0x-prefix 64 hex.
  // -------------------------------------------------------------------------
  const FALLBACK_HASH = '0x' + 'a3f1c92b48d6e077152834f9b62d8e1c93a4f7b528e6c1d09f3b475a682c9e1d';
  let rng = options.rng;
  if (!rng) {
    const hash = options.tokenHash || sceneData.defaults?.seed || FALLBACK_HASH;
    rng = new Random(hash);
  }

  // -------------------------------------------------------------------------
  // Bake hook: scan subjects for types that need pre-render data baking.
  // Phase 1 supports a single terrain-eroded-rune per scene (Phase 2+ may
  // generalize to a PRIMITIVE_BAKES registry with per-primitive uniforms).
  // -------------------------------------------------------------------------
  let bakedHeightmap = null;
  const findErodedRune = (subs) => {
    for (const s of subs || []) {
      if (s.type === 'terrain-eroded-rune') return s;
      if (Array.isArray(s.children)) {
        const f = findErodedRune(s.children);
        if (f) return f;
      }
      if (s.source) {
        const f = findErodedRune([s.source]);
        if (f) return f;
      }
    }
    return null;
  };
  const erodedSubj = findErodedRune(sceneData.subjects);
  if (erodedSubj) {
    const args = erodedSubj.args || {};
    bakedHeightmap = bakeHeightmap(rng, args, args.cacheResolution ?? 512);
  }

  // Sprint 4: Subject motion slot map. Each subjectMotion entry → uniform slot
  // index. Inject uniform-driven offset into the subject's transform.translate
  // so the compiled SDF gets `p - (staticOffset + u_subjectOffset[slot])` at
  // every leaf. FLY 3D uploads u_subjectOffset[slot] per frame from the
  // evaluator's CarInt output.
  const motionSlots = {};
  const motionList = sceneData.cameraSequence?.subjectMotion;
  if (Array.isArray(motionList)) {
    motionList.forEach((m, i) => {
      if (typeof m.subjectId === 'string') motionSlots[m.subjectId] = i;
    });
    injectSubjectMotionTransforms(sceneData.subjects, motionSlots);
  }

  // Compile each subject
  const subjectInfos = []; // { id, region, sdf } flat list (post-compile)
  const topLevelSdfs = []; // top-level SDFs for the final union

  for (const subj of sceneData.subjects) {
    const compiled = compileSubject(subj, 'object', subjectInfos);
    if (compiled.sdf != null) {
      // Tag the post-transform top-level SDF with its resolved material +
      // pattern. sdf3.compile.js flattenUnion propagates both down to all
      // descendant leaves (including atoms that internally union N parts).
      //
      // sea-surface auto-attaches the 'sea' kind so the renderer routes hits
      // through its sea-shading branch without the author needing to spell
      // out material in SceneData. Explicit material on the subject overrides.
      //
      // IMPORTANT: only override if the top-level subj defines material.
      // compileSubject / compileDomain may have already propagated material
      // from nested leaves up to compiled.sdf (e.g. canal-building inside
      // curve→rep). Unconditional overwrite would wipe that out.
      const topLevelMat = resolveMaterial(subj.material);
      if (topLevelMat != null) {
        compiled.sdf._subjectMaterial = topLevelMat;
      } else if (subj.type === 'sea-surface' && compiled.sdf._subjectMaterial == null) {
        compiled.sdf._subjectMaterial = resolveMaterial({
          hue: 0.58,
          sat: 0.4,
          value: 0.2,
          metal: 0,
          glow: 0,
          kind: 'sea',
        });
      } else if (subj.type === 'procedural-city' && compiled.sdf._subjectMaterial == null) {
        // Auto-attach building material kind for window grid + sky reflection.
        compiled.sdf._subjectMaterial = resolveMaterial({
          hue: 0.6,
          sat: 0.05,
          value: 0.85,
          metal: 0.4,
          glow: 0,
          kind: 'building',
        });
      } else if (subj.type === 'terrain-eroded-rune' && compiled.sdf._subjectMaterial == null) {
        // Auto-attach Rune full-shading material kind (cliff/dirt/grass/snow/
        // sand/tree/drainage all dispatched inside material kind=7 branch).
        compiled.sdf._subjectMaterial = resolveMaterial({
          hue: 0.3,
          sat: 0.5,
          value: 0.6,
          metal: 0,
          glow: 0,
          kind: 'eroded-terrain',
        });
      } else if (subj.type === 'terrain-canyon' && compiled.sdf._subjectMaterial == null) {
        // Auto-attach mountain material with red-orange sandstone tint.
        // mountain branch reads leafMat.x/y to tint the rock + ground layers
        // (see Sprint A5 mountain rock tint upgrade). Default canyon = Bryce.
        compiled.sdf._subjectMaterial = resolveMaterial({
          hue: 0.06,
          sat: 0.62,
          value: 0.85,
          metal: 0,
          glow: 0,
          kind: 'mountain',
        });
      } else if (
        (subj.type === 'terrain-heightmap' ||
          subj.type === 'terrain-elevated' ||
          subj.type === 'terrain-with-lakes') &&
        compiled.sdf._subjectMaterial == null
      ) {
        // Mountain material: hue/sat/value mostly irrelevant — mountain branch
        // uses snow/rock palette internally. kind=2 routes to that branch.
        compiled.sdf._subjectMaterial = resolveMaterial({
          hue: 0.6,
          sat: 0.05,
          value: 0.7,
          metal: 0,
          glow: 0,
          kind: 'mountain',
        });
      } else if (subj.type === 'meteor-streak' && compiled.sdf._subjectMaterial == null) {
        // Meteor: warm-white emissive (warm tail trail). kind=3 routes to the
        // emissive branch in flyLambert (bypass lighting, base * (1 + 4*glow)).
        compiled.sdf._subjectMaterial = resolveMaterial({
          hue: 0.1,
          sat: 0.35,
          value: 1.0,
          metal: 0,
          glow: 2.0,
          kind: 'emissive',
        });
      } else if (subj.type === 'maple-leaf' && compiled.sdf._subjectMaterial == null) {
        // Maple leaf: autumn red default + translucent kind=4 → HG backlight
        // when sun behind leaf. Author can override with any HSV + kind.
        compiled.sdf._subjectMaterial = resolveMaterial({
          hue: 0.02,
          sat: 0.85,
          value: 0.55,
          metal: 0,
          glow: 0,
          kind: 'translucent',
        });
      } else if (subj.type === 'grass-field' && compiled.sdf._subjectMaterial == null) {
        // Grass: fresh green + translucent kind=4 → HG backlight at twilight.
        compiled.sdf._subjectMaterial = resolveMaterial({
          hue: 0.28,
          sat: 0.7,
          value: 0.5,
          metal: 0,
          glow: 0,
          kind: 'translucent',
        });
      }
      // (compiled.sdf already keeps any nested-propagated _subjectMaterial.)
      const topLevelPat = resolvePattern(subj.pattern);
      if (topLevelPat != null) {
        compiled.sdf._subjectPattern = topLevelPat;
      }
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
    // Default material so renderer doesn't fall to a random hash-palette
    // color. Authors can override by setting `ground.material` in SceneData.
    groundSdf._subjectMaterial = resolveMaterial(sceneData.ground.material ?? 'stone');
    groundSdf._subjectPattern = resolvePattern(sceneData.ground.pattern ?? null);
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

  const compileResult = {
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
    // Sprint 3: volumes are NOT compiled into the SDF tree — they're a parallel
    // render-time pass that integrates density along the eye ray. Pass-through
    // so FLY 3D can pick them up at render time.
    volumes: Array.isArray(sceneData.volumes) ? sceneData.volumes : [],
    // Sprint 4: subject motion slot map (subjectId → uniform array index).
    // FLY 3D uploads u_subjectOffset[slot] per frame from evaluator output.
    motionSlots,
    // Sprint 12 (Rune erosion): if scene has a terrain-eroded-rune subject,
    // bakeHeightmap was called above and the resulting Float32Array goes here.
    // flyLambert checks for this on setScene and uploads as sampler2D u_heightmap.
    // Shape: { data: Float32Array(W*H*4), width, height, params } | null.
    bakedHeightmap,
    // Track 5.1 (M5 prereq): geometry sanity check — populated below.
    sanityResult: null,
    meta: {
      id: sceneData.id,
      name: sceneData.name,
      hash: sceneData.hash,
      source: sceneData.source,
      palette: sceneData.defaults?.palette,
    },
  };

  // ----- Track 5.1: geometry sanity (warn-only, non-blocking) -----
  // Compile() always runs this unless caller opts out via { sanity: false }.
  // Errors + warnings get console.warn'd; result.sanityResult exposed for
  // editor / regression tooling. The render path is NOT blocked even on
  // high-severity issues — caller decides what to do.
  if (options.sanity !== false) {
    try {
      compileResult.sanityResult = sanityCheck(sceneData, compileResult);
      const sr = compileResult.sanityResult;
      if (sr.all.length > 0) {
        logSanityIssues(sr.all, {
          prefix: `[sanity ${sceneData.id || sceneData.name || '<scene>'}]`,
        });
      }
    } catch (e) {
      console.warn(`[sanity] checker itself threw: ${e.message}`);
    }
  }

  return compileResult;
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

  // 2. Build base SDF. Normalize snake/kebab alias defensively (validator
  // already normalizes in place, but support direct callers too).
  const factory = PRIMITIVE_FACTORIES[normalizeType(subj.type)];
  if (!factory) throw new Error(`compile: no factory for primitive "${subj.type}"`);
  let sdf = factory(resolvedArgs);

  // A single-leaf atom can carry its per-leaf tags on the factory SDF itself
  // (e.g. sphere-fill-3d with ONE sphere returns the bare sphere with its fill
  // fraction on _subjectPattern). The non-union applyTransform branch below wraps
  // the SDF and drops those tags (same as the union branch, which re-attaches per
  // child) — capture them now so we can re-attach after transform. Without this a
  // lone fill gauge loses its fill and renders as plain glass (fill=0).
  const factoryMat = sdf?._subjectMaterial;
  const factoryPat = sdf?._subjectPattern;

  // 3. Apply transform. If the factory returned a UNION (a multi-leaf atom such
  // as sphere-fill-3d, where each leaf carries its own _subjectMaterial /
  // _subjectPattern), push the transform DOWN onto each union child instead of
  // wrapping the union — otherwise applyTransform wraps the union AST in a
  // translate/rotate/scale op node that flattenUnion (sdf3.compile) can't descend,
  // collapsing all leaves into one and dropping their per-leaf material/pattern
  // (same failure mode as the compileBoolean union push-down below). This is
  // mathematically equivalent: the transform acts on the query point and min()
  // distributes over union, so the geometry is unchanged.
  const hasOuterTransform = subj.transform != null || hasTransformAnim(subj.animation);
  const isUnion = sdf?.ast?.kind === 'op' && sdf.ast.name === 'union';
  if (isUnion && hasOuterTransform) {
    const k = sdf.ast.opts?.k;
    const kids = sdf.ast.children.map((c) => {
      const t = applyTransform(c, subj.transform, subj.animation);
      // applyTransform wrappers drop leaf tags — re-attach from the inner child.
      if (c._subjectMaterial !== undefined) t._subjectMaterial = c._subjectMaterial;
      if (c._subjectPattern !== undefined) t._subjectPattern = c._subjectPattern;
      return t;
    });
    sdf = k != null ? union(...kids, { k }) : union(...kids);
  } else {
    sdf = applyTransform(sdf, subj.transform, subj.animation);
    // Re-attach leaf tags the applyTransform wrapper dropped (mirrors the union
    // branch above). Subject-level material/pattern in step 4 still overrides.
    if (factoryMat !== undefined) sdf._subjectMaterial = factoryMat;
    if (factoryPat !== undefined) sdf._subjectPattern = factoryPat;
  }

  // 4. Attach material/pattern at leaf level. Required when a primitive is
  // nested inside DomainGroup ops (rep / curve / mirror / twist / bend) —
  // the wrapping op SDF doesn't carry material, so flattenUnion needs to
  // find it on the leaf. Top-level subjects also set this on their outer
  // SDF, but leaf-level always wins via the inner-override rule.
  if (subj.material != null) {
    sdf._subjectMaterial = resolveMaterial(subj.material);
  }
  if (subj.pattern != null) {
    sdf._subjectPattern = resolvePattern(subj.pattern);
  }

  // 5. Region tracking
  const region = subj.region ?? defaultRegion;
  subjectInfos.push({ id: subj.id, region, sdf });

  return { sdf, region };
}

function compilePseudoPrimitive(subj, defaultRegion, subjectInfos) {
  // extrude / revolve / extrude_to wrap a 2D source
  const source = compileSubject(subj.source, defaultRegion, []); // don't track source in flat list
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

  // 2026-05-24 fix: attach material/pattern from the wrapper subject to the SDF
  // so downstream flattenUnion in sdf3.compile finds the LUT entry. Without
  // this, extrude/revolve/extrude_to subjects with material on the wrapper
  // (not on the source) silently fall back to the cosPalette hash color —
  // surfaced when jet-aircraft.json red-star insignia rendered green. Source
  // material is inherited only if the wrapper itself lacks one.
  if (subj.material != null) {
    sdf._subjectMaterial = resolveMaterial(subj.material);
  } else if (source.sdf._subjectMaterial !== undefined) {
    sdf._subjectMaterial = source.sdf._subjectMaterial;
  }
  if (subj.pattern != null) {
    sdf._subjectPattern = resolvePattern(subj.pattern);
  } else if (source.sdf._subjectPattern !== undefined) {
    sdf._subjectPattern = source.sdf._subjectPattern;
  }

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
  const children = subj.children.map((c) => compileSubject(c, groupRegion, [])); // children regions discarded for SubjectInfo
  // Unwrap if single child (Rule 5 warning case)
  if (children.length === 1) {
    let sdf = applyTransform(children[0].sdf, subj.transform, subj.animation);
    subjectInfos.push({ id: subj.id, region: groupRegion, sdf });
    return { sdf, region: groupRegion };
  }

  const k = subj.args?.k;
  const r = subj.args?.r ?? 0.05;
  // 2026-05-24: for union / smoothUnion, push the group's transform onto each
  // child BEFORE building the union. Otherwise applyTransform wraps the union
  // AST in a translate/rotate/scale op node, which flattenUnion (in sdf3.compile)
  // doesn't recognize → the entire union collapses into a single leaf, and all
  // 30 children's per-leaf materials are lost → hash-palette fallback paints
  // everything green. By pushing transforms down, the union AST stays on top
  // where flattenUnion descends correctly and each child keeps its material.
  // Other boolean ops (difference, intersection, chamfer, etc) are already
  // treated as single leaves by flattenUnion, so this optimization doesn't
  // apply — outer transform stays on the result there.
  const hasOuterTransform = subj.transform != null || hasTransformAnim(subj.animation);
  const isUnionLike = subj.type === 'union' || subj.type === 'smoothUnion';
  const childSdfs =
    isUnionLike && hasOuterTransform
      ? children.map((c) => {
          const t = applyTransform(c.sdf, subj.transform, subj.animation);
          // applyTransform creates wrappers that drop _subjectMaterial — re-attach
          // it from the inner child so flattenUnion finds it on the wrapper.
          if (c.sdf._subjectMaterial !== undefined) t._subjectMaterial = c.sdf._subjectMaterial;
          if (c.sdf._subjectPattern !== undefined) t._subjectPattern = c.sdf._subjectPattern;
          return t;
        })
      : children.map((c) => c.sdf);
  // When transforms have been pushed down, skip the outer applyTransform below.
  const skipOuterTransform = isUnionLike && hasOuterTransform;
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
  } else if (subj.type === 'unionSoft') {
    sdf = unionSoft(...childSdfs, { r: subj.args?.r ?? 0.1 });
  } else if (subj.type === 'unionStairs') {
    sdf = unionStairs(...childSdfs, { r: subj.args?.r ?? 0.1, n: subj.args?.n ?? 3 });
  } else if (subj.type === 'intersectionStairs') {
    sdf = intersectionStairs(...childSdfs, { r: subj.args?.r ?? 0.1, n: subj.args?.n ?? 3 });
  } else if (subj.type === 'differenceStairs') {
    sdf = differenceStairs(...childSdfs, { r: subj.args?.r ?? 0.1, n: subj.args?.n ?? 3 });
  } else if (subj.type === 'unionColumns') {
    sdf = unionColumns(...childSdfs, { r: subj.args?.r ?? 0.1, n: subj.args?.n ?? 3 });
  } else if (subj.type === 'intersectionColumns') {
    sdf = intersectionColumns(...childSdfs, { r: subj.args?.r ?? 0.1, n: subj.args?.n ?? 3 });
  } else if (subj.type === 'differenceColumns') {
    sdf = differenceColumns(...childSdfs, { r: subj.args?.r ?? 0.1, n: subj.args?.n ?? 3 });
  } else if (subj.type === 'pipe') {
    sdf = pipe(...childSdfs, { r: subj.args?.r ?? 0.05 });
  } else if (subj.type === 'engrave') {
    sdf = engrave(...childSdfs, { r: subj.args?.r ?? 0.05 });
  } else if (subj.type === 'groove') {
    sdf = groove(...childSdfs, { ra: subj.args?.ra ?? 0.05, rb: subj.args?.rb ?? 0.02 });
  } else if (subj.type === 'tongue') {
    sdf = tongue(...childSdfs, { ra: subj.args?.ra ?? 0.05, rb: subj.args?.rb ?? 0.02 });
  } else {
    throw new Error(`compile: unknown boolean op "${subj.type}"`);
  }

  if (!skipOuterTransform) {
    sdf = applyTransform(sdf, subj.transform, subj.animation);
  }
  // 2026-05-24: attach group-level material/pattern. flattenUnion only descends
  // into 'union' ops — all other BooleanGroup types (unionStairs / chamfer /
  // round / difference / intersection / pipe / engrave / groove / tongue) are
  // treated as single leaves. Without this, a `cathedral-plinth` with
  // `material: 'stone'` silently dropped → hash-palette fallback → pink.
  // Skip for union/smoothUnion where children carry their own materials
  // (pushing a group material would shadow per-child materials).
  if (!isUnionLike && subj.material != null) {
    sdf._subjectMaterial = resolveMaterial(subj.material);
  }
  if (!isUnionLike && subj.pattern != null) {
    sdf._subjectPattern = resolvePattern(subj.pattern);
  }
  subjectInfos.push({ id: subj.id, region: groupRegion, sdf });
  return { sdf, region: groupRegion };
}

// =============================================================================
// DomainGroup compile
// =============================================================================

function compileDomain(subj, defaultRegion, subjectInfos) {
  const region = subj.region ?? defaultRegion;
  const source = compileSubject(subj.source, region, []); // source-level region passed through

  const args = subj.args ?? {};
  let sdf;

  if (subj.type === 'rep') {
    // rep(sdf, period, options?)
    sdf = rep(
      source.sdf,
      args.period,
      args.count != null
        ? { count: args.count }
        : args.padding != null
          ? { padding: args.padding }
          : undefined,
    );
  } else if (subj.type === 'mirror') {
    sdf = applyMirror(source.sdf, args.axis);
  } else if (subj.type === 'twist') {
    sdf = twist(source.sdf, args.k);
  } else if (subj.type === 'bend') {
    sdf = bend(source.sdf, args.k);
  } else if (subj.type === 'curve') {
    // axis defaults to 'z' (Venice canal idiom: z drives sinusoidal x offset).
    const axisIdx = args.axis === 'x' ? 0 : args.axis === 'y' ? 1 : 2;
    sdf = curve(source.sdf, args.amplitude, args.frequency, axisIdx);
  } else if (subj.type === 'modPolar') {
    sdf = modPolar(source.sdf, { axis: args.axis, repetitions: args.repetitions });
  } else if (subj.type === 'mirrorOctant') {
    sdf = mirrorOctant(source.sdf, { plane: args.plane, dist: args.dist });
  } else {
    throw new Error(`compile: unknown domain op "${subj.type}"`);
  }

  // applyTransform creates new wrapper SDFs (scale/rotate/translate) that
  // don't carry _subjectMaterial, so we must attach AFTER the transform.
  sdf = applyTransform(sdf, subj.transform, subj.animation);

  // Propagate material/pattern from source up to the wrapping domain SDF.
  // flattenUnion in sdf3.compile only descends into 'union' ops — it treats
  // rep/curve/mirror/twist/bend as opaque leaves, so material attached to
  // the inner primitive wouldn't be found unless we lift it onto the wrapper.
  // Subject-level material on the domain op itself takes precedence.
  if (subj.material != null) {
    sdf._subjectMaterial = resolveMaterial(subj.material);
  } else if (source.sdf._subjectMaterial !== undefined) {
    sdf._subjectMaterial = source.sdf._subjectMaterial;
  }
  if (subj.pattern != null) {
    sdf._subjectPattern = resolvePattern(subj.pattern);
  } else if (source.sdf._subjectPattern !== undefined) {
    sdf._subjectPattern = source.sdf._subjectPattern;
  }

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
    if (expr == null) continue; // skip incomplete channels (validator warned)
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
    if (rotVec.every((c) => typeof c === 'number')) {
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
  return animation.some(
    (ch) => typeof ch.channel === 'string' && ch.channel.startsWith('transform.'),
  );
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
  const base =
    Array.isArray(staticVec) && staticVec.length === 3 ? [...staticVec] : [...defaultVec];
  const axes = ['x', 'y', 'z'];
  for (let i = 0; i < 3; i++) {
    const channelKey = `${prefix}.${axes[i]}`;
    if (animMap[channelKey] != null) base[i] = animMap[channelKey];
  }
  return base;
}

function isVec3Zero(v) {
  return v.every((c) => typeof c === 'number' && c === 0);
}

function isComponentZero(c) {
  return typeof c === 'number' && c === 0;
}

// =============================================================================
// Camera / Light / Shadow extraction + evaluator
// =============================================================================

// =============================================================================
// Sprint 4: subject motion injection
// -----------------------------------------------------------------------------
// For each subject whose id is in motionSlots map, mutate its transform.translate
// to embed a uniform-driven offset: [x, y, z] → [sumT(x, uniformT(...x)), ...].
// The downstream applyTransform (and the Sprint 2 union push-down) will emit
// the translate as `vec3((staticX + u_subjectOffset[slot].x), ...)` in GLSL.
//
// FLY 3D updates u_subjectOffset[slot] every frame from evaluateSubjectMotion's
// CarInt output. SDF compile is one-shot; per-frame cost is only a vec3
// uniform upload.
// =============================================================================
function injectSubjectMotionTransforms(subjects, motionSlots) {
  if (!Array.isArray(subjects)) return;
  const axisLetter = ['x', 'y', 'z'];
  for (const subj of subjects) {
    const slot = motionSlots[subj.id];
    if (slot === undefined) continue;
    if (!subj.transform) subj.transform = {};
    const t = subj.transform;
    const base = Array.isArray(t.translate) ? t.translate.slice(0, 3) : [0, 0, 0];
    while (base.length < 3) base.push(0);
    t.translate = base.map((v, i) =>
      sumT(v, uniformT(`u_subjectOffset[${slot}].${axisLetter[i]}`)),
    );
  }
}

function pickCamera(cam) {
  return {
    yaw: cam.yaw ?? 0,
    pitch: cam.pitch ?? 0,
    distance: cam.distance ?? 3,
    focal: cam.focal ?? 1.5,
    targetX: cam.targetX ?? 0,
    targetY: cam.targetY ?? 0,
    targetZ: cam.targetZ ?? 0,
    // Sprint 1: DoF fields. Default 0 = no DoF (back-compat).
    aperture: cam.aperture ?? 0,
    focalDistance: cam.focalDistance ?? 0,
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
        .map((ch) => ({ field: ch.channel, timeExpr: normalizeChannel(ch) }))
        .filter((c) => c.timeExpr != null) // skip incomplete channels (validator warned)
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
      const dv = typeof d === 'number' ? d : d.length === 1 ? d[0] : d[0][0];
      if (dv <= REGION_EPS) return info.region;
    }
    if (groundInfo && p[1] !== undefined && p[1] <= groundInfo.y + REGION_EPS) {
      return groundInfo.region;
    }
    return 'background';
  };
}
