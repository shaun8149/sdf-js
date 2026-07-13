// =============================================================================
// layout.js — Sprint 95: 版式语法 (layout grammar).
//
// 范本 v3 只有一种版式: banner (顶部艺术横带 + 下方正文)。整本 deck 每页
// 同构 → 单调。本模块引入两个新版式 + 按内容形状的自动调度:
//
//   banner    — 现状 (默认): 顶部横带真迹 + 正文。
//   split     — 左侧竖向艺术 rail (~38%) + 右侧正文列。用于 -lead 章节页
//               (正文 1-2 个 atom 时): 竖幅真迹完整呼吸, 标题居中其上。
//   statement — 全幅真迹 + 居中装裱卡。用于引文页 (正文恰好 1 个 quote
//               atom): 作品即页面, 文字如美术馆标牌。
//
// 调度是确定性的 (内容形状 + slot 命名), 不引入随机 — 同一 deck 每次
// 渲染版式一致。几何变换是纯函数: 不改 deck.json, 只在 paint 时重映射
// (与 alignSceneData 同一纪律)。
// =============================================================================

/** 竖 rail 占画布宽度的比例 (split 版式)。 */
export const SPLIT_RAIL_FRAC = 0.38;

const QUOTE_TYPES = new Set(['quote-pull', 'pull-quote-banner']);

/**
 * layoutForSlot(slot, sceneData) → 'banner' | 'split' | 'statement'
 * 按内容形状 + slot 命名确定性调度:
 *   statement — 正文恰好 1 个 quote 类 atom
 *   split     — -lead 章节页 且 正文 1-2 个 atom (3+ 的密页留在 banner,
 *               右列 62% 宽会压垮 KPI 网格)
 *   banner    — 其余全部 (现状不变)
 */
export function layoutForSlot(slot, sceneData) {
  const subs = (sceneData?.subjects || []).filter((s) => s && typeof s.type === 'string');
  const body = subs.filter((s) => s.type !== 'cover');
  if (body.length === 1 && QUOTE_TYPES.has(body[0].type)) return 'statement';
  const name = String(slot?.slotName || '');
  if (
    /-lead$/.test(name) &&
    body.length >= 1 &&
    body.length <= 2 &&
    subs.some((s) => s.type === 'cover')
  ) {
    return 'split';
  }
  return 'banner';
}

/**
 * applySplitLayout(sceneData, W, H) → new sceneData (纯函数, 不改输入)。
 * cover 主体占满左 rail (0,0,railW,H); 正文主体线性重映射进右列,
 * 顶部上移回收原横带留下的空档 (y-80, 地板 48)。
 */
export function applySplitLayout(sceneData, W, H) {
  const railW = Math.round(W * SPLIT_RAIL_FRAC);
  const scale = (W - railW) / W;
  const subjects = (sceneData?.subjects || []).map((s) => {
    if (!s || typeof s.type !== 'string') return s;
    if (s.type === 'cover') return { ...s, x: 0, y: 0, w: railW, h: H };
    const x = s.x ?? 0;
    const w = s.w ?? W;
    const y = s.y ?? 0;
    return {
      ...s,
      x: Math.round(railW + x * scale),
      w: Math.round(w * scale),
      y: y >= 140 ? Math.max(48, y - 80) : y,
    };
  });
  return { ...sceneData, subjects };
}

/**
 * statementCardRect(W, H) — 居中装裱卡的几何 (全幅真迹之上)。
 * 卡宽 64% / 高 ≤56%, 上下留出作品呼吸区。
 */
export function statementCardRect(W, H) {
  const cw = Math.round(W * 0.64);
  const ch = Math.round(Math.min(H * 0.56, H - 192));
  return { x: Math.round((W - cw) / 2), y: Math.round((H - ch) / 2), w: cw, h: ch };
}

/**
 * applyStatementLayout(sceneData, W, H) → { sceneData, kicker } (纯函数)。
 * cover 主体退场 (其标题成为卡上 kicker 小字); 唯一正文 atom 的 bounds
 * 收进装裱卡内 (kicker 占用卡顶 52px, 四周 pad 28)。
 */
export function applyStatementLayout(sceneData, W, H) {
  const card = statementCardRect(W, H);
  const coverSub = (sceneData?.subjects || []).find((s) => s && s.type === 'cover');
  const kicker = coverSub?.args?.title ? String(coverSub.args.title) : '';
  const PAD = 28;
  const topPad = kicker ? 52 + PAD : PAD;
  const subjects = (sceneData?.subjects || [])
    .filter((s) => !(s && s.type === 'cover'))
    .map((s) => {
      if (!s || typeof s.type !== 'string') return s;
      return {
        ...s,
        x: card.x + PAD,
        y: card.y + topPad,
        w: card.w - PAD * 2,
        h: card.h - topPad - PAD,
      };
    });
  return { sceneData: { ...sceneData, subjects }, kicker, card };
}
