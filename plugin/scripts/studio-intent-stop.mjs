import fs from 'fs';
import path from 'path';
import process from 'process';

function pickIntentDir(root) {
  const studioDir = path.join(root, '.ars', 'studio-intents');
  if (fs.existsSync(studioDir) && fs.statSync(studioDir).isDirectory()) {
    return studioDir;
  }
  const legacyDir = path.join(root, '.ars', 'review-intents');
  if (fs.existsSync(legacyDir) && fs.statSync(legacyDir).isDirectory()) {
    return legacyDir;
  }
  return null;
}

function main() {
  const intentDir = pickIntentDir(process.cwd());
  if (!intentDir) {
    return;
  }

  const sessionEndFlagPath = path.join(intentDir, '_session-end.flag');
  const hasSessionEndFlag = fs.existsSync(sessionEndFlagPath);

  const entries = fs.readdirSync(intentDir, { withFileTypes: true });
  let pendingCount = 0;

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) {
      continue;
    }

    const filePath = path.join(intentDir, entry.name);
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (parsed && typeof parsed === 'object' && !Object.hasOwn(parsed, 'processedAt')) {
        pendingCount += 1;
      }
    } catch {
      continue;
    }
  }

  if (hasSessionEndFlag) {
    console.log(
      `ARS: Studio session completed with ${pendingCount} pending intents. Run /ars:apply-review all to batch-process all fixes.`,
    );
    return;
  }

  if (pendingCount > 0) {
    console.log(
      `ARS: You have ${pendingCount} unprocessed studio intent(s). Run /ars:apply-review latest to process them.`,
    );
  }
}

main();
