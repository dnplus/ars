import {
  loadCredentials,
  getChannelInfo,
  queryAnalytics,
  getVideoDetails,
  rowsToObjects,
  safeEndDate,
  daysAgo,
  parseDaysFlag,
  isFresh,
  getMissingYouTubeCredentialKeys,
  type AnalyticsResponse,
  type ChannelInfo,
  type VideoSnippet,
} from '../lib/youtube-client';

const HELP = `
Usage:
  npx ars analytics fetch [--days N] [--fresh] [--top N]

Subcommands:
  fetch            Fetch channel + summary + daily + top-videos JSON snapshot

Options:
  --days N         Lookback window (default 28, max 365)
  --fresh          Bypass local .cache/youtube-analytics/ cache
  --top N          Number of top videos to include (default 10, max 50)
  -h, --help       Show this help

Output:
  Prints a single JSON object to stdout with { window, channel, summary,
  daily, topVideos }. Intended to be consumed by /ars:analytics or any other
  tool that wants raw YouTube analytics data without re-implementing the API
  flow.
`;

interface FetchOptions {
  days: number;
  fresh: boolean;
  top: number;
}

interface DailyRow {
  day: string;
  views: number;
  estimatedMinutesWatched: number;
  subscribersGained: number;
}

interface TopVideoRow {
  videoId: string;
  views: number;
  estimatedMinutesWatched: number;
  averageViewDuration: number;
  averageViewPercentage: number;
  title?: string;
  publishedAt?: string;
  durationSeconds?: number;
}

interface Snapshot {
  window: {
    days: number;
    startDate: string;
    endDate: string;
  };
  channel: ChannelInfo;
  summary: Record<string, number>;
  daily: DailyRow[];
  topVideos: TopVideoRow[];
}

function parseFetchOptions(args: string[]): FetchOptions {
  const days = parseDaysFlag(args, 28);
  const fresh = isFresh(args);
  const topIdx = args.indexOf('--top');
  let top = 10;
  if (topIdx !== -1 && args[topIdx + 1]) {
    const parsed = parseInt(args[topIdx + 1], 10);
    if (parsed > 0 && parsed <= 50) top = parsed;
  }
  return { days, fresh, top };
}

function toNumber(value: string | number | undefined, fallback = 0): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function summaryFromResponse(response: AnalyticsResponse): Record<string, number> {
  const row = response.rows?.[0];
  if (!row) return {};
  const result: Record<string, number> = {};
  response.columnHeaders.forEach((header, index) => {
    result[header.name] = toNumber(row[index]);
  });
  return result;
}

function dailyFromResponse(response: AnalyticsResponse): DailyRow[] {
  return rowsToObjects(response).map((row) => ({
    day: String(row.day ?? ''),
    views: toNumber(row.views),
    estimatedMinutesWatched: toNumber(row.estimatedMinutesWatched),
    subscribersGained: toNumber(row.subscribersGained),
  }));
}

function topVideosFromResponse(response: AnalyticsResponse): TopVideoRow[] {
  return rowsToObjects(response).map((row) => ({
    videoId: String(row.video ?? ''),
    views: toNumber(row.views),
    estimatedMinutesWatched: toNumber(row.estimatedMinutesWatched),
    averageViewDuration: toNumber(row.averageViewDuration),
    averageViewPercentage: toNumber(row.averageViewPercentage),
  }));
}

function enrichTopVideos(
  rows: TopVideoRow[],
  details: VideoSnippet[],
): TopVideoRow[] {
  const byId = new Map(details.map((video) => [video.videoId, video]));
  return rows.map((row) => {
    const snippet = byId.get(row.videoId);
    if (!snippet) return row;
    return {
      ...row,
      title: snippet.title,
      publishedAt: snippet.publishedAt,
    };
  });
}

async function runFetch(args: string[]): Promise<void> {
  const missing = getMissingYouTubeCredentialKeys();
  if (missing.length > 0) {
    console.error(
      `[ars] YouTube credentials missing: ${missing.join(', ')}. Add them to .env.`,
    );
    process.exit(1);
  }

  const options = parseFetchOptions(args);
  const creds = loadCredentials();
  const endDate = safeEndDate();
  const startDate = daysAgo(options.days + 2);

  const [channel, summaryResponse, dailyResponse, topResponse] = await Promise.all([
    getChannelInfo(creds, options.fresh),
    queryAnalytics(
      creds,
      {
        startDate,
        endDate,
        metrics:
          'views,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost,likes,comments,shares',
      },
      options.fresh,
    ),
    queryAnalytics(
      creds,
      {
        startDate,
        endDate,
        metrics: 'views,estimatedMinutesWatched,subscribersGained',
        dimensions: 'day',
        sort: 'day',
      },
      options.fresh,
    ),
    queryAnalytics(
      creds,
      {
        startDate,
        endDate,
        metrics:
          'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage',
        dimensions: 'video',
        sort: '-views',
        maxResults: options.top,
      },
      options.fresh,
    ),
  ]);

  const topRows = topVideosFromResponse(topResponse);
  const videoIds = topRows.map((row) => row.videoId).filter(Boolean);
  const videoDetails = videoIds.length > 0
    ? await getVideoDetails(creds, videoIds, options.fresh)
    : [];

  const snapshot: Snapshot = {
    window: {
      days: options.days,
      startDate,
      endDate,
    },
    channel,
    summary: summaryFromResponse(summaryResponse),
    daily: dailyFromResponse(dailyResponse),
    topVideos: enrichTopVideos(topRows, videoDetails),
  };

  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
}

export async function run(args: string[]): Promise<void> {
  const [subcommand, ...rest] = args;

  if (!subcommand || subcommand === '-h' || subcommand === '--help') {
    console.log(HELP.trim());
    return;
  }

  if (subcommand === 'fetch') {
    await runFetch(rest);
    return;
  }

  console.error(`Unknown analytics subcommand: ${subcommand}`);
  console.log(HELP.trim());
  process.exit(1);
}
