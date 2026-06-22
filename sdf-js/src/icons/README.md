# Atlas Icon Library

Curated 8-category bake of [Phosphor Icons](https://phosphoricons.com)
(MIT-licensed, by Phosphor Studio) plus runtime API consumed by atoms-2d.

## Inventory

- 8 categories × ~150 icons = ~1100-1200 unique icons
- Regular weight only (Phosphor's modern default)
- Categories: business / finance / tech / medical / hrm / social / signs / calendar

## API (`sdf-js/src/icons/index.js`)

- `getIconPath(name) → string|null` — raw SVG d attribute for Canvas2D
- `getIconPath2D(name) → Path2D|null` — convenience-wrapped Path2D
- `hasIcon(name) → boolean`
- `getIconCategory(category) → string[]`
- `getAllCategories() → string[]`

## Re-baking

Edit `categories.js` to add/remove icon names, then:

```bash
npm run build:icons
```

This regenerates `baked-library.js`. The script exits non-zero if any name
listed in `categories.js` is not found under
`node_modules/@phosphor-icons/core/assets/regular/`.

## Country flags (separate render path)

Flag icons come from [`flag-icons`](https://github.com/lipis/flag-icons)
package (MIT, by Panayiotis Lipiridis). They render via CSS classes, not
Canvas2D — atoms needing flags include the package's `flag-icons.min.css`
and apply `.fi.fi-us` etc. NOT wired in Sprint 15c — deferred until an atom
needs flag rendering.

## License

Phosphor Icons: MIT © Phosphor Studio (https://phosphoricons.com)
Flag-icons: MIT © Panayiotis Lipiridis (https://github.com/lipis/flag-icons)
Atlas wiring + curation: PolyForm Noncommercial (see repo `LICENSE.md`).
