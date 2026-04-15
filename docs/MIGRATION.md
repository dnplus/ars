# ARS Engine Migration Notes

## Dual Card System Status

ARS currently ships two card systems in parallel:

1. Legacy React cards under `src/engine/components/cards/`
2. Registry-based CardSpec cards under `src/engine/cards/` with `src/engine/cards/registry.ts`

This is intentional for now. Existing runtime paths still depend on the legacy system:

- `src/engine/scenes/WebinarScene.tsx` uses a `switch (contentType)` router and imports legacy cards directly.
- `src/Root.tsx` and `src/engine/Composition.tsx` still render legacy thumbnail/runtime helpers.
- Existing episodes, including `src/episodes/template/ep-demo.ts`, still exercise legacy `contentType` values.

Because `ars setup` / `ars update` now copy the engine into downstream repos, we need the copied engine to preserve current behavior. Removing the legacy layer prematurely would break existing episodes and scene routing.

## What To Use Going Forward

For all new card work:

- Add the card under `src/engine/cards/<card-id>/`
- Define a `CardSpec`
- Register it in `src/engine/cards/registry.ts`

Do not add new cards to `src/engine/components/cards/` unless they are required to keep the legacy renderer working during migration.

## Legacy Surface Policy

The legacy directory remains supported only as a compatibility layer:

- Keep existing legacy cards that are still imported by `WebinarScene`, `Root`, or `Composition`
- Allow bug fixes and compatibility fixes there
- Avoid expanding the switch-case renderer with new concepts unless there is no registry-based option

Zero-import audit result on 2026-04-15:

- `ScrollableCard.tsx` had no imports and was removed
- `BaseCard.tsx` is still required by `CompareCard`, `ContextCard`, `FlowchartCard`, `MermaidCard`, `StatsCard`, and `TimelineCard`
- `CoverCard.tsx`, `CodeCard.tsx`, `ImageCard.tsx`, and `MarkdownCard.tsx` are still imported by `WebinarScene.tsx`

## Migration Path

The intended removal sequence is:

1. Keep shipping both systems while legacy `contentType` routes still point to `src/engine/components/cards/*`
2. Add registry-backed equivalents for the remaining legacy cards
3. Replace `WebinarScene` switch-case rendering with registry-based lookup and rendering
4. Update `Root` / `Composition` helpers to use the registry-backed path where applicable
5. Delete the remaining legacy `components/cards/*` files only after their imports drop to zero

Until step 3 is complete, downstream repos initialized by `ars setup` should continue to receive both the registry system and the compatibility cards.
