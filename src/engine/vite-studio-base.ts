/**
 * @file vite-studio-base.ts
 * @description Shared Vite config for ARS Studio.
 *              Runs from root dir; uses SERIES env to resolve theme path.
 *
 * Usage:
 *   import { createStudioConfig } from './src/engine/vite-studio-base';
 *   export default createStudioConfig({ port: 5174 });
 */
import { defineConfig, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { createReviewIntent } from '../review/review-intents';

export interface StudioConfigOptions {
  /** Dev server port (each project should use a unique port) */
  port: number;
}

export function createStudioConfig(options: StudioConfigOptions): UserConfig {
  // When launched via `npx ars review open`, ARS_REPO_ROOT points to the user's
  // content repo. Fall back to process.cwd() for local ARS development.
  const rootDir = process.env.ARS_REPO_ROOT ?? process.cwd();
  const fixAppliedEntries = new Map<string, FixAppliedEntry>();
  let latestFixApplied: FixAppliedEntry | null = null;

  // SERIES/EP 由 CLI review.ts 傳入，用於自動開啟 URL
  const series = process.env.SERIES || 'template';
  const targetEp = process.env.EP || '';
  const targetStep = process.env.STEP || '';
  const openParams = new URLSearchParams();
  if (series) openParams.set('series', series);
  if (targetEp) openParams.set('ep', targetEp);
  if (targetStep) openParams.set('step', targetStep);
  const openPath = targetEp ? `/?${openParams.toString()}` : true;

  // When launched via `npx ars review open`, ARS_PACKAGE_ROOT points to the ARS package.
  // Fall back to resolving from import.meta.url for local ARS development.
  const arsPackageRoot = process.env.ARS_PACKAGE_ROOT
    ?? path.resolve(new URL(import.meta.url).pathname, '..', '..', '..');
  const arsModulesDir = path.join(arsPackageRoot, 'node_modules');

  return defineConfig({
    root: path.resolve(rootDir, 'src'),
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
              const target = {
                series: asRequiredString(body.series, 'series'),
                epId: asRequiredString(body.epId, 'epId'),
                stepId: asRequiredString(body.stepId, 'stepId'),
              };
              const record = createReviewIntent({
                target,
                source: {
                  ui: asReviewUi(body.from ?? body.ui ?? 'studio'),
                  hash: asOptionalString(body.hash),
                },
                feedback: {
                  kind: asReviewKind(body.kind ?? 'other'),
                  message: asRequiredString(body.message, 'message'),
                  severity: asReviewSeverity(body.severity ?? 'medium'),
                },
                attachments: persistReviewAttachments(body, rootDir, target),
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

            if (url.pathname === '/__ars/review-intents') {
              if (req.method !== 'GET') {
                writeJson(res, 405, { ok: false, error: 'Method not allowed' });
                return;
              }

              try {
                const reviewDir = path.join(rootDir, '.ars', 'review-intents');
                if (!fs.existsSync(reviewDir)) {
                  writeJson(res, 200, { ok: true, intents: [] });
                  return;
                }

                const fileNames = fs.readdirSync(reviewDir)
                  .filter((fileName) => fileName.endsWith('.json'))
                  .sort((a, b) => b.localeCompare(a));

                const intents = fileNames.map((fileName) => {
                  const raw = fs.readFileSync(path.join(reviewDir, fileName), 'utf-8');
                  return JSON.parse(raw) as unknown;
                });

                writeJson(res, 200, { ok: true, intents });
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
        name: 'studio-html',
        configureServer(server: any) {
          server.middlewares.use((req: any, _res: any, next: any) => {
            const url = new URL(req.url, 'http://localhost');
            if (url.pathname === '/' || url.pathname === '/index.html') {
              req.url = '/studio.html' + url.search;
            }
            next();
          });
        },
      },
    ],
    resolve: {
      alias: [
        // When running in external user repo, redirect all node_modules lookups
        // to ARS package's node_modules so vite can find react, remotion, etc.
        ...(process.env.ARS_PACKAGE_ROOT ? [
          { find: /^react\/(.*)/, replacement: path.join(arsModulesDir, 'react', '$1') },
          { find: 'react', replacement: path.join(arsModulesDir, 'react') },
          { find: 'react-dom/client', replacement: path.join(arsModulesDir, 'react-dom', 'client') },
          { find: 'react-dom', replacement: path.join(arsModulesDir, 'react-dom') },
          { find: 'remotion', replacement: path.join(arsModulesDir, 'remotion') },
          { find: '@remotion/player', replacement: path.join(arsModulesDir, '@remotion', 'player') },
          { find: 'mermaid', replacement: path.join(arsModulesDir, 'mermaid') },
          { find: 'prism-react-renderer', replacement: path.join(arsModulesDir, 'prism-react-renderer') },
          { find: 'react-markdown', replacement: path.join(arsModulesDir, 'react-markdown') },
          { find: 'remark-gfm', replacement: path.join(arsModulesDir, 'remark-gfm') },
          { find: 'remark-breaks', replacement: path.join(arsModulesDir, 'remark-breaks') },
          { find: 'qrcode.react', replacement: path.join(arsModulesDir, 'qrcode.react') },
        ] : []),
        // Mock only packages that have no web-compatible real implementation
        { find: '@remotion/google-fonts/NotoSansTC', replacement: path.resolve(rootDir, 'src/engine/studio/mocks/remotion-google-fonts.ts') },
        { find: '@remotion/media', replacement: path.resolve(rootDir, 'src/engine/studio/mocks/remotion-media.ts') },
        { find: '@remotion/media-utils', replacement: path.resolve(rootDir, 'src/engine/studio/mocks/remotion-media-utils.ts') },
        { find: '@remotion/three', replacement: path.resolve(rootDir, 'src/engine/studio/mocks/remotion-three.tsx') },
        { find: '@shopify/react-native-skia', replacement: path.resolve(rootDir, 'src/engine/studio/mocks/react-native-skia.tsx') },
        { find: '@shopify/react-native-skia/src/web', replacement: path.resolve(rootDir, 'src/engine/studio/mocks/react-native-skia.tsx') },
      ],
    },
    build: {
      outDir: '../dist/studio',
      emptyOutDir: true,
      sourcemap: true,
      rollupOptions: {
        input: path.resolve(rootDir, 'src/studio.html'),
      },
    },
    server: {
      port: options.port,
      open: openPath,
      fs: {
        // Allow serving files from ARS package when running in external user repo
        allow: [rootDir, arsModulesDir],
      },
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

function persistReviewAttachments(
  body: Record<string, unknown>,
  rootDir: string,
  target: { series: string; epId: string; stepId: string },
) {
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

  if (screenshotDataUrl) {
    return {
      screenshotPath: writeReviewAttachmentFile(rootDir, target, screenshotDataUrl),
    };
  }

  return {
    screenshotPath,
  };
}

function writeReviewAttachmentFile(
  rootDir: string,
  target: { series: string; epId: string; stepId: string },
  screenshotDataUrl: string,
): string {
  const match = screenshotDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    throw new Error('Invalid review attachment image data.');
  }

  const [, mimeType, base64Payload] = match;
  const extension = imageMimeToExtension(mimeType);
  const attachmentDir = path.join(
    rootDir,
    '.ars',
    'review-assets',
    sanitizePathToken(target.series),
    sanitizePathToken(target.epId),
  );
  fs.mkdirSync(attachmentDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  const fileName = `${timestamp}-${sanitizePathToken(target.stepId)}.${extension}`;
  const filePath = path.join(attachmentDir, fileName);
  fs.writeFileSync(filePath, Buffer.from(base64Payload, 'base64'));
  return path.relative(rootDir, filePath).split(path.sep).join('/');
}

function imageMimeToExtension(mimeType: string): string {
  switch (mimeType.toLowerCase()) {
    case 'image/jpeg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    default:
      throw new Error(`Unsupported review attachment mime type: ${mimeType}`);
  }
}

function sanitizePathToken(value: string): string {
  const normalized = value.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-');
  return normalized.replace(/^-|-$/g, '') || 'attachment';
}

function asReviewUi(value: unknown): 'studio' {
  if (value === 'studio' || value === 'slides') {
    return 'studio';
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
