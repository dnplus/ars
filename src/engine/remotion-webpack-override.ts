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
  // When running via `npx ars export cover` from an external user repo,
  // ARS_PACKAGE_ROOT points to the ARS package so webpack can resolve
  // remotion and other deps from ARS node_modules.
  const extraModuleDirs: string[] = [];
  if (process.env.ARS_PACKAGE_ROOT) {
    extraModuleDirs.push(`${process.env.ARS_PACKAGE_ROOT}/node_modules`);
  }

  return {
    ...config,
    resolve: {
      ...config.resolve,
      modules: [...extraModuleDirs, ...(config.resolve?.modules || ['node_modules'])],
      alias: {
        ...config.resolve?.alias,
        'react-native$': 'react-native-web',
      },
    },
    resolveLoader: {
      ...config.resolveLoader,
      modules: [...extraModuleDirs, ...(config.resolveLoader?.modules || ['node_modules'])],
    },
  };
}
