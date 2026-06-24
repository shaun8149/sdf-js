// =============================================================================
// scaffold-view.js — Atlas Present Sprint 16 in-browser scaffold pipeline UI
// -----------------------------------------------------------------------------
// Deck-level pipeline UX: user uploads PDF (via library-page) then opens this
// view (`?deck=<id>&mode=scaffold`) to run the 3-stage scaffold pipeline:
//
//   Stage 0 — pickScaffoldLLM (browser fetch to Anthropic, BYOK)
//   Stage 1 — heuristic slot↔slide mapping (no LLM)
//   Stage 2 — per-slot lift LLM calls, render to canvas as each completes
//
// Each stage has an explicit "Confirm" / "Proceed" button so the user can pause
// or back out. Per-slot lift runs serially (one LLM call at a time) to keep
// progress legible and respect rate limits.
//
// Companion CLI: `sdf-js/scripts/bake-scaffold-pipeline.mjs` (same pipeline,
// no UI). Shared modules: scaffolds/{registry, picker, picker-llm}.js + themes.js.
// =============================================================================

import * as deckModel from './deck-model.js';
import { pickScaffold, distributeSources } from './scaffolds/picker.js';
import { pickScaffoldLLM } from './scaffolds/picker-llm.js';
import { getTheme } from './themes.js';
import { renderAtom } from './atoms-2d/registry.js';
import { exportDeckToPPTX } from './exporters/pptx.js';
import { exportDeckToPDF } from './exporters/pdf.js';
import { buildIconCatalogString } from '../icons/index.js';

const ANTHROPIC_KEY_STORAGE = 'atlas-anthropic-key';
const MODEL = 'claude-sonnet-4-5-20250929';

// Public entry — mounted from index.html router on `?deck=<id>&mode=scaffold`
export async function mountScaffoldView(target, deckId) {
  const deck = deckModel.loadDeckFromStorage(deckId);
  if (!deck) {
    target.innerHTML = `<div class="page-pad">Deck not found.<br><a href="./">← Library</a></div>`;
    return;
  }
  if (!deck.document) {
    target.innerHTML = `<div class="page-pad">Deck has no document. Re-import PDF.<br><a href="./">← Library</a></div>`;
    return;
  }

  // Slice flowingText → fake "slides" by page boundary so the pipeline has
  // discrete units to map. Slide title = first heading inside page range
  // (fallback: "Page N").
  const slides = sliceDocumentIntoSlides(deck.document);

  // State machine
  const state = {
    deck,
    slides,
    stage: 'idle', // idle | picking | picked | lifting | done
    picker: { mode: 'auto' }, // 'auto' (LLM with v1 fallback) | 'v1'
    pickerResult: null, // {scaffold, theme, score, signals, fallback, method}
    slotAssignments: null, // array of {slot, slotIdx, slideIdx, score, fallback?}
    slotLifts: null, // array of {slotIdx, status, sceneData?, costUSD?, error?}
    totalCost: 0,
    apiKey: localStorage.getItem(ANTHROPIC_KEY_STORAGE) || '',
    export: { active: false, format: null, progress: 0, msg: '', error: null },
  };

  function render() {
    target.innerHTML = `
      <div class="deck-view-header">
        <a href="./">← Library</a>
        <h2>${escapeHtml(deck.title)}</h2>
        <span class="meta">${slides.length} source slides · scaffold mode</span>
      </div>
      <div id="scaffold-stages" style="max-width: 1280px; margin: 16px auto; padding: 0 20px;">
        ${renderStage0(state)}
        ${state.pickerResult ? renderStage1(state) : ''}
        ${state.slotAssignments ? renderStage2(state) : ''}
        ${state.stage === 'done' ? renderStage3Export(state) : ''}
        ${state.slotLifts ? renderDeckPreview(state) : ''}
      </div>
    `;
    attachHandlers();
    // Re-render any canvases that already have lifts
    if (state.slotLifts) {
      for (const lift of state.slotLifts) {
        if (lift.sceneData) renderSlotCanvas(lift);
      }
    }
  }

  function attachHandlers() {
    document.getElementById('btn-pick')?.addEventListener('click', onPickClick);
    document.getElementById('picker-mode')?.addEventListener('change', (e) => {
      state.picker.mode = e.target.value;
    });
    document.getElementById('btn-confirm-scaffold')?.addEventListener('click', onConfirmScaffold);
    document.getElementById('btn-generate')?.addEventListener('click', onGenerateAll);
    document.getElementById('btn-set-key')?.addEventListener('click', onSetKey);
    document.getElementById('btn-export-pptx')?.addEventListener('click', () => onExport('pptx'));
    document.getElementById('btn-export-pdf')?.addEventListener('click', () => onExport('pdf'));
  }

  async function onExport(format) {
    if (state.export.active) return;
    state.export = { active: true, format, progress: 0, msg: 'Starting…', error: null };
    render();

    const exportInput = {
      title: deck.title,
      theme: state.pickerResult.theme,
      scaffold: {
        id: state.pickerResult.scaffold.id,
        label: state.pickerResult.scaffold.label,
      },
      slots: state.slotLifts
        .filter((l) => l.status === 'done' && l.sceneData)
        .map((l) => {
          const assignment = state.slotAssignments.find((a) => a.slotIdx === l.slotIdx);
          return {
            slotIdx: l.slotIdx,
            slotName: l.slotName,
            slotTitle: assignment?.slot?.title || l.slotName,
            slotPurpose: assignment?.slot?.purpose || '',
            sceneData: l.sceneData,
          };
        }),
    };

    const onProgress = (msg, pct) => {
      state.export.msg = msg;
      state.export.progress = pct;
      render();
    };

    try {
      const fn = format === 'pptx' ? exportDeckToPPTX : exportDeckToPDF;
      const result = await fn(exportInput, { onProgress });
      state.export.msg = `Downloaded: ${result.filename}`;
      state.export.progress = 100;
    } catch (e) {
      state.export.error = e.message;
      console.error(`[scaffold-view] export ${format} failed:`, e);
    } finally {
      state.export.active = false;
      render();
    }
  }

  function onSetKey() {
    const entered = prompt('Anthropic API key (sk-...) — saved to localStorage:', state.apiKey);
    if (!entered) return;
    localStorage.setItem(ANTHROPIC_KEY_STORAGE, entered);
    state.apiKey = entered;
    render();
  }

  async function onPickClick() {
    // v1 deterministic mode doesn't need an API key. Only prompt when v2/auto.
    if (state.picker.mode !== 'v1' && !state.apiKey) {
      onSetKey();
      if (!state.apiKey) return;
    }
    state.stage = 'picking';
    render();

    const allTitles = slides.map((s) => s.title).filter(Boolean);
    const bodyTextsAll = slides.flatMap((s) => s.bodyTexts || []);
    const input = {
      title: allTitles[0] || deck.title,
      bodyTexts: [...allTitles, ...bodyTextsAll].slice(0, 60),
    };

    let result;
    if (state.picker.mode === 'v1') {
      const r = pickScaffold(input);
      result = { ...r, method: r.fallback ? 'fallback' : 'v1' };
    } else {
      // 'auto' → v2 LLM with v1 fallback on error
      result = await pickScaffoldLLM(input, {
        apiKey: state.apiKey,
        fallbackToV1: true,
        log: (...m) => console.log(...m),
      });
    }
    state.pickerResult = result;
    state.stage = 'picked';
    render();
  }

  function onConfirmScaffold() {
    // Stage 1: heuristic mapping
    const scaffold = state.pickerResult.scaffold;
    const consumed = new Set();
    const assignments = scaffold.slots.map((slot, slotIdx) => {
      let bestIdx = -1;
      let bestScore = -1;
      if (slotIdx === 0 && slot.name === 'cover') {
        for (let i = 0; i < slides.length; i++) {
          if (!consumed.has(i)) {
            bestIdx = i;
            bestScore = 0;
            break;
          }
        }
      } else {
        for (let i = 0; i < slides.length; i++) {
          if (consumed.has(i)) continue;
          const score = scoreSlideForSlot(slides[i], slot);
          if (score > bestScore) {
            bestScore = score;
            bestIdx = i;
          }
        }
      }
      if (bestIdx >= 0 && bestScore > 0) {
        consumed.add(bestIdx);
        return { slot, slotIdx, slideIdx: bestIdx, score: bestScore };
      }
      // Fallback
      for (let i = 0; i < slides.length; i++) {
        if (!consumed.has(i)) {
          consumed.add(i);
          return { slot, slotIdx, slideIdx: i, score: 0, fallback: true };
        }
      }
      return { slot, slotIdx, slideIdx: -1, score: 0, empty: true };
    });
    state.slotAssignments = assignments;
    render();
  }

  async function onGenerateAll() {
    const assignments = state.slotAssignments;
    state.slotLifts = assignments.map((a) => ({
      slotIdx: a.slotIdx,
      slotName: a.slot.name,
      status: a.empty ? 'empty' : 'pending',
    }));
    state.stage = 'lifting';
    render();

    for (const a of assignments) {
      if (a.empty) continue;
      const lift = state.slotLifts.find((l) => l.slotIdx === a.slotIdx);
      lift.status = 'lifting';
      render();
      try {
        const result = await runSlotLift(a, state);
        lift.sceneData = result.sceneData;
        lift.costUSD = result.costUSD;
        lift.subjectTypes = (result.sceneData.subjects || []).map((s) => s.type);
        lift.status = 'done';
        state.totalCost += result.costUSD;
        render();
      } catch (e) {
        lift.error = e.message;
        lift.status = 'error';
        render();
      }
    }
    state.stage = 'done';
    render();
  }

  async function runSlotLift(assignment, state) {
    const scaffold = state.pickerResult.scaffold;
    const theme = state.pickerResult.theme;
    const slide = state.slides[assignment.slideIdx];

    const slotContext =
      `## SCAFFOLD CONTEXT\n\n` +
      `You are filling slot **${assignment.slotIdx + 1}/${scaffold.slots.length}** ` +
      `of a **${scaffold.label}** deck.\n\n` +
      `**Slot purpose**: ${assignment.slot.purpose}\n` +
      `**Slot title**: "${assignment.slot.title}"\n\n` +
      `**Recommended atoms** (pick from this menu, in priority order):\n` +
      assignment.slot.recommended_atoms.map((t, i) => `  ${i + 1}. \`${t}\``).join('\n') +
      '\n\n' +
      (assignment.slot.forbidden_atoms && assignment.slot.forbidden_atoms.length > 0
        ? `**Forbidden atoms** (do NOT emit):\n` +
          assignment.slot.forbidden_atoms.map((t) => `  - \`${t}\``).join('\n') +
          '\n\n'
        : '') +
      `**Theme**:\n` +
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

    const userMessage =
      slotContext +
      `## SOURCE MATERIAL\n\n` +
      `**Title**: ${slide.title || '(untitled)'}\n\n` +
      `**Body**:\n` +
      (slide.bodyTexts || []).map((t) => `  - "${t}"`).join('\n') +
      '\n\n' +
      `## OUTPUT\n\nCanvas 1280×720. Emit SceneData JSON for ONE slot:\n\n` +
      '```json\n{\n  "name": "' +
      scaffold.id +
      '/' +
      assignment.slot.name +
      '",\n  "layout": "row|grid|hierarchy|stage|cover",\n  "subjects": [\n    { "type": "<atom>", "x": <px>, "y": <px>, "w": <px>, "h": <px>, "args": { ... } }\n  ]\n}\n```\n\n' +
      workedExamples +
      `Rules (Sprint 18 — text minimization + icons):\n` +
      `0. **CANVAS BOUNDS**: Every subject: x+w ≤ 1240, y+h ≤ 700.\n` +
      `1. **EVERY subject MUST have explicit x/y/w/h** in canvas pixels.\n` +
      `2. **Atom selection**: pick from recommended_atoms (priority order). Use forbidden_atoms as hard negative.\n` +
      `3. **NUMBERS → CHART, never prose**:\n` +
      `   - 3+ KPI values → multiple \`kpi-card\` or 1 \`dashboard-multi-kpi-composite\`\n` +
      `   - Time series (4+ points) → \`line\` or \`bar\`\n` +
      `   - Proportions/shares → \`pie\` or \`waterfall\`\n` +
      `   - Funnel/pipeline → \`funnel\`\n` +
      `   - Single percentage → \`sphere-fill\` or \`kpi-card\` or \`kpi-water-drop\`\n` +
      `   - NEVER describe numbers in bullet-list when a chart fits\n` +
      `4. **SHORT CONCEPTS → icon + 1-3 word label**, not phrase:\n` +
      `   - "Values: Trust, Quality, Speed, Customer Focus" → \`icon-row\` with [{icon:'shield',label:'Trust'},{icon:'sparkle',label:'Quality'},...]\n` +
      `   - Single-word bullets → \`icon-row\` (4-6 items) or \`icon-grid\` (6-12 items)\n` +
      `   - NEVER \`bullet-list\` with all 1-2-word items — use icon-row/grid\n` +
      `5. **bullet-list MUST have inline icons** unless content is truly paragraph-like:\n` +
      `   - Every \`items[*]\` should have \`icon: '<name>'\` from the catalog above\n` +
      `   - Empty bullets (no icon, no real label) = a bug\n` +
      `6. **Per-atom soft text budget**: ≤ 8 words per label / value / title (exception: bullet-list items can be longer when paragraph-like).\n` +
      `7. **Cover atom**:\n` +
      `   - Slot 0 deck cover → h=720 full, style: 'gradient'\n` +
      `   - Mid-deck title strip → h=120 TOP STRIP\n` +
      `   - Section divider slot → h=720 full + style: 'section'\n` +
      `8. **icon-row / icon-grid args**:\n` +
      `   - items: [{icon: '<phosphor-name | brand:slug | flag:code>', label: '1-3 words', sublabel?: '3-5 words'}]\n` +
      `   - icon-row: 2-8 items horizontally (auto wraps to 2 rows when ≥7)\n` +
      `   - icon-grid: 4-16 items (cols auto-picks)\n` +
      `   - colorMode default 'auto' (brand icons keep brand color; Phosphor uses theme accent)\n` +
      `9. **Theme color**: pass theme accent or colors[] for non-brand icons. Don't invent colors.\n`;

    const systemPrompt =
      `You are the Atlas Present scaffold-mode lift LLM. Emit a single JSON ` +
      `SceneData object inside a \`\`\`json fence with no prose. Atoms are 2D ` +
      `Canvas primitives — no 3D, no text-3d-pipe.\n\n` +
      `# CORE GOAL: Atlas decks are 3D theatrical presentations. TEXT MUST BE MINIMAL. ` +
      `Use icons + charts to replace verbose phrases. Audience reads a slide in ` +
      `≤3 seconds; long prose disappears in 3D space.\n\n` +
      buildIconCatalogString();

    const t0 = Date.now();
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': state.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: userMessage }],
      }),
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    const data = await res.json();
    const text = data.content[0].text;
    const usage = data.usage || {};
    const elapsed = (Date.now() - t0) / 1000;

    const sceneData = parseSceneJson(text);
    const costUSD =
      (usage.input_tokens * 3) / 1_000_000 +
      ((usage.cache_creation_input_tokens || 0) * 3.75) / 1_000_000 +
      ((usage.cache_read_input_tokens || 0) * 0.3) / 1_000_000 +
      (usage.output_tokens * 15) / 1_000_000;

    return { sceneData, costUSD, elapsed, usage };
  }

  function renderSlotCanvas(lift) {
    const canvas = document.getElementById(`slot-canvas-${lift.slotIdx}`);
    if (!canvas || !lift.sceneData) return;
    const theme = state.pickerResult.theme;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = `rgb(${theme.bg.join(',')})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const subj of lift.sceneData.subjects || []) {
      try {
        renderAtom(ctx, subj.type, subj.args, 'pseudo3d', {
          x: subj.x ?? 0,
          y: subj.y ?? 0,
          w: subj.w ?? 320,
          h: subj.h ?? 240,
          palette: theme,
        });
      } catch (e) {
        console.error(`renderAtom failed for ${subj.type}:`, e);
        ctx.fillStyle = 'rgba(200,0,0,0.3)';
        ctx.fillRect(subj.x ?? 0, subj.y ?? 0, subj.w ?? 100, subj.h ?? 100);
      }
    }
  }

  // Touch unused imports for lint
  void distributeSources;
  void getTheme;

  render();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sliceDocumentIntoSlides(doc) {
  // Reconstruct discrete slides from flowingText + pages + headings.
  // Each page becomes one slide. Title = first heading inside page (or "Page N").
  // Body = text between subsequent headings inside the page.
  const slides = [];
  for (const page of doc.pages) {
    const pageText = doc.flowingText.slice(page.startOffset, page.endOffset);
    const pageHeadings = (doc.headings || []).filter(
      (h) => h.offset >= page.startOffset && h.offset < page.endOffset,
    );
    const title = pageHeadings[0]?.text || `Page ${page.pageNumber}`;
    // Body = lines other than the title
    const lines = pageText.split('\n').filter((l) => l.trim() && l.trim() !== title);
    slides.push({ title, bodyTexts: lines, pageNumber: page.pageNumber });
  }
  return slides;
}

function scoreSlideForSlot(slide, slot) {
  const slideText = (
    String(slide.title || '') +
    ' ' +
    (slide.bodyTexts || []).join(' ')
  ).toLowerCase();
  const slotKeywords = (slot.purpose + ' ' + slot.title)
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length >= 4);
  let score = 0;
  for (const kw of slotKeywords) {
    if (slideText.includes(kw)) score += 1;
  }
  return score;
}

function parseSceneJson(text) {
  const m = text.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  let s = m ? m[1] : text.trim();
  if (!m && s.startsWith('{') === false) {
    const i = s.indexOf('{');
    const j = s.lastIndexOf('}');
    if (i >= 0 && j > i) s = s.slice(i, j + 1);
  }
  return JSON.parse(s);
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function renderStage0(state) {
  const r = state.pickerResult;
  const apiKeySet = !!state.apiKey;
  return `
    <section style="border:1px solid #d0cec3; border-radius:6px; padding:18px; margin-bottom:16px; background:white;">
      <h3 style="margin:0 0 12px; font-size:16px;">Stage 0 — Pick Scaffold</h3>
      <div style="display:flex; gap:12px; align-items:center; margin-bottom:12px;">
        <label style="font-size:13px;">Picker mode:</label>
        <select id="picker-mode" style="padding:6px 10px;">
          <option value="auto" ${state.picker.mode === 'auto' ? 'selected' : ''}>v2 LLM (auto-fallback)</option>
          <option value="v1" ${state.picker.mode === 'v1' ? 'selected' : ''}>v1 deterministic (no LLM)</option>
        </select>
        <button id="btn-pick" ${state.stage === 'picking' ? 'disabled' : ''} style="padding:8px 14px; background:#1e1b1e; color:white; border:none; border-radius:4px; cursor:pointer;">
          ${state.stage === 'picking' ? '⏳ Picking...' : r ? 'Re-pick' : 'Analyze Deck'}
        </button>
        ${apiKeySet ? '<span style="color:#2a8;font-size:12px;">✓ API key set</span>' : '<button id="btn-set-key" style="padding:6px 12px; font-size:12px;">Set API key</button>'}
      </div>
      ${
        r
          ? `
        <div style="background:#f4f1e9; padding:14px; border-radius:4px;">
          <div style="margin-bottom:8px;">
            <strong style="background:#1e1b1e;color:white;padding:2px 8px;border-radius:3px;font-family:'IBM Plex Mono',monospace;font-size:11px;">PICKED</strong>
            <span style="font-weight:600;font-size:15px;margin-left:8px;">${r.scaffold.label}</span>
            <span style="font-family:'IBM Plex Mono',monospace;font-size:11px;color:#666;margin-left:8px;">${r.scaffold.id}</span>
          </div>
          <div style="font-size:12px;margin-bottom:6px;">
            Confidence: <strong>${r.score}/10</strong>${r.fallback ? ' <em style="color:#a60;">(fallback)</em>' : ''} ·
            Method: <code>${r.method}</code> ·
            Theme: ${r.theme.label}
            <span style="display:inline-block;width:14px;height:14px;background:rgb(${r.theme.accent.join(',')});border:1px solid #888;vertical-align:middle;margin-left:4px;border-radius:2px;"></span>
          </div>
          ${
            r.signals && r.signals.length > 0
              ? `<div style="font-size:11px;color:#555;margin-bottom:10px;"><strong>Reasoning:</strong><ul style="margin:4px 0 0 16px;">${r.signals
                  .slice(0, 5)
                  .map((s) => `<li>${escapeHtml(s)}</li>`)
                  .join('')}</ul></div>`
              : ''
          }
          <div style="font-size:12px;margin-bottom:10px;">${r.scaffold.slots.length} slots: ${r.scaffold.slots.map((s) => s.name).join(' → ')}</div>
          ${state.slotAssignments ? '' : `<button id="btn-confirm-scaffold" style="padding:8px 14px; background:#2a8; color:white; border:none; border-radius:4px; cursor:pointer;">Confirm — proceed to mapping</button>`}
        </div>
      `
          : `<div style="font-size:12px;color:#888;">Click "Analyze Deck" to run scaffold picker on the deck's text. Uses Claude Sonnet 4.5 (~$0.01).</div>`
      }
    </section>
  `;
}

function renderStage1(state) {
  if (!state.slotAssignments) return '';
  return `
    <section style="border:1px solid #d0cec3; border-radius:6px; padding:18px; margin-bottom:16px; background:white;">
      <h3 style="margin:0 0 12px; font-size:16px;">Stage 1 — Slot ↔ Slide Mapping</h3>
      <table style="width:100%; font-size:12px; border-collapse:collapse;">
        <thead><tr style="background:#1e1b1e; color:white;"><th style="padding:6px 10px; text-align:left;">#</th><th style="text-align:left;">Slot</th><th style="text-align:left;">Source slide</th><th style="text-align:left;">Score</th></tr></thead>
        <tbody>
          ${state.slotAssignments
            .map((a) => {
              const slide = a.slideIdx >= 0 ? state.slides[a.slideIdx] : null;
              const scoreLabel = a.empty ? '[empty]' : a.fallback ? '[fallback]' : a.score;
              return `<tr style="border-bottom:1px solid #eee;">
                <td style="padding:6px 10px; font-family:'IBM Plex Mono',monospace; color:#666;">${a.slotIdx}</td>
                <td style="padding:6px 10px;"><strong>${a.slot.name}</strong> — ${a.slot.title}</td>
                <td style="padding:6px 10px;">${slide ? `<em>${escapeHtml(slide.title)}</em> <span style="color:#888;font-size:10px;">(p${slide.pageNumber})</span>` : '—'}</td>
                <td style="padding:6px 10px; font-family:'IBM Plex Mono',monospace; color:#a60;">${scoreLabel}</td>
              </tr>`;
            })
            .join('')}
        </tbody>
      </table>
      <div style="margin-top:14px; font-size:11px; color:#888;">Estimated cost: ~$${(state.slotAssignments.filter((a) => !a.empty).length * 0.07).toFixed(2)} (${state.slotAssignments.filter((a) => !a.empty).length} slot lifts @ ~$0.07 each)</div>
    </section>
  `;
}

function renderStage2(state) {
  if (!state.slotAssignments) return '';
  if (!state.slotLifts) {
    return `
      <section style="border:1px solid #d0cec3; border-radius:6px; padding:18px; margin-bottom:16px; background:white;">
        <h3 style="margin:0 0 12px; font-size:16px;">Stage 2 — Per-Slot Lift</h3>
        <button id="btn-generate" style="padding:10px 18px; background:#1e1b1e; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:600;">
          Generate all ${state.slotAssignments.filter((a) => !a.empty).length} slots
        </button>
      </section>
    `;
  }
  const lifted = state.slotLifts.filter((l) => l.status === 'done').length;
  const errors = state.slotLifts.filter((l) => l.status === 'error').length;
  const total = state.slotLifts.filter((l) => l.status !== 'empty').length;
  return `
    <section style="border:1px solid #d0cec3; border-radius:6px; padding:18px; margin-bottom:16px; background:white;">
      <h3 style="margin:0 0 12px; font-size:16px;">Stage 2 — Per-Slot Lift Progress</h3>
      <div style="font-size:13px;margin-bottom:10px;">
        Progress: <strong>${lifted}/${total}</strong> · spent <strong>$${state.totalCost.toFixed(4)}</strong>${errors > 0 ? ` · <span style="color:#a00;">${errors} error(s)</span>` : ''}
      </div>
      <div style="font-family:'IBM Plex Mono',monospace; font-size:11px;">
        ${state.slotLifts
          .map((l) => {
            const symbol =
              l.status === 'done'
                ? '✓'
                : l.status === 'lifting'
                  ? '⏳'
                  : l.status === 'error'
                    ? '✗'
                    : l.status === 'empty'
                      ? '—'
                      : '·';
            const color =
              l.status === 'done'
                ? '#2a8'
                : l.status === 'lifting'
                  ? '#a60'
                  : l.status === 'error'
                    ? '#a00'
                    : '#888';
            const detail = l.error
              ? ` ERROR: ${escapeHtml(l.error)}`
              : l.costUSD
                ? ` $${l.costUSD.toFixed(4)} · ${l.subjectTypes?.join(', ') || ''}`
                : '';
            return `<div style="color:${color}; padding:2px 0;">${symbol} ${l.slotName.padEnd(20)}${detail}</div>`;
          })
          .join('')}
      </div>
    </section>
  `;
}

function renderStage3Export(state) {
  const liftsOK = state.slotLifts.filter((l) => l.status === 'done').length;
  if (liftsOK === 0) return '';
  const ex = state.export;
  return `
    <section style="border:1px solid #d0cec3; border-radius:6px; padding:18px; margin-bottom:16px; background:white;">
      <h3 style="margin:0 0 8px; font-size:16px;">Stage 3 — Export</h3>
      <div style="font-size:12px; color:#666; margin-bottom:12px;">
        Atlas Present is the spatial visual <strong>presenter</strong>. PPTX = editable / shareable; PDF = archival / print. 3D handoff uses the underlying <code>deck.json</code>, not these.
      </div>
      <div style="display:flex; gap:10px; align-items:center;">
        <button id="btn-export-pptx" ${ex.active ? 'disabled' : ''} style="padding:10px 16px; background:#1e1b1e; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:600;">
          ${ex.active && ex.format === 'pptx' ? '⏳ Exporting PPTX…' : '⬇ Download PPTX'}
        </button>
        <button id="btn-export-pdf" ${ex.active ? 'disabled' : ''} style="padding:10px 16px; background:white; color:#1e1b1e; border:1px solid #1e1b1e; border-radius:4px; cursor:pointer; font-weight:600;">
          ${ex.active && ex.format === 'pdf' ? '⏳ Exporting PDF…' : '⬇ Download PDF'}
        </button>
        <span style="font-size:12px; color:#888;">${liftsOK} slot${liftsOK !== 1 ? 's' : ''} baked</span>
      </div>
      ${
        ex.active || ex.error || (ex.msg && ex.progress === 100)
          ? `<div style="margin-top:12px; font-size:12px; ${ex.error ? 'color:#a00;' : 'color:#444;'}">
              ${ex.error ? `ERROR: ${escapeHtml(ex.error)}` : `${escapeHtml(ex.msg)} (${Math.round(ex.progress)}%)`}
              ${ex.active ? `<div style="margin-top:6px; background:#eee; height:4px; border-radius:2px; overflow:hidden;"><div style="background:#2a8; height:100%; width:${ex.progress}%; transition:width 0.2s;"></div></div>` : ''}
            </div>`
          : ''
      }
    </section>
  `;
}

function renderDeckPreview(state) {
  if (!state.slotLifts) return '';
  const theme = state.pickerResult.theme;
  return `
    <section>
      <h3 style="font-size:16px;margin-bottom:12px;">Assembled Deck</h3>
      ${state.slotLifts
        .map((l) => {
          if (l.status === 'empty') {
            return `<div style="background:white; border:1px solid #eee; border-radius:6px; padding:24px; margin-bottom:12px; color:#888; font-style:italic;">Slot ${l.slotIdx} (${l.slotName}): empty</div>`;
          }
          if (l.status === 'error') {
            return `<div style="background:#fee; border:1px solid #fcc; border-radius:6px; padding:18px; margin-bottom:12px;"><strong>Slot ${l.slotIdx} (${l.slotName})</strong>: error — ${escapeHtml(l.error || '')}</div>`;
          }
          if (l.status !== 'done') {
            return `<div style="background:white; border:1px solid #eee; border-radius:6px; padding:24px; margin-bottom:12px; color:#888;">Slot ${l.slotIdx} (${l.slotName}): ${l.status}...</div>`;
          }
          return `
            <div style="background:white; border:1px solid #d0cec3; border-radius:6px; margin-bottom:16px; overflow:hidden;">
              <div style="padding:8px 14px; background:#1e1b1e; color:white; font-size:12px; font-family:'IBM Plex Mono',monospace;">
                <strong>${l.slotIdx}.</strong> ${l.slotName} · ${l.subjectTypes?.join(', ') || ''}
              </div>
              <div style="padding:12px; background:rgb(${theme.bg.join(',')}); display:flex; justify-content:center;">
                <canvas id="slot-canvas-${l.slotIdx}" width="1280" height="720" style="max-width:100%; height:auto; box-shadow:0 4px 12px rgba(0,0,0,0.08); border-radius:4px;"></canvas>
              </div>
            </div>
          `;
        })
        .join('')}
    </section>
  `;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
