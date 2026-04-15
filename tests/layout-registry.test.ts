import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import {
  BUILT_IN_LAYOUT_REGISTRY,
  getBuiltInLayout,
  getLayoutKey,
  isBuiltInLayout,
  resolveLayout,
  type LayoutComponent,
  type BuiltInLayoutKey,
} from '../src/engine/layouts';
import { ShortsLayout } from '../src/engine/layouts/ShortsLayout';
import { StreamingLayout } from '../src/engine/layouts/StreamingLayout';

const CustomLayout: LayoutComponent = ({ children }): ReactNode => children;

describe('layout registry', () => {
  it('collects the built-in layout specs', () => {
    expect([...BUILT_IN_LAYOUT_REGISTRY.keys()]).toEqual([
      'streaming',
      'shorts',
    ]);
    expect(getBuiltInLayout('streaming').component).toBe(StreamingLayout);
    expect(getBuiltInLayout('shorts').component).toBe(ShortsLayout);
  });

  it('resolves built-in keys and direct component references', () => {
    expect(resolveLayout('streaming')).toBe(StreamingLayout);
    expect(resolveLayout('shorts')).toBe(ShortsLayout);
    expect(resolveLayout(CustomLayout)).toBe(CustomLayout);
  });

  it('reports the built-in key only for built-in layouts', () => {
    expect(isBuiltInLayout('streaming')).toBe(true);
    expect(getLayoutKey('shorts')).toBe('shorts');
    expect(getLayoutKey(CustomLayout)).toBeNull();
  });

  it('throws for unknown built-in layout keys', () => {
    expect(() =>
      getBuiltInLayout('unknown' as BuiltInLayoutKey),
    ).toThrow('[layout-registry] Unknown layout type "unknown".');
  });
});
