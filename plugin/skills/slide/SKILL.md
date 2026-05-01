---
name: ars:slide
description: Open the ARS Studio slide phase for a target episode — presentation-only view with editing chrome removed and presenter affordances (notes, timer, overview, subtitle toggle, chrome auto-hide).
argument-hint: "<epId>"
model: claude-sonnet-4-6
effort: low
---

## Setup

Make the episode context explicit:

```bash
npx ars workstate switch <epId> --stage slide
```

Before opening or reusing Studio, check whether this Claude session already has a running Studio process and Studio intent Monitor:

- If Studio is already open for this same `<epId>` and phase, reuse it. Do not start a duplicate Vite server just to get a fresh URL.
- If Studio is open for this same `<epId>` but no intent Monitor is running, keep the Studio process and start the Monitor immediately.
- If Studio or the Monitor is for a different episode, stop the old Monitor first, keep the explicit workstate switch above, then open/reuse Studio for this target.

Run `npx ars studio <epId> --phase slide` in the background only when there is no reusable Studio process (do not block on it).

Whenever Studio is opened or reused, register an event-driven watch over `.ars/studio-intents/` **using the `Monitor` tool**:

```bash
npx ars studio intent watch
```

Each stdout line is a notification. On every notification:

1. Stage guard: check `.ars/state/workstate.json`. Continue only when it points to this `<epId>` and `stage` is `slide` (or `review` if the user switched Studio tabs to submit feedback). If the workstate points elsewhere, stop the Monitor cleanly.
2. Run `npx ars studio intent list --pending --json`.
3. Ignore unrelated intents. For intents targeting this episode, delegate to `/ars:apply-review <intent.id>` so a user who switches from slide to review inside Studio still gets feedback processed.

Tell the user:

1. The Studio URL printed in the output.
2. Slide mode is presentation-first. The Monitor is still running; if they switch to the `review` tab inside Studio and leave feedback, the agent will pick it up.
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
- Always keep a Studio intent Monitor attached to the open Studio session, even in slide mode.
- If the user asks for fixes directly in chat, switch workstate to review and handle them through `/ars:review <epId>` or `/ars:apply-review <intent.id>` depending on whether an intent already exists.
