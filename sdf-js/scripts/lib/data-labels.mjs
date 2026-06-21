// =============================================================================
// data-labels.mjs — re-export of the chart-label placement helpers, which now
// live in src/scene/chart-labels.js (so the runtime expandChartLabels connector
// and these build-time generators share one source). Kept as a stable import
// path for the gen-* scripts.
// =============================================================================
export {
  barAnchors,
  lineAnchors,
  columnAnchors,
  pieAnchors,
  placeLabels,
  ANCHOR_FOR,
  expandChartLabels,
} from '../../src/scene/chart-labels.js';
