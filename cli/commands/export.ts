/**
 * @command export
 * @description Export assets (cover thumbnail, SRT subtitles, etc.)
 *
 * Usage:
 *   npx ars export cover <epId>                   Export a single cover
 *   npx ars export cover <series>/*               Export all covers for a series
 *   npx ars export srt <epId>                     Export SRT subtitle for YouTube CC
 */
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { resolveEpisodeTarget, resolveSeriesContext } from '../lib/context';
import { getRepoRoot } from '../lib/ars-config';
import { getRuntimePackageInfo } from '../lib/runtime-package';
import type { Episode } from '../../src/engine/shared/types';
import type { SubtitlePhrase } from '../../src/engine/shared/subtitle';

const HELP = `
📸 ARS Export — Cover / SRT Export

Usage:
  npx ars export cover <epId>             Export a single episode cover
  npx ars export cover <series>/*         Export all covers for a series
  npx ars export srt <epId>               Export SRT subtitle for YouTube CC

Examples:
  npx ars export cover ep001
  npx ars export cover template/*
  npx ars export srt ep001
`;

// ── SRT helpers ──────────────────────────────────────────

/** 秒數轉 SRT 時間格式 HH:MM:SS,mmm */
function toSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

async function exportSrt(args: string[]) {
  const target = args[0];
  if (!target) {
    console.error('❌ 請提供 target，格式：<epId> 或 <series>/<epId>');
    process.exit(1);
  }

  const root = getRepoRoot();
  const { series, epId } = resolveEpisodeTarget(target, root);
  const ctx = resolveSeriesContext(series);

  // 載入 episode
  const epFilePath = path.join(ctx.episodesDir, `${epId}.ts`);
  if (!fs.existsSync(epFilePath)) {
    console.error(`❌ Episode not found: ${epFilePath}`);
    process.exit(1);
  }

  const mod = await import(epFilePath);
  const camelId = epId.replace(/-([a-z0-9])/g, (_: string, c: string) => c.toUpperCase());
  const episode: Episode = mod[camelId] || mod[epId] || mod.default;
  if (!episode) {
    console.error(`❌ No recognizable export found in ${epFilePath}`);
    process.exit(1);
  }

  // 載入 subtitles
  const subFilePath = path.join(ctx.episodesDir, `${epId}.subtitles.ts`);
  if (!fs.existsSync(subFilePath)) {
    console.error(`❌ Subtitles not found: ${subFilePath}`);
    console.error(`   Run: npx ars audio generate ${epId}`);
    process.exit(1);
  }

  const subMod = await import(subFilePath);
  const subtitles: Record<string, SubtitlePhrase[]> = subMod.subtitles;
  if (!subtitles || Object.keys(subtitles).length === 0) {
    console.error('❌ No subtitle data found');
    process.exit(1);
  }

  // 計算每個 step 的絕對起始時間
  // 與 Composition.tsx 一致：有字幕用 Math.ceil(endTime)，否則用 durationInSeconds
  const lines: string[] = [];
  let idx = 1;
  let offset = 0;

  for (const step of episode.steps) {
    const phrases = subtitles[step.id];
    const actualDuration = phrases?.length
      ? Math.ceil(phrases[phrases.length - 1].endTime)
      : step.durationInSeconds;

    if (phrases?.length) {
      for (const phrase of phrases) {
        const absStart = offset + phrase.startTime;
        const absEnd = offset + phrase.endTime;
        lines.push(`${idx}`);
        lines.push(`${toSrtTime(absStart)} --> ${toSrtTime(absEnd)}`);
        lines.push(phrase.text);
        lines.push('');
        idx++;
      }
    }
    offset += actualDuration;
  }

  if (idx === 1) {
    console.error('❌ No subtitle phrases to export');
    process.exit(1);
  }

  const outDir = path.join(root, 'output/srt', series);
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${epId}.srt`);
  fs.writeFileSync(outPath, lines.join('\n'), 'utf-8');

  console.log(`✅ ${path.relative(root, outPath)} (${idx - 1} cues, ${Math.round(offset)}s)`);
}

// ── Main ─────────────────────────────────────────────────

export async function run(args: string[]) {
  const subcommand = args[0];

  if (subcommand === 'srt') {
    return exportSrt(args.slice(1));
  }

  if (subcommand !== 'cover') {
    console.error('❌ Unknown export subcommand:', subcommand);
    console.log(HELP);
    process.exit(1);
  }

  const target = args[1];
  if (!target) {
    console.error('❌ 請提供 target');
    console.log(HELP);
    process.exit(1);
  }

  const root = getRepoRoot();
  const compositionPrefix = 'cover';
  const outBase = path.join(root, 'output/covers');

  // Resolve episodes to export
  const targets: { series: string; epId: string }[] = [];

  if (target.endsWith('/*')) {
    const series = target.slice(0, -2);
    if (!series) {
      console.error(`❌ Target 格式錯誤，需要 <series>/*`);
      process.exit(1);
    }

    const ctx = resolveSeriesContext(series);
    const files = fs.readdirSync(ctx.episodesDir)
      .filter(f => /^ep.*\.ts$/.test(f) && !f.includes('.subtitles.') && !f.includes('.template.'));
    for (const f of files) {
      const epId = f.replace(/\.ts$/, '');
      targets.push({ series, epId });
    }
    if (targets.length === 0) {
      console.error(`❌ No episodes found in ${series}`);
      process.exit(1);
    }
  } else {
    targets.push(resolveEpisodeTarget(target, root));
  }

  console.log(`\n📸 Exporting ${targets.length} ${subcommand}(s)...\n`);

  let success = 0;
  let failed = 0;

  for (const { series: s, epId } of targets) {
    const compositionId = `${compositionPrefix}-${s}--${epId}`;
    const outDir = path.join(outBase, s);
    const outPath = path.join(outDir, `${epId}.jpg`);

    fs.mkdirSync(outDir, { recursive: true });

    process.stdout.write(`  🖼  ${s}/${epId} ... `);

    try {
      const { packageRoot } = getRuntimePackageInfo(import.meta.url);
      const remotionBin = path.join(packageRoot, 'node_modules', '.bin', 'remotion');
      const arsModulesDir = path.join(packageRoot, 'node_modules');
      execSync(
        `"${remotionBin}" still src/index.ts "${compositionId}" "${outPath}" --image-format=jpeg --jpeg-quality=90 --log=error`,
        {
          cwd: root,
          stdio: 'pipe',
          timeout: 60000,
          env: {
            ...process.env,
            NODE_PATH: [arsModulesDir, process.env.NODE_PATH].filter(Boolean).join(path.delimiter),
          },
        }
      );
      const size = (fs.statSync(outPath).size / 1024 / 1024).toFixed(1);
      console.log(`✅ ${path.relative(root, outPath)} (${size}MB)`);
      success++;
    } catch (err: any) {
      console.log(`❌ Failed`);
      if (err.stderr) {
        console.error(`     ${err.stderr.toString().trim().split('\n')[0]}`);
      }
      failed++;
    }
  }

  console.log(`\n📊 Done: ${success} exported, ${failed} failed`);
  if (success > 0) {
    console.log(`📁 Output: ${path.relative(root, outBase)}/`);
  }
}
