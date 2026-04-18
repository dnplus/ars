/**
 * @command upload
 * @description Upload rendered video artifacts to YouTube.
 *
 * Usage:
 *   npx ars upload youtube <epId>
 */
import fs from 'fs';
import path from 'path';
import { resolveEpisodeTarget, resolveSeriesContext } from '../lib/context';
import { getRepoRoot } from '../lib/ars-config';
import { loadEpisodeMetadata, writeEpisodePublishState } from '../lib/episode-file';
import { readPreparedYoutubeCandidate } from '../lib/prepare-artifact';
import {
  getAccessToken,
  getAccessTokenInfo,
  getMissingYouTubeCredentialKeys,
  loadCredentials,
  printMissingYouTubeCredentialsMessage,
} from '../lib/youtube-client';
import {
  uploadCaption,
  uploadThumbnail,
  uploadVideo,
  type UploadResult,
  type VideoMetadata,
} from '../lib/youtube-upload';
import type { EpisodeMetadata } from '../../src/engine/shared/types';

type Platform = 'youtube';

interface UploadOptions {
  platform: Platform;
  series: string;
  epId: string;
  dryRun: boolean;
  privacy: 'public' | 'unlisted' | 'private';
  schedule?: string;
  videoPath?: string;
  noThumbnail: boolean;
  noSrt: boolean;
}

interface ResolvedAssets {
  videoPath: string | null;
  coverPath: string;
  srtPath: string | null;
}

const ROOT = getRepoRoot();

const HELP = `
📤 ARS Upload — YouTube

Usage:
  npx ars upload youtube <epId>

Options:
  --dry-run              Preview what would be uploaded without calling YouTube APIs
  --privacy <status>     YouTube privacy: public|unlisted|private (default: private)
  --schedule <datetime>  Schedule publish (ISO 8601, implies private)
  --video <path>         Custom video file path
  --no-thumbnail         Skip thumbnail upload
  --no-srt               Skip SRT subtitle upload

Notes:
  - This core command only handles YouTube.
  - Social uploads live in the optional social extension.
  - Run prepare first:
      npx ars prepare youtube <epId>
`;

function parseArgs(args: string[]): UploadOptions {
  const platform = args[0] as string | undefined;
  const target = args[1];

  if (platform !== 'youtube' || !target) {
    console.log(HELP);
    process.exit(platform && target ? 1 : 0);
  }

  const { series, epId } = resolveEpisodeTarget(target, ROOT);
  const dryRun = args.includes('--dry-run');
  const noThumbnail = args.includes('--no-thumbnail');
  const noSrt = args.includes('--no-srt');

  let privacy: UploadOptions['privacy'] = 'private';
  const privacyIdx = args.indexOf('--privacy');
  if (privacyIdx !== -1 && args[privacyIdx + 1]) {
    const value = args[privacyIdx + 1];
    if (value === 'public' || value === 'unlisted' || value === 'private') {
      privacy = value;
    }
  }

  let schedule: string | undefined;
  const scheduleIdx = args.indexOf('--schedule');
  if (scheduleIdx !== -1 && args[scheduleIdx + 1]) {
    schedule = args[scheduleIdx + 1];
    privacy = 'private';
  }

  let videoPath: string | undefined;
  const videoIdx = args.indexOf('--video');
  if (videoIdx !== -1 && args[videoIdx + 1]) {
    videoPath = args[videoIdx + 1];
  }

  return {
    platform: 'youtube',
    series,
    epId,
    dryRun,
    privacy,
    schedule,
    videoPath,
    noThumbnail,
    noSrt,
  };
}

function prepareHint(series: string, epId: string): string {
  return `npx ars prepare youtube ${epId}`;
}

function resolveAssets(series: string, epId: string, customVideoPath?: string): ResolvedAssets {
  const defaultVideoPath = path.join(ROOT, 'output/render', series, `${epId}.mp4`);
  const videoPath = customVideoPath
    ? (fs.existsSync(customVideoPath) ? customVideoPath : null)
    : (fs.existsSync(defaultVideoPath) ? defaultVideoPath : null);

  const thumbnailPath = path.join(ROOT, 'output/publish', series, epId, 'thumbnail.png');
  if (!fs.existsSync(thumbnailPath)) {
    console.error(`❌ Thumbnail not found: ${thumbnailPath}`);
    console.error(`   Run: npx ars export thumbnail ${series}/${epId}`);
    process.exit(1);
  }
  const coverPath = thumbnailPath;

  // A/B test hint: 若 thumbnails/ 下有多個 variant，提示可手動上 YT Studio
  const variantsDir = path.join(ROOT, 'output/publish', series, epId, 'thumbnails');
  if (fs.existsSync(variantsDir)) {
    const variantFiles = fs.readdirSync(variantsDir).filter((f: string) => f.endsWith('.png'));
    if (variantFiles.length > 1) {
      console.log(`\n💡 A/B Test hint: 偵測到 ${variantFiles.length} 個 thumbnail variants：`);
      for (const f of variantFiles) {
        console.log(`   • output/publish/${series}/${epId}/thumbnails/${f}`);
      }
      console.log(`   可手動上傳到 YT Studio 做 A/B test（YouTube 原生，最多 3 張，API 不支援 programmatic）`);
      console.log(`   https://studio.youtube.com/\n`);
    }
  }

  const srtPath = path.join(ROOT, 'output/srt', series, `${epId}.srt`);

  return {
    videoPath,
    coverPath,
    srtPath: fs.existsSync(srtPath) ? srtPath : null,
  };
}

function resolveYoutubeMetadata(
  series: string,
  epId: string,
  episodeMetadata: EpisodeMetadata | null,
): {
  metadata: VideoMetadata;
  source: string;
} | null {
  const prepared = readPreparedYoutubeCandidate(series, epId);
  if (prepared) {
    return {
      metadata: {
        title: prepared.candidate.title,
        description: prepared.candidate.description,
        tags: prepared.candidate.tags,
        categoryId: '28',
        defaultLanguage: 'zh-TW',
        privacyStatus: 'private',
        selfDeclaredMadeForKids: false,
      },
      source: path.relative(ROOT, prepared.artifactPath),
    };
  }

  if (!episodeMetadata?.youtube) {
    return null;
  }

  return {
    metadata: {
      title: episodeMetadata.youtube.title,
      description: episodeMetadata.youtube.description,
      tags: episodeMetadata.youtube.tags,
      categoryId: '28',
      defaultLanguage: 'zh-TW',
      privacyStatus: 'private',
      selfDeclaredMadeForKids: false,
    },
    source: 'metadata.youtube',
  };
}

function saveUploadResult(series: string, epId: string, data: unknown): void {
  const ctx = resolveSeriesContext(series);
  const outDir = path.join(ctx.publicEpisodesDir, epId);
  fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, 'upload-result-youtube.json');
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`   Result saved: ${path.relative(ROOT, outPath)}`);
}

async function uploadToYouTube(
  opts: UploadOptions,
  assets: ResolvedAssets,
  episodeMetadata: EpisodeMetadata | null,
): Promise<UploadResult | null> {
  console.log(`\n🎬 YouTube Upload: ${opts.series}/${opts.epId}`);
  console.log(`${'─'.repeat(50)}`);

  if (!assets.videoPath && !opts.dryRun) {
    console.error(`❌ Video file not found: output/render/${opts.series}/${opts.epId}.mp4`);
    console.error(`   Render it first: npx remotion render ${opts.series}--${opts.epId} output/render/${opts.series}/${opts.epId}.mp4`);
    return null;
  }

  const resolvedMetadata = resolveYoutubeMetadata(opts.series, opts.epId, episodeMetadata);
  if (!resolvedMetadata) {
    console.error(`Error: YouTube metadata not found.`);
    console.error(`   1. Run: ${prepareHint(opts.series, opts.epId)}`);
    console.error(`   2. In Claude Code: /ars:prepare-youtube ${opts.epId}`);
    return null;
  }

  const metadata: VideoMetadata = {
    ...resolvedMetadata.metadata,
    tags: resolvedMetadata.metadata.tags.filter((value, index, array) => array.indexOf(value) === index),
    privacyStatus: opts.privacy,
    publishAt: opts.schedule,
    notifySubscribers: opts.privacy === 'public',
  };

  console.log(`   Video:        ${assets.videoPath ? path.basename(assets.videoPath) : `output/render/${opts.series}/${opts.epId}.mp4 (missing in dry-run)`}`);
  console.log(`   Title:        ${metadata.title}`);
  console.log(`   Tags:         ${metadata.tags.slice(0, 5).join(', ')}${metadata.tags.length > 5 ? '...' : ''}`);
  console.log(`   Privacy:      ${metadata.privacyStatus}`);
  console.log(`   Metadata:     ${resolvedMetadata.source}`);
  if (assets.coverPath && !opts.noThumbnail) {
    console.log(`   Thumbnail:    ${path.basename(assets.coverPath)}`);
  }
  if (assets.srtPath && !opts.noSrt) {
    console.log(`   SRT:          ${path.basename(assets.srtPath)}`);
  }

  const missingCredentials = getMissingYouTubeCredentialKeys();
  if (opts.dryRun) {
    if (missingCredentials.length > 0) {
      printMissingYouTubeCredentialsMessage();
    }
    console.log('\n   DRY RUN: would upload to YouTube');
    console.log(`   Description preview:`);
    console.log(`   ${metadata.description.slice(0, 200).replace(/\n/g, '\n   ')}...`);
    return null;
  }

  if (missingCredentials.length > 0) {
    printMissingYouTubeCredentialsMessage();
    return null;
  }

  const creds = loadCredentials();
  try {
    await getAccessToken(creds);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`\n❌ YouTube auth preflight failed: ${detail}`);
    console.error(`   Re-authorize with: npx ars auth youtube --force`);
    return null;
  }

  let tokenInfo: Awaited<ReturnType<typeof getAccessTokenInfo>> | null = null;
  if (assets.srtPath && !opts.noSrt) {
    try {
      tokenInfo = await getAccessTokenInfo(creds);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error(`   Warning: could not inspect OAuth scopes before caption upload: ${detail}`);
    }
  }

  console.log(`\n   Uploading video...`);
  const result = await uploadVideo(creds, assets.videoPath!, metadata);
  console.log(`   Uploaded video: ${result.videoId}`);
  console.log(`   URL: https://youtube.com/watch?v=${result.videoId}`);
  const youtubeUrl = `https://youtube.com/watch?v=${result.videoId}`;

  await writeEpisodePublishState(opts.series, opts.epId, {
    youtubeVideoId: result.videoId,
    youtubeUrl,
    youtubeUploadedAt: result.uploadedAt,
  });
  console.log(`   Episode metadata.publish updated`);

  if (assets.coverPath && !opts.noThumbnail) {
    try {
      console.log(`   Uploading thumbnail...`);
      await uploadThumbnail(creds, result.videoId, assets.coverPath);
      result.thumbnailUploaded = true;
      console.log(`   Thumbnail uploaded`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.error(`   Warning: thumbnail upload failed: ${detail}`);
    }
  }

  if (assets.srtPath && !opts.noSrt) {
    const requiredScope = 'https://www.googleapis.com/auth/youtube.force-ssl';
    if (tokenInfo && !tokenInfo.scope.includes(requiredScope)) {
      console.error(`   Warning: caption upload skipped because youtube.force-ssl is missing`);
    } else {
      try {
        console.log(`   Uploading captions...`);
        const caption = await uploadCaption(creds, result.videoId, assets.srtPath);
        result.captionUploaded = true;
        result.captionTrackId = caption.captionId;
        console.log(`   Captions uploaded (${caption.captionId})`);
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        console.error(`   Warning: caption upload failed: ${detail}`);
      }
    }
  }

  saveUploadResult(opts.series, opts.epId, {
    series: opts.series,
    epId: opts.epId,
    videoId: result.videoId,
    title: metadata.title,
    description: metadata.description,
    tags: metadata.tags,
    youtubeUrl,
    thumbnailPath: assets.coverPath,
    srtPath: assets.srtPath,
    privacyStatus: result.privacyStatus,
    publishAt: result.publishAt,
    thumbnailUploaded: result.thumbnailUploaded,
    captionUploaded: result.captionUploaded ?? false,
    captionTrackId: result.captionTrackId ?? null,
    uploadedAt: result.uploadedAt,
  });

  return result;
}

export async function run(args: string[]) {
  const opts = parseArgs(args);
  const assets = resolveAssets(opts.series, opts.epId, opts.videoPath);
  const episodeMetadata = await loadEpisodeMetadata(opts.series, opts.epId);
  const result = await uploadToYouTube(opts, assets, episodeMetadata);

  if (!opts.dryRun && !result) {
    process.exit(1);
  }

  console.log(`\n🎉 Upload command finished.`);
}
