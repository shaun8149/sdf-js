// figure-load.js — fail-loud loading helpers for the standalone figure viewer.

function targetLabel(deckName, irName) {
  const name = deckName || irName || 'funnel-sales';
  return { name, kind: deckName ? 'deck' : 'IR' };
}

export async function loadFigureIR({ deckName = null, irName = 'funnel-sales', fetchImpl = fetch } = {}) {
  const { name, kind } = targetLabel(deckName, irName);
  const url = `../../scenes/ir/${name}.json`;
  let res;
  try {
    res = await fetchImpl(url);
  } catch (e) {
    throw new Error(`Unable to load ${kind} "${name}": ${e?.message || e}`);
  }
  if (!res || !res.ok) {
    const status =
      res && Number.isFinite(res.status)
        ? `HTTP ${res.status}${res.statusText ? ` ${res.statusText}` : ''}`
        : 'no response';
    throw new Error(`Unable to load ${kind} "${name}" (${status})`);
  }

  let ir;
  try {
    ir = await res.json();
  } catch (e) {
    throw new Error(`Unable to parse ${kind} "${name}" JSON: ${e?.message || e}`);
  }

  if (!ir || typeof ir !== 'object') {
    throw new Error(`Invalid ${kind} "${name}": expected a JSON object`);
  }
  if (deckName && (!Array.isArray(ir.slides) || ir.slides.length === 0)) {
    throw new Error(`Invalid deck "${name}": missing non-empty slides[]`);
  }
  return ir;
}

export function showFigureLoadError(error, { documentObj = globalThis.document } = {}) {
  const loadingEl = documentObj?.getElementById?.('loading');
  if (!loadingEl || !documentObj?.createElement) return false;

  const box = documentObj.createElement('div');
  box.className = 'msg';
  Object.assign(box.style, {
    maxWidth: '620px',
    padding: '0 28px',
    textAlign: 'center',
    color: '#dce6f5',
    letterSpacing: '0',
    textTransform: 'none',
    lineHeight: '1.65',
  });

  const title = documentObj.createElement('div');
  title.textContent = 'ATLAS·PRESENT';
  Object.assign(title.style, {
    font: '600 22px/1.3 system-ui,sans-serif',
    letterSpacing: '.3em',
    marginBottom: '18px',
  });

  const body = documentObj.createElement('div');
  body.textContent = 'Unable to load this deck. Please check the link or regenerate the deck JSON.';
  Object.assign(body.style, { font: '400 15px/1.7 system-ui,sans-serif' });

  const detail = documentObj.createElement('div');
  detail.textContent = error?.message || String(error || 'Unknown error');
  Object.assign(detail.style, {
    marginTop: '14px',
    font: '500 12px/1.5 ui-monospace,monospace',
    color: 'rgba(220,230,245,.68)',
    overflowWrap: 'anywhere',
  });

  box.append(title, body, detail);
  loadingEl.replaceChildren(box);
  return true;
}
