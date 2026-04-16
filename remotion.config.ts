/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";
import { sharedWebpackOverride } from './src/engine/remotion-webpack-override';

Config.setVideoImageFormat("jpeg");
Config.setOverwriteOutput(true);
Config.setChromiumOpenGlRenderer("angle");

Config.overrideWebpackConfig((currentConfiguration) => {
    return sharedWebpackOverride(currentConfiguration);
});
