// =============================================================================
// SlideData — intermediate format between parser and downstream mapper (M0.3)
// -----------------------------------------------------------------------------
// Parsers (pdf.js / pptx.js — pptx pending) produce SlideData[]. Downstream
// mapper (M1.5 atlas-slide-to-3d-mapping) consumes SlideData[] and emits
// SceneData. SlideData is lossless: any deck can be serialized into it.
//
// Spec source: project_atlas_ppt_parser_spec.md (memory).
//
// All bbox coords are in PDF/PPTX native units (points or EMU), with origin
// at top-left of the page (Y-down convention, matching screen rendering).
// =============================================================================

/**
 * @typedef {object} SlideData
 * @property {number} index            0-based slide/page index
 * @property {'pdf'|'pptx'} sourceFormat
 * @property {string|null} title       Largest top-area text (heuristic)
 * @property {Array<BodyElement>} body Other text elements (bullets, paragraphs)
 * @property {Array<VisualElement>} visuals  Non-text elements (images, shapes, charts)
 * @property {LayoutHint} layout       Heuristic layout classification
 * @property {ThemeInfo} theme         Color / font / vibe extracted from slide
 * @property {string|null} notes       Speaker notes (PPTX notesSlide; PDF: usually null)
 * @property {{width:number, height:number}} pageSize  In source units
 * @property {{dataUrl:string, width:number, height:number}|null} screenshot
 *           Rasterized slide thumbnail for vision LLM classification (null if
 *           not rendered yet — Sprint 1 doesn't include rasterization).
 * @property {ClassifiedInfo|null} classified  Vision LLM output (null if not run)
 */

/**
 * @typedef {object} BodyElement
 * @property {'paragraph'|'bullet'} kind
 * @property {string} text
 * @property {number} level            Indent level for bullets (0 = top)
 * @property {BBox} bbox
 * @property {number} fontSize         In source units
 * @property {string|null} fontFamily
 */

/**
 * @typedef {object} VisualElement
 * @property {'image'|'chart'|'shape'|'icon'|'diagram'} kind
 * @property {BBox} bbox
 * @property {string|null} dataUrl     Base64 image data when kind='image'
 * @property {object|null} data        Chart-specific data when kind='chart'
 */

/**
 * @typedef {object} BBox
 * @property {number} x   left edge (source units, Y-down)
 * @property {number} y   top edge
 * @property {number} w   width
 * @property {number} h   height
 */

/**
 * @typedef {'cover'|'title-only'|'title-content'|'two-column'|'image-full'|'chart-dominant'|'list-heavy'|'complex'} LayoutHint
 */

/**
 * @typedef {object} ThemeInfo
 * @property {string} primaryColor     hex
 * @property {string[]} accentColors   hex array
 * @property {string} textColor        hex
 * @property {string} bgColor          hex
 * @property {string|null} fontFamily
 * @property {'corporate'|'creative'|'minimal'|'playful'|'tech'|'academic'|null} vibe
 */

/**
 * @typedef {object} ClassifiedInfo
 * @property {'chart'|'process'|'hierarchy'|'comparison'|'text-only'|'image-statement'|'agenda'|'cover'|'mixed'} type
 * @property {number} confidence       0-1
 * @property {object} keyData          type-specific extracted data
 */

// ---- Empty SlideData factory (for testing / fallback) -----------------------

export function emptySlideData(index = 0, sourceFormat = 'pdf') {
  return {
    index,
    sourceFormat,
    title: null,
    body: [],
    visuals: [],
    layout: 'complex',
    theme: {
      primaryColor: '#000000',
      accentColors: [],
      textColor: '#000000',
      bgColor: '#ffffff',
      fontFamily: null,
      vibe: null,
    },
    notes: null,
    pageSize: { width: 0, height: 0 },
    screenshot: null,
    classified: null,
  };
}

// ---- Validation helper ------------------------------------------------------

/**
 * Lightweight runtime validation. Returns array of error messages (empty = OK).
 */
export function validateSlideData(s) {
  const errs = [];
  if (typeof s.index !== 'number') errs.push('index must be number');
  if (!['pdf', 'pptx'].includes(s.sourceFormat)) errs.push(`bad sourceFormat: ${s.sourceFormat}`);
  if (s.title !== null && typeof s.title !== 'string') errs.push('title must be string|null');
  if (!Array.isArray(s.body)) errs.push('body must be array');
  if (!Array.isArray(s.visuals)) errs.push('visuals must be array');
  if (!s.pageSize || typeof s.pageSize.width !== 'number') errs.push('pageSize.width missing');
  if (!s.theme || typeof s.theme.primaryColor !== 'string') errs.push('theme.primaryColor missing');
  return errs;
}

// ---- Heuristic layout classifier from raw items -----------------------------

/**
 * Classify layout from text + visual item counts + positions.
 * Cheap heuristic; vision LLM classifier (downstream) is more accurate.
 */
export function classifyLayout({ title, body, visuals, pageSize }) {
  const hasTitle = title !== null && title.trim().length > 0;
  const textCount = body.length;
  const visCount = visuals.length;
  const bulletCount = body.filter((b) => b.kind === 'bullet').length;

  if (textCount === 0 && visCount === 0) return 'title-only';
  if (visCount === 0 && bulletCount >= 5) return 'list-heavy';
  if (visCount >= 1 && textCount <= 3) return 'image-full';
  // Two-column check BEFORE title-content (a 4+ item left/right split is more
  // informative than just "title + content"). Hold off if obviously not split.
  if (textCount >= 4) {
    const leftHalf = body.filter((b) => b.bbox.x + b.bbox.w / 2 < pageSize.width * 0.5).length;
    const rightHalf = textCount - leftHalf;
    if (leftHalf >= 2 && rightHalf >= 2) return 'two-column';
  }
  if (hasTitle && textCount <= 5 && visCount === 0) return 'title-content';
  if (visCount >= 1 && visuals.some((v) => v.kind === 'chart' || v.bbox.w > pageSize.width * 0.4))
    return 'chart-dominant';
  return 'complex';
}
