import process from 'process';

const TRIGGER_RULES = [
  {
    patterns: [
      /\bars:onboard\b/,
      /\bonboard\b/,
      /\bsetup ars\b/,
      /\binitialize ars\b/,
      /\binit this repo\b/,
      /初始化.*ars/,
      /初始化.*repo/,
      /第一次使用/,
      /設定.*系列/,
    ],
    suggestion:
      'ARS: Detected first-run setup intent. Run ars init <series> first, then use /ars:onboard for the guided Studio walkthrough, customization, and verify flow.',
  },
  {
    patterns: [
      /\bars:doctor\b/,
      /\bars doctor\b/,
      /\bdoctor\b.*\b(ars|repo|setup|config)\b/,
      /\bcheck setup\b/,
      /\bcheck readiness\b/,
      /\bwhy isn.t.*ready\b/,
      /檢查.*(環境|設定|狀態|ready|readiness)/,
      /看看.*(環境|設定|狀態|ready)/,
      /為什麼.*不能用/,
    ],
    suggestion:
      'ARS: Detected readiness/debug intent. Use /ars:doctor to check repo bootstrap, Studio, MiniMax, and YouTube readiness before changing config by hand.',
  },
  {
    patterns: [
      /\bars:plan\b/,
      /\bscene plan\b/,
      /\bepisode plan\b/,
      /\bplan this episode\b/,
      /\bplan this ep\b/,
      /\bplan\b.*\b(episode|ep\d+)\b/,
      /plan.*這集/,
      /寫稿/,
      /規劃這集/,
      /規劃.*ep\d+/,
    ],
    suggestion:
      'ARS: Detected planning intent. Use /ars:plan to generate plan.md under .ars/episodes/<epId>/ before editing episode content.',
  },
  {
    patterns: [
      /\bars:build\b/,
      /\bscene build\b/,
      /\bbuild episode\b/,
      /\bbuild\b.*\b(episode|ep\d+)\b/,
      /build.*這集/,
      /build.*起來/,
      /實作這集/,
      /做完這集/,
    ],
    suggestion:
      'ARS: Detected build intent. Use /ars:build <epId> and apply the approved episode plan from .ars/episodes/<epId>/plan.md instead of inventing new structure.',
  },
  {
    patterns: [
      /\bars:polish\b/,
      /\bscene polish\b/,
      /\bpolish episode\b/,
      /潤稿這集/,
      /精修這集/,
    ],
    suggestion:
      'ARS: Detected polish intent. Use /ars:polish <epId> and limit changes to tier B refinements only.',
  },
  {
    patterns: [
      /\bars:apply-review\b/,
      /\bscene fix\b/,
      /\bapply review\b/,
      /review.*完.*fix/,
      /review.*再.*fix/,
      /套用審稿/,
      /根據 review 修改/,
    ],
    suggestion:
      'ARS: Detected fix intent. Use /ars:apply-review [<intent-id>|latest] to process one review intent and validate the episode after the patch.',
  },
  {
    patterns: [
      /\bars:review\b/,
      /\breview open\b/,
      /\bopen review\b/,
      /\breview\b.*\b(episode|ep\d+)\b/,
      /review.*這集/,
      /開啟審稿/,
      /審稿這集/,
    ],
    suggestion:
      'ARS: Detected review intent. Use /ars:review <epId> to open the Studio review phase, then /ars:apply-review latest after a Studio intent is created.',
  },
  {
    patterns: [
      /\bars:audio\b/,
      /\baudio generate\b/,
      /\bgenerate audio\b/,
      /\btts\b/,
      /\bsubtitle(s)?\b.*\b(generate|refresh|fix)\b/,
      /\bpronunciation\b/,
      /生成.*音訊/,
      /生成.*配音/,
      /生成.*字幕/,
      /補.*字幕/,
      /發音/,
      /念錯/,
    ],
    suggestion:
      'ARS: Detected audio intent. Use /ars:audio <epId> to generate MiniMax audio and subtitles, then validate the episode before the next review pass.',
  },
  {
    patterns: [
      /\bars:new-card\b/,
      /\bnew.?card\b/i,
      /\badd.?card\b/i,
      /\bcreate.?card\b/i,
      /新增.*card/,
      /建立.*card/,
      /新增.*卡片/,
      /建立.*卡片/,
      /寫.*card.*spec/,
    ],
    suggestion:
      'ARS: Detected new card intent. Use /ars:new-card <card-name> [description] to scaffold a series-scoped card in the active series.',
  },
  {
    patterns: [
      /\bars:analytics\b/,
      /\banalytics\b/,
      /\byoutube analytics\b/,
      /\bchannel performance\b/,
      /\bvideo performance\b/,
      /看.*analytics/,
      /看.*表現/,
      /分析.*頻道/,
      /分析.*表現/,
      /數據報告/,
    ],
    suggestion:
      'ARS: Detected analytics intent. Use /ars:analytics [--days N] to fetch a YouTube analytics snapshot and turn it into a concise report.',
  },
  {
    patterns: [
      /\bars:reflect\b/,
      /\breflect\b.*\b(analytics|episodes?|series|guide)\b/,
      /\bretro\b.*\b(episodes?|series|channel)\b/,
      /復盤/,
      /回顧.*(數據|analytics|表現)/,
      /根據.*(analytics|數據).*(調整|修改|更新|優化)/,
      /根據.*episodes?.*(調整|修改|更新|優化)/,
    ],
    suggestion:
      'ARS: Detected reflection intent. Use /ars:reflect to synthesize recent episodes + analytics into a reflection memo and high-confidence SERIES_GUIDE.md updates.',
  },
  {
    patterns: [
      /\bars:publish-youtube\b/,
      /\bpublish youtube\b/,
      /\bprepare youtube\b/,
      /發布到 youtube/,
      /上傳到 youtube/,
    ],
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
    .filter((rule) => rule.patterns.some((pattern) => pattern.test(haystack)))
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
