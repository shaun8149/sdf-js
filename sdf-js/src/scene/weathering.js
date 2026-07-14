// sdf-js/src/scene/weathering.js — Infinigen 研读第八课的移植产物。
// 配方来源(recipe-only):princeton-vl/infinigen (BSD-3)
//   assets/materials/wear_tear/edge_wear.py — Bevel 节点法线 vs 真法线的差 =
//     凸边探测器(shader 空间),掩膜驱动磨白 + 划痕
//   assets/materials/wear_tear/scratches.py — 层叠噪声掩膜调 color/roughness
//   assets/composition/material_assignments.py — wear_tear_prob [0.5, 0.5]:
//     磨损是概率叠加层,不是必选项
// 课文:docs/superpowers/infinigen-study/lesson-08-wear-axis.md
//
// 借/不借的核心论点:Infinigen 必须在 shader 里"侦探"边缘,因为 mesh 不知道
// 自己的曲率;SDF 端曲率是一等参数(rounded_box 的 cornerR、smoothUnion 的 k
// 本来就是"边有多圆")—— 所以几何磨损 = 转旋钮,不需要探测器。这里只移植
// 材质面的年龄轴;几何面在工厂里用参数本身表达(boulder-factory 的 age)。
// 不借:划痕噪声掩膜(shader 表面工作,SDF 端对应物是 L02 位移场,预算贵)。

const clamp01 = (v) => Math.max(0, Math.min(1, v));

// wear_tear_prob 的对应物:约半数物种带磨损(调用方在物种 lane 上掷)
export const WEAR_PROB = 0.5;

/**
 * weatherMaterial(mat, age) → material
 * 材质的年龄轴(edge_wear 磨白 + scratches 糙化的蒸馏,全局而非掩膜级):
 * 漂白(value/sat 衰减)、粗糙化、色相向尘土带微漂。age=0 恒等;纯函数。
 */
export function weatherMaterial(mat, age) {
  const a = clamp01(age);
  if (a === 0) return { ...mat };
  const DUST_HUE = 0.09; // 尘土带(edge_base_color 的"whiteness"方向)
  const hueDrift = 0.25 * a;
  return {
    ...mat,
    hue: mat.hue + (DUST_HUE - mat.hue) * hueDrift,
    sat: mat.sat * (1 - 0.35 * a),
    value: mat.value * (1 - 0.18 * a) + 0.04 * a, // 变灰不是变黑:压低对比,抬一点底
    roughness: clamp01((mat.roughness ?? 0.8) + 0.2 * a),
  };
}
