/**
 * @file vite.slides.config.ts
 * @description Root slides config — delegates to engine base config.
 */
import { createSlidesConfig } from './src/engine/vite-slides-base';

export default createSlidesConfig({ port: 5174 });
