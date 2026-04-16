import type { CardSpec } from "./types";
import { cardSpec as codeSpec } from "./code/spec";
import { cardSpec as coverSpec } from "./cover/spec";
import { cardSpec as imageSpec } from "./image/spec";
import { cardSpec as markdownSpec } from "./markdown/spec";
import { cardSpec as mermaidSpec } from "./mermaid/spec";
import { cardSpec as summarySpec } from "./summary/spec";
import { cardSpec as tickerSpec } from "./ticker/spec";

// Static fallback for Remotion/webpack environments where import.meta.glob is unavailable.
const ENGINE_STATIC_SPECS: Record<string, { cardSpec: CardSpec<unknown> }> = {
  "./code/spec.ts": { cardSpec: codeSpec as CardSpec<unknown> },
  "./cover/spec.ts": { cardSpec: coverSpec as CardSpec<unknown> },
  "./image/spec.ts": { cardSpec: imageSpec as CardSpec<unknown> },
  "./markdown/spec.ts": { cardSpec: markdownSpec as CardSpec<unknown> },
  "./mermaid/spec.ts": { cardSpec: mermaidSpec as CardSpec<unknown> },
  "./summary/spec.ts": { cardSpec: summarySpec as CardSpec<unknown> },
  "./ticker/spec.ts": { cardSpec: tickerSpec as CardSpec<unknown> },
};

type GlobCardModule = {
  cardSpec: CardSpec<unknown>;
};

const collect = (): Map<string, CardSpec<unknown>> => {
  // import.meta.glob is a Vite-only API.
  // - Vite: transforms glob calls into Object.assign({...}) at build time.
  //   The try block succeeds; catch is dead code.
  // - Remotion/webpack: import.meta.glob is undefined at runtime; calling it
  //   throws TypeError. The catch falls back to static imports.
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
    // Remotion/webpack: fall back to statically imported engine cards.
    // Series-scoped custom cards are not available in this path.
    engineSpecs = ENGINE_STATIC_SPECS;
  }
  const hasUserSeriesSpecs = Object.keys(episodeSpecs).some(
    (source) => !source.includes("/episodes/template/"),
  );
  const filteredEpisodeSpecs = hasUserSeriesSpecs
    ? Object.fromEntries(
        Object.entries(episodeSpecs).filter(
          ([source]) => !source.includes("/episodes/template/"),
        ),
      )
    : episodeSpecs;
  const registry = new Map<string, CardSpec<unknown>>();

  for (const [source, mod] of Object.entries({ ...engineSpecs, ...filteredEpisodeSpecs })) {
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

export const hasCard = (type: string): boolean => CARD_REGISTRY.has(type);

export const getCard = (type: string): CardSpec<unknown> => {
  const spec = CARD_REGISTRY.get(type);

  if (!spec) {
    throw new Error(`[card-registry] Unknown card type "${type}".`);
  }

  return spec;
};
