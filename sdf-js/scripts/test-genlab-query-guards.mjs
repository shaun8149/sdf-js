// Regression coverage for public Genlab utility-page query guards.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

const sandbox = {
  window: {},
  location: { search: '' },
  URLSearchParams,
  Number,
  Math,
  Error,
};
vm.runInNewContext(read('examples/genlab/query-params.js'), sandbox);

const q = sandbox.window.genlabQuery;
assert.equal(typeof q.safeCanvasSize, 'function');
assert.equal(q.safeCanvasSize(null), 900, 'missing size keeps the default');
assert.equal(q.safeCanvasSize('360'), 360, 'normal gallery size is preserved');
assert.equal(q.safeCanvasSize('50000'), q.MAX_CANVAS_SIZE, 'huge size is capped');
assert.equal(q.safeCanvasSize('-5'), 64, 'negative size is raised to the floor');
assert.equal(q.safeCanvasSize('not-a-number'), 900, 'non-numeric size falls back');

assert.equal(q.safeSlug('dust-storm-farm'), 'dust-storm-farm');
assert.equal(q.safeSlug('piece_17'), 'piece_17');
assert.equal(q.safeSlug('../src/index'), null, 'path traversal is rejected');
assert.equal(q.safeSlug('x"></iframe><img src=x onerror=alert(1)>'), null, 'markup is rejected');
assert.deepEqual(q.safeSlugList(['ok', '../bad', 'also_ok']), ['ok', 'also_ok']);

const gallery = read('examples/genlab/gallery.html');
assert.ok(gallery.includes('query-params.js'), 'gallery loads query guards');
assert.ok(!gallery.includes('cell.innerHTML'), 'gallery does not inject ids through innerHTML');
assert.ok(gallery.includes('tag.textContent = id'), 'gallery renders id labels as text');
assert.ok(gallery.includes('encodeURIComponent(id)'), 'gallery encodes ids in iframe URLs');

for (const page of ['gen.html', 'view.html', 'view3.html', 'fx.html']) {
  const html = read(`examples/genlab/${page}`);
  assert.ok(
    html.includes('applyCanvasSizeFromQuery'),
    `${page} clamps ?size before canvas allocation`,
  );
  assert.ok(
    !html.includes('c.width = c.height = Number(sz)'),
    `${page} removed unbounded Number(size) assignment`,
  );
}

for (const page of ['view.html', 'view3.html', 'fx.html', 'flow-gpu.html']) {
  const html = read(`examples/genlab/${page}`);
  assert.ok(html.includes('requireSlug'), `${page} validates path-derived query id`);
}

for (const page of ['view.html', 'view3.html', 'fx.html']) {
  const html = read(`examples/genlab/${page}`);
  assert.ok(
    !html.includes('document.body.innerHTML'),
    `${page} does not render exception text as HTML`,
  );
  assert.ok(
    html.includes('document.body.replaceChildren(pre)'),
    `${page} renders exception text safely`,
  );
}

console.log('genlab query guards: ok');
