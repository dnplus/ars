import type { CardSpec } from "./types";

type GlobCardModule = {
  cardSpec: CardSpec<unknown>;
};

const collect = (): Map<string, CardSpec<unknown>> => {
  // import.meta.glob is a Vite-only API.
  // - Vite: transforms glob calls into Object.assign({...}) at build time.
  //   The try block succeeds; catch is dead code.
  // - Remotion/webpack: import.meta.glob is undefined at runtime; calling it
  //   throws TypeError. The catch returns an empty registry.
  // DO NOT use `typeof import.meta.glob !== 'function'` guard — Vite transforms
  // the glob call before the guard fires, so in the browser import.meta.glob is
  // already undefined (transformed away), making the guard always true and
  // returning an empty Map even when the glob data is available.
  let engineSpecs: Record<string, GlobCardModule> = {};
  let episodeSpecs: Record<string, GlobCardModule> = {};
  try {
    engineSpecs = import.meta.glob("./*/spec.ts", {
      eager: true,
    }) as Record<string, GlobCardModule>;
    episodeSpecs = import.meta.glob("../../episodes/*/cards/*/spec.ts", {
      eager: true,
    }) as Record<string, GlobCardModule>;
  } catch {
    return new Map();
  }
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

