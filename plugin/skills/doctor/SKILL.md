---
name: doctor
description: Validate repo bootstrap readiness, ARS config, providers, and environment readiness with npx ars doctor.
model: claude-sonnet-4-6
effort: low
---

Run `npx ars doctor` from the repo root.

Behavior:
- Treat the command output as the source of truth for repo health.
- Surface failing checks first, then warnings, then passing checks.
- If config is missing, direct the user to run `/ars:onboard` or `npx ars init <series>`.
- If bootstrap checks fail, tell the user whether they are missing `git`, a git repo, or a basic project manifest.
- Do not invent provider state that the doctor command did not report.
