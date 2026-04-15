export type CardStatus = "active" | "legacy" | "deprecated";

export type CardRegistryEntry = {
  type: string;
  status: CardStatus;
  generalPurpose?: boolean;
  replacement?: string;
};

export const CARD_CATALOG: CardRegistryEntry[] = [
  { type: "cover", status: "active", generalPurpose: true },
  { type: "text", status: "deprecated", replacement: "markdown" },
  { type: "code", status: "active", generalPurpose: true },
  { type: "image", status: "active", generalPurpose: true },
  { type: "mermaid", status: "active", generalPurpose: true },
  { type: "markdown", status: "active", generalPurpose: true },
  { type: "summary", status: "active", generalPurpose: true },
  { type: "ticker", status: "active", generalPurpose: true },
];

export const CARD_CATALOG_BY_TYPE = new Map(
  CARD_CATALOG.map((entry) => [entry.type, entry]),
);

export const AVAILABLE_CARD_TYPES = CARD_CATALOG.map((entry) => entry.type);

export const GENERAL_PURPOSE_CARD_TYPES = new Set(
  CARD_CATALOG.filter((entry) => entry.generalPurpose).map((entry) => entry.type),
);

export const LEGACY_CARD_TYPES = new Set(
  CARD_CATALOG.filter((entry) => entry.status === "legacy").map((entry) => entry.type),
);

export const DEPRECATED_CARD_TYPES = new Set(
  CARD_CATALOG.filter((entry) => entry.status === "deprecated").map((entry) => entry.type),
);
