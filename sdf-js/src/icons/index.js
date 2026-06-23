// =============================================================================
// sdf-js/src/icons/index.js — Atlas icon library runtime API
// -----------------------------------------------------------------------------
// Wraps the baked icon maps (Phosphor + Simple Icons brand + flag-icons) and
// curated category lists (./categories.js) with consumer-friendly accessors.
//
// Sprint 18: expanded to 3 icon sources:
//   - BAKED_ICONS (baked-library.js)  — Phosphor regular, 11 categories
//   - BRAND_ICONS (brand-icons.js)    — Simple Icons brand slugs, 2 categories
//   - FLAG_ICONS  (flag-icons.js)     — flag-icons SVG body, 1 category
//
// Consumers:
//   - sdf-js/src/present/atoms-2d/icons/icon-badge.js (Canvas2D draw — uses
//     getIconPath2D for the `new Path2D(...)` then ctx.fill / ctx.stroke)
//   - lift system prompt references this library indirectly by calling
//     getIconCategory + getAllCategories during prompt-string assembly
//
// Per docs/superpowers/specs/2026-06-22-atlas-present-sprint-15-design.md §7
// and docs/superpowers/specs/2026-06-23-atlas-icons-and-text-minimization-sprint-18-design.md §3
// =============================================================================

import { BAKED_ICONS } from './baked-library.js';
import { BRAND_ICONS } from './brand-icons.js';
import { FLAG_ICONS } from './flag-icons.js';
import { CATEGORIES, CATEGORY_NAMES } from './categories.js';

const PHOSPHOR_CATEGORIES = new Set([
  'business',
  'tech',
  'ai-robotics',
  'medical',
  'finance',
  'hrm',
  'calendar',
  'signs',
  'nature-energy',
  'transport',
  'arrows',
]);
const BRAND_CATEGORIES = new Set(['brand-social', 'brand-tools']);
const FLAG_CATEGORY = 'flags';

/**
 * Raw SVG d attribute payload for an icon name. Returns null for unknown names.
 * - Phosphor icons: returns raw SVG `d` string (viewBox 256)
 * - Brand icons: returns the path `d` string from brand-icons.js
 * - Flag icons: returns null (flag SVG body is not a simple `d` path)
 * Canvas2D consumers should usually prefer getIconPath2D.
 * @param {string} name kebab-case icon name or brand slug
 * @returns {string|null}
 */
export function getIconPath(name) {
  if (Object.prototype.hasOwnProperty.call(BAKED_ICONS, name)) return BAKED_ICONS[name];
  if (Object.prototype.hasOwnProperty.call(BRAND_ICONS, name)) return BRAND_ICONS[name].path;
  return null;
}

/**
 * Convenience: return a constructed Path2D wrapping the icon's d attr, or null.
 * Canvas2D consumer: ctx.fill(getIconPath2D('briefcase')).
 *
 * Note: Path2D is a browser API. In Node tests without `canvas` package, callers
 * may shim global Path2D before invoking. Browser code never hits the null path
 * (Path2D is always available).
 * @param {string} name
 * @returns {Path2D|null}
 */
export function getIconPath2D(name) {
  const d = getIconPath(name);
  if (d === null) return null;
  if (typeof Path2D === 'undefined') return null;
  return new Path2D(d);
}

/**
 * Quick membership check. Returns true for Phosphor and brand icons.
 * Flag icons are excluded (they don't have path `d` strings).
 * @param {string} name
 * @returns {boolean}
 */
export function hasIcon(name) {
  return (
    Object.prototype.hasOwnProperty.call(BAKED_ICONS, name) ||
    Object.prototype.hasOwnProperty.call(BRAND_ICONS, name)
  );
}

/**
 * Curated icon names belonging to a category. Returns [] for unknown category.
 * Names are guaranteed bakeable across 3 sources:
 *   Phosphor (11 cats) / Simple Icons brand (2 cats) / flag-icons (1 cat)
 * @param {string} category one of 14 category names from CATEGORY_NAMES
 * @returns {string[]}
 */
export function getIconCategory(category) {
  return CATEGORIES[category] ? CATEGORIES[category].slice() : [];
}

/**
 * @returns {string[]} all 14 category names
 */
export function getAllCategories() {
  return CATEGORY_NAMES.slice();
}

/**
 * Returns brand color for a brand icon, or null for Phosphor/flag/unknown.
 * @param {string} name
 * @returns {string|null} hex color e.g. '#1877F2'
 */
export function getBrandColor(name) {
  if (Object.prototype.hasOwnProperty.call(BRAND_ICONS, name)) return BRAND_ICONS[name].color;
  return null;
}

/**
 * Returns inner SVG body for a flag icon (ISO 3166-1 alpha-2 code), or null.
 * @param {string} code e.g. 'us', 'cn', 'gb'
 * @returns {string|null}
 */
export function getFlagSvg(code) {
  const key = code.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(FLAG_ICONS, key)) return FLAG_ICONS[key];
  return null;
}
