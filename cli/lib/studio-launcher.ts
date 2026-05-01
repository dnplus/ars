/**
 * @module studio-launcher
 * @description Shared helper for spawning the Vite Studio dev server. Used by
 *              `ars studio` (this commit), `ars launch <epId>` (commit 7), and
 *              the deprecated `ars review open` shim (commit 8).
 */
import fs from 'fs';
import path from 'path';
import { spawn, type ChildProcess } from 'child_process';
import { createRequire } from 'module';
import { getRuntimePackageInfo } from './runtime-package';

export type StudioPhase = 'plan' | 'build' | 'review' | 'slide';

export interface OpenStudioOptions {
  series: string;
  epId: string;
  phase?: StudioPhase;
  port?: number;
  /** Repo root, defaults to cwd. */
  rootDir?: string;
  /** When true (default), CLI exits with the vite child's exit code. Set false when launch needs to keep running. */
  inheritExit?: boolean;
}

export interface OpenStudioResult {
  child: ChildProcess;
  url: string;
  port: number;
}

const DEFAULT_PORT = 5174;

export function openStudio(options: OpenStudioOptions): OpenStudioResult {
  const root = options.rootDir ?? process.cwd();
  const port = options.port ?? DEFAULT_PORT;
  const phase = options.phase ?? 'plan';
  const inheritExit = options.inheritExit ?? true;

  const { packageRoot: arsPackageRoot } = getRuntimePackageInfo(import.meta.url);
  const consumerViteConfig = path.join(root, 'vite.studio.config.ts');
  const arsViteConfig = path.join(arsPackageRoot, 'vite.studio.config.ts');

  const useConsumer = fs.existsSync(consumerViteConfig) && canResolveViteCli(root);
  const viteCli = useConsumer ? resolveViteCli(root) : resolveViteCli(arsPackageRoot);
  const viteConfigPath = useConsumer ? consumerViteConfig : arsViteConfig;

  const params = new URLSearchParams({ series: options.series, ep: options.epId, phase });
  const url = `http://localhost:${port}/?${params.toString()}`;

  console.log(`🚀 Studio (${phase}) for ${options.series}/${options.epId}`);
  console.log(`   ${url}`);

  const child = spawn(
    process.execPath,
    [viteCli, '--config', viteConfigPath, '--port', String(port)],
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        SERIES: options.series,
        EP: options.epId,
        PHASE: phase,
        ARS_REPO_ROOT: root,
        ARS_PACKAGE_ROOT: arsPackageRoot,
      },
      cwd: root,
    },
  );

  if (inheritExit) {
    child.on('close', (code) => {
      process.exit(code ?? 0);
    });
  }

  return { child, url, port };
}

function canResolveViteCli(packageRoot: string): boolean {
  try {
    resolveViteCli(packageRoot);
    return true;
  } catch {
    return false;
  }
}

function resolveViteCli(packageRoot: string): string {
  const require = createRequire(path.join(packageRoot, 'package.json'));
  const vitePackageJsonPath = require.resolve('vite/package.json');
  const vitePackage = JSON.parse(fs.readFileSync(vitePackageJsonPath, 'utf-8')) as {
    bin?: string | Record<string, string>;
  };
  const binRel = typeof vitePackage.bin === 'string'
    ? vitePackage.bin
    : vitePackage.bin?.vite;
  if (!binRel) {
    throw new Error(`Could not resolve vite CLI from ${vitePackageJsonPath}`);
  }
  return path.join(path.dirname(vitePackageJsonPath), binRel);
}
