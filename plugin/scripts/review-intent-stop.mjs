import fs from 'fs';
import path from 'path';
import process from 'process';

function main() {
  const reviewIntentDir = path.join(process.cwd(), '.ars', 'review-intents');
  if (!fs.existsSync(reviewIntentDir) || !fs.statSync(reviewIntentDir).isDirectory()) {
    return;
  }

  const sessionEndFlagPath = path.join(reviewIntentDir, '_session-end.flag');
  const hasSessionEndFlag = fs.existsSync(sessionEndFlagPath);

  const entries = fs.readdirSync(reviewIntentDir, { withFileTypes: true });
  let pendingCount = 0;

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) {
      continue;
    }

    const filePath = path.join(reviewIntentDir, entry.name);
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
      `ARS: Review session completed with ${pendingCount} pending intents. Run /ars:apply-review all to batch-process all fixes.`,
    );
    return;
  }

  if (pendingCount > 0) {
    console.log(
      `ARS: You have ${pendingCount} unprocessed review intent(s). Run /ars:apply-review latest to process them.`,
    );
  }
}

main();
