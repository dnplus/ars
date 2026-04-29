# Card Selection Heuristics

Cross-card selection guidance for `/ars:build`. Read this **after** `SERIES_GUIDE.md` — the series guide always wins. This file gives portable defaults; series may override the ordering, the misuse list, or both.

If `SERIES_GUIDE.md` lists explicit card preferences (e.g. `mockApp > image > timeline`, `mermaid > flowchart`, `compare 用得勤 / 用得省`), follow the series ordering and treat the defaults below as background context.

---

## Pick by information type, not by visual flair

Don't start from "which card is fanciest". Start from what the segment is **about**, then pick the card that expresses that shape:

| Segment is about… | Default card | Common alternative |
|---|---|---|
| App / product surface (chat, terminal, browser, dashboard) | `mockApp` | `image` (real screenshot) |
| Real screenshots, photos, external visuals | `image` | `mockApp` (browser snapshot mode) |
| Stage progression / layers / 3-5 big concepts | `timeline` | `markdown` (table) |
| Static relationship / architecture / sequence / class diagram | `mermaid` | `flowchart` (only if step-reveal matters) |
| A vs B head-to-head | `compare` | `markdown` table (3+ columns) |
| Multi-column data / decision matrix / mapping | `markdown` table | `compare` (only true 2-col head-to-head) |
| Single-shot impact / chapter transition / punchline | `ticker` | `cover` (episode start only) |
| Counted KPIs / 1-3 standout numbers | `stats` | `mockApp` dashboard (numbers + chart together) |
| Code with syntax highlighting | `code` | (none — code goes here) |
| Episode opening / closing | `cover` / `summary` | (one-shot — never reuse) |
| General prose / lists / mixed text | `markdown` | `text` (legacy) |

---

## Default ordering when intent is ambiguous

These are portable defaults. Series may flip any of them:

- **App-like content** → `mockApp > image > timeline`
- **Diagram content** → `mermaid > flowchart`
- **Numeric content** → `chart / dashboard > stats`
- **Multi-column data** → `markdown table > compare`

Reasoning: `mockApp` carries product texture (frame, address bar, traffic lights) that `image` can fake but rarely matches. `mermaid` is faster to author and less error-prone than `flowchart` for static structure. Dashboard composition (numbers + chart + insight) reads better than `stats` alone for KPI segments.

---

## mockApp combination matrix

`mockApp` is the new app-like primary card. When a segment looks like a product surface, start here:

| `appDevice` | `appType` | Typical use | Key fields |
|---|---|---|---|
| `desktop` | `chat` | Claude / ChatGPT / support copilot UI | `appMessages`, `appName`, `appInputPlaceholder` |
| `desktop` | `terminal` | IDE-side CLI, agent execution log, shell demo | `terminalLines`, `terminalTitle`, `appName` |
| `desktop` | `browser` | Doc page, landing page, site reference | `appBrowserMode`, `appUrl`, `appImageSrc` |
| `desktop` | `dashboard` | KPI panel, chart dashboard, BI summary | `chartType`, `chartData`, `chartValuePrefix/Suffix`, `appInsight` |
| `mobile` | `chat` | Phone messaging, mobile assistant | `appMessages`, `appName`, `appInputPlaceholder` |
| `mobile` | `terminal` | Phone-shell CLI (rare but valid) | `terminalLines`, `appName` |
| `mobile` | `browser` | Mobile product page, in-phone web demo | `appBrowserMode`, `appUrl`, `appImageSrc` |
| `mobile` | `dashboard` | Mobile KPI card, compact analytics | `chartType`, `chartData`, `appInsight` |

Notes:
- `browser` mode hinges on `appBrowserMode`. `meta` favors address bar + summary; `snapshot` favors a captured page image.
- `dashboard` mode pairs numbers with interpretation. Use it when "numbers + reading + app frame" all need to land together — not for a single chart.

---

## mermaid vs flowchart

One-line rule: if the audience needs to **walk along the arrows step by step with animation**, use `flowchart`. Otherwise use `mermaid`.

| Dimension | `flowchart` | `mermaid` |
|---|---|---|
| Animation | Spring node entrance + edge draw + camera zoom | None |
| Best for | Operational flow, decision tree, A→B→C transitions where reveal order matters | sequenceDiagram, classDiagram, ER, static architecture |
| Syntax coverage | Flowchart-style nodes/edges only | Full Mermaid grammar |
| sequenceDiagram | ❌ | ✅ |
| classDiagram / ER | ❌ | ✅ |
| Camera zoom | ✅ | ❌ |

Hard rules:
- `sequenceDiagram` / `classDiagram` / `ER` → must use `mermaid`.
- General "process with 3-5 boxes" → default to `mermaid` first; promote to `flowchart` only when the step-by-step reveal is itself the point.

---

## High-misuse cards

These get over-applied. Each has a tighter use case than it looks:

### `flowchart` — only when arrows-walk is the point

`flowchart` gets used for anything with 3-5 boxes. It's actually only right when the audience must follow the arrow path beat by beat:

```
✅ 先查資料 → 再判斷 → 再執行 → 再驗證          (real flow)
❌ 三層地基 / 三個原則 / 四個框架               (use timeline — it's about layers, not arrows)
❌ 兩種選擇對照                                 (use compare)
```

When in doubt, ask: "do I want the camera to track from box to box on screen?" If no, it's not `flowchart`.

### `compare` — only true two-sided head-to-head

`compare` is for A vs B where both sides share dimensions and clash directly. If two columns are just convenient layout, it's a fake comparison:

```
✅ Before vs After / Old vs New / V1 vs V2     (same dimensions, direct contrast)
❌ Pros / Cons of one thing                     (use markdown bullet — not two sides clashing)
❌ Two unrelated topics side by side            (use markdown table or split into two steps)
```

For 3+ columns or decision matrices, `markdown` table is the right call.

### `ticker` — never as subtitles

Ticker derives its punch from **scarcity**. The most common failure: `narration` and `cardContent` are the same string, so ticker becomes a captioning machine.

```
✅ ticker, no narration, 3-5s         (let the words land in silence)
✅ ticker + short reaction narration  (card is the line; voice reacts)
❌ ticker text == narration text       (this is captions, not impact)
❌ 3 tickers in a row with narration   (this is reading slides aloud)
```

Use ticker for: opening hook (silent), chapter transition (1 line), impact moment (number / verdict / quote). Not for: regular chapter content.

### `flowchart` direction in 16:9

If `flowchart` actually fits, default `flowchartDirection: 'LR'` for 3+ layers. `TB` only works for 2-layer simple structures in 16:9 — beyond that nodes get crushed into a thin band.

```
❌ 'TB' + 4 layers → squashed line in 16:9
✅ 'LR' + 4 layers → horizontal spread, breathing room
✅ 'TB' + 2 layers → fine, simple structure
```

---

## When two consecutive cards feel the same

If two adjacent steps use the same card type, look at whether one of them should switch:

- Two `markdown` cards back to back → second should usually be a visual card (`mockApp` / `image` / `mermaid` / `compare`)
- Two `ticker` in a row → one of them is probably regular content trying to look big
- Two `compare` in a row → at least one is probably forced; check for fake comparison

Pacing rule of thumb: every 3-4 steps should land at least one visual card. The series guide may tighten this further.

---

## When the right card is `image` but no asset exists

This is common for hero visuals and counter-examples. Don't downgrade to a text card — flag it.

In `/ars:build` Phase 2 (Asset prep), the asset is sourced first. If sourcing fails:
- Use a `PLACEHOLDER_<descriptive-name>.<ext>` filename
- Put what's needed into the step's `caption` field
- If it's the hero visual, this becomes a build blocker per the SKILL's placeholder policy

Don't rewrite the segment to use `markdown` just because the image isn't there. The plan chose `image` for a reason.
