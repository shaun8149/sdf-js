# Atlas demo gallery — 8 curated prompts

These 8 prompts are the v1 demo library. Each is intentionally **as short as possible** to demonstrate Atlas's thesis Point #4: "prompts don't need diffusion-era ritual."

Run each prompt through the Compositor text-tab, then ✨ Lift to 3D, then **Export demo JSON**. Drop the file into this directory, flip `status: pending → ready` in `index.json`, commit.

---

## Hard-learned lesson (2026-05-18 evening)

**Don't prompt-engineer for SDF code generation. The LLM is already smarter than your hints.**

Original validation prompt: `一艘中国的航空母舰` — worked perfectly, produced a 3/4-view 中国航母 with starboard-offset island, ski-jump ramp, mast, etc.

First attempt at "improved" prompt: `A Chinese aircraft carrier viewed from a 3/4 aerial angle. Long flat flight deck with ski-jump bow ramp, the island superstructure offset to the starboard side, a tall mast with radar antennas, and small aircraft on the deck.` — **produced a top-down sky view**, broke the composition. The LLM took "3/4 aerial angle" literally as overhead.

**Why short prompts win**:
- The LLM has strong cultural / visual priors. `中国航母` already triggers all the structural details (starboard island, ski-jump, mast) automatically because the training data anchors them.
- Heavy specification overrides those priors. You're not adding information; you're replacing rich latent context with a verbose but lower-density string.
- The model also tries to fit ALL listed details into ONE image, leading to weird compositions when details conflict.

**The rule**: prompt with the **shortest noun phrase** that uniquely names the subject. Trust the LLM's priors. The structural correctness comes from emitting code, not from prompt verbosity.

This is itself a thesis-validating point: diffusion users need to write `(((masterpiece))) trending on artstation 8k uhd` to coerce models. Atlas users type `一艘航母`. The simplicity is the marketing.

---

## Why these 8 (not 30)

- **5 are precision-content** (cathedral / clock / bicycle / dining / carrier) — these are simultaneously vs-diffusion + vs-neural-world-model visual proof. Pick the strongest 1-2 for README hero.
- **1 is revolution** (vase) — P1 milestone proof, also covers "household objects / e-commerce" angle.
- **1 is top-down diorama** (village) — proves #9 multi-axis combinatorial (same scene × N palettes).
- **1 has time-animation** (lighthouse waves) — proves the spec's `waves` time-aware primitive + AnimationChannel pipeline ships.

If a demo lifts poorly, re-roll. If it consistently degrades, the prompt itself is wrong (probably too verbose) — shorten it.

---

## The 8 prompts (all SHORT, all Chinese where natural)

| # | id | Prompt | Thesis point |
|---|---|---|---|
| 1 | china-carrier | `一艘中国的航空母舰` | #1 precision · regression test (matches 2026-05-18 validation) |
| 2 | gothic-cathedral | `一座哥特式大教堂` | #1 structural precision |
| 3 | spiral-vase | `一只花瓶` | P1 milestone · revolution lift |
| 4 | mountain-village | `山间村落` | #9 multi-axis variants |
| 5 | clock-915 | `一个挂钟，指针指向 9:15` | #1 diffusion big-gun (only spec detail = the time, since it's the test) |
| 6 | vintage-bicycle | `一辆复古自行车` | #1 precision-content |
| 7 | dining-setting | `餐桌上摆着一个盘子、刀叉和酒杯` | #2 semantic combinatorics (multi-object naming) |
| 8 | coastal-lighthouse | `海边的灯塔` | #4 prompt simplicity · waves |

**Only #5 and #7 have any spec beyond the bare noun phrase**, and that's only because:
- #5: "9:15" is the entire point of the test (proving precision)
- #7: explicit multi-object listing is itself the thesis point (#2 semantic combinatorics)

Everything else is pure noun phrase.

---

## Workflow to add a demo

1. Open Compositor text-tab (run `python3 dev-server.py 8001` from `sdf-js/`).
2. Click a ✎ pending card → prompt autofills. ✨ Generate.
3. If 2D looks clean → ✨ Lift to 3D. If lift looks correct → next step. Otherwise re-roll.
4. **💾 Export as demo JSON** button (appears in sidebar in lift mode).
5. Drop the downloaded `<id>.json` into `examples/compositor/demo-lifts/`.
6. Open `index.json`, flip that demo's `status` from `pending` to `ready`.
7. Commit.

## Pricing

Each lift ≈ $0.20 (Claude Sonnet 4.6). 8 demos = ~$1.60 + re-roll buffer ≈ **$5 ceiling**.
