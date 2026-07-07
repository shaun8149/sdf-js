// author-2d.js — the "text → deck" page, 2D end. Same one-input UX as
// author.html (3D end, which owns author.html/js — this is a SEPARATE page
// per the two-ends architecture lock), but renders IR as Canvas2D pseudo-3D
// atom slides instead of flying a 3D camera through a compiled world. This
// is what unlocks weak-display preview + PPTX/PDF export for text-authored
// decks: the exporters only know how to draw atoms-2d sceneData.
//
// ?demo=1 — skip the (BYOK) LLM call and render a fixed 3-slide IR deck.
// Used for headless verification where a real Anthropic call can't run.
import { textToIR } from '../../src/scene/text-to-ir.js';
import { irDeckTo2DDeck } from '../../src/scene/ir-to-2d.js';
import { newsToFullDeck, reliftSlot } from '../../src/present/news/full-deck.js';
import { renderSceneDataToCanvas } from '../../src/present/atoms-2d/renderer.js';
import { rethemeDeck } from '../../src/present/retheme.js';
import { ATLAS_THEMES } from '../../src/present/themes.js';
import { exportDeckToPPTX } from '../../src/present/exporters/pptx.js';
import { exportDeckToPDF } from '../../src/present/exporters/pdf.js';

const STORAGE_KEY = 'atlas-anthropic-key'; // shared with the compositor's lift + author.js (3D)

const params = new URLSearchParams(location.search);
const DEMO_MODE = params.get('demo') === '1';

const DEMO_IR_DECK = {
  title: 'Q3 Review (demo)',
  slides: [
    {
      structure: 'magnitude',
      nodes: ['Americas', 'EMEA', 'APAC'],
      magnitude: [890, 420, 310],
      emphasis: [0],
      title: 'Revenue by Region',
    },
    {
      structure: 'sequence',
      nodes: ['Leads', 'Qualified', 'Proposal', 'Closed'],
      magnitude: [1200, 400, 150, 45],
      emphasis: [3],
      title: 'Sales Funnel',
    },
    {
      structure: 'hierarchy',
      nodes: ['CEO', 'VP Engineering', 'VP Sales', 'Eng Team', 'Design Team'],
      relations: [
        [0, 1],
        [0, 2],
        [1, 3],
        [1, 4],
      ],
      title: 'New Org',
    },
  ],
};

const promptEl = document.getElementById('prompt');
const goEl = document.getElementById('go');
const statusEl = document.getElementById('status');
const keyEl = document.getElementById('key');
const slidesEl = document.getElementById('slides');
const exportPptxEl = document.getElementById('export-pptx');
const exportPdfEl = document.getElementById('export-pdf');
const modeEl = document.getElementById('mode');
const themeEl = document.getElementById('theme');

// Theme switcher (Sprint 39): zero-LLM-cost — palette swap + deterministic
// remap of theme colors the lift baked into args, then full re-render.
for (const t of ATLAS_THEMES) {
  const opt = document.createElement('option');
  opt.value = t.id;
  opt.textContent = t.label || t.id;
  themeEl.appendChild(opt);
}
themeEl.addEventListener('change', async () => {
  if (!currentDeck) return;
  try {
    rethemeDeck(currentDeck, themeEl.value);
    await renderDeck(currentDeck);
    setStatus(`theme → ${themeEl.value} (re-rendered, exports follow)`);
  } catch (e) {
    setStatus(`theme switch failed: ${e.message}`, true);
  }
});

function syncThemeSelect() {
  if (currentDeck?.theme?.id) themeEl.value = currentDeck.theme.id;
  themeEl.disabled = !currentDeck;
}

keyEl.value = localStorage.getItem(STORAGE_KEY) || '';
keyEl.addEventListener('change', () => localStorage.setItem(STORAGE_KEY, keyEl.value.trim()));

if (DEMO_MODE) {
  promptEl.value =
    'our Q3: revenue by region with Americas leading at 890, the funnel from 1200 leads to 45 closed, and the new org under the CEO';
}

let currentDeck = null; // exporter-ready deck ({title, theme, scaffold, slots})

const setStatus = (msg, err = false) => {
  statusEl.textContent = msg;
  statusEl.className = err ? 'err' : '';
};

async function renderDeck(deck) {
  slidesEl.innerHTML = '';
  for (const slot of deck.slots) {
    const card = document.createElement('div');
    card.className = 'slide-card';
    const canvas = document.createElement('canvas');
    canvas.width = 1280;
    canvas.height = 720;
    const cap = document.createElement('div');
    cap.className = 'cap';
    cap.textContent = slot.slotTitle || slot.slotName || '';
    card.appendChild(canvas);
    card.appendChild(cap);
    if (slot.liftParams) attachSlideControls(card, canvas, deck, slot);
    slidesEl.appendChild(card);
    await renderSceneDataToCanvas(canvas, slot.sceneData, { palette: deck.theme });
  }
}

// ── Sprint 38: per-slide ⚡ (Napkin-style) — 🎲 re-roll + ✏️ instruct ────────
// Both re-lift THIS slot only (~6s, hits the prompt cache); the deck object
// is mutated in place so PPTX/PDF exports automatically reflect edits.
function attachSlideControls(card, canvas, deck, slot) {
  const bar = document.createElement('div');
  bar.className = 'slide-tools';

  const rollBtn = document.createElement('button');
  rollBtn.textContent = '🎲';
  rollBtn.title = '重新生成这一页 (同素材, 新的排版/图表选择)';

  const editBtn = document.createElement('button');
  editBtn.textContent = '✏️';
  editBtn.title = '用一句话修改这一页 (如: 换成柱状图 / 标题更简短)';

  const editRow = document.createElement('div');
  editRow.className = 'slide-edit-row';
  const editInput = document.createElement('input');
  editInput.placeholder = '想怎么改? 如: 换成柱状图 / 只保留三个要点';
  const editGo = document.createElement('button');
  editGo.textContent = '⚡';
  editRow.appendChild(editInput);
  editRow.appendChild(editGo);

  const busy = document.createElement('div');
  busy.className = 'slide-busy';
  busy.textContent = 're-lifting…';

  async function relift(revision) {
    const apiKey = keyEl.value.trim();
    if (!apiKey) return setStatus('paste your Anthropic API key first', true);
    card.classList.add('busy');
    rollBtn.disabled = editGo.disabled = true;
    try {
      const sceneData = await reliftSlot(currentDeck, slot.slotIdx, { apiKey, revision });
      await renderSceneDataToCanvas(canvas, sceneData, { palette: deck.theme });
      editRow.classList.remove('open');
      editInput.value = '';
      setStatus(
        revision ? `slide "${slot.slotTitle}" revised.` : `slide "${slot.slotTitle}" re-rolled.`,
      );
    } catch (e) {
      setStatus(`re-lift failed: ${e.message}`, true);
    } finally {
      card.classList.remove('busy');
      rollBtn.disabled = editGo.disabled = false;
    }
  }

  rollBtn.addEventListener('click', () => relift(null));
  editBtn.addEventListener('click', () => {
    editRow.classList.toggle('open');
    if (editRow.classList.contains('open')) editInput.focus();
  });
  const submitEdit = () => {
    const v = editInput.value.trim();
    if (v) relift(v);
  };
  editGo.addEventListener('click', submitEdit);
  editInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitEdit();
  });

  bar.appendChild(rollBtn);
  bar.appendChild(editBtn);
  card.appendChild(bar);
  card.appendChild(editRow);
  card.appendChild(busy);
}

async function generate() {
  const text = promptEl.value.trim();
  const apiKey = keyEl.value.trim();
  if (!DEMO_MODE) {
    if (!text) return setStatus('write what you want to present first', true);
    if (!apiKey)
      return setStatus('paste your Anthropic API key (top right — it stays in your browser)', true);
  }
  goEl.disabled = true;
  exportPptxEl.disabled = true;
  exportPdfEl.disabled = true;
  try {
    if (!DEMO_MODE && modeEl.value === 'full') {
      // 整本模式 (Sprint 32): article → 10-20 page briefing via the SAME
      // pipeline modules the CLI bake uses (expand → map → per-slot lift).
      currentDeck = await newsToFullDeck(text, {
        apiKey,
        onProgress: (msg, pct) => setStatus(`${msg} (${Math.round(pct)}%)`),
      });
      window.__atlasDeck = currentDeck; // QA/debug handle
      if (currentDeck.errors?.length) {
        console.warn('[full-deck] slot errors:', currentDeck.errors);
      }
      await renderDeck(currentDeck);
      const errNote = currentDeck.errors?.length
        ? ` (${currentDeck.errors.length} slot(s) failed — see console)`
        : '';
      setStatus(`done — ${currentDeck.slots.length} pages rendered${errNote}. Export below.`);
      exportPptxEl.disabled = false;
      exportPdfEl.disabled = false;
      syncThemeSelect();
      return;
    }
    let irDeck;
    if (DEMO_MODE) {
      setStatus('demo mode — skipping LLM, rendering fixed 3-slide deck');
      irDeck = DEMO_IR_DECK;
    } else {
      setStatus('thinking… (text → structures)');
      irDeck = await textToIR(text, apiKey);
    }
    setStatus(
      `rendering ${irDeck.slides.length} slide${irDeck.slides.length > 1 ? 's' : ''}: ${irDeck.slides.map((s) => s.structure).join(' → ')}`,
    );
    currentDeck = irDeckTo2DDeck(irDeck);
    await renderDeck(currentDeck);
    setStatus(`done — ${currentDeck.slots.length} slide(s) rendered. Export below.`);
    exportPptxEl.disabled = false;
    exportPdfEl.disabled = false;
    syncThemeSelect();
  } catch (e) {
    setStatus(e.message, true);
  } finally {
    goEl.disabled = false;
  }
}

async function doExport(format) {
  if (!currentDeck) return;
  const btn = format === 'pptx' ? exportPptxEl : exportPdfEl;
  btn.disabled = true;
  try {
    const fn = format === 'pptx' ? exportDeckToPPTX : exportDeckToPDF;
    const result = await fn(currentDeck, {
      onProgress: (msg, pct) => setStatus(`${msg} (${Math.round(pct)}%)`),
    });
    setStatus(`downloaded: ${result.filename}`);
  } catch (e) {
    setStatus(`export failed: ${e.message}`, true);
  } finally {
    btn.disabled = false;
  }
}

goEl.addEventListener('click', generate);
promptEl.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') generate();
});
exportPptxEl.addEventListener('click', () => doExport('pptx'));
exportPdfEl.addEventListener('click', () => doExport('pdf'));

if (DEMO_MODE) generate();
