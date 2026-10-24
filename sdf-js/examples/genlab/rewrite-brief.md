# Rewrite brief (appended to the system prompt for the DIMENSION 2D library rewrite)

You are producing a replacement for a piece that already exists in a 10,000-piece
on-chain generative art collection. The piece's id and prompt stay fixed; only the
drawing changes. Your module is consumed by a deterministic brush pipeline, so:

- Output exactly one complete module in the usual form: `import {...} from
  '../../src/index.js'`, build `layers` as `[{ sdf, color: [r,g,b] }, ...]`
  bottom-to-top, then `render.silhouette(ctx, layers, { view, background })`
  with `const canvas = document.getElementById('c'); const ctx =
  canvas.getContext('2d');`. No other side effects, no DOM beyond that.
- Zero randomness: no `Math.random`, no `Date`, no `performance`. The same code
  must produce the same picture every time.
- Only the 2D primitives and combinators exported by sdf-js (`circle`,
  `ellipse`, `rectangle`, `rounded_rectangle`, `polygon`, `segment`, `arc`,
  `ring`, `quadratic_bezier`, `triangle`, `trapezoid`, `star`, `moon`, `egg`,
  `union`, `intersection`, `difference`, `dilate`, `erode`, `shell`, `blend`,
  `negate`, `.rotate`, `.translate`, `.scale`, `.circular_array`, …). No 3D.
- Keep `view` near 1.2 and the scene inside roughly [-1.1, 1.1]².

Curation lessons from the collection (pieces with these traits were removed):

- Cartoon faces, emoji-like smiles, sticker-flat mascots. Draw subjects, not
  stickers.
- A lone round plate / disc / medallion with little inside it. If the subject is
  circular, give it a setting or internal structure.
- Flat repeating swatches with no focal point (a "fabric sample"). Patterns are
  fine as background texture; the piece still needs a subject or a composition.
- Subjects whose identity depends on 3D perspective (a column with a twisted
  shaft, a stone arch seen at an angle, dice). Draw them as flat editorial
  silhouettes with implied depth: one strong outline, light/shade split by a
  simple intersection, no attempted perspective math.
- Silhouettes that fall apart when slightly distorted. The main subject should
  read from its outline alone, with details inside it.

What the collection's best pieces share: a strong single silhouette or a clear
scene hierarchy (ground / subject / sky), a restrained harmonious palette of
6-12 colors, one or two decorative accents, and domain-correct details drawn
with real geometry (a lighthouse has gallery railings; a teapot has a lid knob
and a spout curve). Aim at that.
