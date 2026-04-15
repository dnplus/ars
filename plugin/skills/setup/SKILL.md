---
name: setup
description: Initialize ARS for the current repo by creating .ars/config.json with npx ars setup.
model: claude-sonnet-4-6
effort: low
---

Run `npx ars setup` from the repo root.

Behavior:
- Explain that this initializes `.ars/config.json` for the current repo.
- If the shell is interactive, let the user answer the setup prompts.
- If the shell is non-interactive, note that ARS will apply defaults.
- After setup finishes, confirm the written path and key values for `llm.default`, `tts.provider`, and `publish.youtube.enabled`.
