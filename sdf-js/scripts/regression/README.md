# Lift Regression Test

Compares lift system prompt v1 vs v2 across all 8 bundled demos.

## Run

```bash
export ANTHROPIC_API_KEY=sk-ant-...
cd /Users/hexiaoyang/Documents/sdf-main
node sdf-js/scripts/regression/lift-regression.mjs all
```

Or for a single demo:
```bash
node sdf-js/scripts/regression/lift-regression.mjs china-carrier
```

## What it does

For each demo (e.g. carrier, cathedral, vase, …):

1. Loads its 2D code + original prompt from `examples/compositor/demo-lifts/<id>.json`
2. Sends `(systemPrompt, prompt + 2D code)` to Anthropic API **twice** — once with v1 system prompt, once with v2
3. Parses each response as SceneData JSON
4. Counts: total subjects, new-atom uses, new-IQ-type uses, compile validity
5. Saves both full sceneData responses + per-demo metrics

## Cost

~16 API calls × ~$0.10–0.30 each = **~$2–5 total**.

Per-demo cost depends on output token count (LLM emits more JSON = more tokens). Carrier / cathedral / village = bigger output (more subjects), lighthouse / vase / clock = smaller.

## Output

```
sdf-js/scripts/regression/results/
├── <demo-id>-v1.json      ← full v1 lift result + metrics
├── <demo-id>-v2.json      ← full v2 lift result + metrics
├── <demo-id>-v{1,2}-raw.txt   ← only created if JSON parse failed
└── summary.json           ← cross-demo comparison table
```

A final console summary table prints during the run.

## Key metrics to look for

| Metric | What it tells us |
|---|---|
| `Δ atoms` per demo | did v2 prompt make the LLM use atoms where appropriate? |
| `Δ IQ` per demo | did v2 prompt let LLM use new primitive types? |
| `Δ subjects` (often negative for v2) | atoms condense N primitives → 1 named subject |
| `v1/v2 compile` | does the lifted SceneData still validate against our spec? |
| `total cost` | v2 prompt is longer (562 vs 359 lines) → slightly more input tokens |

## Expected outcomes (predictions before running)

- **lighthouse**: v2 should use `moon` + several `star` (was missing in v1)
- **village**: v2 should use `cottage` and `tree-pine` (instead of box+pyramid+cone)
- **carrier**: v2 might use `flag-on-pole` instead of cylinder+box
- **bicycle**: v2 might use `round-cone` for handlebar grips
- **vase/clock/dining**: limited atom opportunity, expect modest Δ
- **cathedral**: limited atom opportunity; complex shapes still need primitive composition

If `Δ atoms` is uniformly 0, the v2 prompt isn't influential — the LLM is ignoring the new types. Either prompt needs more emphasis, or the examples we added need adjustment.
