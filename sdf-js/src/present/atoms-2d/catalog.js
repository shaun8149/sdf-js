// =============================================================================
// atoms-2d/catalog.js — atom spec catalog string for lift LLM prompt injection
// -----------------------------------------------------------------------------
// Sprint 18 Tier 3 A.1 — fixes "LLM guesses wrong arg keys" bug observed in
// QBR bake (fishbone got `problem`/`categories` vs spec `effect`/`branches`;
// timeline got `milestones` vs `events` → atoms rendered empty).
//
// Outputs a compact, cache-friendly catalog of every registered atom + its
// args schema, suitable for `cache_control: ephemeral` injection into the
// scaffold-pipeline lift system prompt.
//
// Usage:
//   import { buildAtomCatalogString } from '.../atoms-2d/catalog.js';
//   systemPrompt = base + buildAtomCatalogString() + buildIconCatalogString();
// =============================================================================

import { listAtomTypes, getAtomSpec } from './registry.js';

// In-memory cache so we don't re-load all atom modules on every bake run.
let _cached = null;

function fmtArg(name, def) {
  // def: { type, required, default, example, ... }
  const t = def?.type || 'any';
  const req = def?.required ? '' : '?';
  return `${name}${req}: ${t}`;
}

function fmtArgsBlock(specArgs) {
  if (!specArgs || typeof specArgs !== 'object') return '';
  const entries = Object.entries(specArgs);
  if (entries.length === 0) return '';
  return entries.map(([k, v]) => fmtArg(k, v)).join(', ');
}

/**
 * Build the prompt-injection catalog.
 *
 * Format per entry:
 *   - `atom-type` (category) — description
 *     args: argName: type, argName?: type, ...
 *
 * Atoms grouped by category. Cache result on first call.
 *
 * @returns {Promise<string>}
 */
export async function buildAtomCatalogString() {
  if (_cached !== null) return _cached;

  const types = listAtomTypes();
  const byCategory = new Map();

  for (const type of types) {
    try {
      const spec = await getAtomSpec(type);
      const cat = spec?.category || 'misc';
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat).push({ type, spec });
    } catch (e) {
      // Skip atoms that fail to load — don't break the prompt builder
      continue;
    }
  }

  const lines = [
    '## Atlas Atom Catalog — every emit-able atom + its exact args',
    '',
    '**HARD RULE**: Use the EXACT arg key names below. Atoms silently render',
    'empty if you pass wrong keys (e.g. `problem` instead of `effect`).',
    '',
  ];

  const sortedCats = [...byCategory.keys()].sort();
  for (const cat of sortedCats) {
    lines.push(`### ${cat}`);
    const items = byCategory.get(cat).sort((a, b) => a.type.localeCompare(b.type));
    for (const { type, spec } of items) {
      const desc = (spec.description || '').slice(0, 120);
      const argsBlock = fmtArgsBlock(spec.args);
      lines.push(`- \`${type}\` — ${desc}`);
      if (argsBlock) lines.push(`  args: ${argsBlock}`);
    }
    lines.push('');
  }

  _cached = lines.join('\n');
  return _cached;
}

// Test-only reset (called by smoke test to verify rebuild)
export function _resetCatalogCache() {
  _cached = null;
}
