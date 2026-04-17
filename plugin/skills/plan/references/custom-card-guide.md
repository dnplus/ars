# Custom Card Decision Guide

Use this guide when deciding whether to add an entry under `## New card` during `/ars:plan`.

---

## When to create a new card

A new custom card is justified when **both** of the following are true:

1. **No built-in or existing series-scoped card expresses the core visual idea in one glance.**
   Rearranging data fields or changing colors does not qualify. The visual *pattern* must be novel.

2. **The pattern is likely to recur across 2+ episodes, OR the content cannot be expressed without it.**
   One-off decoration → skip it. Structural communication need → build it.

If only one condition is met, prefer extending an existing card or using a built-in with creative data.

---

## Differentiation check (required before proposing)

Before adding a row under `## New card`:

1. Write this sentence in your working notes:

> "This differs from `<nearest-existing-card>` because ___."

2. Make sure the `Concept` field states, in one sentence, what the audience should understand at a glance.

**Reject the new card if the blank is filled with:**
- "different colors" → use theme tokens on the existing card
- "different data shape but same layout" → extend the existing card's schema
- "I couldn't find a good fit" → run `npx ars card list` again and re-read `agentHints`

**Accept the new card if the blank is filled with:**
- "it animates a spatial relationship that no grid/flow card can show"
- "it overlays two data dimensions in a single glyph the audience reads at a glance"
- "the interaction metaphor (e.g. a gauge, a stack trace, a diff view) has no built-in equivalent"

If you cannot describe the concept cleanly in one sentence, the card is probably still an under-specified visual idea rather than a reusable card.

---

## agentHints quality bar

Every new card's `spec.ts` must have `agentHints` with:
- `whenToUse` — one sentence, specific enough that another agent picks this card and not a generic one
- `notForUseCases` — one sentence, names the most likely wrong use
- `exampleData` — a minimal working data object

### Bad (too vague — agent will pick this card for the wrong episodes)

```ts
agentHints: {
  whenToUse: "Use when you want a nice visualization",
  notForUseCases: "Not for simple content",
  exampleData: {},
}
```

### Good (specific — agent knows exactly when this card earns its place)

```ts
agentHints: {
  whenToUse: "Use when showing a live comparison between two ranked lists that change order — e.g. benchmark results, before/after rankings",
  notForUseCases: "Not for static A-vs-B comparisons with no ordering — use the built-in 'compare' card instead",
  exampleData: {
    leftLabel: "Before", rightLabel: "After",
    items: [{ name: "Redis", before: 1, after: 3 }],
  },
}
```

The test: could another agent misuse this card based only on `whenToUse`? If yes, tighten it.

---

## Overriding a built-in engine card

A series-scoped card can fully replace a built-in engine card by using the **same `type` string**. The registry will use the series card instead for all steps in that series.

When to use this:
- The built-in card's visual style doesn't match the series brand and a wrapper isn't enough
- You want to swap the implementation without changing any `contentType` values in episode files

Example: create `src/episodes/<series>/cards/markdown/` with `cardSpec.type = "markdown"` — all `markdown` steps in that series render your version instead of the engine default.

This is an advanced pattern. Don't override unless the built-in genuinely can't be styled to match — prefer `theme.colors` customization first.

---

## Card naming

- Use a descriptive noun phrase, kebab-case: `ranked-diff`, `gauge-cluster`, `stack-trace-viewer`
- Avoid generic names: `custom-chart`, `special-card`, `visual-block`
- The name should be stable — it becomes the `contentType` string in every episode that uses it

---

## Checklist before adding `## New card`

- [ ] Ran `npx ars card list` and confirmed no existing card covers this need
- [ ] Wrote the differentiation sentence — it names a structural difference, not cosmetic
- [ ] Wrote a crisp card ask — one-glance promise, not implementation details
- [ ] Card name is a specific noun phrase
- [ ] Card will recur across 2+ episodes OR content cannot be expressed without it
