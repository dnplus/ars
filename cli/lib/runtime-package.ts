import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

export interface RuntimePackageInfo {
  name: string;
  version: string;
  packageRoot: string;
  pluginRoot: string;
}

interface PackageJsonLike {
  name?: unknown;
  version?: unknown;
}

const PACKAGE_NAME = 'agentic-remotion-studio';

export function getRuntimePackageInfo(importMetaUrl: string): RuntimePackageInfo {
  const packageRoot = locatePackageRoot(importMetaUrl);
  const packageJsonPath = path.join(packageRoot, 'package.json');
  const packageJson = JSON.parse(
    fs.readFileSync(packageJsonPath, 'utf-8'),
  ) as PackageJsonLike;

  const name =
    typeof packageJson.name === 'string' && packageJson.name.trim()
      ? packageJson.name.trim()
      : PACKAGE_NAME;
  const version =
    typeof packageJson.version === 'string' && packageJson.version.trim()
      ? packageJson.version.trim()
      : '0.0.0';
  const pluginRoot = path.join(packageRoot, 'plugin');

  return {
    name,
    version,
    packageRoot,
    pluginRoot,
  };
}

function locatePackageRoot(importMetaUrl: string): string {
  const startDir = path.dirname(fileURLToPath(importMetaUrl));
  let currentDir = startDir;
  let fallbackRoot: string | null = null;

  while (true) {
    const packageJsonPath = path.join(currentDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const pkg = JSON.parse(
          fs.readFileSync(packageJsonPath, 'utf-8'),
        ) as PackageJsonLike;
        if (pkg.name === PACKAGE_NAME) {
          return currentDir;
        }
      } catch {
        // Keep traversing upward.
      }

      if (!fallbackRoot && hasArsSourceLayout(currentDir)) {
        fallbackRoot = currentDir;
      }
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  if (fallbackRoot) {
    return fallbackRoot;
  }

  throw new Error(
    `Could not locate ${PACKAGE_NAME} package root from ${startDir}.`,
  );
}

function hasArsSourceLayout(root: string): boolean {
  return (
    fs.existsSync(path.join(root, 'plugin', '.claude-plugin', 'plugin.json')) &&
    fs.existsSync(path.join(root, 'src', 'engine'))
  );
}
