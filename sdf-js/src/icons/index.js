// =============================================================================
// sdf-js/src/icons/index.js — Atlas icon library runtime API
// -----------------------------------------------------------------------------
// Wraps the baked Phosphor icon path map (./baked-library.js) + curated
// category lists (./categories.js) with consumer-friendly accessors.
//
// Consumers:
//   - sdf-js/src/present/atoms-2d/icons/icon-badge.js (Canvas2D draw — uses
//     getIconPath2D for the `new Path2D(...)` then ctx.fill / ctx.stroke)
//   - lift system prompt v3.32 references this library indirectly by calling
//     getIconCategory + getAllCategories during prompt-string assembly
//     (NOT YET wired — see Task 6.1)
//
// Per docs/superpowers/specs/2026-06-22-atlas-present-sprint-15-design.md §7
// and docs/superpowers/plans/2026-06-22-atlas-present-sprint-15c-icon-library-plan.md
// Phase 4 Task 4.1.
// =============================================================================

import { BAKED_ICONS } from './baked-library.js';
import { CATEGORIES, CATEGORY_NAMES } from './categories.js';

/**
 * Raw SVG d attribute payload for an icon name. Returns null for unknown names.
 * Canvas2D consumers should usually prefer getIconPath2D.
 * @param {string} name kebab-case Phosphor name (e.g. 'briefcase', 'chart-line')
 * @returns {string|null}
 */
export function getIconPath(name) {
  return Object.prototype.hasOwnProperty.call(BAKED_ICONS, name) ? BAKED_ICONS[name] : null;
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
 * Quick membership check.
 * @param {string} name
 * @returns {boolean}
 */
export function hasIcon(name) {
  return Object.prototype.hasOwnProperty.call(BAKED_ICONS, name);
}

/**
 * Curated icon names belonging to a category. Returns [] for unknown category.
 * Names are guaranteed bakeable (see Phase 3 Task 3.1 Step 3 — bake script
 * exits non-zero on any missing name, so committed categories.js + baked-library.js
 * are always in sync).
 * @param {string} category one of 'business' | 'finance' | 'tech' | 'medical'
 *                          | 'hrm' | 'social' | 'signs' | 'calendar'
 * @returns {string[]}
 */
export function getIconCategory(category) {
  return CATEGORIES[category] ? CATEGORIES[category].slice() : [];
}

/**
 * @returns {string[]} all 8 category names
 */
export function getAllCategories() {
  return CATEGORY_NAMES.slice();
}
