// =============================================================================
// atom-palette.js — Atlas Present Canvas Mode subject creation helper
// -----------------------------------------------------------------------------
// Sprint 1 P0 atom palette: 5 atom types user can add as subjects to the
// canvas. Form-based placement (type + numerical [x,y,z]) — interactive
// 3D placement is Sprint 2+.
//
// All 5 atom types ARE registered in compile.js PRIMITIVE_FACTORIES.
// =============================================================================

/**
 * Atom palette entries.
 *
 * Each entry:
 *   - type:        the canonical name registered in compile.js PRIMITIVE_FACTORIES
 *   - displayName: human-friendly label for the UI dropdown
 *   - defaultArgs: sensible starting args (atom-specific)
 *   - description: short hint shown in the form
 */
export const ATOM_PALETTE = [
  {
    type: 'cube-3d',
    displayName: 'Cube row',
    defaultArgs: {
      count: 4,
      arrangement: 'row',
      cubeSize: 0.6,
      spacing: 0.4,
      labels: ['1', '2', '3', '4'],
    },
    description: '4 connected cubes in a row with numeric labels.',
  },
  {
    type: 'text-3d-pipe',
    displayName: 'Text (pipe)',
    defaultArgs: { text: 'ATLAS', height: 1.0, pipeRadius: 0.08, align: 'center' },
    description: 'True 3D text built from capsules + torus + sphere.',
  },
  {
    type: 'pyramid-3d',
    displayName: 'Pyramid',
    defaultArgs: { levels: 4, base: 2, height: 2 },
    description: 'N-level stepped pyramid.',
  },
  {
    type: 'bar-3d',
    displayName: 'Bar chart',
    defaultArgs: { values: [0.3, 0.7, 1.0, 0.5, 0.8], barWidth: 0.4, gap: 0.1, maxHeight: 2.0 },
    description: '5-bar 3D chart.',
  },
  {
    type: 'cover-3d',
    displayName: 'Cover (title + subtitle)',
    defaultArgs: { title: 'My Deck', subtitle: 'Subtitle here' },
    description: 'Slide-cover atom (title + subtitle on pedestal).',
  },
];

/**
 * Find a palette entry by atom type.
 *
 * @param {string} type
 * @returns {object|null}
 */
export function findPaletteEntry(type) {
  return ATOM_PALETTE.find((p) => p.type === type) || null;
}
