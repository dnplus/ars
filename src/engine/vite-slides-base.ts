/**
 * @file vite-slides-base.ts
 * @description Shared Vite config for web slides.
 *              Runs from root dir; uses SERIES env to resolve theme path.
 *
 * Usage:
 *   import { createSlidesConfig } from './src/engine/vite-slides-base';
 *   export default createSlidesConfig({ port: 5174 });
 */
import { defineConfig, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { createReviewIntent } from '../review/review-intents';

export interface SlidesConfigOptions {
  /** Dev server port (each project should use a unique port) */
  port: number;
}

export function createSlidesConfig(options: SlidesConfigOptions): UserConfig {
  const rootDir = process.cwd();
  const fixAppliedEntries = new Map<string, FixAppliedEntry>();
  let latestFixApplied: FixAppliedEntry | null = null;

  // SERIES/EP 由 CLI slides.ts 傳入，用於自動開啟 URL
  const series = process.env.SERIES || 'template';
  const targetEp = process.env.EP || '';
  const targetStep = process.env.STEP || '';
  const openParams = new URLSearchParams();
  if (series) openParams.set('series', series);
  if (targetEp) openParams.set('ep', targetEp);
  if (targetStep) openParams.set('step', targetStep);
  const openPath = targetEp ? `/?${openParams.toString()}` : true;

  return defineConfig({
    root: 'src',
    base: '/',
    publicDir: path.resolve(rootDir, 'public'),
    define: {},
    plugins: [
      react(),
      {
        name: 'review-intent-api',
        configureServer(server: any) {
          server.middlewares.use(async (req: any, res: any, next: any) => {
            const url = new URL(req.url, 'http://localhost');
            if (url.pathname !== '/__ars/review-intent') {
              next();
              return;
            }

            if (req.method !== 'POST') {
              res.statusCode = 405;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
              return;
            }

            try {
              const body = await readJsonBody(req);
              const record = createReviewIntent({
                target: {
                  series: asRequiredString(body.series, 'series'),
                  epId: asRequiredString(body.epId, 'epId'),
                  stepId: asRequiredString(body.stepId, 'stepId'),
                },
                source: {
                  ui: asReviewUi(body.from ?? body.ui ?? 'slides'),
                  hash: asOptionalString(body.hash),
                },
                feedback: {
                  kind: asReviewKind(body.kind ?? 'other'),
                  message: asRequiredString(body.message, 'message'),
                  severity: asReviewSeverity(body.severity ?? 'medium'),
                },
                attachments: asReviewAttachments(body),
                rootDir,
              });

              res.statusCode = 201;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: true, intent: record.intent }));
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ ok: false, error: message }));
            }
          });
        },
      },
      {
        name: 'review-session-api',
        configureServer(server: any) {
          server.middlewares.use(async (req: any, res: any, next: any) => {
            const url = new URL(req.url, 'http://localhost');

            if (url.pathname === '/__ars/review-session-end') {
              if (req.method !== 'POST') {
                writeJson(res, 405, { ok: false, error: 'Method not allowed' });
                return;
              }

              try {
                const reviewIntentsDir = path.join(rootDir, '.ars', 'review-intents');
                fs.mkdirSync(reviewIntentsDir, { recursive: true });
                const intentCount = fs.readdirSync(reviewIntentsDir)
                  .filter((fileName) => fileName.endsWith('.json'))
                  .length;
                const payload = {
                  timestamp: new Date().toISOString(),
                  intentCount,
                };

                fs.writeFileSync(
                  path.join(reviewIntentsDir, '_session-end.flag'),
                  `${JSON.stringify(payload, null, 2)}\n`,
                  'utf-8',
                );

                writeJson(res, 200, { ok: true, intentCount });
              } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                writeJson(res, 500, { ok: false, error: message });
              }
              return;
            }

            if (url.pathname === '/__ars/fix-applied') {
              if (req.method === 'POST') {
                try {
                  const body = await readJsonBody(req);
                  const stepIds = asStepIds(body.stepIds);
                  const timestamp = new Date().toISOString();
                  const entry = { timestamp, stepIds };

                  fixAppliedEntries.set(timestamp, entry);
                  latestFixApplied = entry;

                  writeJson(res, 200, { ok: true });
                } catch (error) {
                  const message = error instanceof Error ? error.message : String(error);
                  writeJson(res, 400, { ok: false, error: message });
                }
                return;
              }

              if (req.method === 'GET') {
                writeJson(res, 200, { ok: true, latest: latestFixApplied });
                return;
              }

              writeJson(res, 405, { ok: false, error: 'Method not allowed' });
              return;
            }

            next();
          });
        },
      },
      // Custom plugin to serve slides.html as index
      {
        name: 'slides-html',
        configureServer(server: any) {
          server.middlewares.use((req: any, _res: any, next: any) => {
            const url = new URL(req.url, 'http://localhost');
            if (url.pathname === '/' || url.pathname === '/index.html') {
              req.url = '/slides.html' + url.search;
            }
            next();
          });
        },
      },
    ],
    resolve: {
      alias: {
        // Mock only packages that have no web-compatible real implementation
        '@remotion/google-fonts/NotoSansTC': path.resolve(rootDir, 'src/engine/slides/mocks/remotion-google-fonts.ts'),
        '@remotion/media': path.resolve(rootDir, 'src/engine/slides/mocks/remotion-media.ts'),
        '@remotion/media-utils': path.resolve(rootDir, 'src/engine/slides/mocks/remotion-media-utils.ts'),
        '@remotion/three': path.resolve(rootDir, 'src/engine/slides/mocks/remotion-three.tsx'),
        // Mock Skia for web
        '@shopify/react-native-skia': path.resolve(rootDir, 'src/engine/slides/mocks/react-native-skia.tsx'),
        '@shopify/react-native-skia/src/web': path.resolve(rootDir, 'src/engine/slides/mocks/react-native-skia.tsx'),
      },
    },
    build: {
      outDir: '../dist/slides',
      emptyOutDir: true,
      sourcemap: true,
      rollupOptions: {
        input: path.resolve(rootDir, 'src/slides.html'),
      },
    },
    server: {
      port: options.port,
      open: openPath,
    },
    optimizeDeps: {
      include: ['react', 'react-dom', 'mermaid', 'prism-react-renderer', 'react-markdown', 'remark-gfm', '@remotion/player'],
      exclude: ['@remotion/three'],
    },
  }) as UserConfig;
}

type FixAppliedEntry = {
  timestamp: string;
  stepIds: string[];
};

async function readJsonBody(req: NodeJS.ReadableStream): Promise<Record<string, unknown>> {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
  }

  if (!raw) {
    throw new Error('Missing JSON body.');
  }

  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('JSON body must be an object.');
  }

  return parsed as Record<string, unknown>;
}

function asRequiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Invalid "${field}" value.`);
  }

  return value.trim();
}

function asOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.trim() === '') {
    return undefined;
  }

  return value.trim();
}

function asReviewAttachments(body: Record<string, unknown>) {
  const attachmentsValue = body.attachments;
  const screenshotPath =
    asOptionalString(body.screenshotPath) ||
    (attachmentsValue && typeof attachmentsValue === 'object' && !Array.isArray(attachmentsValue)
      ? asOptionalString((attachmentsValue as Record<string, unknown>).screenshotPath)
      : undefined);
  const screenshotDataUrl =
    attachmentsValue && typeof attachmentsValue === 'object' && !Array.isArray(attachmentsValue)
      ? asOptionalString((attachmentsValue as Record<string, unknown>).screenshotDataUrl)
      : undefined;

  if (!screenshotPath && !screenshotDataUrl) {
    return undefined;
  }

  return {
    screenshotPath,
    screenshotDataUrl,
  };
}

function asReviewUi(value: unknown): 'slides' | 'studio-exp' {
  if (value === 'slides' || value === 'studio-exp') {
    return value;
  }

  throw new Error('Invalid review source ui.');
}

function asReviewKind(value: unknown): 'visual' | 'content' | 'timing' | 'other' {
  if (value === 'visual' || value === 'content' || value === 'timing' || value === 'other') {
    return value;
  }

  throw new Error('Invalid review feedback kind.');
}

function asReviewSeverity(value: unknown): 'low' | 'medium' | 'high' {
  if (value === 'low' || value === 'medium' || value === 'high') {
    return value;
  }

  throw new Error('Invalid review feedback severity.');
}

function asStepIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('Invalid "stepIds" value.');
  }

  const stepIds = value.map((entry) => asRequiredString(entry, 'stepIds[]'));
  return Array.from(new Set(stepIds));
}

function writeJson(
  res: {
    statusCode: number;
    setHeader(name: string, value: string): void;
    end(body: string): void;
  },
  statusCode: number,
  payload: Record<string, unknown>,
) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}
