// =============================================================================
// sdf-js/src/icons/categories.js — Curated Phosphor icon names per category
// -----------------------------------------------------------------------------
// 8 domain categories of kebab-case Phosphor icon names. Bake script reads
// node_modules/@phosphor-icons/core/assets/regular/<name>.svg for each name.
//
// Full curation lives here; expand by adding names. Names must match
// Phosphor's filename (no extension). To list available: `ls
// node_modules/@phosphor-icons/core/assets/regular/`.
//
// Per docs/superpowers/specs/2026-06-22-atlas-present-sprint-15-design.md §7.
// =============================================================================

export const CATEGORIES = {
  business: [
    'briefcase',
    'chart-line',
    'users',
    'presentation',
    'handshake',
    // (Phase 3.1 expands to ~150)
  ],
  finance: ['currency-dollar', 'bank', 'coins', 'trend-up', 'trend-down'],
  tech: ['cpu', 'database', 'cloud', 'code', 'gear'],
  medical: ['stethoscope', 'pill', 'first-aid', 'heart-straight', 'syringe'],
  hrm: ['user', 'user-circle', 'users-three', 'identification-badge', 'graduation-cap'],
  social: ['chat-circle', 'share-network', 'heart', 'at', 'thumbs-up'],
  signs: ['warning', 'prohibit', 'info', 'question', 'check-circle'],
  calendar: ['calendar', 'clock', 'timer', 'alarm', 'hourglass'],
};

export function getAllIconNames() {
  return Array.from(new Set(Object.values(CATEGORIES).flat()));
}

export function getIconNamesForCategory(category) {
  return CATEGORIES[category] ?? [];
}

export const CATEGORY_NAMES = Object.keys(CATEGORIES);
