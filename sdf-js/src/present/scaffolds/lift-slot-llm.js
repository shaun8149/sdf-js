// =============================================================================
// lift-slot-llm.js — Stage 2 slot lift, extracted from bake-scaffold-pipeline
// (Sprint 32) so the SAME prompt + parser drives both the CLI bake and the
// browser (author-2d full-deck mode). Single source of truth: any rule change
// here reaches both ends — never fork this back into a script-local blob.
// =============================================================================
import { buildIconCatalogString } from '../../icons/index.js';
import { buildAtomCatalogString } from './../atoms-2d/catalog.js';

export const LIFT_MODEL = 'claude-sonnet-4-5-20250929';

// Base system prompt + atom catalog + icon catalog (both src-portable).
export async function buildLiftSystemPrompt() {
  return (
    `You are the Atlas Present scaffold-mode lift LLM. Emit a single JSON ` +
    `SceneData object inside a \`\`\`json fence with no prose. Atoms are 2D ` +
    `Canvas primitives — no 3D, no text-3d-pipe.\n\n` +
    `# CORE GOAL: Atlas decks are 3D theatrical presentations. TEXT MUST BE MINIMAL. ` +
    `Use icons + charts to replace verbose phrases. Audience reads a slide in ` +
    `≤3 seconds; long prose disappears in 3D space.\n\n` +
    (await buildAtomCatalogString()) +
    '\n\n' +
    buildIconCatalogString()
  );
}

/**
 * Build the per-slot user message — verbatim the bake pipeline's Stage 2
 * prompt (slot context + source material + output contract + worked
 * examples + Rules 0-20).
 *
 * @param {object} p — { scaffold, slot, slotIdx, slideIdx, theme, slide,
 *   slides, extraSlides } (slides + extraSlides feed orphan-rescue material)
 */
export function buildSlotUserMessage({
  scaffold,
  slot,
  slotIdx,
  slideIdx,
  theme,
  slide,
  slides = [],
  extraSlides = [],
}) {
  const bodyTexts = (slide.body || [])
    .map((b) => (typeof b === 'string' ? b : b.text || ''))
    .filter((t) => t && t.length > 0);

  const slotContext =
    `## SCAFFOLD CONTEXT\n\n` +
    `You are filling slot **${slotIdx + 1}/${scaffold.slots.length}** ` +
    `of a **${scaffold.label}** deck.\n\n` +
    `**Slot purpose**: ${slot.purpose}\n` +
    `**Slot title**: "${slot.title}" (this is the section header)\n\n` +
    `**Recommended atoms** (pick from this menu, in priority order):\n` +
    slot.recommended_atoms.map((t, i) => `  ${i + 1}. \`${t}\``).join('\n') +
    '\n\n' +
    (slot.forbidden_atoms && slot.forbidden_atoms.length > 0
      ? `**Forbidden atoms** (do NOT emit these in this slot):\n` +
        slot.forbidden_atoms.map((t) => `  - \`${t}\``).join('\n') +
        '\n\n'
      : '') +
    `**Theme** (use these colors):\n` +
    `  - bg: rgb(${theme.bg.join(', ')})\n` +
    `  - silhouetteColor: rgb(${theme.silhouetteColor.join(', ')})\n` +
    `  - accent: rgb(${theme.accent.join(', ')})\n` +
    `  - colors[]: ${theme.colors.map((c) => `rgb(${c.join(',')})`).join(' / ')}\n\n`;

  const workedExamples =
    `## WORKED EXAMPLES (study these patterns)\n\n` +
    `### Example A — values slide:\n` +
    `Source body: "We believe in Trust, Quality, Speed, Customer Focus"\n` +
    `GOOD output:\n` +
    '```json\n' +
    `{ "subjects": [\n` +
    `  { "type": "cover", "x": 0, "y": 0, "w": 1280, "h": 120,\n` +
    `    "args": {"title": "Our Values"} },\n` +
    `  { "type": "icon-row", "x": 40, "y": 160, "w": 1200, "h": 480,\n` +
    `    "args": {\n` +
    `      "items": [\n` +
    `        {"icon": "shield", "label": "Trust"},\n` +
    `        {"icon": "sparkle", "label": "Quality"},\n` +
    `        {"icon": "lightning", "label": "Speed"},\n` +
    `        {"icon": "heart", "label": "Customer Focus"}\n` +
    `      ]\n` +
    `    }\n` +
    `  }\n` +
    `]}\n` +
    '```\n' +
    `BAD: bullet-list with "We believe in Trust" etc.\n\n` +
    `### Example B — KPI dashboard:\n` +
    `Source body: "Q3 results: Revenue $3.4M (+27%), MAU 12,450, Churn 2.1%"\n` +
    `GOOD: 3× \`kpi-card\` atoms with value=$3.4M / 12.4K / 2.1% — no prose.\n\n` +
    `### Example C — time series:\n` +
    `Source body: "ARR: Q1 $0, Q2 $120K, Q3 $740K, Q4F $2.4M"\n` +
    `GOOD: { "type": "line", "args": {"values":[0,0.12,0.74,2.4],"labels":["Q1","Q2","Q3","Q4F"],"format":"currency","title":"ARR Growth"} }\n\n` +
    `### Example D — feature list with inline icons (bullet-list with icons):\n` +
    `Source body: "Mobile wallet / AI co-pilot / E2E encryption / Cross-chain"\n` +
    `GOOD: { "type": "bullet-list", "args": {"items":[\n` +
    `  {"icon": "device-mobile", "label": "Mobile-first wallet"},\n` +
    `  {"icon": "brain", "label": "AI co-pilot"},\n` +
    `  {"icon": "lock-key", "label": "End-to-end encryption"},\n` +
    `  {"icon": "link", "label": "Cross-chain liquidity"}\n` +
    `]} }\n\n`;

  // Stage 1.5 orphan rescue: extra source slides merged into this slot.

  let extraMaterial = '';
  if (Array.isArray(extraSlides) && extraSlides.length > 0) {
    for (const exIdx of extraSlides) {
      const ex = slides[exIdx];
      if (!ex) continue;
      const exBody = (ex.body || [])
        .map((b) => (typeof b === 'string' ? b : b.text || ''))
        .filter((t) => t && t.length > 0);
      extraMaterial +=
        `\n## ADDITIONAL SOURCE MATERIAL (slide ${exIdx} — merged into this slot; ` +
        `it fits no other slot, so its DATA VALUES must appear in your output too)\n\n` +
        `**Title**: ${ex.title || '(untitled)'}\n\n` +
        `**Body**:\n` +
        exBody.map((t) => `  - "${t}"`).join('\n') +
        '\n';
    }
  }

  const userMessage =
    slotContext +
    `## SOURCE MATERIAL (slide ${slideIdx} from input deck)\n\n` +
    `**Title**: ${slide.title || '(untitled)'}\n\n` +
    `**Body**:\n` +
    bodyTexts.map((t) => `  - "${t}"`).join('\n') +
    '\n' +
    extraMaterial +
    '\n' +
    `## OUTPUT\n\n` +
    `Canvas: **1280×720**. Emit SceneData JSON for ONE slot:\n\n` +
    '```json\n' +
    `{\n` +
    `  "name": "${scaffold.id}/${slot.name}",\n` +
    `  "layout": "row|grid|hierarchy|stage|cover",\n` +
    `  "subjects": [\n` +
    `    { "type": "<atom-name>", "x": <px>, "y": <px>, "w": <px>, "h": <px>, "args": { ... } }\n` +
    `  ]\n` +
    `}\n` +
    '```\n\n' +
    workedExamples +
    `Rules (Sprint 18 v5 — aggressive text minimization + atom variety):\n` +
    `0. **CANVAS BOUNDS**: Every subject: x+w ≤ 1240, y+h ≤ 700.\n` +
    `1. **EVERY subject MUST have explicit x/y/w/h** in canvas pixels.\n` +
    `2. **Atom selection**: pick from recommended_atoms (priority order). Use forbidden_atoms as hard negative.\n` +
    `3. **HARD TEXT BUDGET (this is a 3D theater, not a document!)**:\n` +
    `   - icon-row / icon-grid items[].label: **≤ 2 words** (e.g. 'Trust', 'Self-Custodial', 'Cross-Chain' — NOT 'Self-custodial trading approach')\n` +
    `   - bullet-list items[].label: **≤ 5 words** (was unlimited; now hard cap — strip verbs / articles / fluff)\n` +
    `   - kpi-card.value: **1-3 words** (e.g. '$3M', '92%', '1-2 Months')\n` +
    `   - cover.title: **≤ 3 words** for section strips; deck-cover allowed full title\n` +
    `   - Any label exceeding budget gets the meaning compressed by you BEFORE emit\n` +
    `4. **NUMBERS → CHART, never prose**:\n` +
    `   - 3+ KPI values → multiple \`kpi-card\` or 1 \`dashboard-multi-kpi-composite\`\n` +
    `   - Time series (4+ points) → \`line\` or \`bar\`\n` +
    `   - Proportions/shares → \`pie\` or \`waterfall\`\n` +
    `   - Funnel/pipeline → \`funnel\`\n` +
    `   - Single percentage → \`sphere-fill\` or \`kpi-card\` or \`kpi-water-drop\`\n` +
    `   - NEVER describe numbers in bullet-list when a chart fits\n` +
    `5. **VARIETY rule**: Look at adjacent slots' emit history. If the previous slot used \`icon-row\`, prefer \`icon-grid\` / \`bullet-list\` / chart atom THIS slot. Goal: ≥ 6 distinct atom types across deck (cover excluded). Atoms you should rotate through: cover / icon-row / icon-grid / bullet-list / kpi-card / agenda-list / progression / pyramid / pie / line / bar / funnel / waterfall / scatter / sphere-fill / venn / matrix-grid / nine-field-matrix / dashboard-multi-kpi-composite / fishbone / mindmap / org-chart / tree-diagram / circle-image-hub-spoke / device-mockup-row / isotype-people-grid.\n` +
    `6. **SHORT CONCEPTS → icon + 1-2 word label**, not phrase:\n` +
    `   - "Values: Trust, Quality, Speed, Customer Focus" → \`icon-row\` with [{icon:'shield',label:'Trust'},{icon:'sparkle',label:'Quality'},...]\n` +
    `   - Single-word bullets → \`icon-row\` (4-6 items) or \`icon-grid\` (6-12 items)\n` +
    `   - NEVER \`bullet-list\` with all 1-2-word items — use icon-row/grid\n` +
    `7. **bullet-list MUST have inline icons** unless content is truly paragraph-like:\n` +
    `   - Every \`items[*]\` should have \`icon: '<name>'\` from the catalog above\n` +
    `   - Empty bullets (no icon, no real label) = a bug\n` +
    `8. **Cover atom**:\n` +
    `   - Slot 0 deck cover → h=720 full, style: 'gradient'\n` +
    `   - Mid-deck title strip → h=120 TOP STRIP\n` +
    `   - Section divider slot → h=720 full + style: 'section'\n` +
    `   - **Section divider slot detected (slot name = 'section-divider')**: emit a SINGLE cover atom at x=0/y=0/w=1280/h=720 with \`args.style: 'section'\` (deep accent + box-behind-title). Title should be ≤ 3 words (e.g. 'PRODUCT', 'TEAM', 'VISION').\n` +
    `9. **icon-row / icon-grid args**:\n` +
    `   - items: [{icon: '<phosphor-name | brand:slug | flag:code>', label: '1-2 words MAX', sublabel?: '3-5 words'}]\n` +
    `   - icon-row: 2-8 items horizontally (auto wraps to 2 rows when ≥7)\n` +
    `   - icon-grid: 4-16 items (cols auto-picks)\n` +
    `   - colorMode default 'auto' (brand icons keep brand color; Phosphor uses theme accent)\n` +
    `   - **iconSize: 'small'|'medium'|'large'** (Sprint 18 Tier 1) — default 'medium'. Use 'large' for hero slots (vision/values with only 3-4 items at h≥360). 'small' only for dense 12+ item grids.\n` +
    `   - iconStyle: 'circle' (default; icon in pseudo-3D badge) | 'card' (item is white card with icon + label + sublabel; PL services 4-up pattern, use for services/features slots) | 'square'|'plain'\n` +
    `10. **kpi-card.style variants** (Sprint 18 Tier 1):\n` +
    `    - \`style: 'dark'\` (default): dark bg + white text — single hero KPI (e.g. one big number per slot)\n` +
    `    - \`style: 'light'\`: white bg + dark text + accent edge — dashboard grids of 3-6 KPIs (cleaner, less heavy)\n` +
    `    - \`style: 'accent-border'\`: white bg + thick left accent border — single sidebar KPI (e.g. "30% retention" callout next to bullet content)\n` +
    `    - Mix styles within a deck: hero KPI dark + dashboard KPIs light. Don't use all-dark for 6-card grid (overwhelming).\n` +
    `11. **Theme color**: pass theme accent or colors[] for non-brand icons. Don't invent colors.\n` +
    `12. **Undeclared args = bug**: don't add accentColor / iconColor / fontSize / anything not in the atom spec — atoms silently ignore unknown args, you're wasting tokens.\n` +
    `13. **Semantic atom selection (Sprint 18 Tier 3 A.2)** — when slot purpose matches a specialized atom, USE IT instead of falling back to bullet-list:\n` +
    `    - cause-analysis slots (Challenges / Risks / Blockers / Problems / Root Cause) → \`fishbone\` (effect=problem statement, branches=cause categories with sub-causes)\n` +
    `    - dated action items / roadmap slots (Next Steps / Milestones / Roadmap / Action Items with due dates) → \`timeline\` (events: array of {date, label, sublabel?})\n` +
    `    - time-series numeric slots (Growth / Traction / Trend) → \`line\` or \`column\`\n` +
    `    - process / workflow slots (How It Works / Pipeline) → \`flow-chart\` or \`progression\`\n` +
    `    - 2-set comparison slots (Before/After / Us vs Them) → \`venn\` or side-by-side kpi-cards\n` +
    `    Specialized atoms communicate semantics in 3D theatrical playback — bullet-list reads as "they had no better atom".\n` +
    `14. **NEVER emit \`type: "text"\`** — there is NO text atom. For corner attribution (author / date / version) use cover's \`author\`/\`date\`/\`version\` args. For floating labels INSIDE a chart, set the chart atom's title/labels args. If you can't express something via an atom + its args, omit it.\n` +
    `15. **Image atoms (Sprint 18 Tier 3 C)** — strictly bound to images that were ALREADY embedded in the user's source document. We do NOT call image-generation models, we do NOT search the internet for stock photos:\n` +
    `    - Use ONLY when slide.body contains an explicit src for an image the user already had (look for "image:" lines pointing to data: URIs, OR relative paths the parser emitted from embedded images).\n` +
    `    - If no such src exists in source, OMIT image atoms entirely. NEVER fabricate URLs. NEVER add picsum / unsplash / any internet host. NEVER write "image: https://..." that isn't in the source.\n` +
    `    - When you DO have a valid src: hero slot with one dominant image + title/body/bullets → \`image-split\`; full-bleed photo with caption → \`image\` (fit:'cover').\n` +
    `    - DO NOT use image atoms for purely numeric / list / process content — specialized atoms (kpi-card / fishbone / timeline / flow-chart) are better.\n` +
    `16. **Prefer specialized Sprint 19 atoms when content matches their semantic** — these atoms communicate meaning in 3D theatrical playback better than generic alternatives:\n` +
    `    - "N core values / strategic pillars / principles" with 3-8 items → \`radial-wheel-segmented\` (NOT \`icon-grid\`)\n` +
    `    - Hero quote / testimonial / founder statement → \`quote-pull\` (NOT raw \`bullet-list\`)\n` +
    `    - Headline single metric ("$24M ARR ↑117%") → \`stat-banner\` (NOT a kpi-card on full canvas)\n` +
    `    - Section break ("01 Findings") between major slot groups → \`section-number-divider\` (NOT cover-only)\n` +
    `    - 2x2 strategic analysis (Strengths/Weaknesses/Opportunities/Threats or similar) → \`swot\` (NOT \`matrix-grid\`)\n` +
    `    - Porter-style primary+support activity chain → \`value-chain-diagram\` (NOT \`flow-chart\`)\n` +
    `    - N-tier feature comparison ("Free vs Pro vs Enterprise") → \`comparison-table\` (NOT side-by-side \`kpi-card\`s)\n` +
    `    - Transformation S-curve (Kübler-Ross / journey phases) → \`change-curve-chart\` (NOT \`line\` chart with annotations)\n` +
    `17. **PL-recommendations atoms (Sprint 22 B1)** — when content matches PL signature patterns, prefer the specialized PL atom:\n` +
    `    - Goal-progression with named milestones / "climb to X" / "path to Y" narrative → \`mountain-path\` (NOT \`progression\`)\n` +
    `    - Kaplan/Norton balanced scorecard / 4-perspective strategy / Financial-Customer-Process-Learning grouping → \`strategy-map\` (NOT \`matrix-grid\`)\n` +
    `    - Multi-axis capability/competency assessment ("AI maturity radar", "skill profile") with 3-9 axes → \`radar-chart\` (NOT \`radial-spoke\`)\n` +
    `    - OKR slide (1 Objective + N Key Results with progress %) → \`okr-tree\` (NOT generic \`tree-diagram\`)\n` +
    `    - Decision/coaching framework (Yes/No/Maybe, GROW, fork-in-the-road) with 3-5 options → \`decision-tree-3-arm\` (NOT generic \`tree-diagram\`)\n` +
    `    - Capability maturity ladder (CMMI, AI maturity, digital maturity) with 3-7 stages → \`maturity-model\` (NOT generic \`pyramid\`)\n` +
    `    - Cost-benefit / impact-effort / value-complexity 2x2 plot → \`cost-benefit-matrix\` (NOT generic \`swot\` or \`matrix-grid\`)\n` +
    `    - Customer journey / experience map with emotion curve → \`journey-flow-curve\` (NOT generic \`timeline\`)\n` +
    `    - 5×5 risk grid (Cybersecurity / Risk Assessment) with likelihood × impact cells → \`risk-heatmap\` (NOT generic \`matrix-grid\`)\n` +
    `    - Competitive positioning 2×2 (Magic Quadrant style) with org/company bubbles → \`org-vs-org-matrix\` (NOT generic \`matrix-grid\`)\n` +
    `    - Project status board with column workflow (Backlog / In Progress / Done) → \`kanban-board\` (NOT generic \`flow-chart\`)\n` +
    `    - Donut chart with prominent center metric / hero KPI value in the ring hole → \`donut-with-center\` (NOT generic \`pie\`)\n` +
    `    - Funnel with explicit conversion % chips between stages (SaaS 12% → 35% → 18%) → \`funnel-with-conversion\` (NOT generic \`funnel\`)\n` +
    `    - 2-4 tall hero pillar cards side-by-side (Three Pillars / Three Principles / Our Values) → \`pillar-3up\` (NOT \`feature-card-grid\`)\n` +
    `    - Row of 2-4 customer quote/testimonial cards (social proof, "What our customers say") → \`testimonial-wall\` (NOT \`bullet-list\`)\n` +
    `    - Build vs Buy / Pros vs Cons / Left vs Right two-side comparison with visual scale → \`balance-scale\` (NOT \`swot\` or \`cost-benefit-matrix\`)\n` +
    `18. **NUMBERS ARE THE PAYLOAD (Sprint 25)** — "TEXT MUST BE MINIMAL" means minimize WORDS, never data values. Every number in the source slide ($3.53M, 52%, 210,000, 87 wells) MUST appear in some atom's args — as a kpi value, pie/donut segment, bar value, stat, or label. If a slide carries TWO datasets (e.g. spending breakdown AND revenue sources), emit TWO chart atoms side by side — never silently drop the second dataset. Preserve values LITERALLY as written in the source ("$3.53M" stays "$3.53M", not "3.5M").\n` +
    `    - **When a chart arg must be numeric** (pie/donut segments[].value, bar values[]): the number goes numeric for geometry, but the SOURCE-LITERAL form must ALSO appear in the label — e.g. \`{"label": "Program Services · $3.53M", "value": 3530000}\`, \`{"label": "Individual Donors 52%", "value": 52}\`. A legend showing "3530000" raw is a rendering failure.\n` +
    `19. **KEEP THE SOURCE LANGUAGE (Sprint 29)** — all titles, labels, and text args stay in the language of the source slide. Chinese source → Chinese deck (世界银行 stays 世界银行, never "World Bank"). Do NOT translate. Universal abbreviations that appear verbatim in the source (IMF, GDP, KPI) may stay as-is.\n` +
    `20. **NAMED ENTITIES ARE PAYLOAD TOO (Sprint 29)** — Rule 18 for proper nouns: every named person, organization, product, or publication in the source slide (Gartner Magic Quadrant, Google Slides, 英国央行, Sarah Chen) MUST appear in some atom's text args. Names carry the slide's credibility — "per Gartner Magic Quadrant" reduced to "industry ranking" is a fidelity failure, exactly like dropping a number.\n` +
    `21. **NEVER INVENT NUMBERS (Sprint 33)** — the converse of Rule 18: every numeric value in your args MUST appear in the SOURCE MATERIAL (or be its direct scale conversion, $4.6M → 4600000). FORBIDDEN: interpolated chart values (source says "$500K to $4.6M" — do NOT invent 1.6M/2.5M bars between them), complements (source "81%" does NOT license a 19% slice), illustrative scores/ratings/progress values (no made-up 0.75 "dependency index", no 87.5/12.5 splits), estimated breakdowns. If the slot's recommended atom needs numbers the source doesn't provide, USE A NON-NUMERIC ATOM instead (icon-row, pillar-3up, bullet-list, quote-pull, flow-chart). A chart with invented values is a fidelity failure worse than no chart — the deck asserts data the author never wrote.\n` +
    `22. **SUMMARIES SYNTHESIZE, NEVER ADD (Sprint 35)** — summary / takeaways / outlook / conclusion slots may ONLY restate themes and facts already present in the SOURCE MATERIAL. Do NOT enrich with world knowledge, however topically adjacent: a source about GPU costs does NOT license takeaways about "energy crisis", "nuclear power renaissance", or "sovereign AI" the author never wrote. Every takeaway line must be traceable to a specific source line. Same for people: never attribute a quote to a named person unless the source names that person.\n` +
    `23. **SUBJECTS NEVER OVERLAP (Sprint 37)** — every pair of non-cover subjects must have disjoint boxes with ≥16px gutters. Before emitting, CHECK the arithmetic: side-by-side subjects satisfy x2 ≥ x1+w1+16; stacked subjects satisfy y2 ≥ y1+h1+16; widths in one row sum to ≤ 1200 including gutters. Two atoms drawn on the same pixels is a broken slide — if content doesn't fit, drop the least important atom or shrink boxes, never stack them.\n`;

  return userMessage;
}

export function parseSceneJson(text) {
  const m = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  let s = m ? m[1] : text.trim();
  if (!m && s.startsWith('{') === false) {
    const i = s.indexOf('{');
    const j = s.lastIndexOf('}');
    if (i >= 0 && j > i) s = s.slice(i, j + 1);
  }
  return JSON.parse(s);
}

// One fetch to the Anthropic API with the lift system prompt cached.
// Returns { sceneData, usage, costUSD, elapsed }.
export async function liftSlotLLM(
  params,
  { apiKey, systemPrompt, model = LIFT_MODEL, onThrottle },
) {
  if (!apiKey) throw new Error('liftSlotLLM: apiKey required');
  const userMessage = buildSlotUserMessage(params);
  const t0 = Date.now();
  // Retry with exponential backoff on 429/5xx/network (Sprint 34 — a lift
  // that dies on one transient 429 kills a whole page of the deck).
  let lastErr;
  let data;
  for (let attempt = 0; attempt < 3 && !data; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 2000 * 4 ** (attempt - 1)));
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
          model,
          max_tokens: 16384,
          system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
          messages: [{ role: 'user', content: userMessage }],
        }),
      });
      if (!res.ok) {
        const err = new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
        if (res.status !== 429 && res.status < 500) throw err;
        if (res.status === 429 && onThrottle) onThrottle();
        lastErr = err;
        continue;
      }
      data = await res.json();
    } catch (e) {
      if (e.message?.startsWith('Anthropic 4') && !e.message.startsWith('Anthropic 429')) throw e;
      lastErr = e; // network hiccup — loop
    }
  }
  if (!data) throw lastErr;
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const usage = data.usage;
  const inCost = (usage.input_tokens * 3) / 1_000_000;
  const cacheCreateCost = ((usage.cache_creation_input_tokens || 0) * 3.75) / 1_000_000;
  const cacheReadCost = ((usage.cache_read_input_tokens || 0) * 0.3) / 1_000_000;
  const outCost = (usage.output_tokens * 15) / 1_000_000;
  const costUSD = inCost + cacheCreateCost + cacheReadCost + outCost;
  return { sceneData: parseSceneJson(data.content[0].text), usage, costUSD, elapsed };
}

/**
 * liftSlotsPool — lift many slots concurrently without breaking the prompt
 * cache or the user's rate limit (Sprint 34):
 *
 *   1. WARMUP: the first slot runs ALONE so its call writes the (large)
 *      system prompt into Anthropic's prompt cache — 14 simultaneous first
 *      calls would each pay full-price cache_creation.
 *   2. BOUNDED POOL: remaining slots run under `concurrency` workers
 *      (default 5 — safe for low-tier BYOK keys, still ~3-4× faster).
 *   3. 429-ADAPTIVE: any throttled call pushes a shared cooldown; workers
 *      wait it out before starting new slots (graceful degrade toward
 *      serial instead of blowing up the page).
 *
 * @param {object[]} paramsList — buildSlotUserMessage params per slot
 * @param {object} opts — { apiKey, systemPrompt, model?, concurrency=5,
 *   onSlotDone(i, result)?, liftFn? (test injection) }
 * @returns results[] aligned with paramsList; each { sceneData, usage,
 *   costUSD, elapsed } or { error }
 */
export async function liftSlotsPool(paramsList, opts) {
  const { concurrency = 5, onSlotDone = () => {}, liftFn = liftSlotLLM } = opts;
  const results = new Array(paramsList.length);
  if (paramsList.length === 0) return results;

  const throttle = { until: 0 };
  const run = async (i) => {
    const waitMs = throttle.until - Date.now();
    if (waitMs > 0) await new Promise((r) => setTimeout(r, waitMs));
    try {
      results[i] = await liftFn(paramsList[i], {
        ...opts,
        onThrottle: () => {
          throttle.until = Date.now() + 15000;
        },
      });
    } catch (e) {
      results[i] = { error: e.message };
    }
    onSlotDone(i, results[i]);
  };

  await run(0); // warmup — writes the system-prompt cache
  let next = 1;
  const workers = Array.from(
    { length: Math.max(1, Math.min(concurrency, paramsList.length - 1)) },
    async () => {
      while (next < paramsList.length) {
        const i = next++;
        await run(i);
      }
    },
  );
  await Promise.all(workers);
  return results;
}
