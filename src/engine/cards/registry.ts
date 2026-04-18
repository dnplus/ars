import { isHiddenTemplateSeries } from "../shared/constants";
import type { CardSpec } from "./types";
import { cardSpec as codeSpec } from "./code/spec";
import { cardSpec as coverSpec } from "./cover/spec";
import { cardSpec as imageSpec } from "./image/spec";
import { cardSpec as markdownSpec } from "./markdown/spec";
import { cardSpec as mermaidSpec } from "./mermaid/spec";
import { cardSpec as summarySpec } from "./summary/spec";
import { cardSpec as thumbnailSpec } from "./thumbnail/spec";
import { cardSpec as tickerSpec } from "./ticker/spec";

// Static fallback for Remotion/webpack environments where import.meta.glob is unavailable.
const ENGINE_STATIC_SPECS: Record<string, { cardSpec: CardSpec<unknown> }> = {
  "./code/spec.ts": { cardSpec: codeSpec as CardSpec<unknown> },
  "./cover/spec.ts": { cardSpec: coverSpec as CardSpec<unknown> },
  "./image/spec.ts": { cardSpec: imageSpec as CardSpec<unknown> },
  "./markdown/spec.ts": { cardSpec: markdownSpec as CardSpec<unknown> },
  "./mermaid/spec.ts": { cardSpec: mermaidSpec as CardSpec<unknown> },
  "./summary/spec.ts": { cardSpec: summarySpec as CardSpec<unknown> },
  "./thumbnail/spec.ts": { cardSpec: thumbnailSpec as CardSpec<unknown> },
  "./ticker/spec.ts": { cardSpec: tickerSpec as CardSpec<unknown> },
};

type GlobCardModule = {
  cardSpec: CardSpec<unknown>;
};

const extractSeriesIdFromSpecSource = (source: string): string | null => {
  const normalized = source.replace(/\\/g, "/");
  const match =
    normalized.match(/\/episodes\/([^/]+)\/cards\/[^/]+\/spec\.ts$/) ??
    normalized.match(/^\.\/([^/]+)\/cards\/[^/]+\/spec\.ts$/);

  return match?.[1] ?? null;
};

const loadEpisodeSpecsWithWebpackContext = (): Record<string, GlobCardModule> => {
  try {
    const webpackRequire = require as unknown as {
      context: (
        directory: string,
        useSubdirectories: boolean,
        regExp: RegExp,
      ) => RequireContext;
    };
    const context = webpackRequire.context(
      "../../episodes",
      true,
      /^\.\/[^/]+\/cards\/[^/]+\/spec\.ts$/,
    );

    return Object.fromEntries(
      context.keys().map((source: string) => [source, context(source) as GlobCardModule]),
    );
  } catch {
    return {};
  }
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
    // Remotion/webpack: fall back to statically imported engine cards plus
    // webpack require.context discovery for series-scoped custom cards.
    engineSpecs = ENGINE_STATIC_SPECS;
    episodeSpecs = loadEpisodeSpecsWithWebpackContext();
  }
  const allSeriesIds = Object.keys(episodeSpecs)
    .map(extractSeriesIdFromSpecSource)
    .filter((id): id is string => id !== null);
  const filteredEpisodeSpecs = Object.fromEntries(
    Object.entries(episodeSpecs).filter(([source]) => {
      const seriesId = extractSeriesIdFromSpecSource(source);
      return seriesId === null || !isHiddenTemplateSeries(seriesId, allSeriesIds);
    }),
  );
  const registry = new Map<string, CardSpec<unknown>>();
  const engineTypes = new Set<string>();

  for (const [, mod] of Object.entries(engineSpecs)) {
    const spec = mod.cardSpec;
    if (!spec) continue;
    registry.set(spec.type, spec);
    engineTypes.add(spec.type);
  }

  for (const [source, mod] of Object.entries(filteredEpisodeSpecs)) {
    const spec = mod.cardSpec;
    if (!spec) continue;

    if (registry.has(spec.type) && !engineTypes.has(spec.type)) {
      throw new Error(
        `[card-registry] Duplicate card type "${spec.type}" from ${source}.`,
      );
    }

    // Series-scoped card overrides engine card when types match (silent replace).
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
