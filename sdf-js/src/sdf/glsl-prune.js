// =============================================================================
// glsl-prune.js — GLSL library dead-code elimination.
// -----------------------------------------------------------------------------
// The SDF GLSL library (~130KB across noise/voronoi/sdf3/sdf2) is prepended to
// EVERY scene shader, but a typical scene calls a handful of primitives. The
// driver still compiles all of it — the dominant cost behind multi-second (30s+
// for terrain scenes) cold shader compiles.
//
// pruneGLSL(source, roots) keeps only the top-level FUNCTIONS that are
// (transitively) referenced from `roots` (the emitted scene body + the
// renderer's own fragment code) — everything else (uniforms, #defines, consts,
// globals, comments outside functions) is always kept; those are bytes-cheap
// and may be referenced in ways reference-scanning can't see (macros, samplers).
//
// Parsing is a line/brace chunker, not a real grammar: it relies on the
// library's regular shape (top-level `retType name(args) { ... }` definitions,
// braces balanced, no function-local `}` at column-anything tricks — true for
// all four library files). Overloads (same name, different signature) live or
// die together. Chunks keep their original order, so declare-before-use is
// preserved automatically.
// =============================================================================

// Matches the START of a top-level function definition (return type + name +
// open paren). The opening brace may sit on the same or a following line.
const FN_START = /^\s*(?:float|vec[234]|int|bool|void|mat[234])\s+(\w+)\s*\(/;

/**
 * Split GLSL source into chunks: { kind: 'fn', name, text } for function
 * definitions (with their immediately-preceding comment block), and
 * { kind: 'keep', text } for everything else.
 */
export function chunkGLSL(source) {
  const lines = source.split('\n');
  const chunks = [];
  let keepBuf = [];
  let i = 0;

  const flushKeep = () => {
    if (keepBuf.length) {
      chunks.push({ kind: 'keep', text: keepBuf.join('\n') + '\n' });
      keepBuf = [];
    }
  };

  while (i < lines.length) {
    const m = lines[i].match(FN_START);
    if (!m) {
      keepBuf.push(lines[i]);
      i++;
      continue;
    }
    // Pull the fn's contiguous preceding comment/blank lines out of keepBuf so
    // a dropped fn takes its own comments with it.
    const attached = [];
    while (keepBuf.length) {
      const prev = keepBuf[keepBuf.length - 1];
      if (/^\s*(\/\/.*)?$/.test(prev)) attached.unshift(keepBuf.pop());
      else break;
    }
    // drop leading blank lines of the attached block (keep spacing in 'keep')
    while (attached.length && /^\s*$/.test(attached[0])) {
      keepBuf.push(attached.shift());
    }
    flushKeep();

    // Brace-match to the end of the function body.
    const fnLines = [...attached];
    let depth = 0;
    let sawBrace = false;
    while (i < lines.length) {
      const line = lines[i];
      fnLines.push(line);
      for (const ch of line) {
        if (ch === '{') {
          depth++;
          sawBrace = true;
        } else if (ch === '}') depth--;
      }
      i++;
      if (sawBrace && depth === 0) break;
    }
    chunks.push({ kind: 'fn', name: m[1], text: fnLines.join('\n') + '\n' });
  }
  flushKeep();
  return chunks;
}

/**
 * Dead-code-eliminate a GLSL library against root text(s).
 * @param {string} source  the library GLSL
 * @param {string|string[]} roots  code that calls into the library (scene body,
 *   renderer fragment code, …)
 * @returns {string} the pruned library (non-function chunks + reachable fns)
 */
export function pruneGLSL(source, roots) {
  const chunks = chunkGLSL(source);
  const fnNames = new Set(chunks.filter((c) => c.kind === 'fn').map((c) => c.name));
  if (fnNames.size === 0) return source;

  // Bodies per fn name (overloads concatenated — they share reachability).
  const bodyByName = new Map();
  for (const c of chunks) {
    if (c.kind !== 'fn') continue;
    bodyByName.set(c.name, (bodyByName.get(c.name) || '') + c.text);
  }

  // Roots = caller text + every non-function chunk (macros may call functions).
  const rootText =
    (Array.isArray(roots) ? roots.join('\n') : String(roots || '')) +
    '\n' +
    chunks
      .filter((c) => c.kind === 'keep')
      .map((c) => c.text)
      .join('\n');

  const calledIn = (text, name) => new RegExp(`\\b${name}\\s*\\(`).test(text);

  const needed = new Set();
  let frontier = [...fnNames].filter((n) => calledIn(rootText, n));
  while (frontier.length) {
    const next = [];
    for (const n of frontier) {
      if (needed.has(n)) continue;
      needed.add(n);
      const body = bodyByName.get(n);
      for (const m of fnNames) {
        if (!needed.has(m) && calledIn(body, m)) next.push(m);
      }
    }
    frontier = next;
  }

  return chunks
    .filter((c) => c.kind !== 'fn' || needed.has(c.name))
    .map((c) => c.text)
    .join('');
}
