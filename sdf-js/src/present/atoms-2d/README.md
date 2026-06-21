# Atlas 2D Atom Library

Per [[atlas-2d-two-track-architecture-lock]] (2026-06-21 user LOCK):

> 行业模板 + ICON 库用 **2D vector** 预先做好 (Atlas 团队写), 其他 LLM 解读文字走 **P5 路径** (LLM 自由生成).

This directory is the **pre-authored 2D vector atom library**. Each atom is a semantic concept (e.g. `kpi-card`, `bar`, `waterfall`) with multiple render implementations:

- **Pseudo-3D vector** (`drawPseudo3D`): gradient + drop shadow + isometric edge — PresentationLoad / think-cell style for professional business decks
- **Flat vector** (`drawFlat`): solid color + outline — Napkin / Linear / modern style (TBD, after pseudo-3D batch ships)
- **3D SDF** (`eval3D`): geometry for future Atlas 3D presentation mode (per [[atlas-present-spatial-narrative-thesis]])

## Architecture

```
atoms-2d/
├── registry.js       atom dispatch table + render API
├── renderer.js       Canvas2D renderer (runs in main page, NOT iframe — trusted code)
├── charts/
│   ├── data/         kpi-card / bar / line / pie / column
│   ├── diagrams/     flow / mindmap / org-chart / relationship / timeline / tree
│   └── hierarchy/    pyramid
├── shapes/           cube / sphere / diamond / gear / arrow + basic primitives
├── icons/            24 icons upgraded from atlas-icon-library SVG paths to vector
└── presentation/     cover
```

Each atom file follows this shape:

```js
export const spec = {
  type: 'kpi-card',
  category: 'charts/data',
  args: {
    value: { type: 'string|number', required: true },
    label: { type: 'string', required: true },
    trend: { type: 'up|down|neutral?', default: null },
    // ...
  },
};

export function drawPseudo3D(ctx, args, opts) {
  // Canvas2D draw calls with gradient + shadow + isometric tricks
}

// Future: drawFlat, eval3D
```

## Why main-page Canvas2D (not iframe)?

Per user 2026-06-21 sanity Q response: render path **(C)** chosen.

- These atoms are **Atlas-authored**, not LLM-generated → no sandbox needed
- Main-page render is **~10× faster** than iframe postMessage round-trip (10ms vs 100ms)
- High-level escape hatch (manual edit / hover / inspect) is natively supported
- iframe sandbox continues to wrap LLM-generated P5 sketches (security model unchanged)

## How LLM invokes these atoms

Lift prompt (v3.30+) routes content matching presets to atom types:

```json
{
  "subjects": [
    {
      "type": "kpi-card",
      "args": { "value": "$3.4M", "label": "Q3 Revenue", "trend": "up", "trendValue": "+127%" },
      "style": "pseudo3d"
    }
  ]
}
```

Pipeline detects atom type (not `p5-sketch`) and routes to atoms-2d renderer.

## Style switching (per-deck or per-visual)

Same atom type with different `style` arg renders differently. User can switch deck-level branding from "pseudo3d" to "flat" and all atoms re-render — same data, different visual identity.
