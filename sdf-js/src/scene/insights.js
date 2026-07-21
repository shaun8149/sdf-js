// sdf-js/src/scene/insights.js — R1: derived-insight lines for the floating
// text layer. The critique that spawned this: "数据在场,结论缺席" — every
// magnitude station shows raw numbers and makes the audience do the division.
// Tufte: the chart should finish the derivation for the reader.
//
// RULES-FIRST, ZERO LLM: every line here is arithmetic on ir.magnitude —
// multiples, CAGR, shares, retention. We never editorialize beyond what the
// numbers themselves say (no invented comparisons, no adjectives). The 2D
// end's Rule 24 (derived values cite their parents) applies: the sub line
// always shows the source numbers the derivation came from.
const label = (n) => (typeof n === 'string' ? n : (n && (n.label ?? n.name)) || '');

/**
 * calloutOverlay(ir, superAt, hideAt?) → overlay item | null
 * ir.callout carries page-critical text the structure can't encode (the
 * funding ask, the moat line, the server count). Every structure renderer
 * surfaces it on its SUPER beat through this one helper.
 */
export function calloutOverlay(ir, superAt, hideAt) {
  if (!ir.callout || !ir.callout.text) return null;
  return {
    text: String(ir.callout.text),
    sub: ir.callout.sub ? String(ir.callout.sub) : undefined,
    role: 'insight',
    revealAt: superAt + 0.25,
    ...(hideAt != null ? { hideAt } : {}),
  };
}
const disp = (ir, i) => (ir.display && ir.display[i]) || String(ir.magnitude[i]);
const yearOf = (s) => {
  const m = /^(\d{4})e?$/.exec(String(s).trim());
  return m ? Number(m[1]) : null;
};

/**
 * deriveMagnitudeInsight(ir) → { text, sub, note? } | null
 * text — the one big takeaway line; sub — the cited derivation; note — data
 * hygiene footnote (e.g. "e" = estimate) when the labels carry one.
 */
export function deriveMagnitudeInsight(ir) {
  const mag = (ir.magnitude || []).map(Number);
  if (mag.length < 2 || mag.some((v) => !Number.isFinite(v) || v < 0)) return null;
  const nodes = (ir.nodes || []).map(label);
  const note = nodes.some((n) => /^\d{4}e$/.test(String(n).trim())) ? '注:“e” 为预估值' : null;

  const years = nodes.map(yearOf);
  const isTimeSeries = years.every((y) => y != null) && years[years.length - 1] > years[0];
  const first = mag[0];
  const last = mag[mag.length - 1];

  // TIME SERIES, GROWING — the multiple is the story
  if (isTimeSeries && last > first && first > 0) {
    const span = years[years.length - 1] - years[0];
    const mult = last / first;
    const cagr = (Math.pow(mult, 1 / span) - 1) * 100;
    return {
      text: `${span} 年 ${mult >= 10 ? mult.toFixed(1) : mult.toFixed(1)} 倍`,
      sub: `${disp(ir, 0)} → ${disp(ir, mag.length - 1)} · 年均复合增长约 ${Math.round(cagr)}%`,
      note,
    };
  }

  // TIME SERIES, DECLINING — the retention floor is the story
  if (isTimeSeries && last < first && last > 0) {
    const keep = (last / first) * 100;
    const per = Math.pow(last / first, 1 / (mag.length - 1)) * 100;
    return {
      text: `${nodes[mag.length - 1]}仍保有 ${disp(ir, mag.length - 1)}`,
      sub: `自 ${disp(ir, 0)} 起累计保留 ${Math.round(keep)}% · 期均保持约 ${Math.round(per)}%`,
      note,
    };
  }

  // SHARE SET (sums ≈ 100) — the lead margin is the story
  const sum = mag.reduce((a, b) => a + b, 0);
  const order = mag.map((_, i) => i).sort((a, b) => mag[b] - mag[a]);
  const [top, second] = order;
  if (Math.abs(sum - 100) <= 8 || String(ir.title || '').includes('%')) {
    return {
      text: `${nodes[top]}居首:${disp(ir, top)}%`,
      sub: `高于第二位 ${nodes[second]}(${disp(ir, second)}%)`,
      note,
    };
  }

  // GENERIC — name the peak, cite the runner-up
  return {
    text: `${nodes[top]} 最高:${disp(ir, top)}`,
    sub: `第二位 ${nodes[second]}:${disp(ir, second)}`,
    note,
  };
}
