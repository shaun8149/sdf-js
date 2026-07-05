// author.js — the "text → world" page: describe the presentation, textToIR
// turns it into a validated deck of IRs, assembleDeck builds ONE continuous
// world, and the camera flies it. The full thesis loop in one input box.
import { textToIR } from '../../src/scene/text-to-ir.js';
import { assembleDeck } from '../../src/scene/assemble-deck.js';
import { createFigure } from './figure-core.js';

const STORAGE_KEY = 'atlas-anthropic-key'; // shared with the compositor's lift

const params = new URLSearchParams(location.search);
const env = params.get('env') || 'studio';
const { show } = createFigure({ outdoor: env !== 'studio' });

const promptEl = document.getElementById('prompt');
const goEl = document.getElementById('go');
const statusEl = document.getElementById('status');
const keyEl = document.getElementById('key');
const loading = document.getElementById('loading');

keyEl.value = localStorage.getItem(STORAGE_KEY) || '';
keyEl.addEventListener('change', () => localStorage.setItem(STORAGE_KEY, keyEl.value.trim()));

const setStatus = (msg, err = false) => {
  statusEl.textContent = msg;
  statusEl.className = err ? 'err' : '';
};

async function generate() {
  const text = promptEl.value.trim();
  const apiKey = keyEl.value.trim();
  if (!text) return setStatus('write what you want to present first', true);
  if (!apiKey)
    return setStatus('paste your Anthropic API key (top right — it stays in your browser)', true);
  goEl.disabled = true;
  try {
    setStatus('thinking… (text → structures)');
    const deck = await textToIR(text, apiKey);
    setStatus(
      `building ${deck.slides.length} station${deck.slides.length > 1 ? 's' : ''}: ${deck.slides.map((s) => s.structure).join(' → ')}`,
    );
    loading.classList.remove('done'); // shader may recompile for a new shape
    show(assembleDeck(deck, { env }));
  } catch (e) {
    setStatus(e.message, true);
  } finally {
    goEl.disabled = false;
  }
}

goEl.addEventListener('click', generate);
promptEl.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') generate();
});
