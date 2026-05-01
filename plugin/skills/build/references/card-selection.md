# Card Selection Heuristics

Cross-card selection guidance for `/ars:build`. Read this **after** `SERIES_GUIDE.md` — the series guide always wins. This file gives portable defaults; series may override the ordering, the misuse list, or both.

If `SERIES_GUIDE.md` lists explicit card preferences (e.g. `markdown > image > mermaid`), follow the series ordering and treat the defaults below as background context. Only use card names that appear in `npx ars card list` for the active repo/series.

---

## Pick by information type, not by visual flair

Don't start from "which card is fanciest". Start from what the segment is **about**, then pick the card that expresses that shape:

| Segment is about… | Default card | Common alternative |
|---|---|---|
| App / product surface (chat, terminal, browser, dashboard) | `image` with real screenshot or generated UI SVG | `markdown` for exact logs/commands |
| Real screenshots, photos, external visuals | `image` (use the real asset) | generated SVG only for conceptual stand-ins, never evidence |
| Abstract visual relation / concept mock / before→after | `image` with a generated SVG asset | `markdown` if the content is mostly text |
| Stage progression / layers / 3-5 big concepts | `markdown` table/list | generated SVG `image` when spatial progression matters |
| Static relationship / architecture / sequence / class diagram | `mermaid` | generated SVG `image` when the diagram is a load-bearing hero/anchor |
| A vs B head-to-head | `markdown` table | generated SVG `image` when the contrast needs visual composition |
| Multi-column data / decision matrix / mapping | `markdown` table | generated SVG `image` when spatial layout matters |
| Single-shot impact / chapter transition / punchline | `ticker` | `cover` (episode start only) |
| Counted KPIs / 1-3 standout numbers | `markdown` or generated SVG `image` | `ticker` for one standout number |
| Code with syntax highlighting | `code` | (none — code goes here) |
| Episode opening / closing | `cover` / `summary` | (one-shot — never reuse) |
| General prose / lists / mixed text | `markdown` | `text` (legacy) |

---

## SVG-first policy for `image`

When a step already lands on the `image` card, **default to generating a branded SVG asset for conceptual / hero / brand visuals**. Do not treat SVG as a weak fallback. The reasoning:

- A custom SVG aligns with the series palette, types, icons, and composition — every frame becomes a brand surface, not a generic stock visual.
- Memorability beats accuracy for most concept beats. Real screenshots fight for attention with the narration; a tuned SVG lets the one idea you want viewers to remember land in a single frame.
- SVGs are diff-able and Studio-editable. If the user wants to swap it out later, they can — but the first pass should not be a placeholder waiting for a real asset.

Use a real screenshot, photograph, or downloaded asset when:

- The beat is **claim-bearing evidence** (the source must be the real artifact: an actual UI screenshot, a published chart, a real-world photo, a primary-source document).
- The plan's `## References` section explicitly cites a URL/file that needs to be shown verbatim.
- The visual is a live product surface and the truthfulness of the surface matters.

Otherwise, if the card is `image`: generate the SVG. If the user later decides during Studio review that they want a real screenshot, they swap it in then — that's a review-time refinement, not a build-time decision.

Do not promote another card type to `image` just to get an SVG. If the plan chose `markdown`, `code`, `mermaid`, `ticker`, `cover`, or `summary`, assume that card shape is intentional unless implementation proves it cannot carry the beat.

SVG is the wrong tool when the asset is mostly hand-drawn bullets, exact definitions, or a table. In those cases keep the editable text-friendly card and spend the visual budget on the frames that truly need composition.

---

## Default ordering when intent is ambiguous

These are portable defaults. Series may flip any of them:

- **App-like content** → `image (real screenshot or generated UI SVG) > markdown`
- **Static relationship / architecture / sequence** → `mermaid > image (branded SVG for load-bearing anchors)`
- **Visual concept / before-after / relationship mock** → generated SVG `image > markdown`
- **Numeric content** → `markdown table/list > generated SVG image > ticker`
- **Multi-column data** → `markdown table > generated SVG image`
- **Hero / opener / chapter transition visuals** → generated SVG `image > ticker`

Reasoning: `image` is the only built-in visual asset card, so screenshots and generated SVGs both go there. `mermaid` stays the default for static structure because it is fast, editable, and less likely to become a text-heavy poster. Promote a diagram to generated SVG when it is a hero/anchor frame, needs visual metaphor, or must carry the episode's brand memory.

---

## Mermaid vs custom flow visuals

`mermaid` is the built-in diagram card. Use it for flowcharts, sequence diagrams, class diagrams, ER diagrams, and lightweight system maps.

If the audience needs animated step-by-step reveals, camera movement, or a specialized diagram style, propose a series-scoped custom card in `## New card` instead of naming a non-existent built-in. If the diagram is static but needs strong brand composition, use a generated SVG through the `image` card.

Hard rules:
- `sequenceDiagram` / `classDiagram` / `ER` / `gantt` → use `mermaid` unless a custom card is explicitly planned.
- General "process with 3-5 boxes" → default to `mermaid` or `markdown`; promote to a branded SVG `image` only when the diagram is a load-bearing visual anchor.

---

## mermaid vs generated SVG image

Both can render a static diagram. The choice is about **brand presence and memorability** vs **authoring speed**.

| Dimension | `mermaid` | Generated SVG `image` |
|---|---|---|
| Brand alignment | Generic node/edge styling, hard to make on-brand | Series palette, custom typography, icons, layout |
| Composition control | Auto-layout (boxes-and-lines look) | Free composition, callouts, visual metaphor |
| Memorability | Functional, often forgettable | Designed to land in one frame |
| Authoring speed | Faster — write a few lines of grammar | Slower — generate, place, refine |
| Grammar coverage | sequenceDiagram, classDiagram, ER, gantt, etc. | Anything you can draw in SVG |
| Editing in review | Edit text → re-renders | Edit SVG file directly or regenerate |

Use generated SVG `image` when:

- The diagram is **load-bearing** — it's a hero visual, anchors a chapter, or is the one frame viewers should remember from the segment.
- The relationship benefits from visual metaphor, icons, or non-grid composition (e.g. orbits, layers, funnels, Venn-style overlap, before→after parallels).
- The episode brand identity matters — recurring series, branded visuals on a channel.

Use `mermaid` when:

- The diagram is **support material**, not the hero — a quick reference inside a larger explanation.
- You specifically need `sequenceDiagram` / `classDiagram` / `ER` / `gantt` grammar.
- The diagram is throwaway (one-time use, no series brand expectation).
- Time pressure: SVG generation will block the build but a mermaid diagram unblocks the beat.

Don't reach for SVG just because it feels more designed. If the beat deserves to be remembered, a tuned SVG can outperform an auto-laid-out diagram; if it only needs to be understood quickly, `mermaid` is usually the healthier default.

---

## Generated SVG image vs markdown

Treat generated SVG assets as first-class `image` card material, not only as a placeholder fallback. The question is whether the beat is primarily a **visual relationship** or primarily **editable text**.

Prefer generated SVG `image` over `markdown` when:

- The beat is a before→after, prompt→result, input→output, system→effect, or similar relationship that should land in one glance.
- A markdown card would mostly repeat the narration or become a dense bullet/table wall.
- The visual can be truthfully represented as an abstract mock, branded diagram, UI sketch, or symbolic scene without pretending to be real sourced evidence.
- The episode needs a visual anchor and nearby cards are not already a run of static image cards.

Prefer `markdown` when:

- The content is a compact list, quote, table, command snippet, or checklist whose value is the exact wording.
- The user is likely to revise the text live in Studio and needs clean section-level editability.
- The card is a light transition or support note that does not deserve a full custom visual.
- The surrounding run already contains multiple image/SVG cards; use markdown, mermaid, ticker, or another existing card to restore pacing.

Generated SVG image quality bar:

- Use a 16:9 canvas such as `1920x1080`, align to the series palette, and keep text large enough for video.
- Keep it contentful: labels, arrows, boxes, callouts, charts, or mock UI that clarifies the beat.
- Do not generate SVGs that fake real screenshots, real people, product logos, or sourced evidence. Use screenshots or citations for those.
- Avoid making every SVG the same two-column poster. Vary composition when several appear in one episode.

---

## High-misuse cards

These get over-applied. Each has a tighter use case than it looks:

### Non-existent convenience cards

Do not name cards that are not in `npx ars card list`. If you want an A/B comparison, staged progression, or KPI panel and there is no series-scoped card for it:

```
✅ A/B comparison                    → markdown table, or generated SVG image if visual contrast matters
✅ 3-5 stage progression             → markdown list/table, mermaid, or generated SVG image
✅ KPI panel                         → markdown for exact numbers, ticker for one number, image for a designed dashboard SVG
❌ compare / timeline / stats        → not built-in core cards
❌ flowchart                         → not built-in; use mermaid or propose a custom card
```

### `ticker` — never as subtitles

Ticker derives its punch from **scarcity**. The most common failure: `narration` and `data.content` are the same string, so ticker becomes a captioning machine.

```
✅ ticker, no narration, 3-5s         (let the words land in silence)
✅ ticker + short reaction narration  (card is the line; voice reacts)
❌ ticker text == narration text       (this is captions, not impact)
❌ 3 tickers in a row with narration   (this is reading slides aloud)
```

Use ticker for: opening hook (silent), chapter transition (1 line), impact moment (number / verdict / quote). Not for: regular chapter content.

## When two consecutive cards feel the same

If two adjacent steps use the same card type, look at whether one of them should switch:

- Two `markdown` cards back to back → second should usually be a visual card (`image` / `mermaid` / `ticker`)
- Three `image` / generated SVG cards in a row → at least one should usually become `markdown`, `mermaid`, `ticker`, or a real screenshot unless the sequence is intentionally visual.
- Two `ticker` in a row → one of them is probably regular content trying to look big

Pacing rule of thumb: every 3-4 steps should land at least one visual card. The series guide may tighten this further.

---

## When the right card is `image` but no asset exists

This is common for hero visuals and counter-examples. Don't downgrade to a text card — flag it.

In `/ars:build` Phase 2 (Asset prep), the asset is sourced first. If sourcing fails:
- For abstract / symbolic / diagram-like visuals, generate a small local SVG image asset and keep using the `image` card
- Use a `PLACEHOLDER_<descriptive-name>.<ext>` filename
- Put what's needed into the step's `caption` field
- If it's the hero visual, this becomes a build blocker per the SKILL's placeholder policy

Don't rewrite the segment to use `markdown` just because the image isn't there. The plan chose `image` for a reason.
