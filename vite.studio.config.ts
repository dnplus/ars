/**
 * @file vite.studio.config.ts
 * @description Root studio config — delegates to engine base config.
 */
import { createStudioConfig } from './src/engine/vite-studio-base';

export default createStudioConfig({ port: 5174 });
