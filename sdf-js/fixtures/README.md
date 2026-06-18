# Parser test fixtures

Put PDF / PPTX decks here for parser end-to-end testing. The smoke test
`scripts/test-pdf-parser.mjs` auto-detects `test-deck.pdf` and runs
end-to-end if present (skipped gracefully otherwise).

Fixtures are **gitignored** — these are usually copyrighted templates or
private decks. Don't commit.

## Recommended fixtures

| Path | Purpose | Source |
| --- | --- | --- |
| `test-deck.pdf` | Default end-to-end target for smoke test | Any clean .pdf |
| `presentationload-kpi.pdf` | KPI dashboard mapping target (stun demo) | PresentationLoad export |
| `presentationload-spheres.pdf` | 3D spheres / fill levels (stun demo dogfood) | PresentationLoad export |
| `pitch-deck.pdf` | a16z YC startup pitch template | a16z public template |

## CLI

```bash
node sdf-js/scripts/parse-deck.mjs sdf-js/fixtures/test-deck.pdf --summary
node sdf-js/scripts/parse-deck.mjs sdf-js/fixtures/test-deck.pdf --out /tmp/slides.json
```
