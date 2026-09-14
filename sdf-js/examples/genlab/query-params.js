// Shared query-string guards for the public Genlab utility pages.
(() => {
  const SLUG_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,80}$/;
  const DEFAULT_CANVAS_SIZE = 900;
  const MIN_CANVAS_SIZE = 64;
  const MAX_CANVAS_SIZE = 2048;

  const safeCanvasSize = (raw, fallback = DEFAULT_CANVAS_SIZE) => {
    if (raw === null || raw === undefined || raw === '') return fallback;
    const n = Number(raw);
    if (!Number.isFinite(n)) return fallback;
    const rounded = Math.floor(n);
    if (rounded < MIN_CANVAS_SIZE) return MIN_CANVAS_SIZE;
    if (rounded > MAX_CANVAS_SIZE) return MAX_CANVAS_SIZE;
    return rounded;
  };

  const applyCanvasSizeFromQuery = (canvas, search = location.search) => {
    if (!canvas) return DEFAULT_CANVAS_SIZE;
    const qs = new URLSearchParams(search);
    const size = safeCanvasSize(qs.get('size'), canvas.width || DEFAULT_CANVAS_SIZE);
    canvas.width = size;
    canvas.height = size;
    return size;
  };

  const safeSlug = (value, fallback = null) => {
    const text = typeof value === 'string' ? value.trim() : '';
    return SLUG_RE.test(text) ? text : fallback;
  };

  const requireSlug = (value, label = 'id') => {
    const slug = safeSlug(value);
    if (!slug) throw new Error(`Invalid ${label}`);
    return slug;
  };

  const safeSlugList = (values) =>
    values.map((value) => safeSlug(value)).filter((value) => value !== null);

  window.genlabQuery = {
    MAX_CANVAS_SIZE,
    safeCanvasSize,
    applyCanvasSizeFromQuery,
    safeSlug,
    requireSlug,
    safeSlugList,
  };
})();
