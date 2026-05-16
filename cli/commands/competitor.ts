import { mkdir, writeFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  loadCredentials,
  searchVideos,
  getVideoDetails,
  getChannelVideos,
  fetchTranscript,
  isFresh,
  getMissingYouTubeCredentialKeys,
  parseDuration,
  type VideoSnippet,
  type SearchOptions,
  type TranscriptResult,
} from '../lib/youtube-client';

const HELP = `
Usage:
  npx ars competitor search  --q <query> [options]
  npx ars competitor channel --id <channelId> [options]
  npx ars competitor captions --video-id <id> [--lang zh-Hant] [--plain]

Subcommands:
  search           Search YouTube by keyword and return enriched video stats
  channel          Fetch top videos from a specific channel with full stats
  captions         Download captions/transcript for a single video

search options:
  --q <query>      Search query (required)
  --max N          Results count (default 20, max 50)
  --order          relevance (default) | viewCount | date | rating
  --region         Region code (default: TW)
  --lang           Relevance language (default: zh-Hant)
  --duration       any (default) | short (<4m) | medium (4–20m) | long (>20m)
  --after          Published after YYYY-MM-DD
  --captions       Also fetch captions for top N results (default 3 if flag present)
  --covers <dir>   Also download cover thumbnails for all results into <dir>

channel options:
  --id <channelId> Channel ID, e.g. UCxxxxxxx (required)
  --max N          Results count (default 30, max 50)
  --order          viewCount (default) | date | relevance | rating
  --after          Published after YYYY-MM-DD
  --captions       Also fetch captions for top N results (default 3)
  --covers <dir>   Also download cover thumbnails for all results into <dir>

captions options:
  --video-id <id>  YouTube video ID (required)
  --lang           Preferred transcript language (default: zh-Hant zh en)
  --plain          Output plain text instead of JSON

global options:
  --fresh          Bypass cache
  -h, --help       Show this help

Output:
  JSON with { query/channelId, fetchedAt, results[] }
  Each result: title, channel, publishedAt, durationFormatted, viewCount,
  likeCount, commentCount, likeRatio, tags, descSections[], captions?
`;

// ── Types ──

interface DescSection {
  timestamp: string;  // e.g. "0:00"
  seconds: number;
  label: string;
}

// CaptionResult re-exported from youtube-client via fetchTranscript return type

interface CompetitorVideo {
  videoId: string;
  url: string;
  title: string;
  channelTitle: string;
  channelId: string;
  publishedAt: string;
  durationSeconds: number;
  durationFormatted: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  likeRatio: number | null;
  tags: string[];
  description: string;
  descSections: DescSection[];
  thumbnailUrl: string;
  captions?: TranscriptResult | { error: string };
}

// ── Helpers ──

function formatDur(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function timestampToSeconds(ts: string): number {
  const parts = ts.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}

/** Parse chapter/section timestamps from a YouTube description */
function parseDescSections(description: string): DescSection[] {
  // Matches: 0:00, 00:00, 0:00:00 followed by optional separator and label
  const pattern = /(?:^|\n)\(?(\d{1,2}:\d{2}(?::\d{2})?)\)?[\s\-–—|\.]+(.+)/gm;
  const sections: DescSection[] = [];
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(description)) !== null) {
    const ts = match[1].trim();
    const label = match[2].trim().slice(0, 80);
    if (label.length < 2) continue;
    sections.push({ timestamp: ts, seconds: timestampToSeconds(ts), label });
  }
  return sections;
}

async function getCaptions(videoId: string, langs: string[]) {
  return fetchTranscript(videoId, langs);
}

async function downloadCovers(
  videos: { videoId: string; thumbnailUrl: string }[],
  dir: string,
): Promise<{ saved: number; skipped: number; failed: number }> {
  const outDir = resolve(dir);
  await mkdir(outDir, { recursive: true });

  let saved = 0;
  let skipped = 0;
  let failed = 0;

  await Promise.all(videos.map(async (v) => {
    if (!v.thumbnailUrl) { failed += 1; return; }
    const dest = resolve(outDir, `${v.videoId}.jpg`);
    try {
      await access(dest);
      skipped += 1;
      return;
    } catch {
      // not exist, fall through to download
    }
    try {
      const res = await fetch(v.thumbnailUrl);
      if (!res.ok) { failed += 1; return; }
      const buf = Buffer.from(await res.arrayBuffer());
      await writeFile(dest, buf);
      saved += 1;
    } catch {
      failed += 1;
    }
  }));

  return { saved, skipped, failed };
}

function buildVideo(
  snippet: VideoSnippet & { channelId?: string },
  captionsResult?: TranscriptResult | { error: string },
): CompetitorVideo {
  const durationSeconds = parseDuration(snippet.duration);
  const likeRatio =
    snippet.viewCount > 0
      ? Math.round((snippet.likeCount / snippet.viewCount) * 10000) / 10000
      : null;
  const descSections = parseDescSections(snippet.description);

  const result: CompetitorVideo = {
    videoId: snippet.videoId,
    url: `https://www.youtube.com/watch?v=${snippet.videoId}`,
    title: snippet.title,
    channelTitle: snippet.channelTitle,
    channelId: snippet.channelId ?? '',
    publishedAt: snippet.publishedAt,
    durationSeconds,
    durationFormatted: formatDur(durationSeconds),
    viewCount: snippet.viewCount,
    likeCount: snippet.likeCount,
    commentCount: snippet.commentCount,
    likeRatio,
    tags: snippet.tags,
    description: snippet.description.slice(0, 600),
    descSections,
    thumbnailUrl: snippet.thumbnailUrl ?? '',
  };

  if (captionsResult !== undefined) result.captions = captionsResult;
  return result;
}

// ── Arg parsers ──

function getFlag(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : undefined;
}

function hasFlag(args: string[], flag: string): boolean {
  return args.includes(flag);
}

function parseCaptionsN(args: string[]): number {
  // --captions alone → 3, --captions N → N
  const idx = args.indexOf('--captions');
  if (idx === -1) return 0;
  const next = args[idx + 1];
  if (next && /^\d+$/.test(next)) return Math.min(parseInt(next, 10), 10);
  return 3;
}

// ── Subcommands ──

async function runSearch(args: string[]): Promise<void> {
  const q = getFlag(args, '--q');
  if (!q) throw new Error('--q <query> is required');

  const fresh = isFresh(args);
  const captionsN = parseCaptionsN(args);
  const maxRaw = getFlag(args, '--max');
  const options: SearchOptions = {
    q,
    maxResults: maxRaw ? Math.min(parseInt(maxRaw, 10), 50) : 20,
    order: (getFlag(args, '--order') ?? 'relevance') as SearchOptions['order'],
    regionCode: getFlag(args, '--region') ?? 'TW',
    relevanceLanguage: getFlag(args, '--lang') ?? 'zh-Hant',
    videoDuration: (getFlag(args, '--duration') ?? 'any') as SearchOptions['videoDuration'],
    publishedAfter: getFlag(args, '--after')
      ? `${getFlag(args, '--after')}T00:00:00Z`
      : undefined,
  };

  const creds = loadCredentials();
  const searchResults = await searchVideos(creds, options, fresh);
  if (!searchResults.length) {
    process.stdout.write(JSON.stringify({ query: q, fetchedAt: new Date().toISOString().slice(0, 10), results: [] }, null, 2) + '\n');
    return;
  }

  const channelMap = new Map(searchResults.map((r) => [r.videoId, r.channelId]));
  const details = await getVideoDetails(creds, searchResults.map((r) => r.videoId), fresh);
  details.sort((a, b) => b.viewCount - a.viewCount);

  const results: CompetitorVideo[] = await Promise.all(details.map(async (d, i) => {
    const caps = i < captionsN ? await getCaptions(d.videoId, ['zh-Hant', 'zh-TW', 'zh', 'zh-Hans', 'en']) : undefined;
    return buildVideo({ ...d, channelId: channelMap.get(d.videoId) }, caps);
  }));

  const coversDir = getFlag(args, '--covers');
  const covers = coversDir ? await downloadCovers(results, coversDir) : undefined;

  process.stdout.write(JSON.stringify({
    query: q,
    fetchedAt: new Date().toISOString().slice(0, 10),
    options: { order: options.order, region: options.regionCode, lang: options.relevanceLanguage, duration: options.videoDuration },
    ...(covers ? { covers: { dir: resolve(coversDir!), ...covers } } : {}),
    results,
  }, null, 2) + '\n');
}

async function runChannel(args: string[]): Promise<void> {
  const channelId = getFlag(args, '--id');
  if (!channelId) throw new Error('--id <channelId> is required');

  const fresh = isFresh(args);
  const captionsN = parseCaptionsN(args);
  const maxRaw = getFlag(args, '--max');
  const order = (getFlag(args, '--order') ?? 'viewCount') as 'viewCount' | 'date' | 'relevance' | 'rating';
  const publishedAfter = getFlag(args, '--after')
    ? `${getFlag(args, '--after')}T00:00:00Z`
    : undefined;

  const creds = loadCredentials();

  const searchResults = await getChannelVideos(creds, {
    channelId,
    maxResults: maxRaw ? Math.min(parseInt(maxRaw, 10), 50) : 30,
    order,
    publishedAfter,
  }, fresh);

  if (!searchResults.length) {
    process.stdout.write(JSON.stringify({ channelId, fetchedAt: new Date().toISOString().slice(0, 10), results: [] }, null, 2) + '\n');
    return;
  }

  // channelTitle from playlist results (more reliable than getChannelInfo which uses mine=true)
  const channelTitle = searchResults[0]?.channelTitle ?? channelId;

  const details = await getVideoDetails(creds, searchResults.map((r) => r.videoId), fresh);
  details.sort((a, b) => b.viewCount - a.viewCount);

  const results: CompetitorVideo[] = await Promise.all(details.map(async (d, i) => {
    const caps = i < captionsN ? await getCaptions(d.videoId, ['zh-Hant', 'zh-TW', 'zh', 'zh-Hans', 'en']) : undefined;
    return buildVideo({ ...d, channelId }, caps);
  }));

  const coversDir = getFlag(args, '--covers');
  const covers = coversDir ? await downloadCovers(results, coversDir) : undefined;

  process.stdout.write(JSON.stringify({
    channelId,
    channelTitle,
    fetchedAt: new Date().toISOString().slice(0, 10),
    options: { order, maxResults: results.length },
    ...(covers ? { covers: { dir: resolve(coversDir!), ...covers } } : {}),
    results,
  }, null, 2) + '\n');
}

async function runCaptions(args: string[]): Promise<void> {
  const videoId = getFlag(args, '--video-id');
  if (!videoId) throw new Error('--video-id <id> is required');

  const langArg = getFlag(args, '--lang');
  const langs = langArg ? [langArg] : ['zh-Hant', 'zh-TW', 'zh', 'zh-Hans', 'en'];
  const plain = hasFlag(args, '--plain');

  const result = await getCaptions(videoId, langs);

  if (plain && 'text' in result) {
    process.stdout.write(result.text + '\n');
  } else {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  }
}

// ── Entry ──

export async function run(args: string[]): Promise<void> {
  const [subcommand, ...rest] = args;

  if (!subcommand || subcommand === '-h' || subcommand === '--help') {
    console.log(HELP.trim());
    return;
  }

  const missing = getMissingYouTubeCredentialKeys();
  if (missing.length > 0 && subcommand !== 'captions') {
    console.error(`[ars] YouTube credentials missing: ${missing.join(', ')}`);
    process.exit(1);
  }

  switch (subcommand) {
    case 'search':   await runSearch(rest); break;
    case 'channel':  await runChannel(rest); break;
    case 'captions': await runCaptions(rest); break;
    default:
      console.error(`Unknown competitor subcommand: ${subcommand}`);
      console.log(HELP.trim());
      process.exit(1);
  }
}
