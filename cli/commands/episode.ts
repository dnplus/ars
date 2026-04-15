/**
 * @command episode
 * @description Episode management: create, list, validate, bake, stats
 *
 * Usage:
 *   npx ars episode create <series>/<epId>
 *   npx ars episode list <series>
 *   npx ars episode validate <series>/<epId>
 *   npx ars episode bake <series>/<epId>
 *   npx ars episode stats <series>/<epId>
 */
import fs from 'fs';
import path from 'path';
import { resolveSeriesContext, parseTarget, listAvailableSeries } from '../lib/context';
import { analyzeEpisodeDuration, formatDurationReport } from '../lib/estimate-duration';
import { loadEpisode } from '../lib/episode-file';
import { captureUrlScreenshot } from '../lib/browser-screenshot';
import { updateStepField } from '../lib/episode-ast';
import {
  AVAILABLE_CARD_TYPES,
  CARD_REGISTRY_BY_TYPE,
  DEPRECATED_CARD_TYPES,
  GENERAL_PURPOSE_CARD_TYPES,
  LEGACY_CARD_TYPES,
} from '../../src/engine/shared/card-registry';

const HELP = `
Usage: npx ars episode <subcommand> [target]

Subcommands:
  create <series>/<epId>    Create a new episode (free-form epId)
  list <series>             List all episodes in a series
  validate <series>/<epId>  Validate an episode's structure
  bake <series>/<epId>      Materialize pre-render episode assets and write back
  stats <series>/<epId>     Card usage stats for an episode
  stats <series> --all      Aggregate stats for all episodes in a series
  stats --all               Aggregate stats for all series

Examples:
  npx ars episode create gss/ep-my-topic
  npx ars episode create gss/ep007
  npx ars episode list gss
  npx ars episode validate gss/ep005
  npx ars episode bake gss/ep005
  npx ars episode bake gss/ep005 --dry-run
  npx ars episode stats gss/ep005
  npx ars episode stats gss --all
  npx ars episode stats --all
`;

// ── create ──────────────────────────────────────────────
async function create(args: string[]) {
  const target = args[0];
  if (!target) {
    console.error('❌ 請提供 target，格式：<series>/<epId>');
    console.log('Usage: npx ars episode create gss/ep-my-topic');
    process.exit(1);
  }

  const { series, epId } = parseTarget(target);
  const ctx = resolveSeriesContext(series);

  const epFilePath = path.join(ctx.episodesDir, `${epId}.ts`);
  if (fs.existsSync(epFilePath)) {
    console.error(`❌ Episode 已存在：${epFilePath}`);
    process.exit(1);
  }

  // 建立 public dirs
  const publicEpDir = path.join(ctx.publicEpisodesDir, epId);
  fs.mkdirSync(path.join(publicEpDir, 'audio'), { recursive: true });
  fs.mkdirSync(path.join(publicEpDir, 'demos'), { recursive: true });
  console.log(`📁 Created: public/episodes/${series}/${epId}/`);

  // 複製 template（統一從 src/episodes/template/ 讀取）
  const root = path.resolve(__dirname, '../..');
  const templatePath = path.join(root, 'src/episodes/template/episode.template.ts');
  if (!fs.existsSync(templatePath)) {
    console.error(`❌ Template not found: ${templatePath}`);
    process.exit(1);
  }

  const templateContent = fs.readFileSync(templatePath, 'utf-8');
  const newContent = templateContent
    .replace(/ep999/g, epId)
    .replace(/Episode Title/g, `${epId} Title`)
    .replace(/Episode Subtitle/g, `${epId} Subtitle`)
    .replace(/episodeNumber: 999/g, `episodeNumber: 0`)
    .replace(/export const epTemplate/g, `export const ${sanitizeIdentifier(epId)}`);

  fs.writeFileSync(epFilePath, newContent);
  console.log(`✅ Created: src/episodes/${series}/${epId}.ts`);

  console.log(`
🎉 Episode ${series}/${epId} created!

Next steps:
  1. Edit src/episodes/${series}/${epId}.ts
  2. npx ars audio generate ${series}/${epId}
  3. npx ars studio
`);
}

// ── list ────────────────────────────────────────────────
async function list(args: string[]) {
  const seriesArg = args[0];
  const root = path.resolve(__dirname, '../..');

  if (!seriesArg) {
    // 沒有給 series，列出所有
    const allSeries = listAvailableSeries(root);
    if (allSeries.length === 0) {
      console.log('📭 No series found in src/episodes/');
      return;
    }
    console.log(`📋 Available series: ${allSeries.join(', ')}`);
    return;
  }

  const ctx = resolveSeriesContext(seriesArg);
  const files = fs.readdirSync(ctx.episodesDir)
    .filter(f => f.match(/^ep.*\.ts$/) && !f.includes('.subtitles.') && !f.includes('template'))
    .sort();

  if (files.length === 0) {
    console.log(`📭 No episodes found in ${seriesArg}`);
    return;
  }

  console.log(`📋 Episodes in "${seriesArg}" (${files.length}):\n`);
  for (const file of files) {
    const epId = file.replace('.ts', '');
    const hasSubtitles = fs.existsSync(path.join(ctx.episodesDir, `${epId}.subtitles.ts`));
    const hasAudio = fs.existsSync(path.join(ctx.publicEpisodesDir, epId, 'audio'));

    const status = [
      hasSubtitles ? '🔤' : '  ',
      hasAudio ? '🔊' : '  ',
    ].join('');

    console.log(`  ${status} ${epId}`);
  }
  console.log(`\n  🔤 = subtitles  🔊 = audio`);
}

// ── validate ────────────────────────────────────────────
async function validate(args: string[]) {
  const target = args[0];
  if (!target) {
    console.error('❌ 請提供 target，格式：<series>/<epId>');
    console.log('Usage: npx ars episode validate gss/ep005');
    process.exit(1);
  }

  const { series, epId } = parseTarget(target);
  const ctx = resolveSeriesContext(series);

  const epFilePath = path.join(ctx.episodesDir, `${epId}.ts`);
  if (!fs.existsSync(epFilePath)) {
    console.error(`❌ Episode not found: ${epFilePath}`);
    process.exit(1);
  }

  try {
    const validationIssues: string[] = [];
    const validationSuggestions: string[] = [];
    const mod = await import(epFilePath);
    const episode = mod[sanitizeIdentifier(epId)] || mod[epId] || mod.default;
    if (!episode) {
      console.error(`❌ No recognizable export found in ${epFilePath}`);
      process.exit(1);
    }

    // ── Load series-config to detect Shorts ──
    const seriesConfigPath = path.join(ctx.episodesDir, 'series-config.ts');
    let isShorts = false;
    if (fs.existsSync(seriesConfigPath)) {
      const configMod = await import(seriesConfigPath);
      const seriesConfig = configMod.SERIES_CONFIG;
      isShorts = seriesConfig?.shell?.layout === 'shorts';
    }

    console.log(`✅ Episode "${series}/${epId}" loaded`);
    console.log(`   Title: ${episode.metadata?.title || '(none)'}`);
    console.log(`   Steps: ${episode.steps?.length || 0}`);

    const stepsWithNarration = (episode.steps || []).filter((s: any) => s.narration);
    const legacySteps = (episode.steps || []).filter((s: any) => LEGACY_CARD_TYPES.has(s.contentType));
    const deprecatedSteps = (episode.steps || []).filter((s: any) => DEPRECATED_CARD_TYPES.has(s.contentType));
    console.log(`   Narrated: ${stepsWithNarration.length}`);
    console.log(`   FPS: ${episode.metadata?.fps}`);
    console.log(`   Resolution: ${episode.metadata?.width}x${episode.metadata?.height}`);

    for (const step of legacySteps) {
      const entry = CARD_REGISTRY_BY_TYPE.get(step.contentType);
      if (!entry?.replacement) continue;
      validationSuggestions.push(
        `Step "${step.id}" uses legacy card "${step.contentType}". 建議改成 ${entry.replacement}。`,
      );
    }

    for (const step of deprecatedSteps) {
      const entry = CARD_REGISTRY_BY_TYPE.get(step.contentType);
      validationSuggestions.push(
        `Step "${step.id}" uses deprecated card "${step.contentType}". 建議改成 ${entry?.replacement || '其他 active card'}。`,
      );
    }

    // ── Summary / CTA heuristics ──
    const summarySteps = (episode.steps || []).filter((s: any) => s.contentType === 'summary');
    if (summarySteps.length === 0) {
      validationSuggestions.push('No summary step found. 長片通常應該有一張 summary 當收尾。');
    } else {
      const lastSummary = summarySteps[summarySteps.length - 1];
      const summaryPoints = Array.isArray(lastSummary.summaryPoints) ? lastSummary.summaryPoints : [];
      const summaryCtaButtons = Array.isArray(lastSummary.summaryCtaButtons) ? lastSummary.summaryCtaButtons : [];
      const summaryQrCodes = Array.isArray(lastSummary.summaryQrCodes) ? lastSummary.summaryQrCodes : [];

      if (summaryPoints.length === 0) {
        validationSuggestions.push(`Summary step "${lastSummary.id}" has no summaryPoints. 建議至少放 2-4 個 thesis 級結論。`);
      }

      if (summaryPoints.length > 4) {
        validationSuggestions.push(
          `Summary step "${lastSummary.id}" has ${summaryPoints.length} points. 建議收斂到 2-4 點，避免變成落落長的 recap。`,
        );
      }

      const longPoints = summaryPoints.filter((p: string) => p.length > 34);
      if (longPoints.length > 0) {
        validationSuggestions.push(
          `Summary step "${lastSummary.id}" has ${longPoints.length} long point(s). 條列點應該短，讓畫面一眼抓到結論。`,
        );
      }

      const recapLikeCount = summaryPoints.filter(isRecapLikeSummaryPoint).length;
      if (recapLikeCount >= 2 || (summaryPoints.length > 0 && recapLikeCount === summaryPoints.length)) {
        validationSuggestions.push(
          `Summary step "${lastSummary.id}" looks recap-heavy. 建議改成最終判斷 / 判準 / punchline，不要把章節大綱再列一次。`,
        );
      }

      if (summaryCtaButtons.length === 0 && summaryQrCodes.length === 0) {
        validationSuggestions.push(
          `Summary step "${lastSummary.id}" has no CTA. 建議至少補上 summaryCtaButtons，例如：🔔 訂閱頻道 / 👍 按讚支持 / 💬 留言討論。`,
        );
      }
    }

    // ── Audio & Subtitles status ──
    const audioDir = path.join(ctx.publicEpisodesDir, epId, 'audio');
    const subtitleFilePath = path.join(ctx.episodesDir, `${epId}.subtitles.ts`);
    const hasAudioDir = fs.existsSync(audioDir);
    const hasSubtitleFile = fs.existsSync(subtitleFilePath);
    const subtitlesImported = !!episode.subtitles;

    const audioFiles = hasAudioDir
      ? fs.readdirSync(audioDir).filter(f => f.endsWith('.mp3'))
      : [];

    const stepsNeedingAudio = stepsWithNarration.map((s: any) => s.id);
    const missingAudio = stepsNeedingAudio.filter(
      (id: string) => !audioFiles.includes(`${id}.mp3`),
    );

    console.log('');
    console.log(`   🔊 Audio: ${audioFiles.length}/${stepsNeedingAudio.length} files`);
    if (missingAudio.length > 0) {
      console.log(`   ⚠️  Missing audio: ${missingAudio.join(', ')}`);
    }
    console.log(`   🔤 Subtitles file: ${hasSubtitleFile ? '✅' : '❌ not generated'}`);
    console.log(`   📎 Subtitles imported: ${subtitlesImported ? '✅' : '❌ not imported in episode'}`);
    if (hasSubtitleFile && !subtitlesImported) {
      validationIssues.push(`Subtitles file exists but episode does not import/use it: ${epId}.subtitles.ts`);
    }

    // ── Duration analysis (estimated from narration) ──
    if (episode.steps?.length > 0) {
      const analysis = analyzeEpisodeDuration(episode.steps);
      console.log(formatDurationReport(analysis));

      // ── Shorts format validation ──
      if (isShorts) {
        const totalEstimated = analysis.totalEstimated;
        const stepCount = episode.steps.length;
        const SHORTS_MAX_SECONDS = 30;
        const SHORTS_MAX_STEPS = 5;

        const SHORTS_COVER_SECONDS = 1.5;
        const totalWithCover = totalEstimated + SHORTS_COVER_SECONDS;

        console.log('');
        console.log(`   📱 Shorts format: ${totalEstimated}s + ${SHORTS_COVER_SECONDS}s cover = ${totalWithCover}s / ${SHORTS_MAX_SECONDS}s max`);
        if (totalWithCover > SHORTS_MAX_SECONDS) {
          console.log(`   ⚠️  超過 Shorts 上限！建議砍 narration 或減少步數`);
        }
        if (stepCount > SHORTS_MAX_STEPS) {
          console.log(`   ⚠️  步數 ${stepCount} 超過建議上限 ${SHORTS_MAX_STEPS}`);
        }
      }
    }

    // ── Actual audio duration comparison (if subtitles exist) ──
    if (hasSubtitleFile && subtitlesImported) {
      const subMod = await import(subtitleFilePath);
      const subtitles = subMod.subtitles;

      if (subtitles && Object.keys(subtitles).length > 0) {
        console.log('\n   Actual audio duration (from subtitles):');
        console.log(
          '   ' +
          'Step'.padEnd(25) +
          'Declared'.padStart(10) +
          'Actual'.padStart(10) +
          'Diff'.padStart(8),
        );
        console.log('   ' + '─'.repeat(53));

        let totalDeclared = 0;
        let totalActual = 0;
        for (const step of episode.steps) {
          if (!step.id) continue;
          const subs = subtitles[step.id];
          if (subs?.length) {
            const lastEnd = subs[subs.length - 1].endTime;
            const actual = Math.ceil(lastEnd);
            const declared = step.durationInSeconds;
            const diff = declared - actual;
            const diffStr = diff >= 0 ? `+${diff}s` : `${diff}s`;
            const flag = diff < -3 ? ' ⚠️' : '';
            console.log(
              '   ' +
              step.id.padEnd(25) +
              `${declared}s`.padStart(10) +
              `${actual}s`.padStart(10) +
              diffStr.padStart(8) +
              flag,
            );
            totalDeclared += declared;
            totalActual += actual;
          }
        }

        console.log('   ' + '─'.repeat(53));
        const totalDiff = totalDeclared - totalActual;
        const totalDiffStr = totalDiff >= 0 ? `+${totalDiff}s` : `${totalDiff}s`;
        const pct = totalActual > 0 ? Math.round((totalDiff / totalActual) * 100) : 0;
        console.log(
          '   ' +
          'TOTAL'.padEnd(25) +
          `${totalDeclared}s`.padStart(10) +
          `${totalActual}s`.padStart(10) +
          totalDiffStr.padStart(8) +
          ` (${pct >= 0 ? '+' : ''}${pct}%)`,
        );
        console.log(`\n   🎬 Actual total: ${totalActual}s (${(totalActual / 60).toFixed(1)}min)`);
      }
    }

    if (validationIssues.length > 0) {
      console.error('\n❌ Validation failed:');
      for (const issue of validationIssues) {
        console.error(`   - ${issue}`);
      }
      process.exit(1);
    }

    if (validationSuggestions.length > 0) {
      console.log('\n   💡 Suggestions:');
      for (const suggestion of validationSuggestions) {
        console.log(`   - ${suggestion}`);
      }
    }

    console.log('\n✅ Validation passed');
  } catch (e: any) {
    console.error(`❌ Failed to load episode: ${e.message}`);
    process.exit(1);
  }
}

// ── bake ────────────────────────────────────────────────
async function bake(args: string[]) {
  const target = args.find((arg) => !arg.startsWith('--'));
  const dryRun = args.includes('--dry-run');

  if (!target) {
    console.error('❌ 請提供 target，格式：<series>/<epId>');
    console.log('Usage: npx ars episode bake gss/ep005 [--dry-run]');
    process.exit(1);
  }

  const { series, epId } = parseTarget(target);
  const ctx = resolveSeriesContext(series);
  const epFilePath = path.join(ctx.episodesDir, `${epId}.ts`);

  if (!fs.existsSync(epFilePath)) {
    console.error(`❌ Episode not found: ${epFilePath}`);
    process.exit(1);
  }

  try {
    const mod = await import(epFilePath);
    const episode = mod[sanitizeIdentifier(epId)] || mod[epId] || mod.default;
    if (!episode) {
      console.error(`❌ No recognizable export found in ${epFilePath}`);
      process.exit(1);
    }

    const browserStepsNeedingScreenshot = (episode.steps || []).filter((step: any) => (
      step.contentType === 'mockApp' &&
      step.appType === 'browser' &&
      step.appUrl &&
      !step.appImageSrc
    ));

    console.log(`🧁 Baking "${series}/${epId}"`);
    console.log(`   Browser screenshots needed: ${browserStepsNeedingScreenshot.length}`);

    if (browserStepsNeedingScreenshot.length === 0) {
      console.log('\n✅ Nothing to bake');
      return;
    }

    if (dryRun) {
      console.log('\n   Dry run:');
      for (const step of browserStepsNeedingScreenshot) {
        console.log(`   - ${step.id}: would capture ${step.appUrl}`);
      }
      console.log('\n✅ Bake dry run complete');
      return;
    }

    const bakeIssues: string[] = [];

    for (const step of browserStepsNeedingScreenshot) {
      try {
        const screenshotPath = await captureUrlScreenshot(
          step.appUrl,
          series,
          epId,
          step.id,
          ctx,
          step.appBrowserLayout || 'normal',
        );
        if (!screenshotPath) {
          bakeIssues.push(`Step "${step.id}" browser 截圖失敗，請手動提供 appImageSrc。`);
          continue;
        }

        updateStepField(epFilePath, step.id, 'appImageSrc', screenshotPath);
        updateStepField(epFilePath, step.id, 'appBrowserMode', 'snapshot');
        console.log(`   ✅ ${step.id}: ${screenshotPath}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        bakeIssues.push(`Step "${step.id}" browser 截圖寫回失敗：${message}`);
      }
    }

    if (bakeIssues.length > 0) {
      console.error('\n❌ Bake finished with errors:');
      for (const issue of bakeIssues) {
        console.error(`   - ${issue}`);
      }
      process.exit(1);
    }

    console.log('\n✅ Bake complete');
  } catch (e: any) {
    console.error(`❌ Failed to bake episode: ${e.message}`);
    process.exit(1);
  }
}

/**
 * 將 epId 轉為合法的 JS identifier（用於 export const）
 * ep-my-topic → epMyTopic
 * ep007 → ep007
 */
function sanitizeIdentifier(epId: string): string {
  return epId.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
}

function isRecapLikeSummaryPoint(point: string): boolean {
  const text = point.trim();
  const recapPatterns = [
    /^這集講/,
    /^本集講/,
    /^今天講/,
    /^我們講/,
    /^先講/,
    /^最後講/,
    /prompt/i,
    /context/i,
    /harness/i,
    /chat\s*vs\s*agent/i,
    /api/i,
    /cloud/i,
    /iac/i,
    /章節/,
    /三層地基/,
    /新創/,
    /既有企業/,
  ];

  return recapPatterns.some((pattern) => pattern.test(text));
}

type CardUsageRow = {
  type: string;
  count: number;
  percent: number;
  duration: number;
  durationPercent: number;
  narratedCount: number;
  avgDuration: number;
};

type StreakRow = {
  type: string;
  length: number;
  startId: string;
  endId: string;
};

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatSeconds(value: number): string {
  return `${Math.round(value)}s`;
}

function buildCardUsageRows(steps: any[]): CardUsageRow[] {
  const totalSteps = steps.length || 1;
  const totalDuration = steps.reduce((sum, step) => sum + (step.durationInSeconds || 0), 0) || 1;
  const byType = new Map<string, { count: number; duration: number; narratedCount: number }>();

  for (const step of steps) {
    const type = step.contentType || 'unknown';
    const current = byType.get(type) || { count: 0, duration: 0, narratedCount: 0 };
    current.count += 1;
    current.duration += step.durationInSeconds || 0;
    if (step.narration?.trim()) current.narratedCount += 1;
    byType.set(type, current);
  }

  return Array.from(byType.entries())
    .map(([type, data]) => ({
      type,
      count: data.count,
      percent: (data.count / totalSteps) * 100,
      duration: data.duration,
      durationPercent: (data.duration / totalDuration) * 100,
      narratedCount: data.narratedCount,
      avgDuration: data.duration / data.count,
    }))
    .sort((a, b) => b.count - a.count || b.duration - a.duration || a.type.localeCompare(b.type));
}

function buildTypeStreaks(steps: any[]): StreakRow[] {
  const streaks: StreakRow[] = [];
  if (steps.length === 0) return streaks;

  let currentType = steps[0].contentType || 'unknown';
  let startId = steps[0].id;
  let endId = steps[0].id;
  let length = 1;

  for (let i = 1; i < steps.length; i++) {
    const step = steps[i];
    const type = step.contentType || 'unknown';
    if (type === currentType) {
      length += 1;
      endId = step.id;
      continue;
    }

    streaks.push({ type: currentType, length, startId, endId });
    currentType = type;
    startId = step.id;
    endId = step.id;
    length = 1;
  }

  streaks.push({ type: currentType, length, startId, endId });
  return streaks
    .filter((row) => row.length >= 2)
    .sort((a, b) => b.length - a.length || a.startId.localeCompare(b.startId));
}

function buildPhaseBreakdown(steps: any[]) {
  const phases = new Map<string, Map<string, number>>();

  for (const step of steps) {
    const phase = step.phase || '(no phase)';
    const type = step.contentType || 'unknown';
    const byType = phases.get(phase) || new Map<string, number>();
    byType.set(type, (byType.get(type) || 0) + 1);
    phases.set(phase, byType);
  }

  return Array.from(phases.entries()).map(([phase, byType]) => ({
    phase,
    types: Array.from(byType.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([type, count]) => `${type}×${count}`),
  }));
}

function buildSignals(rows: CardUsageRow[], streaks: StreakRow[], steps: any[]): string[] {
  const signals: string[] = [];
  const stepCount = steps.length || 1;
  const compareRow = rows.find((row) => row.type === 'compare');
  const terminalRow = rows.find((row) => row.type === 'terminal');
  const markdownRow = rows.find((row) => row.type === 'markdown');
  const mockAppRow = rows.find((row) => row.type === 'mockApp');

  if (compareRow && compareRow.count >= 5) {
    signals.push(`compare cards = ${compareRow.count}/${stepCount} steps. 可以回頭檢查是不是有些其實只是立場整理，不需要左右對照。`);
  }
  if (terminalRow && terminalRow.count >= 4) {
    signals.push(`terminal cards = ${terminalRow.count}/${stepCount} steps. 這是 legacy alias；新稿優先改成 mockApp + terminal。`);
  }
  if (markdownRow && markdownRow.durationPercent >= 30) {
    signals.push(`markdown duration = ${formatPercent(markdownRow.durationPercent)}. 可以檢查是不是有些卡其實該升級成更具體的 visual card。`);
  }
  if (mockAppRow && mockAppRow.count >= 4) {
    signals.push(`mockApp cards = ${mockAppRow.count}/${stepCount} steps. 可以檢查 device/type 分布是不是太單一。`);
  }

  for (const streak of streaks) {
    if (streak.length >= 3) {
      signals.push(`連續 ${streak.length} 張 ${streak.type} card (${streak.startId} → ${streak.endId})。這段可能會有視覺疲勞。`);
    }
  }

  return signals;
}

function listEpisodeIdsInSeries(series: string): string[] {
  const ctx = resolveSeriesContext(series);
  return fs.readdirSync(ctx.episodesDir)
    .filter((f) => f.match(/^ep.*\.ts$/) && !f.includes('.subtitles.') && !f.includes('template'))
    .map((f) => f.replace('.ts', ''))
    .sort();
}

async function loadEpisodesForStats(target?: string, allMode?: boolean) {
  if (allMode) {
    const seriesList = target ? [target] : listAvailableSeries(path.resolve(__dirname, '../..'));
    const loaded = [];
    for (const series of seriesList) {
      for (const epId of listEpisodeIdsInSeries(series)) {
        loaded.push(await loadEpisode(series, epId));
      }
    }
    return loaded;
  }

  if (!target || !target.includes('/')) {
    console.error('❌ 單集 stats 請提供 target，格式：<series>/<epId>');
    console.log('Usage: npx ars episode stats gss/ep005');
    console.log('   or: npx ars episode stats gss --all');
    process.exit(1);
  }

  const { series, epId } = parseTarget(target);
  return [await loadEpisode(series, epId)];
}

function buildCoverageMap(episodes: Array<{ episode: { steps: any[] } }>) {
  const coverage = new Map<string, number>();
  for (const loaded of episodes) {
    const seen = new Set<string>();
    for (const step of loaded.episode.steps || []) {
      seen.add(step.contentType || 'unknown');
    }
    for (const type of seen) {
      coverage.set(type, (coverage.get(type) || 0) + 1);
    }
  }
  return coverage;
}

function buildGapSignals(
  rows: CardUsageRow[],
  coverage: Map<string, number>,
  episodeCount: number,
  stepCount: number,
  steps: any[],
): string[] {
  const signals: string[] = [];
  const compareRow = rows.find((row) => row.type === 'compare');
  const terminalRow = rows.find((row) => row.type === 'terminal');
  const markdownRow = rows.find((row) => row.type === 'markdown');
  const imageRow = rows.find((row) => row.type === 'image');
  const statsRow = rows.find((row) => row.type === 'stats');
  const mockAppRow = rows.find((row) => row.type === 'mockApp');
  const phoneRow = rows.find((row) => row.type === 'phone');
  const hasDashboardStep = steps.some((step) => step.contentType === 'mockApp' && step.appType === 'dashboard');

  if (compareRow && compareRow.percent >= 20) {
    signals.push(`compare 佔 ${formatPercent(compareRow.percent)}。這通常代表有些「立場 / 判準 / 包法」被擠進左右對照，可能缺少更適合講 stance 的卡型或寫法。`);
  }
  if (markdownRow && markdownRow.percent >= 25 && (!imageRow || imageRow.count === 0)) {
    signals.push(`markdown 佔 ${formatPercent(markdownRow.percent)}，但 image 幾乎沒用。可以回頭想想，有沒有一些 repo / artifact / UI 其實值得直接給畫面。`);
  }
  if (terminalRow && terminalRow.percent >= 15) {
    signals.push(`terminal 佔 ${formatPercent(terminalRow.percent)}。這仍然是 legacy alias；如果變成系列常態，建議直接改寫成 mockApp terminal。`);
  }
  if ((!statsRow || statsRow.count === 0) && !hasDashboardStep) {
    signals.push('stats / dashboard 幾乎沒進場。如果你後續會常講 analytics、benchmark、成長趨勢，可能需要多用 mockApp dashboard。');
  }
  if ((!phoneRow || phoneRow.count === 0) && episodeCount >= 3) {
    signals.push('phone card 幾乎沒用到。若社群發布或 mobile UI 之後變重要，可能需要補一種更適合社群 artifact 的呈現。');
  }
  if (mockAppRow && mockAppRow.percent >= 20) {
    signals.push(`mockApp 佔 ${formatPercent(mockAppRow.percent)}。這通常沒問題，但可以檢查是不是連續太多張都在同一種 desktop frame 裡。`);
  }

  const rarelyUsedGeneralCards = AVAILABLE_CARD_TYPES
    .filter((type) => GENERAL_PURPOSE_CARD_TYPES.has(type))
    .filter((type) => (coverage.get(type) || 0) <= 1 && !['cover', 'summary', 'ticker', 'text'].includes(type));

  if (rarelyUsedGeneralCards.length > 0) {
    signals.push(`幾乎沒用到的通用卡：${rarelyUsedGeneralCards.join(', ')}。這不一定是問題，但值得問一下是題材不需要，還是現有卡不好用。`);
  }

  if (stepCount >= 30 && compareRow && compareRow.count >= 8 && terminalRow && terminalRow.count >= 6) {
    signals.push('長片裡 compare + terminal 都偏高，這通常不是單一卡片問題，而是缺少「中間態」卡型: 既不是純對照，也不是純 CLI 打字。');
  }

  return signals;
}

async function stats(args: string[]) {
  const target = args[0];
  const jsonMode = args.includes('--json');
  const allMode = args.includes('--all');
  const episodes = await loadEpisodesForStats(target, allMode);
  const allSteps = episodes.flatMap((loaded) => loaded.episode.steps || []);
  const steps = allSteps;
  const rows = buildCardUsageRows(steps);
  const streaks = buildTypeStreaks(steps);
  const phaseBreakdown = buildPhaseBreakdown(steps);
  const signals = buildSignals(rows, streaks, steps);
  const coverage = buildCoverageMap(episodes);
  const gapSignals = buildGapSignals(rows, coverage, episodes.length, steps.length, steps);
  const totalDuration = steps.reduce((sum, step) => sum + (step.durationInSeconds || 0), 0);
  const estimatedDuration = analyzeEpisodeDuration(steps).totalEstimated;
  const label = allMode
    ? (target ? `${target}/*` : 'ALL SERIES')
    : `${episodes[0].series}/${episodes[0].epId}`;
  const title = allMode
    ? (target ? `${target} aggregate` : 'All episodes aggregate')
    : episodes[0].metadata.title;
  const unusedTypes = AVAILABLE_CARD_TYPES.filter((type) => !coverage.has(type));
  const underusedTypes = AVAILABLE_CARD_TYPES
    .filter((type) => GENERAL_PURPOSE_CARD_TYPES.has(type))
    .filter((type) => (coverage.get(type) || 0) <= 1 && !['cover', 'summary', 'ticker', 'text'].includes(type));
  const overusedTypes = rows.filter((row) => row.percent >= 20 || row.durationPercent >= 20).map((row) => row.type);
  const legacyAliasRows = rows
    .filter((row) => LEGACY_CARD_TYPES.has(row.type))
    .map((row) => ({
      type: row.type,
      count: row.count,
      replacement: CARD_REGISTRY_BY_TYPE.get(row.type)?.replacement || 'mockApp',
    }));

  const payload = {
    target: label,
    title,
    episodeCount: episodes.length,
    totalSteps: steps.length,
    declaredDuration: totalDuration,
    estimatedDuration,
    cardUsage: rows,
    episodeCoverage: Array.from(coverage.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
    repeatedStreaks: streaks,
    phaseBreakdown,
    signals,
    gapSignals,
    overusedTypes,
    underusedTypes,
    unusedTypes,
    legacyAliasRows,
  };

  if (jsonMode) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`📊 Card stats: ${label}`);
  console.log(`   Title: ${title}`);
  console.log(`   Episodes: ${episodes.length}`);
  console.log(`   Steps: ${steps.length}`);
  console.log(`   Declared duration: ${formatSeconds(totalDuration)} (${(totalDuration / 60).toFixed(1)}min)`);
  console.log(`   Estimated narration duration: ${formatSeconds(estimatedDuration)} (${(estimatedDuration / 60).toFixed(1)}min)`);

  console.log('\n   Card usage:');
  console.log(
    '   ' +
    'Type'.padEnd(14) +
    'Count'.padStart(7) +
    'Steps'.padStart(9) +
    'Dur'.padStart(8) +
    'Time'.padStart(9) +
    'Narr'.padStart(7) +
    'Avg'.padStart(8),
  );
  console.log('   ' + '─'.repeat(62));
  for (const row of rows) {
    console.log(
      '   ' +
      row.type.padEnd(14) +
      String(row.count).padStart(7) +
      formatPercent(row.percent).padStart(9) +
      formatSeconds(row.duration).padStart(8) +
      formatPercent(row.durationPercent).padStart(9) +
      String(row.narratedCount).padStart(7) +
      formatSeconds(row.avgDuration).padStart(8),
    );
  }

  if (streaks.length > 0) {
    console.log('\n   Repeated streaks:');
    for (const streak of streaks.slice(0, 8)) {
      console.log(`   - ${streak.type} ×${streak.length} (${streak.startId} → ${streak.endId})`);
    }
  }

  console.log('\n   Coverage:');
  for (const row of rows) {
    const covered = coverage.get(row.type) || 0;
    console.log(`   - ${row.type}: ${covered}/${episodes.length} episode(s)`);
  }

  if (overusedTypes.length > 0) {
    console.log(`\n   Often-used cards: ${overusedTypes.join(', ')}`);
  }
  if (underusedTypes.length > 0) {
    console.log(`   Rarely-used general cards: ${underusedTypes.join(', ')}`);
  }
  if (unusedTypes.length > 0) {
    console.log(`   Unused cards: ${unusedTypes.join(', ')}`);
  }

  if (legacyAliasRows.length > 0) {
    console.log('\n   Legacy aliases in use:');
    for (const row of legacyAliasRows) {
      console.log(`   - ${row.type} ×${row.count} → prefer ${row.replacement}`);
    }
  }

  console.log('\n   Phase breakdown:');
  for (const phase of phaseBreakdown) {
    console.log(`   - ${phase.phase}: ${phase.types.join(', ')}`);
  }

  if (signals.length > 0) {
    console.log('\n   Signals:');
    for (const signal of signals) {
      console.log(`   - ${signal}`);
    }
  }

  if (gapSignals.length > 0) {
    console.log('\n   Gap hypotheses:');
    for (const signal of gapSignals) {
      console.log(`   - ${signal}`);
    }
  }
}

// ── router ──────────────────────────────────────────────
export async function run(args: string[]) {
  const sub = args[0];
  const subArgs = args.slice(1);

  const subs: Record<string, (a: string[]) => Promise<void>> = {
    create,
    list,
    validate,
    bake,
    stats,
  };

  if (!sub || !subs[sub]) {
    console.log(HELP);
    process.exit(sub ? 1 : 0);
  }

  await subs[sub](subArgs);
}
