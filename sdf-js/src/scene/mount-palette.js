// sdf-js/src/scene/mount-palette.js — §9.6 配合点 #1:figure.js 吃 deck.artMount。
// 契约 §3.5(docs/atlas-deck-contract.md):deck 出图时穿了真迹装裱,palette
// 预烘焙随契约走 —— 同一份 deck.json,纸上 PDF 和 3D 飞行穿同一件真迹的颜色。
// 优先级(URL 参数保留为显式覆盖,2D 端留言原文):
//   ?palette=0        → 关(显式)
//   ?palette=<theme>  → 主题覆盖(显式)
//   deck.artMount.palette → 真迹装裱(预烘焙)
//   默认主题
// 装裱色进 3D 前过一遍 ensureContrast 对比度地板(§9.6 配合点 #5 的建议;
// 2D 端 mountPaletteOverride 已这么做)—— deck 剧场是暗场,地板方向是提亮。
import { ensureContrast } from '../present/atoms-2d/color.js';

// deck 剧场的暗场底色(stage 层 studioBg dark 的近似;对比度地板的参照面)
const STAGE_BG = [30, 32, 36];

const validPalette = (p) =>
  p &&
  Array.isArray(p.accent) &&
  p.accent.length === 3 &&
  Array.isArray(p.colors) &&
  p.colors.length > 0;

/**
 * resolveDeckPalette({ artMount, paletteParam, themeOf }) →
 *   { palette: {anchor, colors}|null, source, attribution|null }
 * @param artMount     IR deck 携带的 §3.5 溯源块(可缺)
 * @param paletteParam URL ?palette= 原始值(可缺)
 * @param themeOf      (id|null) => theme|null(figure.js 注入 getTheme,便于测试)
 */
export function resolveDeckPalette({ artMount = null, paletteParam = null, themeOf } = {}) {
  const attribution =
    artMount && (artMount.name || artMount.artist)
      ? {
          name: artMount.name || null,
          artist: artMount.artist || null,
          license: artMount.license || null,
        }
      : null;

  if (paletteParam === '0') return { palette: null, source: 'off', attribution };

  if (paletteParam) {
    const theme = themeOf(paletteParam);
    if (theme)
      return {
        palette: { anchor: theme.accent, colors: theme.colors },
        source: 'url',
        attribution,
      };
  }

  if (validPalette(artMount?.palette)) {
    const floor = (rgb) => ensureContrast(rgb, STAGE_BG);
    return {
      palette: {
        anchor: floor(artMount.palette.accent),
        colors: artMount.palette.colors.map(floor),
      },
      source: 'artMount',
      attribution,
    };
  }

  const theme = themeOf(null); // 调用方的默认主题
  return {
    palette: theme ? { anchor: theme.accent, colors: theme.colors } : null,
    source: 'default',
    attribution,
  };
}
