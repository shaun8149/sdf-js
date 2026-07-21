// =============================================================================
// cjk-text.js — Sprint 94: 中文排版引擎 (一次性投入, 全局受益).
//
// 裸 canvas fillText 的三宗罪, 逐条修:
//   1. 断行: CJK 字符级硬切 → 行首出现「，。、」等收尾标点 (禁则处理缺失)
//   2. 中西文混排: 「质押1万ANT」浑然一体 → 缺盘古之白 (CJK↔latin 细空)
//   3. 尾行: 标点被硬折到下一行孤立成行
//
// API:
//   pangu(text)                     — CJK↔latin/数字边界插 U+2009 THIN SPACE
//   wrapCJK(ctx, text, maxW, maxLines) — 禁则断行 + 尾行省略号 (词不裂)
//   fitTextCJK(ctx, text, maxW)     — 单行收缩: 先 pangu 再按需去白
//
// 禁则 (简化 JIS X 4051):
//   行首禁: 收尾标点 ，。、；：！？）】」』％‰°℃…—·"'
//   行尾禁: 起始标点 （【「『"'
// =============================================================================

const NO_LINE_START = '，。、；：！？）】」』》〉%％‰°℃…—·"\'’”';
const NO_LINE_END = '（【「『《〈"\'‘“';
// 全角/CJK 标点: pangu 边界上不隔白 (「（ANT）机制」的 ）↔机 不是混排边界)
const CJK_PUNCT = '，。、；：！？（）【】「」『』《》〈〉…—·“”‘’％‰';
const CJK_RE = /[\u2E80-\u9FFF\uF900-\uFAFF\u3000-\u303F\uFF00-\uFFEF]/;
// '.' ',' 计入词内字符: 「0.5」「1,000」在断行时不裂开
const LATIN_RE = /[A-Za-z0-9$%#@&+±=~<>*/\\.,'-]/;

/** pangu(text) — 盘古之白: CJK 与 latin/数字之间补 THIN SPACE (U+2009)。 */
export function pangu(text) {
  const s = String(text);
  let out = '';
  for (let i = 0; i < s.length; i++) {
    out += s[i];
    const a = s[i];
    const b = s[i + 1];
    if (!b || a === ' ' || b === ' ') continue;
    const ab = CJK_RE.test(a) && LATIN_RE.test(b);
    const ba = LATIN_RE.test(a) && CJK_RE.test(b);
    // 全角标点邻界不隔白 (「（ANT）机制」); 半角 %/. 随词, 照常隔
    if ((ab || ba) && !CJK_PUNCT.includes(a) && !CJK_PUNCT.includes(b)) {
      out += '\u2009';
    }
  }
  return out;
}

// 切分为不可再分的排版单元: latin 词/数字串整体, CJK 逐字
function tokens(text) {
  const s = String(text);
  const out = [];
  let buf = '';
  const flush = () => {
    if (buf) out.push(buf);
    buf = '';
  };
  for (const ch of s) {
    if (LATIN_RE.test(ch)) {
      buf += ch;
    } else {
      flush();
      out.push(ch);
    }
  }
  flush();
  return out;
}

/**
 * wrapCJK(ctx, text, maxW, maxLines) → string[] — 禁则断行。
 * latin 词整体移行; 行首禁则标点回吸到上一行 (轻微超宽换孤立标点, 悬挂
 * 式处理); 超过 maxLines 时尾行去整 token 加省略号。ctx.font 须已设置。
 */
export function wrapCJK(ctx, text, maxW, maxLines = Infinity) {
  const toks = [];
  // 比整列还宽的 latin 长词 (URL/hash) 先字符级拆开, 否则永不折行
  for (const raw of tokens(pangu(text))) {
    if (ctx.measureText(raw).width <= maxW) {
      toks.push(raw);
      continue;
    }
    let chunk = '';
    for (const ch of raw) {
      if (chunk && ctx.measureText(chunk + ch).width > maxW) {
        toks.push(chunk);
        chunk = ch;
      } else chunk += ch;
    }
    if (chunk) toks.push(chunk);
  }
  const lines = [];
  let line = '';
  for (let i = 0; i < toks.length; i++) {
    const tok = toks[i];
    if (!line && !tok.trim()) continue; // 空白不领行
    const test = line + tok;
    if (line && ctx.measureText(test).width > maxW) {
      // 折行点恰逢空白: 收行, 空白吞掉
      if (!tok.trim()) {
        lines.push(line);
        line = '';
        continue;
      }
      // 禁则: 该 token 是行首禁标点 → 吸到上一行 (标点悬挂)
      if (tok.length === 1 && NO_LINE_START.includes(tok)) {
        lines.push(line + tok);
        line = '';
        continue;
      }
      // 禁则: 上一行不能以起始标点收尾 → 拖它下来
      const last = line[line.length - 1];
      if (last && NO_LINE_END.includes(last)) {
        lines.push(line.slice(0, -1));
        line = last + tok;
        continue;
      }
      lines.push(line);
      line = tok;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const cut = lines.slice(0, maxLines);
  let lastLine = cut[maxLines - 1];
  while (lastLine && ctx.measureText(lastLine + '…').width > maxW) {
    const ts = tokens(lastLine);
    ts.pop();
    lastLine = ts.join('');
  }
  cut[maxLines - 1] = lastLine + '…';
  return cut;
}

/** fitTextCJK(ctx, text, maxW) — 单行: pangu 后超宽则先撤白, 再截断加省略。 */
export function fitTextCJK(ctx, text, maxW) {
  let s = pangu(text);
  if (ctx.measureText(s).width <= maxW) return s;
  s = String(text); // 撤盘古之白救宽度
  if (ctx.measureText(s).width <= maxW) return s;
  while (s && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
  return s + '…';
}
