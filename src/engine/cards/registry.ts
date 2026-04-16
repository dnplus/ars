import type { CardSpec } from "./types";

type GlobCardModule = {
  cardSpec: CardSpec<unknown>;
};

const collect = (): Map<string, CardSpec<unknown>> => {
  // import.meta.glob is a Vite-only API — not available in Remotion/webpack.
  // Return an empty registry when running outside Vite (e.g. cover render).
  if (typeof import.meta.glob !== 'function') {
    return new Map();
  }

  const engineSpecs = import.meta.glob("./*/spec.ts", {
    eager: true,
  }) as Record<string, GlobCardModule>;
  const episodeSpecs = import.meta.glob("../../episodes/*/cards/*/spec.ts", {
    eager: true,
  }) as Record<string, GlobCardModule>;
  const registry = new Map<string, CardSpec<unknown>>();

  for (const [source, mod] of Object.entries({ ...engineSpecs, ...episodeSpecs })) {
    const spec = mod.cardSpec;

    if (!spec) {
      continue;
    }

    if (registry.has(spec.type)) {
      throw new Error(
        `[card-registry] Duplicate card type "${spec.type}" from ${source}.`,
      );
    }

    registry.set(spec.type, spec);
  }

  return registry;
};

export const CARD_REGISTRY = collect();

export const getCard = (type: string): CardSpec<unknown> => {
  const spec = CARD_REGISTRY.get(type);

  if (!spec) {
    throw new Error(`[card-registry] Unknown card type "${type}".`);
  }

  return spec;
};

