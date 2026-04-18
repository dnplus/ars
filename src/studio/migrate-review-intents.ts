import fs from 'fs';
import path from 'path';
import type { StudioIntent, StudioIntentTarget } from '../types/studio-intent';

const LEGACY_INTENTS_DIR = '.ars/review-intents';
const NEW_INTENTS_DIR = '.ars/studio-intents';
const LEGACY_ASSETS_DIR = '.ars/review-assets';
const NEW_ASSETS_DIR = '.ars/studio-assets';

interface MigrationResult {
  intentsMigrated: number;
  assetsMigrated: number;
  skipped: boolean;
  reason?: string;
}

/**
 * One-shot migration of legacy `.ars/review-intents/*.json` and `.ars/review-assets/`
 * into the new `.ars/studio-intents/` and `.ars/studio-assets/` directories.
 *
 * - Idempotent: skips when target dir exists and already has files
 * - Legacy files are renamed with `.migrated` suffix instead of deleted, so
 *   external watchers can still see them disappear from their original names
 * - Legacy `_session-end.flag` is copied (not renamed) to preserve the signal
 *   for both the legacy stop hook and the new one during transition
 */
export function migrateReviewIntents(rootDir = process.cwd()): MigrationResult {
  const result: MigrationResult = { intentsMigrated: 0, assetsMigrated: 0, skipped: false };
  const legacyIntentsAbs = path.join(rootDir, LEGACY_INTENTS_DIR);
  const newIntentsAbs = path.join(rootDir, NEW_INTENTS_DIR);

  if (!fs.existsSync(legacyIntentsAbs)) {
    result.skipped = true;
    result.reason = 'no legacy review-intents dir';
  } else if (hasJsonFiles(newIntentsAbs)) {
    result.skipped = true;
    result.reason = 'studio-intents already populated';
  } else {
    fs.mkdirSync(newIntentsAbs, { recursive: true });
    for (const entry of fs.readdirSync(legacyIntentsAbs, { withFileTypes: true })) {
      if (!entry.isFile()) continue;
      const legacyPath = path.join(legacyIntentsAbs, entry.name);

      if (entry.name === '_session-end.flag') {
        fs.copyFileSync(legacyPath, path.join(newIntentsAbs, entry.name));
        continue;
      }

      if (!entry.name.endsWith('.json')) continue;

      try {
        const raw = fs.readFileSync(legacyPath, 'utf-8');
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const migrated = normalizeLegacyIntent(parsed);
        fs.writeFileSync(
          path.join(newIntentsAbs, entry.name),
          `${JSON.stringify(migrated, null, 2)}\n`,
          'utf-8',
        );
        fs.renameSync(legacyPath, `${legacyPath}.migrated`);
        result.intentsMigrated += 1;
      } catch {
        // Skip unreadable / malformed files; do not block migration
      }
    }
  }

  result.assetsMigrated = migrateAssetsDir(rootDir);
  return result;
}

function migrateAssetsDir(rootDir: string): number {
  const legacyAbs = path.join(rootDir, LEGACY_ASSETS_DIR);
  const newAbs = path.join(rootDir, NEW_ASSETS_DIR);

  if (!fs.existsSync(legacyAbs)) return 0;
  if (fs.existsSync(newAbs) && fs.readdirSync(newAbs).length > 0) return 0;

  fs.mkdirSync(newAbs, { recursive: true });
  let count = 0;
  copyTreeRecursive(legacyAbs, newAbs, () => {
    count += 1;
  });
  return count;
}

function copyTreeRecursive(srcDir: string, destDir: string, onFile: () => void): void {
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyTreeRecursive(srcPath, destPath, onFile);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
      onFile();
    }
  }
}

function hasJsonFiles(dir: string): boolean {
  if (!fs.existsSync(dir)) return false;
  return fs.readdirSync(dir).some((name) => name.endsWith('.json'));
}

function normalizeLegacyIntent(parsed: Record<string, unknown>): StudioIntent {
  const target = (parsed.target ?? {}) as Record<string, unknown>;
  const stepId = typeof target.stepId === 'string' ? target.stepId : undefined;
  const explicitAnchorType = typeof target.anchorType === 'string' ? target.anchorType as StudioIntentTarget['anchorType'] : undefined;
  const explicitAnchorId = typeof target.anchorId === 'string' ? target.anchorId : undefined;
  const anchorType: StudioIntentTarget['anchorType'] = explicitAnchorType ?? (stepId ? 'step' : 'episode');
  const anchorId = explicitAnchorId ?? stepId ?? 'unknown';

  return {
    version: 1,
    id: typeof parsed.id === 'string' ? parsed.id : `migrated-${Date.now()}`,
    target: {
      series: typeof target.series === 'string' ? target.series : 'unknown',
      epId: typeof target.epId === 'string' ? target.epId : 'unknown',
      anchorType,
      anchorId,
      stepId,
    },
    source: (parsed.source ?? { ui: 'review' }) as StudioIntent['source'],
    feedback: (parsed.feedback ?? { kind: 'other', message: '', severity: 'medium' }) as StudioIntent['feedback'],
    attachments: parsed.attachments as StudioIntent['attachments'],
    processedAt: typeof parsed.processedAt === 'string' ? parsed.processedAt : undefined,
  };
}
