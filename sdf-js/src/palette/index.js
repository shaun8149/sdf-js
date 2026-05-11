// =============================================================================
// palette/ —— 三种色彩选择
// -----------------------------------------------------------------------------
//   - tyler:       Tyler Hobbs / Fidenza 的 15 个 fg/bg 方案
//                  （35 个命名 HSB 三元组 + 加权采样）
//   - bob:         BOB 原版 pigments —— 仙人掌场景的两套 hex 数组
//                  （12 + 11 色，painted 风格 layer 交替索引）
//   - generative:  (i, j) 坐标系生成器
//                  （HSL 反查，含色相不均匀补偿 + 亮度重映射）
//
// 用法：
//   import * as tyler from 'sdf-js/palette/tyler';
//   import * as bob from 'sdf-js/palette/bob';
//   import * as generative from 'sdf-js/palette/generative';
//
//   或者从顶层：
//   import { palette } from 'sdf-js';
//   palette.tyler.SCHEMES.luxe.fg();
//   palette.bob.PIGMENTS;
//   palette.generative.definingPerfectGroup(10);
// =============================================================================

export * as tyler from './tyler.js';
export * as bob from './bob.js';
export * as generative from './generative.js';
