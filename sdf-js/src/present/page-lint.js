// =============================================================================
// page-lint.js — 渲染后视觉闸门 (2026-07-14 黑洞页事故的出厂检).
//
// 教训: 10 份 PDF 出厂没有任何"这页是不是黑洞"的自动检查, user 翻 PDF 才
// 发现整批内页黑底黑字。本模块是烟雾报警器, 不是设计评委 — 阈值宽松,
// 只拦三类灾难: 黑洞页 / 空白页 / 无对比度页。
//
// 页面分两类 (调用方按 layout/role 声明):
//   'art'     — 封面/转场/statement: 全幅真迹, 允许整页深色, 只查空白
//   'content' — banner/split 正文页: 正文必须落在纸面上, 深色占比设上限
//
// 纯函数, 吃 ImageData 形状 ({data, width, height}), browser/node 通用。
// =============================================================================

/** 页面亮度统计 — 均匀抽样至多 ~16k 像素, 足够烟雾报警。 */
export function pageStats(img) {
  const { data, width, height } = img;
  const n = width * height;
  const step = Math.max(1, Math.floor(n / 16384));
  const lums = [];
  let dark = 0;
  let light = 0;
  for (let i = 0; i < n; i += step) {
    const o = i * 4;
    const lum = 0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2];
    lums.push(lum);
    if (lum < 40) dark++;
    else if (lum > 215) light++;
  }
  lums.sort((a, b) => a - b);
  const q = (p) => lums[Math.min(lums.length - 1, Math.floor(p * lums.length))];
  const mean = lums.reduce((a, b) => a + b, 0) / lums.length;
  const std = Math.sqrt(lums.reduce((a, b) => a + (b - mean) * (b - mean), 0) / lums.length);
  return {
    std,
    contrast: q(0.97) - q(0.03),
    darkFrac: dark / lums.length,
    lightFrac: light / lums.length,
  };
}

/**
 * lintPage(img, kind) → { ok, issues: string[], stats }
 * kind: 'art' | 'content' (默认 'content')
 */
export function lintPage(img, kind = 'content') {
  const s = pageStats(img);
  const issues = [];
  // 空白页: 几乎无信号 (全同色)。art 页也不允许 — 空白说明没画出来
  if (s.std < 4 && s.contrast < 12) issues.push(`blank-page (std=${s.std.toFixed(1)})`);
  // 无对比度: 有像素但拉不开 — 文字必然不可读
  else if (s.contrast < 24) issues.push(`no-contrast (contrast=${s.contrast.toFixed(0)})`);
  // 黑洞页: 正文页深色占比过高 (2026-07-14 事故形态: ~90% 近黑)
  if (kind === 'content' && s.darkFrac > 0.62) {
    issues.push(`black-hole (darkFrac=${(s.darkFrac * 100).toFixed(0)}%)`);
  }
  return { ok: issues.length === 0, issues, stats: s };
}

/**
 * pageKindOf(slot, layout) — 按 slot/版式归类。
 * 转场页与纯 cover 页 = 'art'; statement 全幅真迹 = 'art'; 其余 'content'。
 */
export function pageKindOf(slot, layout) {
  if (slot?._transition) return 'art';
  if (layout === 'statement') return 'art';
  const subs = slot?.sceneData?.subjects || [];
  if (subs.length > 0 && subs.every((s) => s?.type === 'cover')) return 'art';
  return 'content';
}
