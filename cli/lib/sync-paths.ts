/**
 * @module cli/lib/sync-paths
 *
 * Single source of truth for "which files in this repo are ARS-owned".
 *
 * `npx ars init` and `npx ars update` both need to copy a defined set of files
 * from the installed ARS package into a consumer repo. Historically those two
 * sets diverged: `src/` was negative-listed (sync everything except a few
 * carve-outs), while `cli/` and the support files (`vite.studio.config.ts`,
 * `tsconfig.json`, etc.) were positive-listed file by file in install.ts.
 * Every time someone added a new top-level directory or a new CLI command,
 * `update` silently failed to ship it until the allow-list got patched (4+
 * post-hoc fixes in git history).
 *
 * The fix: read `package.json#files` as the canonical inventory of "what npm
 * publishes from this repo" (which IS what consumer repos should receive),
 * apply a small negative list of carve-outs that npm publishes for source-tree
 * reasons but consumers must not get (tests, fixtures, user content slots),
 * and let init/update walk the result.
 *
 * Result: adding any new file to the npm package surface automatically lands
 * in consumer repos on next update. No more "update missed X" patches.
 */
import fs from 'fs';
import path from 'path';

/**
 * Carve-outs WITHIN ARS-owned paths that must NOT be copied into consumer
 * repos. These are paths that npm publishes (because they live under an
 * included directory like `cli/` or `src/`) but the consumer should never
 * receive a copy of.
 *
 * Each entry is a path RELATIVE to the package root, matched as a prefix.
 * Trailing slash means "directory only"; no trailing slash means exact file.
 *
 * Carve-back-in: any path that matches a `SYNC_INCLUDE_OVERRIDES` prefix is
 * kept even if a SYNC_EXCLUDES rule would otherwise drop it. This is how
 * `src/episodes/template/` survives the broad `src/episodes/` exclude that
 * protects user series content.
 */
const SYNC_EXCLUDES: readonly string[] = [
  // Dev-only test infrastructure that ships in the npm tarball for source-map
  // / typecheck reasons but consumer repos run their own tests.
  'cli/__tests__/',
  'cli/__fixtures__/',
  'cli/test-utils/',
  'src/__tests__/',
  'src/__fixtures__/',
  'src/test-utils/',
  'src/internal/',
  // User content slot — only the `template/` subdirectory is ARS-owned (see
  // SYNC_INCLUDE_OVERRIDES); the rest of `src/episodes/` and
  // `public/episodes/` is never overwritten.
  'src/episodes/',
  'public/episodes/',
  // Plugin assets are synced through dedicated functions
  // (syncSkills / syncAgents / syncHookScripts) into different consumer
  // locations (.claude/, .ars/hooks/), so the package-relative copy of
  // `plugin/` must not be cloned wholesale into the consumer's `plugin/`.
  'plugin/',
];

/**
 * Path prefixes that are kept even if a SYNC_EXCLUDES rule would drop them.
 * These are the carve-back-in's that allow narrow ARS-owned subtrees inside
 * an otherwise-protected user-content area.
 */
const SYNC_INCLUDE_OVERRIDES: readonly string[] = [
  // Template series ships with the engine and is what `npx ars init <series>`
  // copies. Consumers receive it as a reference but should not edit it.
  'src/episodes/template/',
  // VTuber images and other public assets the template episode references.
  'public/episodes/template/',
];

/**
 * package.json#files entries to skip even before excludes. These are
 * single-file root entries that init/update handle through dedicated paths
 * and should not be processed by the generic walker.
 */
const SKIP_TOP_LEVEL_ENTRIES: ReadonlySet<string> = new Set([
  'README.md',
  'LICENSE',
  'persona.md',
]);

export type SyncCategory = 'engine' | 'support';

export interface ArsOwnedFile {
  /** Path relative to package/consumer root (POSIX-style, forward slashes). */
  relPath: string;
  /** Absolute source path inside the installed ARS package. */
  sourceAbs: string;
  /** Whether `update` should treat this as the engine (heavy hammer) or as a support file. */
  category: SyncCategory;
}

interface PackageJsonLike {
  files?: unknown;
}

function readPackageFiles(sourceRoot: string): string[] {
  const packageJsonPath = path.join(sourceRoot, 'package.json');
  const raw = fs.readFileSync(packageJsonPath, 'utf-8');
  const pkg = JSON.parse(raw) as PackageJsonLike;
  if (!Array.isArray(pkg.files)) {
    throw new Error(
      `${packageJsonPath} is missing a "files" array — sync needs it as the source of truth for ARS-owned paths.`,
    );
  }
  return pkg.files
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.replace(/\\/g, '/'));
}

function matchesPrefix(posix: string, prefix: string): boolean {
  if (prefix.endsWith('/')) {
    return posix === prefix.slice(0, -1) || posix.startsWith(prefix);
  }
  return posix === prefix;
}

/**
 * Returns true if `dirRel` is an ancestor of any SYNC_INCLUDE_OVERRIDES path.
 * Used by the walker to keep descending into a directory that is otherwise
 * excluded so it can reach a carve-back-in subtree (e.g. descend into
 * `src/episodes/` even though the dir itself is excluded, because
 * `src/episodes/template/` is included).
 */
function ancestorOfIncludeOverride(dirRel: string): boolean {
  const dirWithSlash = dirRel.endsWith('/') ? dirRel : `${dirRel}/`;
  return SYNC_INCLUDE_OVERRIDES.some((include) => include.startsWith(dirWithSlash));
}

function isExcluded(relPath: string): boolean {
  // Match excludes as path prefixes. Always compare in POSIX form.
  const posix = relPath.replace(/\\/g, '/');

  // Override wins: `src/episodes/template/foo.ts` is ARS-owned even though
  // the broad `src/episodes/` rule would otherwise drop it.
  for (const include of SYNC_INCLUDE_OVERRIDES) {
    if (matchesPrefix(posix, include)) return false;
  }

  for (const exclude of SYNC_EXCLUDES) {
    if (matchesPrefix(posix, exclude)) return true;
  }
  return false;
}

function categorize(relPath: string): SyncCategory {
  // `src/engine/` is the only path that follows the heavier --force-engine
  // hammer; everything else goes through --force support files.
  return relPath === 'src/engine' || relPath.startsWith('src/engine/')
    ? 'engine'
    : 'support';
}

function joinPosix(...parts: string[]): string {
  return parts.filter(Boolean).join('/').replace(/\/+/g, '/');
}

/**
 * Walk the ARS-owned path inventory, yielding one entry per file or directory
 * that init/update should sync into a consumer repo. Excludes are applied
 * before yielding.
 *
 * Directory entries are yielded as a single ArsOwnedFile (the caller copies
 * the whole tree); file entries are yielded individually.
 */
export function iterArsOwnedFiles(sourceRoot: string): ArsOwnedFile[] {
  const entries = readPackageFiles(sourceRoot);
  const out: ArsOwnedFile[] = [];

  for (const rawEntry of entries) {
    if (SKIP_TOP_LEVEL_ENTRIES.has(rawEntry)) continue;

    // Strip trailing slash for normalization but remember if it was a dir.
    const declaredDir = rawEntry.endsWith('/');
    const norm = declaredDir ? rawEntry.slice(0, -1) : rawEntry;
    const sourceAbs = path.join(sourceRoot, norm);

    if (!fs.existsSync(sourceAbs)) {
      // Some entries (e.g. .env.example for older releases) may be optional;
      // skip silently rather than crashing the sync.
      continue;
    }

    const stat = fs.statSync(sourceAbs);
    if (stat.isDirectory()) {
      // Walk every file within so the consumer-side callers can apply
      // per-file exclude logic without re-implementing tree traversal.
      walkDirectoryForOwnedFiles(sourceRoot, norm, out);
    } else if (stat.isFile()) {
      if (isExcluded(norm)) continue;
      out.push({
        relPath: norm,
        sourceAbs,
        category: categorize(norm),
      });
    }
  }

  return out;
}

function walkDirectoryForOwnedFiles(
  sourceRoot: string,
  relDir: string,
  out: ArsOwnedFile[],
): void {
  const absDir = path.join(sourceRoot, relDir);
  for (const dirent of fs.readdirSync(absDir, { withFileTypes: true })) {
    const childRel = joinPosix(relDir, dirent.name);
    const childAbs = path.join(absDir, dirent.name);

    if (dirent.isDirectory()) {
      // Keep descending if the directory is either not excluded OR is an
      // ancestor of a carve-back-in path. This lets the walker reach
      // `src/episodes/template/` even though `src/episodes/` is excluded.
      if (isExcluded(childRel) && !ancestorOfIncludeOverride(childRel)) continue;
      walkDirectoryForOwnedFiles(sourceRoot, childRel, out);
    } else if (dirent.isFile()) {
      if (isExcluded(childRel)) continue;
      out.push({
        relPath: childRel,
        sourceAbs: childAbs,
        category: categorize(childRel),
      });
    }
  }
}

/**
 * Returns true if the package's npm `files` array would publish the given
 * relative path. Used by tests and by the audit-style helpers that check
 * "does my new file actually ship?".
 */
export function isArsOwnedPath(sourceRoot: string, relPath: string): boolean {
  const norm = relPath.replace(/\\/g, '/');
  if (isExcluded(norm)) return false;
  return iterArsOwnedFiles(sourceRoot).some((entry) => entry.relPath === norm);
}

/**
 * Re-export the exclude list so tests / audit tooling can introspect it
 * without duplicating the constant.
 */
export const SYNC_EXCLUDE_PATTERNS: readonly string[] = SYNC_EXCLUDES;
