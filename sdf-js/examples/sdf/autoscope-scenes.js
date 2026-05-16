// =============================================================================
// autoscope-scenes —— Erik Swahn Autoscope 6 个 generative scene template
// -----------------------------------------------------------------------------
// 直接 1:1 翻译 Autoscope sketch.js 的 6 个 if 块（scene 0..5），用我们的
// autoscope-primitives.js compose。每个 scene 返回顶层 union(...) SDF3，
// BOB GPU 渲染时每个 child leaf 获得独立 objNum → 多色块。
//
// 坐标约定：autoscope 原版 y=0 ground。autoscope-clone Page 通过关闭 BOB shader 的
// groundOn 让 scene 自己提供 ground（plane / waves / slanted）。
//
// API：
//   scene0_city(rng, opts) → SDF3
//   scene1_sea(rng, opts) → SDF3
//   ...
//   generateScene(sceneType, rng, opts) → SDF3   // 0..5 派发
// =============================================================================

import {
  boxE, cylinderE, houseP, houseC, houseS,
  arch, arch2, vault, cutouts,
  tree1, tree2, tree3,
  person1, person2, person3, person4,
  animal1, animal2,
  bird1, bird2, bird3, bird4,
  backdrop, autoscopePyramid, autoscopeCone, waves,
} from './autoscope-primitives.js';
import { sphere, box, cylinder, plane, cone, tri_prism } from '../../src/sdf/d3.js';
import { union, difference } from '../../src/sdf/dn.js';

const PI = Math.PI;

// =============================================================================
// Ground primitives —— 每个 scene 自己挑
// =============================================================================

// Flat ground at y=0. SDF = p.y (positive above, negative below)
function groundFlat() {
  return plane([0, -1, 0], [0, 0, 0]);
}

// Slanted ground (autoscope 'p.y-.05*p.z')
function groundSlant(slopeZ = 0.05) {
  return plane([0, -1, slopeZ], [0, 0, 0]);
}

// Wavy ground (autoscope `addGround('waves(...)')`)
function groundWaves(rng, opts = {}) {
  const freq = opts.freq ?? rng.random_num(2, 4);
  const amp  = opts.amp  ?? rng.random_num(0.33, 1);
  const angle = opts.angle ?? rng.random_angle();
  const speed = opts.speed ?? rng.random_num(0.1, 0.5);
  return waves(freq, amp, angle, speed);
}

// =============================================================================
// 公共 helpers —— 远景山 / 居民 / 鸟
// =============================================================================

// 远景山（cones + pyramids 在远处 z=75-150）
function mountainsParts(rng, count) {
  const parts = [];
  for (let i = 0; i < count; i++) {
    const pos = [rng.random_num(-15, 15), 0, rng.random_num(75, 150)];
    if (rng.random_bool(0.5)) {
      parts.push(autoscopeCone(pos, rng.random_num(10, 25), rng.random_num(1, 10)));
    } else {
      parts.push(autoscopePyramid(pos, [rng.random_num(10, 20), rng.random_num(1, 10), rng.random_num(10, 20)], rng.random_angle()));
    }
  }
  return parts;
}

// 居民（person1-4 + animal1-2 随机分布）
function inhabitantsParts(rng, count) {
  const parts = [];
  const types = [0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 4, 5];
  for (let i = 0; i < count; i++) {
    const t = rng.random_choice(types);
    const pos = [rng.random_num(-15, 15), 0, rng.random_num(-20, 5)];
    const h = rng.random_num(1, 2.2);
    let movement = [0, 0, 0];
    if (rng.random_bool(0.05)) {
      movement = [rng.random_num(-0.25, 0.25), 0, rng.random_num(-0.25, 0.25)];
    }
    if (t === 0) parts.push(person1(pos, h, movement));
    else if (t === 1) parts.push(person2(pos, h, movement));
    else if (t === 2) parts.push(person3(pos, h, movement));
    else if (t === 3) parts.push(person4(pos, h, movement));
    else if (t === 4) parts.push(animal1(pos, rng.random_num(0.25, 1.25), Math.abs(movement[0]), rng.random_angle()));
    else parts.push(animal2(pos, rng.random_num(0.25, 1), Math.abs(movement[0]), rng.random_angle()));
  }
  return parts;
}

// 鸟群（bird1-4 在空中 y=4-13）
function birdsParts(rng, count) {
  const parts = [];
  let types = [0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 3];
  if (rng.random_bool(0.05)) types = [rng.random_choice([0, 1, 2, 3])];
  for (let i = 0; i < count; i++) {
    const t = rng.random_choice(types);
    const pos = [rng.random_num(-10, 10), rng.random_num(4, 13), rng.random_num(-5, 15)];
    const speed = rng.random_num(2, 8);
    const rot = rng.random_angle();
    if (t === 0) parts.push(bird1(pos, rng.random_num(0.05, 0.4), rot, speed));
    else if (t === 1) parts.push(bird2(pos, rng.random_num(0.1, 0.6), rot, speed));
    else if (t === 2) parts.push(bird3([pos[0], rng.random_num(6, 13), pos[2]], 0.2, rot, rng.random_num(2, 12)));
    else parts.push(bird4([pos[0], rng.random_num(0, 13), pos[2]], 1, rot, rng.random_num(2, 12)));
  }
  return parts;
}

// =============================================================================
// Scene 0: City（15-30 buildings + backdrop + people + birds）
// =============================================================================
export function scene0_city(rng, opts = {}) {
  const parts = [groundFlat()];
  const buildings = rng.random_int(15, 30);
  const objectTypes = [0, 0, 0, 1, 1, 1, 2, 2, 3, 4];

  for (let i = 0; i < buildings; i++) {
    const t = rng.random_choice(objectTypes);
    const back = rng.random_num(20, 60);
    const left = rng.random_num(-5, -20);
    const right = rng.random_num(5, 20);
    // Autoscope: r([[r([left,right]),0,r(-10,back)], [r(left,right),0,back]])
    const pos = rng.random_bool(0.5)
      ? [rng.random_bool(0.5) ? left : right, 0, rng.random_num(-10, back)]
      : [rng.random_num(left, right), 0, back];

    if (t === 0) parts.push(boxE(pos, [rng.random_num(2, 6), rng.random_num(4, 20), rng.random_num(2, 6)]));
    else if (t === 1) parts.push(houseS(pos, [3 * rng.random_int(1, 2), rng.random_num(5, 20), 3 * rng.random_int(1, 2)], rng.random_angle()));
    else if (t === 2) parts.push(houseP(pos, [3 * rng.random_int(1, 2), rng.random_num(5, 20), 3 * rng.random_int(1, 2)], rng.random_num(3, 6), rng.random_angle()));
    else if (t === 3) parts.push(arch2(pos, [rng.random_num(4, 8), rng.random_num(2, 16), rng.random_num(2, 20)], 0));
    else parts.push(arch(pos, [rng.random_num(4, 8), rng.random_num(2, 16), rng.random_num(2, 20)], 0));
  }
  if (rng.random_bool(0.5)) parts.push(backdrop(80.1));

  // 远景山 50%
  if (rng.random_bool(0.5)) {
    parts.push(...mountainsParts(rng, rng.random_int(2, 9)));
  }
  // city 总是有人
  parts.push(...inhabitantsParts(rng, rng.random_int(4, 12)));
  // city 总是有鸟
  parts.push(...birdsParts(rng, rng.random_int(2, 8)));

  return union(...parts);
}

// =============================================================================
// Scene 1: Sea (wavy ground + occasional islands + mountains)
// =============================================================================
export function scene1_sea(rng, opts = {}) {
  const parts = [groundWaves(rng)];

  // 偶尔加 island / 石头
  if (rng.random_bool(0.2)) {
    parts.push(
      cylinder(rng.random_num(0.1, 0.4), rng.random_num(5, 15))
        .rotate(rng.random_num(0.1, 0.5) * (rng.random_bool(0.5) ? 1 : -1), [1, 0, 0])
        .translate([rng.random_num(-10, 10), 0, rng.random_num(5, 20)])
    );
  } else if (rng.random_bool(0.1)) {
    // 远处的高山岛
    parts.push(autoscopeCone([rng.random_num(-14, 14), -1, rng.random_num(5, 25)], rng.random_num(0.5, 2), rng.random_num(5, 15)));
  } else if (rng.random_bool(0.15)) {
    // 大圆柱（灯塔 / 岩柱）
    parts.push(
      cylinderE([rng.random_num(-10, 10), 0, rng.random_num(5, 20)], rng.random_num(7.5, 25), rng.random_num(1, 4))
    );
  }

  if (rng.random_bool(0.1)) {
    // 大箱（船 / 大平台）
    const w = rng.random_choice([10, 20, 50, 100]);
    const h = rng.random_choice([4, 8]);
    const d = rng.random_choice([10, 20, 40]);
    parts.push(boxE([0, 0, rng.random_num(-40, 40)], [w, h, d]));
  }
  if (rng.random_bool(0.15)) {
    parts.push(sphere(rng.random_num(0.25, 0.75)).translate([rng.random_num(-10, 10), 0.1, rng.random_num(0, 5)]));
  }

  // mountains in distance
  parts.push(...mountainsParts(rng, rng.random_int(3, 12)));
  // 鸟 25%
  if (rng.random_bool(0.25)) parts.push(...birdsParts(rng, rng.random_int(1, 6)));
  return union(...parts);
}

// =============================================================================
// Scene 2: Forest (4-12 trees, occasional house, mountains, lots of birds)
// =============================================================================
export function scene2_forest(rng, opts = {}) {
  const parts = [];
  // ground: 75% waves, 25% flat or slanted
  if (rng.random_bool(0.75)) {
    parts.push(waves(rng.random_num(2, 8), rng.random_num(0.5, 0.5), rng.random_angle(), 0));
  } else {
    parts.push(rng.random_bool(0.8) ? groundFlat() : groundSlant(0.05));
  }

  let treeCount = rng.random_int(4, 12);
  let treeTypes = [0, 0, 0, 0, 0, 0, 1, 1, 1, 2, 4];
  if (rng.random_bool(0.3)) {
    // 栅栏密度 - 用 cylinderE 重复
    treeTypes = [3, 3, 3, 3, 3, 3, 3, 3, 1, 4];
    treeCount *= 3;
  }

  for (let i = 0; i < treeCount; i++) {
    const t = rng.random_choice(treeTypes);
    const pos = [rng.random_int(-12, 12), 0, rng.random_int(10, 40)];
    if (t === 0) parts.push(tree1(pos, rng.random_num(3, 10)));
    else if (t === 1) parts.push(tree2(pos, rng.random_num(8, 20)));
    else if (t === 2) {
      const tr = rng.random_num(0.5, 1.5);
      parts.push(sphere(tr).translate([rng.random_int(-12, 12), tr * rng.random_num(0.3, 0.5), rng.random_int(10, 40)]));
    } else if (t === 3) {
      parts.push(cylinderE([rng.random_int(-15, 15), 0, rng.random_int(-40, 40)], 30, rng.random_num(0.15, 0.3)));
    } else if (t === 4) {
      parts.push(tree3([rng.random_int(-12, 12), 0, rng.random_int(10, 40)], rng.random_num(5, 12), rng.random_angle()));
    }
  }
  // 偶尔加房子
  if (rng.random_bool(0.33)) {
    if (rng.random_bool(0.5)) {
      parts.push(houseS([rng.random_num(-10, 10), 0, rng.random_num(-5, 30)], [rng.random_num(3, 5), 3, rng.random_num(3, 9)], rng.random_angle()));
    } else {
      parts.push(houseP([rng.random_num(-10, 10), 0, rng.random_num(-5, 30)], [3 * rng.random_int(1, 4), rng.random_num(3, 6), 3 * rng.random_int(1, 3)], 3, rng.random_angle()));
    }
  }

  // 远山一定有
  parts.push(...mountainsParts(rng, rng.random_int(4, 13)));
  // 人偶尔
  if (rng.random_bool(0.67)) parts.push(...inhabitantsParts(rng, rng.random_int(1, 6)));
  // 鸟必出现
  parts.push(...birdsParts(rng, rng.random_int(3, 11)));

  return union(...parts);
}

// =============================================================================
// Scene 3: Village (1-9 houses + occasional trees)
// =============================================================================
export function scene3_village(rng, opts = {}) {
  const parts = [groundFlat()];

  const buildings = rng.random_int(1, 9);
  for (let i = 0; i < buildings; i++) {
    const t = rng.random_choice([0, 0, 0, 1, 1, 1, 1, 2, 3]);
    const pos = [rng.random_num(-20, 20), 0, rng.random_num(-5, 40)];
    if (t === 0) parts.push(houseS(pos, [rng.random_num(3, 5), 3, rng.random_num(3, 20)], rng.random_angle()));
    else if (t === 1) parts.push(houseP(pos, [3 * rng.random_int(1, 4), rng.random_num(3, 6), 3 * rng.random_int(1, 3)], 3, rng.random_angle()));
    else if (t === 2) parts.push(houseP(pos, [3 * rng.random_int(1, 2), rng.random_num(5, 20), 3 * rng.random_int(1, 2)], rng.random_num(3, 6), rng.random_angle()));
    else parts.push(houseC(pos, [3 * rng.random_int(1, 4), rng.random_num(3, 6)], rng.random_num(3, 6)));
  }
  // 装饰：长 box / 圆柱
  if (rng.random_bool(0.1)) {
    parts.push(
      boxE([rng.random_num(-20, 20), 0, rng.random_num(-5, 40)], [3 * rng.random_int(2, 4), rng.random_num(6, 9), rng.random_int(1, 9)])
        .rotate(rng.random_angle(), [0, 1, 0])
    );
  }
  if (rng.random_bool(0.2)) {
    parts.push(cylinderE([rng.random_num(-20, 20), 0, rng.random_num(-5, 40)], rng.random_num(4, 20), 0.2));
  }
  // 33% 几棵树
  if (rng.random_bool(0.33)) {
    const treeCount = rng.random_int(1, 4);
    for (let i = 0; i < treeCount; i++) {
      const t = rng.random_choice([0, 0, 0, 0, 0, 1, 1, 1, 2, 3, 4]);
      const pos = [rng.random_num(-12, 12), 0, rng.random_num(10, 40)];
      if (t === 0) parts.push(tree1(pos, rng.random_num(3, 10)));
      else if (t === 1) parts.push(tree2(pos, rng.random_num(8, 20)));
      else if (t === 2) {
        const tr = rng.random_num(0.5, 1.5);
        parts.push(sphere(tr).translate([pos[0], tr * 0.3, pos[2]]));
      } else if (t === 3) {
        parts.push(cylinderE([rng.random_num(-15, 15), 0, rng.random_num(-40, 40)], 30, rng.random_num(0.15, 0.3)));
      } else {
        parts.push(tree3([rng.random_int(-12, 12), 0, rng.random_int(10, 40)], rng.random_num(5, 12), rng.random_angle()));
      }
    }
  }

  // 山 / 人 / 鸟
  if (rng.random_bool(0.5)) parts.push(...mountainsParts(rng, rng.random_int(2, 9)));
  parts.push(...inhabitantsParts(rng, rng.random_int(1, 6)));
  if (rng.random_bool(0.25)) parts.push(...birdsParts(rng, rng.random_int(1, 6)));

  return union(...parts);
}

// =============================================================================
// Scene 4: City axis (3-14 mixed + occasional vault/cutouts)
// =============================================================================
export function scene4_axis(rng, opts = {}) {
  const parts = [rng.random_bool(0.8) ? groundFlat() : groundSlant(0.025)];

  const buildings = rng.random_int(3, 14);
  let objectTypes;

  if (rng.random_bool(0.33)) {
    objectTypes = [0, 0, 0, 1, 3];
    // 偶尔加移动的"火车"长 box
    if (rng.random_bool(0.15)) {
      const boxes = rng.random_choice([1, 1, 1, 2]);
      for (let i = 0; i < boxes; i++) {
        const ang = rng.random_angle();
        const pos = [rng.random_num(-30, 30), 0, rng.random_num(-10, 10)];
        const dims = [rng.random_num(1, 15), rng.random_num(0.5, 2.5), 1];
        // 沿 X 用 linearT(1) 动画移动
        parts.push(
          boxE([0, 0, 0], dims)
            .rotate(ang, [0, 1, 0])
            .translate([pos[0], pos[1], pos[2]])
        );
      }
    }
  } else {
    objectTypes = [0, 0, 0, 0, 0, 1, 1, 2, 2, 4];
  }
  if (rng.random_bool(0.2)) objectTypes = [rng.random_choice([0, 1, 2, 3, 4])];

  for (let i = 0; i < buildings; i++) {
    const t = rng.random_choice(objectTypes);
    const pos = [rng.random_num(-15, 15), 0, rng.random_num(0, 70)];
    if (t === 0) parts.push(boxE(pos, [rng.random_num(2, 6), rng.random_num(4, 20), rng.random_num(2, 6)]));
    else if (t === 1) parts.push(cylinderE([pos[0], 0, pos[2]], rng.random_num(10, 50), 0.2));
    else if (t === 2) parts.push(houseP(pos, [3 * rng.random_int(1, 2), rng.random_num(5, 20), 3 * rng.random_int(1, 2)], rng.random_num(3, 6), rng.random_angle()));
    else if (t === 3) parts.push(arch2([rng.random_num(-10, 10), 0, rng.random_num(-5, 15)], [rng.random_num(4, 8), rng.random_num(2, 16), rng.random_num(2, 20)], 0));
    else {
      // 拱门连廊（rep 复制）
      const archW = rng.random_num(2, 6);
      const archH = rng.random_num(3, 10);
      const repCount = rng.random_choice([0, 0, 1, 10, 20]);
      const archUnit = arch([0, 0, 0], [archW, archH, rng.random_num(2, 5)], 0);
      const repeated = repCount === 0
        ? archUnit
        : archUnit.rep([archW * 2, 0, 0], { count: [repCount, 0, 0] });
      parts.push(repeated.rotate(rng.random_angle(), [0, 1, 0]).translate([rng.random_num(-20, 20), 0, rng.random_num(20, 40)]));
    }
  }

  // mountains + inhabitants + birds
  if (rng.random_bool(0.5)) parts.push(...mountainsParts(rng, rng.random_int(2, 9)));
  parts.push(...inhabitantsParts(rng, rng.random_int(1, 6)));
  if (rng.random_bool(0.25)) parts.push(...birdsParts(rng, rng.random_int(1, 4)));

  return union(...parts);
}

// =============================================================================
// Scene 5: Abstract (cursor walk stacking primitives)
// =============================================================================
export function scene5_abstract(rng, opts = {}) {
  const parts = [rng.random_bool(0.8) ? groundFlat() : groundSlant(0.05)];

  const jobCount = rng.random_choice([1, 2, 3]);
  for (let j = 0; j < jobCount; j++) {
    const cursor = [rng.random_num(-4, 4), 0, rng.random_num(-4, 4)];
    const steps = rng.random_int(4, 16);
    for (let i = 0; i < steps; i++) {
      const dims = [rng.random_num(2, 5), rng.random_num(2, 6), rng.random_num(2, 12)];
      const t = rng.random_choice([0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 2, 2, 3]);
      const pos = [...cursor];
      if (t === 0) {
        // Autoscope: box(p, loc, dims) — centered at loc with full dims
        parts.push(box(dims).translate(pos));
      } else if (t === 1) {
        dims[0] *= 0.25; dims[1] *= 0.25; dims[2] *= 0.25;
        parts.push(sphere(dims[0]).translate(pos));
      } else if (t === 2) {
        dims[0] *= 0.5;
        parts.push(cylinder(dims[0], dims[1]).translate(pos));
      } else {
        dims[0] *= 0.5;
        // Autoscope prism = triangular prism along Z. dims[0] = half-width, dims[1] = length
        parts.push(tri_prism(dims[0], dims[1]).translate(pos));
      }
      // 光标随机往邻近偏移
      cursor[0] += rng.random_int(-Math.floor(dims[0] * 0.8), Math.floor(dims[0] * 0.8));
      cursor[1] += rng.random_int(-Math.floor(dims[1] * 0.5), Math.floor(dims[1] * 0.8));
      cursor[2] += rng.random_int(-Math.floor(dims[2] * 0.8), Math.floor(dims[2] * 0.8));
    }
  }
  // mountains 50%
  if (rng.random_bool(0.5)) parts.push(...mountainsParts(rng, rng.random_int(0, 9)));

  return union(...parts);
}

// =============================================================================
// Dispatcher
// =============================================================================
const SCENE_FNS = [scene0_city, scene1_sea, scene2_forest, scene3_village, scene4_axis, scene5_abstract];
export const SCENE_NAMES = ['City', 'Sea', 'Forest', 'Village', 'City axis', 'Abstract'];

export function generateScene(sceneType, rng, opts = {}) {
  const n = SCENE_FNS.length;
  const idx = ((sceneType | 0) % n + n) % n;  // clamp + wrap
  return SCENE_FNS[idx](rng, opts);
}

export function randomSceneType(rng) {
  // Autoscope sketch.js: r([0,0,1,1,2,2,3,3,3,4,4,4,5]) weighted
  return rng.random_choice([0, 0, 1, 1, 2, 2, 3, 3, 3, 4, 4, 4, 5]);
}
