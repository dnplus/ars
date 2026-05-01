/**
 * @command export
 * @description Export assets (thumbnail PNG, SRT subtitles, etc.)
 *
 * Usage:
 *   npx ars export thumbnail <epId>               Export YouTube thumbnail PNG
 *   npx ars export srt <epId>                     Export SRT subtitle for YouTube CC
 */
import { execFileSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { resolveEpisodeTarget, resolveSeriesContext } from '../lib/context';
import { getRepoRoot } from '../lib/ars-config';
import { getRuntimePackageInfo } from '../lib/runtime-package';
import { npmCommand } from '../lib/platform-command';
import type { Episode } from '../../src/engine/shared/types';
import type { SubtitlePhrase } from '../../src/engine/shared/subtitle';

const HELP = `
📸 ARS Export — Thumbnail / SRT Export

Usage:
  npx ars export thumbnail <epId>                 Export primary thumbnail PNG
  npx ars export thumbnail <epId> --variant <id>  Export specific variant PNG
  npx ars export thumbnail <epId> --all-variants  Export all variants + copy primary
  npx ars export srt <epId>                       Export SRT subtitle for YouTube CC

Examples:
  npx ars export thumbnail ep001
  npx ars export thumbnail ep001 --variant v2
  npx ars export thumbnail ep001 --all-variants
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

// ── Thumbnail export ─────────────────────────────────────

/** variantId 解析邏輯（與 Root.tsx 一致）*/
function resolveVariantId(variant: { id?: string }, index: number): string {
  return variant.id ?? `v${index + 1}`;
}

/** 解析 primary variant（與 Root.tsx 一致）*/
function resolvePrimaryVariantId(thumbnail: { variants: Array<{ id?: string }>; primary?: string }): string {
  if (thumbnail.primary) return thumbnail.primary;
  return resolveVariantId(thumbnail.variants[0], 0);
}

/** 用 remotion still 輸出單張 PNG */
function renderStill(
  _packageRoot: string,
  root: string,
  compositionId: string,
  outPath: string,
): void {
  const entryPoint = path.join(root, 'src', 'index.ts');
  const publicDir = path.join(root, 'public');
  const absOutPath = path.resolve(outPath);

  execFileSync(
    npmCommand('npx'),
    [
      'remotion',
      'still',
      entryPoint,
      compositionId,
      absOutPath,
      `--public-dir=${publicDir}`,
      '--image-format=png',
      '--log=error',
    ],
    {
      cwd: root,
      stdio: 'pipe',
      timeout: 60000,
      env: {
        ...process.env,
        ARS_PACKAGE_ROOT: _packageRoot,
        ARS_REPO_ROOT: root,
      },
    }
  );
}

async function exportThumbnail(args: string[]) {
  const target = args[0];
  if (!target) {
    console.error('❌ 請提供 target，格式：<epId> 或 <series>/<epId>');
    console.log(HELP);
    process.exit(1);
  }

  // Parse flags
  const variantFlag = args.includes('--variant') ? args[args.indexOf('--variant') + 1] : undefined;
  const allVariants = args.includes('--all-variants');

  const root = getRepoRoot();
  const { series, epId } = resolveEpisodeTarget(target, root);
  const ctx = resolveSeriesContext(series);

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

  if (!episode.metadata?.thumbnail?.variants?.length) {
    console.error(`❌ episode.metadata.thumbnail 未設定或格式不正確`);
    console.error(`   請在 ${epFilePath} 的 metadata 改成新格式：`);
    console.error(`   thumbnail: {`);
    console.error(`     variants: [`);
    console.error(`       { id: "v1", cardType: "thumbnail", label: "直述標題", data: { title: "你的標題", subtitle: "副標題", channelName: "頻道名稱", episodeTag: "EP01" } },`);
    console.error(`     ],`);
    console.error(`     primary: "v1",  // 省略取 variants[0]`);
    console.error(`   }`);
    process.exit(1);
  }

  const thumbnail = episode.metadata.thumbnail;
  const { packageRoot } = getRuntimePackageInfo(import.meta.url);
  const outDir = path.join(root, 'output/publish', series, epId);
  const variantsDir = path.join(outDir, 'thumbnails');

  fs.mkdirSync(outDir, { recursive: true });

  if (allVariants) {
    // --all-variants: render 全部 variants 到 thumbnails/<id>.png，primary 複製到 thumbnail.png
    fs.mkdirSync(variantsDir, { recursive: true });
    console.log(`\n🖼  Exporting all variants: ${series}/${epId} (${thumbnail.variants.length} variants) ...`);

    for (let i = 0; i < thumbnail.variants.length; i++) {
      const variant = thumbnail.variants[i];
      const variantId = resolveVariantId(variant, i);
      const compositionId = `thumbnail-${series}--${epId}--${variantId}`;
      const outPath = path.join(variantsDir, `${variantId}.png`);

      console.log(`   Rendering variant: ${variantId}${variant.label ? ` (${variant.label})` : ''} ...`);
      renderStill(packageRoot, root, compositionId, outPath);
      const size = (fs.statSync(outPath).size / 1024 / 1024).toFixed(1);
      console.log(`   ✅ thumbnails/${variantId}.png (${size}MB)`);
    }

    // Copy primary to thumbnail.png
    const primaryId = resolvePrimaryVariantId(thumbnail);
    const primarySrc = path.join(variantsDir, `${primaryId}.png`);
    const primaryDst = path.join(outDir, 'thumbnail.png');
    fs.copyFileSync(primarySrc, primaryDst);
    const primarySize = (fs.statSync(primaryDst).size / 1024 / 1024).toFixed(1);
    console.log(`\n✅ thumbnail.png → primary (${primaryId}) (${primarySize}MB)`);
    console.log(`✅ thumbnails/ (${thumbnail.variants.length} variants)`);

  } else if (variantFlag) {
    // --variant <id>: render 指定 variant 到 thumbnails/<id>.png
    const idx = thumbnail.variants.findIndex((v, i) => (v.id ?? `v${i + 1}`) === variantFlag);
    if (idx === -1) {
      console.error(`❌ Variant "${variantFlag}" not found in thumbnail.variants`);
      console.error(`   Available: ${thumbnail.variants.map((v, i) => v.id ?? `v${i + 1}`).join(', ')}`);
      process.exit(1);
    }
    const variant = thumbnail.variants[idx];
    const variantId = resolveVariantId(variant, idx);
    const compositionId = `thumbnail-${series}--${epId}--${variantId}`;
    fs.mkdirSync(variantsDir, { recursive: true });
    const outPath = path.join(variantsDir, `${variantId}.png`);

    console.log(`\n🖼  Exporting variant ${variantId}${variant.label ? ` (${variant.label})` : ''}: ${series}/${epId} ...`);
    renderStill(packageRoot, root, compositionId, outPath);
    const size = (fs.statSync(outPath).size / 1024 / 1024).toFixed(1);
    console.log(`✅ thumbnails/${variantId}.png (${size}MB)`);

  } else {
    // Default: render primary variant → thumbnail.png
    const primaryId = resolvePrimaryVariantId(thumbnail);
    const primaryIdx = thumbnail.variants.findIndex((v, i) => (v.id ?? `v${i + 1}`) === primaryId);
    if (primaryIdx === -1) {
      console.error(`❌ Primary variant "${primaryId}" not found in thumbnail.variants`);
      process.exit(1);
    }
    const compositionId = `thumbnail-${series}--${epId}--${primaryId}`;
    const outPath = path.join(outDir, 'thumbnail.png');

    console.log(`\n🖼  Exporting thumbnail: ${series}/${epId} (primary=${primaryId}) ...`);
    renderStill(packageRoot, root, compositionId, outPath);
    const size = (fs.statSync(outPath).size / 1024 / 1024).toFixed(1);
    console.log(`✅ ${path.relative(root, outPath)} (${size}MB)`);
  }
}

// ── Main ─────────────────────────────────────────────────

export async function run(args: string[]) {
  const subcommand = args[0];

  if (subcommand === 'srt') {
    return exportSrt(args.slice(1));
  }

  if (subcommand === 'thumbnail') {
    return exportThumbnail(args.slice(1));
  }

  console.error('❌ Unknown export subcommand:', subcommand);
  console.log(HELP);
  process.exit(1);
}
