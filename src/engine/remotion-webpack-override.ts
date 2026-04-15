/**
 * Shared Remotion webpack override.
 *
 * Handles:
 * 1. react-native → react-native-web alias
 *
 * Theme 不再需要 bare import 魔法 — 各 series-config.ts 直接 inline theme，
 * 由 ThemeProvider 在 runtime 注入。
 *
 * Usage in remotion.config.ts:
 *   import { sharedWebpackOverride } from './src/engine/remotion-webpack-override';
 *   Config.overrideWebpackConfig(sharedWebpackOverride);
 */

type WebpackConfig = Record<string, any>;

export function sharedWebpackOverride(config: WebpackConfig): WebpackConfig {
  return {
    ...config,
    resolve: {
      ...config.resolve,
      modules: [...(config.resolve?.modules || ['node_modules'])],
      alias: {
        ...config.resolve?.alias,
        'react-native$': 'react-native-web',
      },
    },
  };
}
