import process from 'process';

const TRIGGER_RULES = [
  {
    keywords: ['scene plan', '寫稿'],
    suggestion:
      'ARS: Detected planning intent. Use /ars:scene-plan <series>/<epId> to generate a read-only plan artifact in .ars/scene-plans/ before editing episode content.',
  },
  {
    keywords: ['scene build'],
    suggestion:
      'ARS: Detected build intent. Use /ars:scene-build <series>/<epId> and apply the chosen plan variant strictly instead of inventing new scene structure.',
  },
  {
    keywords: ['scene polish'],
    suggestion:
      'ARS: Detected polish intent. Use /ars:scene-polish <series>/<epId> and limit changes to tier B steps only.',
  },
  {
    keywords: ['scene fix'],
    suggestion:
      'ARS: Detected fix intent. Use /ars:scene-fix [<intent-id>|latest] to process one review intent and validate the episode after the patch.',
  },
  {
    keywords: ['review'],
    suggestion:
      'ARS: Detected review intent. Use /ars:review-open <epId> to open review UI, then /ars:scene-fix latest after a review intent is created.',
  },
  {
    keywords: ['publish', '發布'],
    suggestion:
      'ARS: Detected publish intent. Run /ars:prepare-youtube <epId> first, wait for human confirmation, then use /ars:publish-youtube <epId>.',
  },
];

async function main() {
  const raw = await readStdin();
  if (!raw.trim()) {
    return;
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return;
  }

  const haystack = collectStrings(payload).join('\n').toLowerCase();
  if (!haystack) {
    return;
  }

  const suggestions = TRIGGER_RULES
    .filter((rule) => rule.keywords.some((keyword) => haystack.includes(keyword)))
    .map((rule) => rule.suggestion);

  if (suggestions.length === 0) {
    return;
  }

  console.log(Array.from(new Set(suggestions)).join('\n'));
}

function collectStrings(value) {
  if (typeof value === 'string') {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectStrings(item));
  }

  if (value && typeof value === 'object') {
    return Object.values(value).flatMap((item) => collectStrings(item));
  }

  return [];
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let buffer = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      buffer += chunk;
    });
    process.stdin.on('end', () => resolve(buffer));
    process.stdin.on('error', reject);
  });
}

main().catch(() => {
  process.exit(0);
});
