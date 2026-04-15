import type { CardSpec } from "./types";

type GlobCardModule = {
  cardSpec: CardSpec<unknown>;
};

type StepLike = {
  type?: string;
  contentType?: string;
  data?: unknown;
};

const collect = (): Map<string, CardSpec<unknown>> => {
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

export const validateStep = (step: StepLike) => {
  const type = step.type ?? step.contentType;

  if (!type) {
    throw new Error("[card-registry] Step is missing type/contentType.");
  }

  const card = getCard(type);
  const rawData = step.data ?? {};

  if (!card.schema) {
    return {
      card,
      data: rawData,
    };
  }

  const result = card.schema.safeParse(rawData);

  if (!result.success) {
    throw new Error(
      `[card-registry] Invalid data for "${type}": ${result.error.message}`,
    );
  }

  return {
    card,
    data: result.data,
  };
};
