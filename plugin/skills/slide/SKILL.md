---
name: ars:slide
description: Open the ARS Studio slide phase for a target episode — presentation-only view with editing chrome removed and presenter affordances (notes, timer, overview, subtitle toggle, chrome auto-hide).
argument-hint: "<epId>"
model: claude-sonnet-4-6
effort: low
---

## Setup

Run `npx ars studio <epId> --phase slide` in the background (do not block on it).

Tell the user:

1. The Studio URL printed in the output.
2. Slide mode is presentation-only — it does **not** watch Studio intents and does **not** apply fixes. If they need to record feedback, they should switch to the `review` tab inside Studio (or run `/ars:review <epId>`).
3. The keyboard shortcuts:
   - `←` / `→` — previous / next slide
   - `Space` / `PageDown` — next slide
   - `PageUp` — previous slide
   - `Home` / `End` — first / last slide
   - `F` — toggle fullscreen
   - `N` — toggle presenter notes + timer panel
   - `O` — toggle slide overview (grid of all slides)
   - `S` — toggle on-canvas subtitles
   - `R` — reset the presenter timer
   - `Esc` — close the overview

## Rules

- Run `npx ars studio ... --phase slide` in the background so it doesn't block the conversation.
- Do not start any intent watch loop for slide mode — it's read-only.
- If the user asks for fixes, direct them to `/ars:review <epId>`.
