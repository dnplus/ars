/**
 * @module layouts/index
 * @description Layout 註冊中心
 */

import type { ComponentType } from "react";
import type { StreamingLayoutProps } from "./StreamingLayout";
import { layoutSpec as streamingLayoutSpec } from "./StreamingLayout";
import { layoutSpec as shortsLayoutSpec } from "./ShortsLayout";

export type LayoutComponent = ComponentType<StreamingLayoutProps>;
export type BuiltInLayoutKey = "streaming" | "shorts";
export type LayoutReference = BuiltInLayoutKey | LayoutComponent;
export type LayoutSpec = {
  type: BuiltInLayoutKey;
  component: LayoutComponent;
  description?: string;
};

const BUILT_IN_LAYOUT_SPECS: Record<string, LayoutSpec> = {
  "./StreamingLayout.tsx": streamingLayoutSpec,
  "./ShortsLayout.tsx": shortsLayoutSpec,
};

const collect = (): Map<BuiltInLayoutKey, LayoutSpec> => {
  const registry = new Map<BuiltInLayoutKey, LayoutSpec>();

  for (const [source, spec] of Object.entries(BUILT_IN_LAYOUT_SPECS)) {
    if (registry.has(spec.type)) {
      throw new Error(
        `[layout-registry] Duplicate layout type "${spec.type}" from ${source}.`,
      );
    }

    registry.set(spec.type, spec);
  }

  return registry;
}

export const BUILT_IN_LAYOUT_REGISTRY = collect();

const isBuiltInLayout = (
  value: LayoutReference,
): value is BuiltInLayoutKey => typeof value === "string";

const getBuiltInLayout = (key: BuiltInLayoutKey): LayoutSpec => {
  const spec = BUILT_IN_LAYOUT_REGISTRY.get(key);

  if (!spec) {
    throw new Error(`[layout-registry] Unknown layout type "${key}".`);
  }

  return spec;
};

export const resolveLayout = (layout: LayoutReference): LayoutComponent => {
  if (isBuiltInLayout(layout)) {
    return getBuiltInLayout(layout).component;
  }

  return layout;
};

export const getLayoutKey = (
  layout: LayoutReference,
): BuiltInLayoutKey | null => (isBuiltInLayout(layout) ? layout : null);

export * from "./StreamingLayout";
