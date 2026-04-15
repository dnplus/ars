/**
 * @module extensions/social/upload-social
 * @description Optional social upload commands for Threads and FB Group.
 */
import fs from 'fs';
import path from 'path';
import { run as runCoreUpload } from '../../cli/commands/upload';
import { parseTarget, resolveSeriesContext } from '../../cli/lib/context';
import { loadEpisodeMetadata } from '../../cli/lib/episode-file';
import { uploadImage as imgurUpload } from '../../cli/lib/imgur-upload';
import {
  loadThreadsCredentials,
  publishImagePost,
  publishTextPost,
  replyToPost,
  type ThreadsPostResult,
} from './threads-client';
import type { EpisodeMetadata } from '../../src/engine/shared/types';

type Platform = 'threads' | 'fbgroup' | 'all';

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
  coverPath: string | null;
  srtPath: string | null;
}

const ROOT = path.resolve(__dirname, '../..');

const HELP = `
📤 ARS Upload — Social Extension

Usage:
  npx ars upload threads <series>/<epId>
  npx ars upload fbgroup <series>/<epId>
  npx ars upload all <series>/<epId>

Options:
  --dry-run              Preview what would be uploaded
  --privacy <status>     Forwarded to the YouTube core upload for upload all
  --schedule <datetime>  Forwarded to the YouTube core upload for upload all
  --video <path>         Forwarded to the YouTube core upload for upload all
  --no-thumbnail         Forwarded to the YouTube core upload for upload all
  --no-srt               Forwarded to the YouTube core upload for upload all
`;

function parseArgs(args: string[]): UploadOptions {
  const platform = args[0] as Platform | undefined;
  const target = args[1];

  if (!platform || !target || !['threads', 'fbgroup', 'all'].includes(platform)) {
    console.log(HELP);
    process.exit(platform && target ? 1 : 0);
  }

  const { series, epId } = parseTarget(target);
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

  const scheduleIdx = args.indexOf('--schedule');
  const schedule = scheduleIdx !== -1 ? args[scheduleIdx + 1] : undefined;
  const videoIdx = args.indexOf('--video');
  const videoPath = videoIdx !== -1 ? args[videoIdx + 1] : undefined;

  return {
    platform,
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

function prepareHint(phase: 'social' | 'youtube', series: string, epId: string): string {
  return `npx ars prepare ${phase} ${series}/${epId}`;
}

function resolveAssets(series: string, epId: string, customVideoPath?: string): ResolvedAssets {
  const defaultVideoPath = path.join(ROOT, 'output/render', series, `${epId}.mp4`);
  const videoPath = customVideoPath
    ? (fs.existsSync(customVideoPath) ? customVideoPath : null)
    : (fs.existsSync(defaultVideoPath) ? defaultVideoPath : null);

  const coverPath = path.join(ROOT, 'output/covers', series, `${epId}.jpg`);
  const srtPath = path.join(ROOT, 'output/srt', series, `${epId}.srt`);

  return {
    videoPath,
    coverPath: fs.existsSync(coverPath) ? coverPath : null,
    srtPath: fs.existsSync(srtPath) ? srtPath : null,
  };
}

function resolveRepoRelativeAssetPath(assetPath: string): { resolvedPath: string | null; issue?: string } {
  if (path.isAbsolute(assetPath)) {
    return fs.existsSync(assetPath)
      ? { resolvedPath: assetPath }
      : { resolvedPath: null, issue: `imageAssets file not found: ${assetPath}` };
  }

  const resolvedPath = path.resolve(ROOT, assetPath);
  const relative = path.relative(ROOT, resolvedPath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    return {
      resolvedPath: null,
      issue: `imageAssets must be repo-root-relative or absolute: ${assetPath}`,
    };
  }

  return fs.existsSync(resolvedPath)
    ? { resolvedPath }
    : { resolvedPath: null, issue: `imageAssets file not found: ${assetPath}` };
}

function resolvePrimarySocialImagePath(
  metadata: EpisodeMetadata | null,
  assets: ResolvedAssets,
): { imagePath: string | null; issue?: string } {
  const imageAsset = metadata?.social?.imageAssets?.[0];
  if (!imageAsset) {
    return { imagePath: assets.coverPath };
  }

  const resolved = resolveRepoRelativeAssetPath(imageAsset);
  if (resolved.issue) return { imagePath: null, issue: resolved.issue };
  return { imagePath: resolved.resolvedPath };
}

function saveUploadResult(series: string, epId: string, platform: string, data: unknown): void {
  const ctx = resolveSeriesContext(series);
  const outDir = path.join(ctx.publicEpisodesDir, epId);
  fs.mkdirSync(outDir, { recursive: true });

  const outPath = path.join(outDir, `upload-result-${platform}.json`);
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`   Result saved: ${path.relative(ROOT, outPath)}`);
}

async function uploadToThreads(
  opts: UploadOptions,
  assets: ResolvedAssets,
  metadata: EpisodeMetadata | null,
): Promise<ThreadsPostResult[] | null> {
  console.log(`\n🧵 Threads Upload: ${opts.series}/${opts.epId}`);
  console.log(`${'─'.repeat(50)}`);

  const posts = metadata?.social?.posts;
  if (!posts || posts.length === 0) {
    console.error(`❌ No social posts found`);
    console.error(`   Run first: ${prepareHint('social', opts.series, opts.epId)}`);
    return null;
  }

  const imageResolution = resolvePrimarySocialImagePath(metadata, assets);
  if (imageResolution.issue) {
    console.error(`❌ ${imageResolution.issue}`);
    return null;
  }
  const imagePath = imageResolution.imagePath;

  console.log(`   Posts:        ${posts.length}`);
  if (imagePath) console.log(`   Image:        ${path.basename(imagePath)}`);

  if (opts.dryRun) {
    console.log(`\n   DRY RUN: would post to Threads`);
    return null;
  }

  const creds = loadThreadsCredentials();
  const results: ThreadsPostResult[] = [];

  console.log(`\n   Posting thread...`);
  let firstResult: ThreadsPostResult;
  if (imagePath && fs.existsSync(imagePath)) {
    console.log(`   Uploading image to Imgur...`);
    const imageUrl = await imgurUpload(imagePath);
    firstResult = await publishImagePost(creds, imageUrl, posts[0]);
  } else {
    firstResult = await publishTextPost(creds, posts[0]);
  }
  results.push(firstResult);
  console.log(`   Post 1 published (${firstResult.postId})`);

  let lastPostId = firstResult.postId;
  for (let i = 1; i < posts.length; i++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const replyResult = await replyToPost(creds, lastPostId, posts[i]);
    results.push(replyResult);
    lastPostId = replyResult.postId;
    console.log(`   Post ${i + 1} published (${replyResult.postId})`);
  }

  saveUploadResult(opts.series, opts.epId, 'threads', {
    posts: results,
    publishedAt: new Date().toISOString(),
  });

  return results;
}

async function uploadToFBGroup(
  opts: UploadOptions,
  assets: ResolvedAssets,
  metadata: EpisodeMetadata | null,
): Promise<boolean> {
  console.log(`\n📘 FB Group Upload: ${opts.series}/${opts.epId}`);
  console.log(`${'─'.repeat(50)}`);

  const groupId = process.env.FB_GROUP_ID;
  const accessToken = process.env.FB_ACCESS_TOKEN;
  if (!groupId || !accessToken) {
    const missing = [!groupId && 'FB_GROUP_ID', !accessToken && 'FB_ACCESS_TOKEN'].filter(Boolean);
    console.error(`❌ Missing env vars: ${missing.join(', ')}`);
    return false;
  }

  const postText = metadata?.social?.posts?.[0];
  if (!postText) {
    console.error(`❌ No social post text found`);
    console.error(`   Run first: ${prepareHint('social', opts.series, opts.epId)}`);
    return false;
  }

  const imageResolution = resolvePrimarySocialImagePath(metadata, assets);
  if (imageResolution.issue) {
    console.error(`❌ ${imageResolution.issue}`);
    return false;
  }
  const imagePath = imageResolution.imagePath;

  if (opts.dryRun) {
    console.log(`\n   DRY RUN: would post to FB Group`);
    return true;
  }

  if (imagePath && fs.existsSync(imagePath)) {
    const formData = new FormData();
    const imageBuffer = fs.readFileSync(imagePath);
    formData.append('source', new Blob([imageBuffer], { type: 'image/jpeg' }), path.basename(imagePath));
    formData.append('message', postText);
    formData.append('access_token', accessToken);

    const res = await fetch(`https://graph.facebook.com/v21.0/${groupId}/photos`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`❌ FB Group photo post failed (${res.status}): ${errBody}`);
      return false;
    }
  } else {
    const res = await fetch(`https://graph.facebook.com/v21.0/${groupId}/feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: postText, access_token: accessToken }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error(`❌ FB Group post failed (${res.status}): ${errBody}`);
      return false;
    }
  }

  saveUploadResult(opts.series, opts.epId, 'fbgroup', {
    publishedAt: new Date().toISOString(),
  });
  return true;
}

function preflightCheck(
  opts: UploadOptions,
  metadata: EpisodeMetadata | null,
): boolean {
  const blockers: string[] = [];

  if (!metadata?.social?.posts?.[0]) {
    blockers.push(`No social posts — run: ${prepareHint('social', opts.series, opts.epId)}`);
  }
  if (!metadata?.publish?.youtubeUrl) {
    blockers.push(`No metadata.publish.youtubeUrl — upload YouTube first, then run: ${prepareHint('social', opts.series, opts.epId)}`);
  }

  if (blockers.length > 0) {
    console.log(`\n⚠️  Preflight issues:`);
    for (const issue of blockers) {
      console.log(`   • ${issue}`);
    }
    return false;
  }

  return true;
}

function buildCoreYoutubeArgs(opts: UploadOptions): string[] {
  const target = `${opts.series}/${opts.epId}`;
  const args = ['youtube', target, '--privacy', opts.privacy];
  if (opts.dryRun) args.push('--dry-run');
  if (opts.schedule) args.push('--schedule', opts.schedule);
  if (opts.videoPath) args.push('--video', opts.videoPath);
  if (opts.noThumbnail) args.push('--no-thumbnail');
  if (opts.noSrt) args.push('--no-srt');
  return args;
}

export async function run(args: string[]) {
  const opts = parseArgs(args);
  const target = `${opts.series}/${opts.epId}`;
  const assets = resolveAssets(opts.series, opts.epId, opts.videoPath);

  if (opts.platform === 'all') {
    await runCoreUpload(buildCoreYoutubeArgs(opts));
  }

  const metadata = await loadEpisodeMetadata(opts.series, opts.epId);
  if (!preflightCheck(opts, metadata)) {
    process.exit(1);
  }

  const platforms = opts.platform === 'all' ? ['threads', 'fbgroup'] as const : [opts.platform];
  for (const platform of platforms) {
    if (platform === 'threads') {
      const result = await uploadToThreads(opts, assets, metadata);
      if (!opts.dryRun && !result) {
        process.exit(1);
      }
      continue;
    }

    const success = await uploadToFBGroup(opts, assets, metadata);
    if (!opts.dryRun && !success) {
      process.exit(1);
    }
  }

  console.log(`\n🎉 Social upload command finished: ${target}`);
}
