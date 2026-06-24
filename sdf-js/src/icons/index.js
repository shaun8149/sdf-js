// =============================================================================
// sdf-js/src/icons/index.js — Atlas icon library runtime API (Sprint 18)
// -----------------------------------------------------------------------------
// Unified resolver across 3 sources (Phosphor / Simple Icons / flag-icons)
// with fuzzy fallback for typos. See:
//   docs/superpowers/specs/2026-06-23-atlas-icons-and-text-minimization-sprint-18-design.md
//
// Consumers:
//   - sdf-js/src/present/atoms-2d/icons/{icon-badge,icon-row,icon-grid}.js
//   - 6 atoms with inline-icon support (bullet-list / agenda-list / etc)
//   - Lift prompt v4 (catalog injection)
// =============================================================================

import { BAKED_ICONS } from './baked-library.js';
import { BRAND_ICONS } from './brand-icons.js';
import { FLAG_ICONS } from './flag-icons.js';
import { CATEGORIES, CATEGORY_NAMES, getCategoryNames, getCategoryForIcon } from './categories.js';
import { closestMatch } from './fuzzy.js';

// Pre-compute a flat name list for fuzzy matching (across all 3 sources, plain/unprefixed)
const PLAIN_NAMES = [
  ...Object.keys(BAKED_ICONS),
  ...Object.keys(BRAND_ICONS),
  ...Object.keys(FLAG_ICONS),
];

/**
 * Resolved icon descriptor (full form).
 * @typedef {object} IconResult
 * @property {Path2D|null} path — Path2D for path-based icons; null for flags
 * @property {string|null} color — Brand hex color; null for Phosphor / flags
 * @property {string} source — 'phosphor' | 'brand' | 'flag' | 'fallback'
 * @property {string} resolvedName — actual name used (may differ if fuzzy matched)
 * @property {string|null} svgInner — Flag SVG inner body; null for non-flag
 */

/**
 * Full resolver — returns an IconResult object or null if nothing matches.
 *
 * Prefer this over getIconPath2D when the atom needs any of:
 *   - brand color (e.g. Slack purple, GitHub dark)
 *   - flag SVG body (flags are multi-element SVGs, not single paths)
 *   - source attribution ('phosphor' | 'brand' | 'flag' | 'fallback')
 *   - the actual resolved name after fuzzy matching
 *
 * @param {string} name kebab-case icon name (Phosphor / brand: / flag:)
 * @returns {IconResult|null}
 */
export function resolveIcon(name) {
  if (!name || typeof name !== 'string') return null;
  const lc = name.toLowerCase().trim();

  // 1. Prefixed lookups (explicit source)
  if (lc.startsWith('phosphor:')) return _phosphorResult(lc.slice(9));
  if (lc.startsWith('brand:')) return _brandResult(lc.slice(6));
  if (lc.startsWith('flag:')) return _flagResult(lc.slice(5));
  if (lc.startsWith('country-')) return _flagResult(lc.slice(8));

  // 2. Try Phosphor (most common)
  if (Object.prototype.hasOwnProperty.call(BAKED_ICONS, lc)) {
    return _phosphorResult(lc);
  }
  // 3. Try Brand (Simple Icons)
  if (Object.prototype.hasOwnProperty.call(BRAND_ICONS, lc)) {
    return _brandResult(lc);
  }
  // 4. Try flag (2-letter ISO code)
  if (lc.length === 2 && Object.prototype.hasOwnProperty.call(FLAG_ICONS, lc)) {
    return _flagResult(lc);
  }
  // 5. Fuzzy fallback across all sources
  const match = closestMatch(lc, PLAIN_NAMES, 2);
  if (match) {
    const result = resolveIcon(match.name);
    if (result) return { ...result, source: 'fallback', resolvedName: match.name };
  }
  // 6. No match
  return null;
}

/**
 * Get a Path2D for an icon by name. Returns null for unknown names,
 * brands (use resolveIcon for brand color), and flags (use resolveIcon
 * for the SVG body — flags are multi-element SVGs not single paths).
 *
 * For full icon descriptor with source attribution, brand color, and
 * fuzzy fallback info, use resolveIcon() instead.
 *
 * @param {string} name kebab-case icon name (Phosphor / brand: / flag:)
 * @returns {Path2D|null}
 */
export function getIconPath2D(name) {
  const result = resolveIcon(name);
  if (!result) return null;
  return result.path ?? null;
}

// ----------------------------------------------------------------------------
// Internal resolvers
// ----------------------------------------------------------------------------

function _phosphorResult(name) {
  if (!Object.prototype.hasOwnProperty.call(BAKED_ICONS, name)) return null;
  const path = typeof Path2D !== 'undefined' ? new Path2D(BAKED_ICONS[name]) : null;
  return { path, color: null, source: 'phosphor', resolvedName: name, svgInner: null };
}

function _brandResult(slug) {
  if (!Object.prototype.hasOwnProperty.call(BRAND_ICONS, slug)) return null;
  const entry = BRAND_ICONS[slug];
  const path = typeof Path2D !== 'undefined' ? new Path2D(entry.path) : null;
  return { path, color: entry.color, source: 'brand', resolvedName: slug, svgInner: null };
}

function _flagResult(code) {
  if (!Object.prototype.hasOwnProperty.call(FLAG_ICONS, code)) return null;
  return {
    path: null,
    color: null,
    source: 'flag',
    resolvedName: code,
    svgInner: FLAG_ICONS[code],
  };
}

// ----------------------------------------------------------------------------
// Sprint 15c backward-compat: getIconPath returns raw SVG `d` string or null.
// Checks Phosphor first, then brand, so all 14 category names resolve.
// ----------------------------------------------------------------------------
export function getIconPath(name) {
  if (!name) return null;
  const lc = name.toLowerCase().trim();
  if (Object.prototype.hasOwnProperty.call(BAKED_ICONS, lc)) return BAKED_ICONS[lc];
  if (Object.prototype.hasOwnProperty.call(BRAND_ICONS, lc)) return BRAND_ICONS[lc].path;
  return null;
}

/**
 * Quick membership check (no fuzzy).
 * @param {string} name
 * @returns {boolean}
 */
export function hasIcon(name) {
  const lc = (name || '').toLowerCase().trim();
  if (lc.startsWith('brand:'))
    return Object.prototype.hasOwnProperty.call(BRAND_ICONS, lc.slice(6));
  if (lc.startsWith('flag:')) return Object.prototype.hasOwnProperty.call(FLAG_ICONS, lc.slice(5));
  return (
    Object.prototype.hasOwnProperty.call(BAKED_ICONS, lc) ||
    Object.prototype.hasOwnProperty.call(BRAND_ICONS, lc) ||
    (lc.length === 2 && Object.prototype.hasOwnProperty.call(FLAG_ICONS, lc))
  );
}

/**
 * Get brand color for a Simple Icons entry. null for Phosphor / flags.
 * @param {string} name
 * @returns {string|null}
 */
export function getIconBrandColor(name) {
  const lc = (name || '').toLowerCase().trim();
  const slug = lc.startsWith('brand:') ? lc.slice(6) : lc;
  return BRAND_ICONS[slug]?.color ?? null;
}

/** Alias (test-icon-library.mjs imports getBrandColor) */
export const getBrandColor = getIconBrandColor;

/**
 * Get inner SVG body for a flag. Returns null if not found.
 * @param {string} code — 2-letter ISO 3166-1 alpha-2 (e.g. 'cn', 'us')
 * @returns {string|null}
 */
export function getFlagSvg(code) {
  const lc = (code || '').toLowerCase().trim();
  return FLAG_ICONS[lc] ?? null;
}

export function getCategoryIcons(category) {
  return getCategoryNames(category);
}

export function getAllCategories() {
  return CATEGORY_NAMES.slice();
}

/** Sprint 15c name alias */
export const getIconCategory = getCategoryIcons;

export { CATEGORIES, CATEGORY_NAMES, getCategoryForIcon };
