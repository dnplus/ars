# Branding Interview Guide

Use this guide during onboard customize to collect brand information, derive theme tokens, and shape SERIES_GUIDE.md.

The interview has a compact first pass and an optional deeper pass:

- **Quick customize** (always run unless the user chooses "keep template for now") — one free-form answer first, then at most 3 follow-up questions. Produces usable `series-config.ts` changes and a basic `SERIES_GUIDE.md`.
- **Deep-dive** (opt-in) — one free-form answer first, then at most 3 follow-up questions. Covers voice, language allergies, card preferences, step duration cap, contrast examples. Appends optional sections to `SERIES_GUIDE.md`.

Channel name, YouTube publishing, and layout are already handled by `npx ars init` — do not re-ask them here. TTS settings now live in `series-config.ts` under `SERIES_CONFIG.speech`; audio starts disabled by default until the user explicitly enables it.

## Interview Rules

Brief the user before asking questions. Say customize will tune visible defaults and write `SERIES_GUIDE.md`, which future plan/build/review-fix/reflect runs will read.

Prefer free-form answers over a rigid questionnaire. Ask one broad prompt first. Wait for the user's reply, extract as much as possible, then ask targeted follow-ups only for missing fields that would otherwise force invention.

- Default to a conversational flow, not a form dump.
- If the user answers multiple questions in one reply, capture the answered fields and skip them.
- Do not re-ask information the user already gave clearly.
- Accept "reuse defaults" / "same" / "default" / "skip" as an answer — record it as "use template default" for that field, do NOT silently invent richer content.
- Stop as soon as the user says "do it later."
- If the user is lazy or says "just do your best", stop the interview and fall back to the minimal defaults in `references/series-guide-template.md`.

## Quick Customize — Free-Form First

Start with this single prompt:

```text
先用一段話或幾個 bullet 描述這個頻道就好：
它叫什麼、誰在講、想給誰看、希望觀眾帶走什麼、
講話風格和視覺感覺大概是什麼。

不用填表；你想到什麼先丟，我會幫你整理成 series-config.ts 和 SERIES_GUIDE.md。
```

After the answer, extract these fields. Ask at most 3 follow-up questions total, only for fields that are both missing and important:

1. **Channel identity** — What should the channel/series be called, and who is presenting it? One line is enough.
2. **Audience + takeaway** — Who is this for, and what should viewers usually walk away with?
3. **Voice** — Pick or describe: direct / opinionated / playful / didactic / calm / other. Any words or phrases you dislike?
4. **Visual direction** — Any brand color, visual tone, or VTuber/image assets? If no VTuber, set `shell.config.vtuber.enabled = false` instead of leaving broken image paths.
5. **Episode defaults** — Preferred length range and CTA style? If unsure, use default: mixed length, soft CTA.

If the user answers sparsely, use the minimal defaults and explicitly say which defaults were used. Do not keep asking just to fill every field.

`brandTag` is derived — default to `EP`. Offer to set it only if the user spontaneously mentions episode-type labeling.

## Field Mapping

### Visual identity (→ `series-config.ts`)

1. **Primary color** — Do you have a brand color? (hex preferred; can describe if not)
2. **Visual tone** — Warm/earthy, cool/tech, minimal/clean, or something else?
3. **Font** — Any preferred font? (defaults to Noto Sans TC for CJK, Inter for Latin)
4. **VTuber** — Do you have a VTuber character? If yes, ask them to drop the images in `public/episodes/<series>/shared/vtuber/`. If not, set `shell.config.vtuber.enabled = false` in `series-config.ts` instead of leaving broken image paths around.

### Series identity (→ `SERIES_GUIDE.md`)

These drive `SERIES_GUIDE.md` and are required as fields, but they do not all need separate questions. Fill them from compact answers, existing config values, or minimal defaults. Do NOT invent them from channel name alone. If the user says "reuse defaults" / "default", use the minimal defaults from `references/series-guide-template.md` verbatim and tell them which defaults you used.

5. **Host / creator** — Who is presenting this series? (one-line background, e.g. "senior backend engineer and small-team lead", "indie developer", "ServiceNow consultant") — drives narration credibility and the depth of claims the series can make.
6. **Audience** — Who is this series for? (one line, e.g. "experienced engineers in Taiwan who want practical AI workflow examples")
7. **Mission / takeaway** — What should a viewer walk away with after each episode? (one sentence)
8. **Narration tone** — Pick one or describe: direct / opinionated / playful / didactic / other
9. **Episode length range** — what length spectrum does this series cover? short 1–3 min / medium 3–6 min / long 6–30 min / mixed (any combination). Per-episode length is decided at `/ars:plan` time based on source material — this question sets the *acceptable range*, not a per-episode default.
10. **CTA policy** — Soft (description link / subscribe) / Direct (call out action) / Mixed / None

`brandTag` is derived — default to `EP`. Offer to set it only if the user spontaneously mentions episode-type labeling (e.g. "I want each episode tagged as Tutorial / Deep Dive"). Don't ask proactively.

## Deep-Dive (opt-in)

Run this only after quick customize finishes and the user opts in. Before asking for input, explain what will happen next: the user gives one free-form style note, you summarize it into optional guide sections, then you ask at most 3 follow-ups if needed.

These answers fill the optional sections in SERIES_GUIDE.md (`## Slogan & Persona`, `## Common Openers`, `## Signature Sign-off`, `## Banned Phrases & Replacements`, `## Card Preferences`, `## Step Duration Cap`, `## Contrast Examples`). They are read directly by `/ars:build` to drive narration style, card selection, and step pacing.

Start with one free-form prompt:

```text
想補強的話，直接描述你希望影片「聽起來」和「看起來」像什麼：
口頭禪、禁用詞、喜歡/討厭的 AI 句型、卡片偏好、節奏都可以混在一起講。
```

Then map the answer to the fields below. Ask at most 3 follow-up questions total. Each skipped or unanswered field simply means that section won't be added to SERIES_GUIDE.md.

### Voice & Persona

11. **Slogan / signature phrase** — One line you want viewers to remember. Example for 人蔘Try Catch: "人生就像 Try…Catch，反正 Catch 住就對了。" Skip if no slogan.

12. **Persona one-liner** — Who is the host? In one line — role, age range or vibe, signature attitude. Example: "37 歲技術部門主管（人蔘擬人），冷面笑匠、苦中帶甘"; or "資深 ServiceNow 顧問，務實派"; or "indie hacker, plays dumb on purpose to teach better." Skip if persona = host's real bio from quick customize.

13. **Common openers** — Up to 3 phrases you actually say at the top of segments. Example: "講白了" / "老實說" / "唉……（推眼鏡）" / "It's worth noting" → 否定樣本，不是真實口頭禪. Skip if you don't have stock openers.

14. **Signature sign-off** — How does every episode end? Example: "人蔘好難，但 Catch 住就對了。我是人蔘，我們下次見。" Skip if you prefer it to vary per episode.

### Forbidden Patterns

15. **Banned words / phrases** — 3-5 words or phrases you don't want to see in your narration, ever. These are personal language allergies the writer should grep for and rewrite. Example for 人蔘: `手感`, `戰場`, `拆`, `味道`, `炫技`. Provide 1-2 replacement directions per banned word if natural (e.g. `拆 → 分解 / 講清楚`). Skip if no personal allergies.

16. **AI 套路句 baseline** — apply the built-in AI cliché blacklist by default? (yes / no / extend)
    - The built-in list: 「真正難的不是 X 而是 Y」、「不僅是 X 更是 Y」、「值得注意的是」、「總結來說」、「在這個 X 時代」、「讓我們一起來看看」、「批評者認為」
    - `yes` → use it as-is (default)
    - `no` → skip the AI cliché filter (rare; only for series with intentional formal tone)
    - `extend` → add the user's own additions on top

### Card Preferences

These three questions set the default card ordering for `/ars:build`. The series guide overrides the defaults in `references/card-selection.md`. Use compact options:

17. **App-like content priority** — when a segment is about a product surface, prefer:
    - `image screenshot > generated UI SVG > markdown` (default — truthfulness first)
    - `generated UI SVG > image screenshot > markdown` (branded abstraction first)
    - `mixed / depends` (let build decide per segment)

18. **Diagram default** — when showing static structure or process:
    - `mermaid > generated SVG image` (default — editable structure first)
    - `generated SVG image > mermaid` (you favor branded visual anchors)
    - `mixed / depends`

19. **A/B framing density** — for comparison segments:
    - 用得勤 (use A/B markdown tables or visual contrast frames aggressively)
    - 用得省 (default — only true head-to-head; multi-column → markdown table)
    - `mixed`

### Pacing

20. **Step duration cap** — when a single narrated step's narration runs longer than this, build should split it into two beats. Pick:
    - 20s (tight, ginseng-style)
    - 30s (balanced)
    - 45s (long-form, GSS-style or formal training content)
    - other — user-specified number

This number directly overrides the build SKILL's 30-60s default.

### Contrast Examples

21. **Contrast pair (optional but high-value)** — give 1-2 example sentences in two versions:

    ```
    ❌ 太書面 / 不像我:
    ✅ 我的風格:
    ```

    Example for 人蔘:
    ```
    ❌ 這種架構設計體現了系統性思考的重要性，值得注意的是其擴展性問題。
    ✅ 問題在這裡。你把整個系統塞進一個 service，乍看沒問題，但流量一上來就炸。不是因為程式寫錯，是因為它從一開始就沒準備好被這樣用。
    ```

    Build reads these as tone calibration data — they're worth more than any rule when judging "does this narration sound like me?". Skip if user can't think of one (offer to revisit later in `/ars:onboard` re-run).

## Color Derivation Rules

When you only have a primary hex color, derive the full palette:

```
primary       → brand color as-is
secondary     → primary H unchanged, S -20%, L -15%
accent        → primary H unchanged, S -10%, L +10%

surfaceDark   → primary H, S -40%, L 10-15%  (dark mode base)
surfaceCard   → surfaceDark L +5%
surfaceCardHeader → surfaceDark
surfaceLight  → primary H, S -60%, L 94-97%  (light/cream bg)
surfaceCode   → #1e1e1e (fixed)

onDark        → surfaceLight color
onCard        → surfaceLight color
onLight       → surfaceDark color
onPrimary     → #ffffff if primary is dark, #000000 if light

gradientDark  → linear-gradient(135deg, surfaceDark, surfaceCard)
gradientGold  → linear-gradient(135deg, primary, accent)
border        → primary H, S -30%, L 30-35%
shadow        → primary hex + alpha 0.2
```

## Visual Tone → Color Guidance

| Tone | Primary range | Surface feel |
|------|--------------|-------------|
| Warm/earthy | Browns, tans, amber (#c4a77d range) | Warm off-whites, dark browns |
| Cool/tech | Blues, teals, indigo (#4a7fb5 range) | Dark navy/slate, cool grays |
| Minimal/clean | Neutral grays, slate | Near-white light bg, charcoal dark |
| Vibrant | Any saturated hue | High contrast light/dark |

## What to Write Back

After quick customize, update `series-config.ts`:
- Replace all placeholder colors in `theme.colors`
- Set `fontFamily` to chosen font (use Google Fonts via `@remotion/google-fonts/<FontName>` if available)
- Update `vtuber.closedImg` / `openImg` paths if user provided images
- If the series does not use a VTuber avatar, explicitly set `vtuber.enabled = false`
- Only touch `episodeDefaults.brandTag` if the user explicitly asked for a custom tag

Do NOT touch `episodeDefaults.channelName` during the branding interview — `npx ars init` already set it.

For `shell.layout`:
- In normal onboarding, leave the built-in layout choice from `npx ars init` as-is.
- Only change it if the user explicitly wants to switch between built-in `'streaming'` / `'shorts'`, or they are intentionally setting up a series custom layout override.

Then write `SERIES_GUIDE.md` — see `references/series-guide-template.md`. Use only the basic sections at this point.

After the deep-dive (if the user opted in), append the optional sections to the same `SERIES_GUIDE.md`:

| Deep-dive question | SERIES_GUIDE section |
|---|---|
| Q11 (slogan) + Q12 (persona) | `## Slogan & Persona` |
| Q13 (common openers) | `## Common Openers` |
| Q14 (signature sign-off) | `## Signature Sign-off` |
| Q15 (banned words) + Q16 (AI cliché policy) | `## Banned Phrases & Replacements` |
| Q17 / Q18 / Q19 (card preferences) | `## Card Preferences (Authoring Heuristics)` |
| Q20 (step duration) | `## Step Duration Cap` |
| Q21 (contrast pair) | `## Contrast Examples` |

Sections corresponding to skipped questions are simply omitted — don't write empty placeholder sections. After writing, tell the user which sections were added so they can verify the file matches their answers. Also remind them that `SERIES_GUIDE.md` is editable later: they can directly tell the agent to change tone, banned phrases, card preferences, pacing, or other series rules in that file.
