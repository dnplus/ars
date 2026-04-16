// Global type declarations for the project

declare module 'react-dom/client';
declare module 'react-native' {
  export type NodeHandle = number;
  export const ViewComponent: unknown;
  export const View: unknown;
  export const Platform: {
    OS: string;
  };
  export const PixelRatio: {
    get(): number;
  };
  export const Image: {
    resolveAssetSource(source: unknown): {
      uri: string;
    };
  };
  export function findNodeHandle(...args: unknown[]): NodeHandle | null;
}

declare module 'react-native-reanimated' {
  export interface SharedValue<T = unknown> {
    value: T;
  }
}

/**
 * Webpack require.context — available at bundle time, not in Node/TS static analysis.
 */
interface RequireContext {
  keys(): string[];
  (id: string): unknown;
  resolve(id: string): string;
  id: string;
}

interface Require {
  context(
    directory: string,
    useSubdirectories: boolean,
    regExp: RegExp
  ): RequireContext;
}

// bare `import 'theme'` 已移除 — theme 現在透過 ThemeContext 注入
// 如果看到 import 'theme' 的 compile error，改用 useTheme() hook
