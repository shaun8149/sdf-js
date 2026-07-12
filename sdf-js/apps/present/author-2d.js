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
import { newsToFullDeck, reliftSlot, retryFailedSlot } from '../../src/present/news/full-deck.js';
import { renderSceneDataToCanvas } from '../../src/present/atoms-2d/renderer.js';
import {
  rethemeDeck,
  applySectionAccents,
  slotPalette,
  slotRoleOf,
} from '../../src/present/retheme.js';
import { decorFromHash, mintDecorHash } from '../../src/present/decor/registry.js';
import {
  artMountOpts,
  loadArtMount,
  fetchMintManifest,
  mountPaletteOverride,
  mountUnderlayDecor,
  rankMounts,
} from '../../src/present/art-mount.js';
import { ATLAS_THEMES } from '../../src/present/themes.js';
import { exportDeckToPPTX } from '../../src/present/exporters/pptx.js';
import { exportDeckToPDF } from '../../src/present/exporters/pdf.js';
import { serializeDeck, deserializeDeck } from '../../src/present/deck-io.js';
import { listScaffolds } from '../../src/present/scaffolds/registry.js';
import { assessDeck } from '../../src/present/quality-lights.js';

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
    if (currentDeck.decor?.hash)
      currentDeck.decor = mintDecor(currentDeck.theme, {
        hash: currentDeck.decor.hash,
        v: currentDeck.decor.v,
        serial: currentDeck.decor.serial,
      });
    await renderDeck(currentDeck);
    syncProvenance();
    autosave();
    setStatus(`theme → ${themeEl.value} (re-rendered, exports follow)`);
  } catch (e) {
    setStatus(`theme switch failed: ${e.message}`, true);
  }
});

// Sprint 63: scaffold choice for 整本 mode — 自动 (deterministic ranker)
// or any of the 21 skeletons. Hidden in quick mode (quick has no scaffold).
const scaffoldEl = document.getElementById('scaffold');
{
  const auto = document.createElement('option');
  auto.value = 'auto';
  auto.textContent = '骨架 · 自动';
  scaffoldEl.appendChild(auto);
  const news = document.createElement('option');
  news.value = 'news-briefing';
  news.textContent = 'News Briefing (默认)';
  scaffoldEl.appendChild(news);
  for (const sc of listScaffolds()) {
    if (sc.id === 'news-briefing') continue;
    const opt = document.createElement('option');
    opt.value = sc.id;
    opt.textContent = sc.label || sc.id;
    scaffoldEl.appendChild(opt);
  }
  scaffoldEl.value = 'news-briefing';
  const syncScaffoldVis = () => {
    scaffoldEl.hidden = modeEl.value !== 'full';
  };
  modeEl.addEventListener('change', syncScaffoldVis);
  syncScaffoldVis();
}

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

// ── Sprint 62: deck persistence — 💾 download / 📂 open / autosave ──────────
// deck.json is the machine contract (two-ends lock): saving it is the 3D
// handoff artifact made user-visible, not just a UI convenience.
const saveEl = document.getElementById('save');
const openEl = document.getElementById('open');
const openFileEl = document.getElementById('openfile');
const AUTOSAVE_KEY = 'atlas-last-deck';

function autosave() {
  if (!currentDeck) return;
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(serializeDeck(currentDeck)));
  } catch {
    /* quota — deck survives in memory; 💾 still works */
  }
}

async function adoptDeck(deck, note) {
  currentDeck = deck;
  window.__atlasDeck = currentDeck;
  await renderDeck(currentDeck);
  exportPptxEl.disabled = false;
  exportPdfEl.disabled = false;
  saveEl.disabled = false;
  syncThemeSelect();
  syncProvenance();
  if (note) setStatus(note);
}

saveEl.addEventListener('click', () => {
  if (!currentDeck) return;
  const blob = new Blob([JSON.stringify(serializeDeck(currentDeck), null, 1)], {
    type: 'application/json',
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  const slug = (currentDeck.title || 'deck').replace(/[^\w\u4e00-\u9fff-]+/g, '-').slice(0, 40);
  a.download = `atlas-${slug}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  setStatus(`已保存 ${a.download} — 这份 deck.json 也是交给 3D 端的机器契约`);
});

openEl.addEventListener('click', () => openFileEl.click());
openFileEl.addEventListener('change', async () => {
  const file = openFileEl.files?.[0];
  openFileEl.value = '';
  if (!file) return;
  try {
    const deck = deserializeDeck(await file.text());
    await adoptDeck(deck, `已打开 ${file.name} — ${deck.slots.length} 页`);
    autosave();
  } catch (e) {
    setStatus(`打开失败: ${e.message}`, true);
  }
});

// Decoration provenance (Sprint 41): the hash is MINTED per generation
// (crypto-random, fxhash-style) — never derived from the content. ?hash=
// re-opens an existing work — consumed ONCE, so later Generates mint fresh
// (Sprint 58: we now write the hash back into the address bar, and without
// the consume-once rule that would pin every subsequent mint).
let pendingUrlHash = new URLSearchParams(location.search).get('hash');
// ?v= pins the engine version the artifact was MINTED under (freeze
// contract: a v1 work re-opened must NOT run through the v2 pipeline).
// It is consumed together with ?hash — a later fresh Generate mints at
// the current DECOR_V, not the pinned one. ?at= is the VIEW layer:
// re-render any calendar-event look on demand, identity untouched.
let pendingUrlV = parseInt(new URLSearchParams(location.search).get('v'), 10) || undefined;
let pendingUrlSerial = parseInt(new URLSearchParams(location.search).get('n'), 10) || undefined;
const viewAt = new URLSearchParams(location.search).get('at') || undefined;
// Sprint 61: the serial — a per-browser mint counter (the L23 Pre-Process
// axis: hash names the individual, the serial names its place in YOUR run).
// It rides the reopen URL as &n= so the edition mark reproduces too.
const SERIAL_KEY = 'atlas-mint-serial';
function nextSerial() {
  const n = (parseInt(localStorage.getItem(SERIAL_KEY), 10) || 0) + 1;
  localStorage.setItem(SERIAL_KEY, String(n));
  return n;
}
function currentMint() {
  const h = pendingUrlHash;
  const v = pendingUrlV;
  const n = pendingUrlSerial;
  pendingUrlHash = null;
  pendingUrlV = undefined;
  pendingUrlSerial = undefined;
  return h
    ? { hash: h, v, serial: n }
    : { hash: mintDecorHash(), v: undefined, serial: nextSerial() };
}
function mintDecor(theme, { hash, v, serial }) {
  const d = decorFromHash(theme, hash, {
    ...(v ? { v } : {}),
    ...(serial != null ? { serial } : {}),
  });
  if (viewAt) d.at = viewAt;
  return d;
}

// ── Sprint 58: decoration as a product surface ────────────────────────────
// 换装 (re-dress) re-mints ONLY the decoration — content, theme and locks
// untouched; the provenance chip makes "持 hash 可复现" a button instead of
// a sentence; the decor toggle is a VIEW control (legibility escape hatch —
// identity stays in the hash, per the URL-view-layer idiom from Gazers).
const redressEl = document.getElementById('redress');
const decorVisEl = document.getElementById('decorvis');
const provEl = document.getElementById('prov');

function slotDecor(deck, slot) {
  if (!deck.decor || decorVisEl.value === 'off') return undefined;
  return { ...deck.decor, seed: (deck.decor.seed ?? 1) + (slot.slotIdx ?? 0) };
}

// ── Sprint 82: 真迹装裱 — authentic original mints as the deck's art layer.
// The mount replaces the decor engine on art surfaces (cover full-bleed +
// banner filmstrip); the decor toggle doubles as the mount's view switch.
// Degrades to nothing when the local mint cache is absent (gitignored).
const MINT_BASE = '../../examples/original-mints/cache/';
const artMountEl = document.getElementById('artmount');
let artMount = null;

function slotRenderOpts(theme, deck, slot) {
  const base = {
    palette: slotPalette(theme, slot),
    decor: slotDecor(deck, slot),
    decorRole: slotRoleOf(slot),
  };
  if (artMount && decorVisEl.value !== 'off') {
    Object.assign(base, artMountOpts(artMount, slot, slotRoleOf(slot)) || {});
    // Sprint 84: the deck speaks the artwork's colors — accents/numbers
    // across every atom come from the mount's extracted palette
    base.palette = mountPaletteOverride(base.palette, artMount);
    // Sprint 85: 内页纹样 — 异源默认, 同源可选 (user: Naïve×drift-web 和谐)
    base.decor = mountUnderlayDecor(base.decor, artMount, window.__underlayMode || 'hetero');
  }
  return base;
}

(async () => {
  const manifest = await fetchMintManifest(MINT_BASE);
  const oks = (manifest || []).filter((m) => m.status === 'ok');
  if (!oks.length) return; // no local cache — feature stays hidden
  // Sprint 87: 推荐排序 — dropdown best-first for the CURRENT theme, ⭐ top-3
  const themeAccentOf = () =>
    (ATLAS_THEMES.find((t) => t.id === themeEl.value) || ATLAS_THEMES[0])?.accent;
  const rebuildMountOptions = () => {
    const keep = artMountEl.value;
    while (artMountEl.options.length > 1) artMountEl.remove(1);
    const ranked = rankMounts(oks, themeAccentOf());
    ranked.forEach((m, i) => {
      const o = document.createElement('option');
      o.value = m.id;
      o.textContent = `${i < 3 ? '⭐ ' : ''}装裱 · ${m.name}${m.artist ? ' · ' + m.artist : ''}`;
      o.title = `${m.license || ''} — 原版脚本非商用运行 · 匹配分 ${m._score.toFixed(2)}`;
      artMountEl.appendChild(o);
    });
    artMountEl.value = keep;
  };
  rebuildMountOptions();
  themeEl.addEventListener('change', rebuildMountOptions);
  artMountEl.hidden = false;
  artMountEl.addEventListener('change', async () => {
    const id = artMountEl.value;
    try {
      artMount = id
        ? await loadArtMount(
            oks.find((m) => m.id === id),
            MINT_BASE,
          )
        : null;
    } catch (e) {
      artMount = null;
      artMountEl.value = '';
      return setStatus(`装裱加载失败: ${e.message}`, true);
    }
    const qs = new URLSearchParams(location.search);
    if (id) qs.set('art', id);
    else qs.delete('art');
    history.replaceState(null, '', `?${qs.toString()}`);
    if (currentDeck) await renderDeck(currentDeck);
    syncProvenance();
    setStatus(
      artMount
        ? `已装裱 — ${artMount.name} 真迹 (封面全幅 + 标题栏胶片条, 非商用)`
        : '已卸下装裱 — 回到生成引擎',
    );
  });
  const want = new URLSearchParams(location.search).get('art');
  if (want && oks.some((m) => m.id === want)) {
    artMountEl.value = want;
    artMountEl.dispatchEvent(new Event('change'));
  }
})();

function reopenUrl(hash, v, serial) {
  return `${location.origin}${location.pathname}?hash=${hash}${v ? `&v=${v}` : ''}${serial != null ? `&n=${serial}` : ''}`;
}

function syncProvenance() {
  const d = currentDeck?.decor;
  if (!d?.hash) {
    provEl.hidden = true;
    redressEl.disabled = true;
    decorVisEl.disabled = true;
    return;
  }
  provEl.hidden = false;
  redressEl.disabled = false;
  decorVisEl.disabled = false;
  provEl.textContent = `${artMount && decorVisEl.value !== 'off' ? `装裱 ${artMount.name} 真迹 · ` : ''}作品 #${String(d.hash).slice(0, 8)}${d.serial != null ? ` · Nº ${d.serial}` : ''} · ${d.family} · ${d.personality} · v${d.v ?? 1}${d.rare ? ' · ✨稀有' : ''}`;
  // the address bar IS the provenance link (safe: ?hash is consume-once);
  // preserve other params (?demo=1 etc.) — only the hash slot is ours
  const qs = new URLSearchParams(location.search);
  qs.set('hash', d.hash);
  if (d.v) qs.set('v', String(d.v));
  if (d.serial != null) qs.set('n', String(d.serial));
  else qs.delete('n');
  history.replaceState(null, '', `?${qs.toString()}`);
}

provEl.addEventListener('click', async () => {
  const d = currentDeck?.decor;
  if (!d?.hash) return;
  try {
    await navigator.clipboard.writeText(reopenUrl(d.hash, d.v, d.serial));
    setStatus(`已复制复现链接 — 持有它可永久重开这件作品 (#${String(d.hash).slice(0, 8)})`);
  } catch {
    setStatus(reopenUrl(d.hash, d.v, d.serial)); // clipboard blocked: show it instead
  }
});

redressEl.addEventListener('click', async () => {
  if (!currentDeck) return;
  redressEl.disabled = true;
  try {
    currentDeck.decor = mintDecor(currentDeck.theme, {
      hash: mintDecorHash(),
      serial: nextSerial(),
    });
    await renderDeck(currentDeck);
    syncProvenance();
    autosave();
    const d = currentDeck.decor;
    setStatus(
      `已换装 — 作品 #${String(d.hash).slice(0, 8)} (${d.family} · ${d.personality}${d.rare ? ' · ✨稀有件!' : ''})`,
    );
  } catch (e) {
    setStatus(`换装失败: ${e.message}`, true);
  } finally {
    redressEl.disabled = false;
  }
});

decorVisEl.addEventListener('change', async () => {
  if (!currentDeck) return;
  await renderDeck(currentDeck);
  setStatus(decorVisEl.value === 'off' ? '修饰已隐藏 (导出同样不含)' : '修饰已恢复');
});

// ── Sprint 67: quality lights — the offline eval's two zero-LLM axes run
// right here after every render, so a page that overflows or asserts an
// ungrounded number wears its light BEFORE export or 3D handoff.
async function updateQualityLights() {
  if (!currentDeck) return;
  try {
    const outline = currentDeck.slots.find((s) => s.liftParams)?.liftParams?.slides || [];
    const { bySlot, counts } = await assessDeck(currentDeck, {
      sourceTexts: [promptEl.value, ...outline],
    });
    // slot cards precede failed-slot cards in slidesEl, so index alignment
    // with deck.slots holds for the first slots.length children
    [...slidesEl.children].forEach((card, i) => {
      const slot = currentDeck.slots[i];
      const a = bySlot.get(slot);
      if (!a) return;
      let b = card.querySelector('.qlight');
      if (!b) {
        b = document.createElement('button');
        b.className = 'qlight';
        card.appendChild(b);
      }
      b.textContent = a.level === 'ok' ? '🟢' : a.level === 'warn' ? '🟡' : '🔴';
      b.title = a.summary;
      b.onclick = () =>
        setStatus(`「${slot.slotTitle || slot.slotName || `第${i + 1}页`}」 ${a.summary}`);
    });
    if (counts.bad > 0) {
      console.warn(
        `[quality-lights] ${counts.bad} slide(s) flagged 🔴 — hover the light for detail`,
      );
    }
  } catch (e) {
    console.warn('[quality-lights] assessment failed:', e);
  }
}

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
    attachSlideControls(card, canvas, deck, slot);
    slidesEl.appendChild(card);
    await renderSceneDataToCanvas(canvas, slot.sceneData, slotRenderOpts(deck.theme, deck, slot));
  }
  // Sprint 68: failed slots surface as retryable cards, not console lines —
  // a dropped page you can SEE is a page you can rescue
  for (const errEntry of deck.errors || []) {
    if (!errEntry.liftParams) continue;
    const card = document.createElement('div');
    card.className = 'slide-card failed';
    const body = document.createElement('div');
    body.className = 'fail-body';
    body.innerHTML = `<b>「${errEntry.slotTitle || errEntry.slot}」lift 失败</b><span>${String(
      errEntry.message,
    ).slice(0, 120)}</span>`;
    const retryBtn = document.createElement('button');
    retryBtn.className = 'retry';
    retryBtn.textContent = '🔁 重试这一页';
    retryBtn.addEventListener('click', async () => {
      const apiKey = keyEl.value.trim();
      if (!apiKey) return setStatus('paste your Anthropic API key first', true);
      retryBtn.disabled = true;
      retryBtn.textContent = 're-lifting…';
      try {
        await retryFailedSlot(deck, errEntry, { apiKey });
        await renderDeck(deck);
        autosave();
        setStatus(`「${errEntry.slotTitle || errEntry.slot}」已救回 — ${deck.slots.length} 页`);
      } catch (e) {
        retryBtn.disabled = false;
        retryBtn.textContent = '🔁 重试这一页';
        setStatus(`重试失败: ${e.message}`, true);
      }
    });
    card.appendChild(body);
    card.appendChild(retryBtn);
    slidesEl.appendChild(card);
  }
  updateQualityLights(); // async, non-blocking — lights pop in when ready
}

// ── Sprint 38: per-slide ⚡ (Napkin-style) — 🎲 re-roll + ✏️ instruct ────────
// Both re-lift THIS slot only (~6s, hits the prompt cache); the deck object
// is mutated in place so PPTX/PDF exports automatically reflect edits.
function attachSlideControls(card, canvas, deck, slot) {
  const bar = document.createElement('div');
  bar.className = 'slide-tools';

  // ── deck-level tools (Sprint 62): every slide can be moved or removed —
  // the deck is a document, not a printout. Exports follow the array.
  const moveBtn = (dir) => {
    const b = document.createElement('button');
    b.textContent = dir < 0 ? '◀' : '▶';
    b.title = dir < 0 ? '前移一页' : '后移一页';
    b.addEventListener('click', async () => {
      const i = deck.slots.indexOf(slot);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= deck.slots.length) return;
      [deck.slots[i], deck.slots[j]] = [deck.slots[j], deck.slots[i]];
      await renderDeck(deck);
      autosave();
      setStatus(`「${slot.slotTitle || '这一页'}」已${dir < 0 ? '前' : '后'}移`);
    });
    return b;
  };
  const delBtn = document.createElement('button');
  delBtn.textContent = '🗑';
  delBtn.title = '删除这一页 (导出即时生效)';
  delBtn.addEventListener('click', async () => {
    const i = deck.slots.indexOf(slot);
    if (i < 0) return;
    deck.slots.splice(i, 1);
    await renderDeck(deck);
    autosave();
    setStatus(`已删除「${slot.slotTitle || '一页'}」— 剩 ${deck.slots.length} 页`);
  });

  const lockBtn = document.createElement('button');
  const syncLock = () => {
    lockBtn.textContent = slot.locked ? '🔒' : '✋';
    lockBtn.title = slot.locked
      ? '已锁定 — 重新 Generate 时保留这一页 (点击解锁)'
      : '锁定这一页 (重新 Generate 时保留, 不再重 lift)';
    card.classList.toggle('locked', !!slot.locked);
    rollBtn.disabled = editBtn.disabled = !!slot.locked;
  };

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
      await renderSceneDataToCanvas(canvas, sceneData, slotRenderOpts(deck.theme, deck, slot));
      editRow.classList.remove('open');
      editInput.value = '';
      autosave();
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

  lockBtn.addEventListener('click', () => {
    slot.locked = !slot.locked;
    syncLock();
    setStatus(
      slot.locked ? `slide "${slot.slotTitle}" 已锁定` : `slide "${slot.slotTitle}" 已解锁`,
    );
  });
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

  bar.appendChild(moveBtn(-1));
  bar.appendChild(moveBtn(1));
  bar.appendChild(delBtn);
  if (slot.liftParams) {
    bar.appendChild(lockBtn);
    bar.appendChild(rollBtn);
    bar.appendChild(editBtn);
    syncLock();
  }
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
      // Sprint 62: slides STREAM IN as they lift — the 90s wait becomes a
      // deck growing in front of you. The artifact is minted up front so
      // streamed slides already wear their decoration.
      const lockedSlots = (currentDeck?.slots || []).filter((s) => s.locked && s.liftParams);
      const mintInfo = currentMint();
      let streamDecor = null;
      let streamTheme = null;
      const streamCards = new Map();
      currentDeck = await newsToFullDeck(text, {
        apiKey,
        lockedSlots,
        scaffoldId: scaffoldEl.value,
        onProgress: (msg, pct) => setStatus(`${msg} (${Math.round(pct)}%)`),
        onPlan: (plan, meta) => {
          streamTheme = meta.theme;
          streamDecor = mintDecor(meta.theme, mintInfo);
          slidesEl.innerHTML = '';
          for (const pl of plan) {
            const card = document.createElement('div');
            card.className = 'slide-card busy';
            const canvas = document.createElement('canvas');
            canvas.width = 1280;
            canvas.height = 720;
            const cap = document.createElement('div');
            cap.className = 'cap';
            cap.textContent = pl.slotTitle || pl.slotName || '';
            const busy = document.createElement('div');
            busy.className = 'slide-busy';
            busy.textContent = 'lifting…';
            card.appendChild(canvas);
            card.appendChild(cap);
            card.appendChild(busy);
            slidesEl.appendChild(card);
            streamCards.set(pl.slotIdx, { card, canvas });
          }
        },
        onSlotReady: async (slot) => {
          const entry = streamCards.get(slot.slotIdx);
          if (!entry) return;
          try {
            await renderSceneDataToCanvas(
              entry.canvas,
              slot.sceneData,
              slotRenderOpts(streamTheme, { decor: streamDecor }, slot),
            );
          } finally {
            entry.card.classList.remove('busy');
          }
        },
      });
      if (currentDeck.errors?.length) {
        console.warn('[full-deck] slot errors:', currentDeck.errors);
      }
      currentDeck.decor = streamDecor ?? mintDecor(currentDeck.theme, mintInfo);
      const errNote = currentDeck.errors?.length
        ? ` (${currentDeck.errors.length} slot(s) failed — see console)`
        : '';
      await adoptDeck(
        currentDeck,
        `done — ${currentDeck.slots.length} pages · 骨架 ${currentDeck.scaffold?.label || ''}${errNote}. 作品 #${currentDeck.decor.hash} (唯一, 持 hash 可复现). Export below.`,
      );
      autosave();
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
    // Sprint 73: quick decks get section colors too — every content page
    // holds its own hue (slot names are unique → one section per page)
    applySectionAccents(currentDeck);
    // demo default is a fixed hash (deterministic screenshots), but an
    // explicit ?hash= re-open wins even in demo — provenance is testable
    currentDeck.decor = mintDecor(
      currentDeck.theme,
      DEMO_MODE && !pendingUrlHash ? { hash: 'demo-fixed-hash' } : currentMint(),
    );
    await adoptDeck(
      currentDeck,
      `done — ${currentDeck.slots.length} slide(s) rendered. 作品 #${currentDeck.decor.hash}. Export below.`,
    );
    autosave();
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
    // decor toggle applies to exports too — screen and file must match
    const deckForExport =
      decorVisEl.value === 'off' ? { ...currentDeck, decor: undefined } : currentDeck;
    const result = await fn(deckForExport, {
      onProgress: (msg, pct) => setStatus(`${msg} (${Math.round(pct)}%)`),
      // 真迹装裱跟随视图开关 — 屏幕与文件一致
      ...(artMount && decorVisEl.value !== 'off' ? { artMount } : {}),
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

if (DEMO_MODE) {
  generate();
} else {
  // Sprint 62: continuity — the last deck survives a refresh (no LLM cost).
  const saved = localStorage.getItem(AUTOSAVE_KEY);
  if (saved) {
    try {
      adoptDeck(
        deserializeDeck(saved),
        '已恢复上次的 deck (免费, 本地) — 直接编辑/导出, 或 Generate 生成新的',
      ).catch(() => {});
    } catch {
      /* corrupt autosave — start fresh */
    }
  }
}
