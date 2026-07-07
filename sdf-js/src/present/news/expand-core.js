// =============================================================================
// expand-core.js — Sprint 30/32: raw news text → slide outline (12-18 slides)
// Extracted from scripts/expand-news.mjs so the browser (author-2d full-deck
// mode) and the CLI share one implementation. Pure fetch — no node imports.
// Deterministic backstops: count-retry → splitToFloor → mergeToCeiling;
// exponential backoff on 429/5xx; repairJsonQuotes for CJK-quote breakage;
// truncation salvage. See scripts/test-expand-news.mjs for the mechanics.
// =============================================================================
const MODEL = 'claude-sonnet-4-5-20250929';

const EXPAND_SYSTEM = `You expand a short news article into a presentation outline.

Output ONLY a JSON array inside a \`\`\`json fence. Each element is one slide:
  {"title": "...", "body": ["fact line", "fact line", ...]}

Rules:
1. TARGET {MIN}-{MAX} slides. This is a hard requirement — decompose until you reach it.
2. Slide 0 is the cover: article headline as title, source/date context as body.
3. Slide 1 is an agenda/overview: one body line per major theme.
4. ONE fact-cluster per slide. Split aggressively: each institution's forecast,
   each risk, each policy step, each region can be its own slide — BUT every
   content slide carries 2-4 body lines (the fact plus its surrounding context
   from the article). Never emit a one-line slide.
5. EVERY number from the article appears in EXACTLY ONE slide's body, in its
   source-literal form ("3.3%" stays "3.3%"). Never round, never drop, never
   repeat a figure on a second slide (the agenda names themes, not figures).
6. EVERY named person/organization/publication appears in some slide body.
7. KEEP THE SOURCE LANGUAGE. Chinese article → Chinese outline. Do not translate.
8. When facts have probability/impact or two-axis language, give that cluster a
   slide whose body spells out both axes per item (feeds a matrix slide).
9. End with an outlook/summary slide.
10. Body lines are complete factual sentences from the article, lightly trimmed —
   not your commentary. Do not invent facts not in the article.`;

function buildSystem(min, max) {
  return EXPAND_SYSTEM.replace('{MIN}', String(min)).replace('{MAX}', String(max));
}

// Transient API failures (429 rate limit, 529 overloaded, network hiccups)
// are part of "stable" — retry with exponential backoff before giving up.
async function callModel(apiKey, system, userMessage, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 2000 * 4 ** (i - 1)));
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 8192,
          system,
          messages: [{ role: 'user', content: userMessage }],
        }),
      });
      if (!res.ok) {
        const retryable = res.status === 429 || res.status >= 500;
        const err = new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
        if (!retryable) throw err;
        lastErr = err;
        continue;
      }
      const data = await res.json();
      return data.content[0].text;
    } catch (e) {
      if (e.message?.startsWith('Anthropic 4') && !e.message.startsWith('Anthropic 429')) throw e;
      lastErr = e; // network error or retryable status — loop
    }
  }
  throw lastErr;
}

// The model sometimes normalizes the article's fullwidth quotes ("…") into
// unescaped ASCII quotes INSIDE a JSON string ("要求实现"县县全覆盖"…") —
// broken JSON. Line-based repair for the two pretty-printed shapes it emits:
// key-value lines and bare array-element strings. Inner quotes → escaped.
export function repairJsonQuotes(s) {
  return s
    .split('\n')
    .map((line) => {
      let m = line.match(/^(\s*"[^"]*"\s*:\s*")(.*)("\s*,?\s*)$/);
      if (m) return m[1] + m[2].replace(/(?<!\\)"/g, '\\"') + m[3];
      m = line.match(/^(\s*")(.*)("\s*,?\s*)$/);
      if (m) return m[1] + m[2].replace(/(?<!\\)"/g, '\\"') + m[3];
      return line;
    })
    .join('\n');
}

function parseSlides(text) {
  const m = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  let s = m ? m[1] : text.trim();
  if (!m && !s.startsWith('[')) {
    const i = s.indexOf('[');
    const j = s.lastIndexOf(']');
    if (i >= 0 && j > i) s = s.slice(i, j + 1);
  }
  let slides;
  try {
    slides = JSON.parse(s);
  } catch {
    s = repairJsonQuotes(s);
  }
  try {
    slides = slides ?? JSON.parse(s);
  } catch (e) {
    // A max_tokens truncation leaves a syntactically broken tail — salvage
    // every complete slide object rather than failing the whole expansion.
    const lastComplete = s.lastIndexOf('},');
    if (lastComplete > 0) {
      try {
        slides = JSON.parse(s.slice(0, lastComplete + 1) + ']');
      } catch {
        throw new Error(`expand-news parse: ${e.message} — raw tail: …${text.slice(-200)}`);
      }
    } else {
      throw new Error(`expand-news parse: ${e.message} — raw tail: …${text.slice(-200)}`);
    }
  }
  if (!Array.isArray(slides)) throw new Error('expand-news: LLM did not return an array');
  return slides
    .filter((sl) => sl && typeof sl === 'object' && (sl.title || (sl.body || []).length))
    .map((sl) => ({
      title: String(sl.title || '').trim(),
      body: (Array.isArray(sl.body) ? sl.body : []).map((b) => String(b).trim()).filter(Boolean),
    }));
}

// Mechanical floor: split the slide with the most body lines into two until
// the count is met (never touches cover/agenda at idx 0/1). A slide needs
// ≥2 body lines to split; if nothing is splittable we stop — the harness
// will report the shortfall honestly rather than pad with empty pages.
export function splitToFloor(slides, min) {
  const out = slides.map((s) => ({ title: s.title, body: [...s.body] }));
  while (out.length < min) {
    let best = -1;
    for (let i = 2; i < out.length; i++) {
      if (out[i].body.length >= 2 && (best === -1 || out[i].body.length > out[best].body.length))
        best = i;
    }
    if (best === -1) break;
    const src = out[best];
    const half = Math.ceil(src.body.length / 2);
    const second = { title: `${src.title}（续）`, body: src.body.slice(half) };
    src.body = src.body.slice(0, half);
    out.splice(best + 1, 0, second);
  }
  return out;
}

// Mechanical ceiling: merge the two shortest adjacent tail slides.
export function mergeToCeiling(slides, max) {
  const out = slides.map((s) => ({ title: s.title, body: [...s.body] }));
  while (out.length > max) {
    let best = 2;
    let bestLen = Infinity;
    for (let i = 2; i < out.length - 1; i++) {
      const len = out[i].body.length + out[i + 1].body.length;
      if (len < bestLen) {
        bestLen = len;
        best = i;
      }
    }
    out[best].body.push(...out[best + 1].body);
    out.splice(best + 1, 1);
  }
  return out;
}

export async function expandNews(text, { apiKey, min = 12, max = 18 } = {}) {
  if (!apiKey) throw new Error('expand-news: API key required');
  const system = buildSystem(min, max);
  let slides;
  try {
    slides = parseSlides(await callModel(apiKey, system, text));
  } catch {
    // malformed JSON or exhausted retries — one clean re-ask before failing
    slides = parseSlides(
      await callModel(apiKey, system, `${text}\n\n(Output ONLY the JSON array in a json fence.)`),
    );
  }
  if (slides.length < min) {
    // one retry with an explicit complaint, then mechanical floor
    try {
      const retry = await callModel(
        apiKey,
        system,
        `${text}\n\n(Your previous outline had only ${slides.length} slides — the hard requirement is ${min}-${max}. Split fact-clusters further: one institution / one risk / one region per slide.)`,
      );
      const slides2 = parseSlides(retry);
      if (slides2.length > slides.length) slides = slides2;
    } catch {
      // retry failed — the mechanical floor below still runs on the first result
    }
  }
  if (slides.length < min) slides = splitToFloor(slides, min);
  if (slides.length > max) slides = mergeToCeiling(slides, max);
  return slides;
}
