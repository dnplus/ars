/**
 * @module cli/lib/youtube-client
 * @description YouTube API client with token refresh, Analytics + Data API queries, and local caching.
 *
 * Environment variables required:
 *   YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN
 *
 * Cache: JSON files in .cache/youtube-analytics/ with 24h TTL.
 * Use --fresh flag to bypass cache.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// ── Config ──

const ANALYTICS_BASE = 'https://youtubeanalytics.googleapis.com/v2/reports';
const DATA_API_BASE = 'https://www.googleapis.com/youtube/v3';
const CACHE_DIR = path.resolve(__dirname, '../../.cache/youtube-analytics');
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ── Types ──

export interface YouTubeCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

export interface AccessTokenInfo {
  scope: string[];
  expiresIn?: number;
  audience?: string;
}

export interface AnalyticsQuery {
  startDate: string;
  endDate: string;
  metrics: string;
  dimensions?: string;
  filters?: string;
  sort?: string;
  maxResults?: number;
}

export interface AnalyticsResponse {
  kind: string;
  columnHeaders: Array<{
    name: string;
    columnType: 'DIMENSION' | 'METRIC';
    dataType: string;
  }>;
  rows: Array<Array<string | number>>;
}

export interface VideoSnippet {
  videoId: string;
  title: string;
  description: string;
  tags: string[];
  publishedAt: string;
  channelTitle: string;
  thumbnailUrl: string;
  categoryId: string;
  duration: string; // ISO 8601
  viewCount: number;
  likeCount: number;
  commentCount: number;
}

export interface ChannelInfo {
  channelId: string;
  title: string;
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
}

// ── Credentials ──

export function getMissingYouTubeCredentialKeys(): string[] {
  return [
    !process.env.YOUTUBE_CLIENT_ID && 'YOUTUBE_CLIENT_ID',
    !process.env.YOUTUBE_CLIENT_SECRET && 'YOUTUBE_CLIENT_SECRET',
    !process.env.YOUTUBE_REFRESH_TOKEN && 'YOUTUBE_REFRESH_TOKEN',
  ].filter(Boolean) as string[];
}

export function printMissingYouTubeCredentialsMessage(): void {
  const missing = getMissingYouTubeCredentialKeys();
  if (missing.length === 0) return;

  console.error(
    'Error: YouTube credentials not configured. Set YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN in .env',
  );
  console.error(`Missing: ${missing.join(', ')}`);
}

export function loadCredentials(): YouTubeCredentials {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    printMissingYouTubeCredentialsMessage();
    process.exit(1);
  }

  return { clientId, clientSecret, refreshToken };
}

// ── Token Refresh ──

let cachedAccessToken: { token: string; expiresAt: number } | null = null;

export async function getAccessToken(creds: YouTubeCredentials): Promise<string> {
  if (cachedAccessToken && Date.now() < cachedAccessToken.expiresAt - 60_000) {
    return cachedAccessToken.token;
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: creds.refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (data.error || !data.access_token) {
    throw new Error(
      `Token refresh failed: ${data.error ?? 'no access_token'} — ${data.error_description ?? ''}`
    );
  }

  cachedAccessToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };

  return data.access_token;
}

export async function getAccessTokenInfo(
  creds: YouTubeCredentials,
): Promise<AccessTokenInfo> {
  const token = await getAccessToken(creds);
  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`,
  );

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Token info lookup failed (${res.status}): ${errBody}`);
  }

  const data = (await res.json()) as {
    scope?: string;
    expires_in?: string;
    aud?: string;
  };

  return {
    scope: (data.scope ?? '')
      .split(' ')
      .map((s) => s.trim())
      .filter(Boolean),
    expiresIn: data.expires_in ? Number(data.expires_in) : undefined,
    audience: data.aud,
  };
}

// ── Cache ──

function cacheKey(prefix: string, params: Record<string, string | number | undefined>): string {
  const hash = crypto
    .createHash('md5')
    .update(JSON.stringify({ prefix, ...params }))
    .digest('hex')
    .slice(0, 12);
  return `${prefix}_${hash}.json`;
}

function readCache<T>(key: string): T | null {
  const filePath = path.join(CACHE_DIR, key);
  if (!fs.existsSync(filePath)) return null;

  const stat = fs.statSync(filePath);
  if (Date.now() - stat.mtimeMs > CACHE_TTL_MS) {
    fs.unlinkSync(filePath);
    return null;
  }

  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

function writeCache(key: string, data: unknown): void {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.writeFileSync(path.join(CACHE_DIR, key), JSON.stringify(data, null, 2), 'utf-8');
}

export function clearCache(): void {
  if (fs.existsSync(CACHE_DIR)) {
    fs.rmSync(CACHE_DIR, { recursive: true });
    console.log('🗑️  Cache cleared.');
  }
}

// ── Analytics API ──

export async function queryAnalytics(
  creds: YouTubeCredentials,
  query: AnalyticsQuery,
  fresh = false,
): Promise<AnalyticsResponse> {
  const ck = cacheKey('analytics', query as unknown as Record<string, string | number | undefined>);
  if (!fresh) {
    const cached = readCache<AnalyticsResponse>(ck);
    if (cached) return cached;
  }

  const token = await getAccessToken(creds);

  const url = new URL(ANALYTICS_BASE);
  url.searchParams.set('ids', 'channel==MINE');
  url.searchParams.set('startDate', query.startDate);
  url.searchParams.set('endDate', query.endDate);
  url.searchParams.set('metrics', query.metrics);
  if (query.dimensions) url.searchParams.set('dimensions', query.dimensions);
  if (query.filters) url.searchParams.set('filters', query.filters);
  if (query.sort) url.searchParams.set('sort', query.sort);
  if (query.maxResults) url.searchParams.set('maxResults', String(query.maxResults));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Analytics API error (${res.status}): ${errBody}`);
  }

  const data = (await res.json()) as AnalyticsResponse;
  writeCache(ck, data);
  return data;
}

// ── Data API: Video Details ──

export async function getVideoDetails(
  creds: YouTubeCredentials,
  videoIds: string[],
  fresh = false,
): Promise<VideoSnippet[]> {
  if (videoIds.length === 0) return [];

  const ck = cacheKey('videos', { ids: videoIds.join(',') });
  if (!fresh) {
    const cached = readCache<VideoSnippet[]>(ck);
    if (cached) return cached;
  }

  const token = await getAccessToken(creds);
  const results: VideoSnippet[] = [];

  // Batch in groups of 50 (API max)
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const url = new URL(`${DATA_API_BASE}/videos`);
    url.searchParams.set('part', 'snippet,statistics,contentDetails');
    url.searchParams.set('id', batch.join(','));

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Data API error (${res.status}): ${errBody}`);
    }

    const data = (await res.json()) as {
      items: Array<{
        id: string;
        snippet: {
          title: string;
          description: string;
          tags?: string[];
          publishedAt: string;
          channelTitle: string;
          thumbnails?: { medium?: { url: string } };
          categoryId: string;
        };
        statistics: {
          viewCount: string;
          likeCount: string;
          commentCount: string;
        };
        contentDetails: { duration: string };
      }>;
    };

    for (const item of data.items ?? []) {
      results.push({
        videoId: item.id,
        title: item.snippet.title,
        description: item.snippet.description,
        tags: item.snippet.tags ?? [],
        publishedAt: item.snippet.publishedAt,
        channelTitle: item.snippet.channelTitle,
        thumbnailUrl: item.snippet.thumbnails?.medium?.url ?? '',
        categoryId: item.snippet.categoryId,
        duration: item.contentDetails.duration,
        viewCount: parseInt(item.statistics.viewCount ?? '0', 10),
        likeCount: parseInt(item.statistics.likeCount ?? '0', 10),
        commentCount: parseInt(item.statistics.commentCount ?? '0', 10),
      });
    }
  }

  writeCache(ck, results);
  return results;
}

// ── Data API: Channel Info ──

export async function getChannelInfo(
  creds: YouTubeCredentials,
  fresh = false,
): Promise<ChannelInfo> {
  const ck = cacheKey('channel', { mine: 'true' });
  if (!fresh) {
    const cached = readCache<ChannelInfo>(ck);
    if (cached) return cached;
  }

  const token = await getAccessToken(creds);
  const url = new URL(`${DATA_API_BASE}/channels`);
  url.searchParams.set('part', 'snippet,statistics');
  url.searchParams.set('mine', 'true');

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Data API error (${res.status}): ${errBody}`);
  }

  const data = (await res.json()) as {
    items: Array<{
      id: string;
      snippet: { title: string };
      statistics: {
        subscriberCount: string;
        videoCount: string;
        viewCount: string;
      };
    }>;
  };

  const ch = data.items?.[0];
  if (!ch) throw new Error('No channel found for this account.');

  const info: ChannelInfo = {
    channelId: ch.id,
    title: ch.snippet.title,
    subscriberCount: parseInt(ch.statistics.subscriberCount ?? '0', 10),
    videoCount: parseInt(ch.statistics.videoCount ?? '0', 10),
    viewCount: parseInt(ch.statistics.viewCount ?? '0', 10),
  };

  writeCache(ck, info);
  return info;
}

// ── Helpers ──

/** Parse ISO 8601 duration (PT1H2M3S) to seconds */
export function parseDuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (parseInt(match[1] ?? '0') * 3600) +
    (parseInt(match[2] ?? '0') * 60) +
    parseInt(match[3] ?? '0');
}

/** Format seconds to human readable (e.g. 3661 → "1h 1m 1s") */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s || parts.length === 0) parts.push(`${s}s`);
  return parts.join(' ');
}

/** Format a number with comma separators (e.g. 1234567 → "1,234,567") */
export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

/** Format percentage (e.g. 0.0532 → "5.32%") */
export function formatPercent(n: number): string {
  return `${(n * 100).toFixed(2)}%`;
}

/** Get date string N days ago in YYYY-MM-DD */
export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Get today's date minus 2 days (data delay) in YYYY-MM-DD */
export function safeEndDate(): string {
  return daysAgo(2);
}

/** Parse --days flag or return default 28 */
export function parseDaysFlag(args: string[], defaultDays = 28): number {
  const idx = args.indexOf('--days');
  if (idx !== -1 && args[idx + 1]) {
    const d = parseInt(args[idx + 1], 10);
    if (d > 0 && d <= 365) return d;
  }
  return defaultDays;
}

/** Check if --fresh flag is present */
export function isFresh(args: string[]): boolean {
  return args.includes('--fresh');
}

/** Convert analytics rows to named objects */
export function rowsToObjects(
  response: AnalyticsResponse,
): Array<Record<string, string | number>> {
  const headers = response.columnHeaders.map((h) => h.name);
  return (response.rows ?? []).map((row) => {
    const obj: Record<string, string | number> = {};
    headers.forEach((h, i) => {
      obj[h] = row[i];
    });
    return obj;
  });
}

// ── Data API: Search Videos ──

export interface SearchOptions {
  q: string;
  maxResults?: number;        // 1–50, default 20
  order?: 'relevance' | 'viewCount' | 'date' | 'rating';
  regionCode?: string;        // e.g. 'TW'
  relevanceLanguage?: string; // e.g. 'zh-Hant'
  videoDuration?: 'any' | 'short' | 'medium' | 'long';
  publishedAfter?: string;    // ISO 8601, e.g. '2025-01-01T00:00:00Z'
}

export interface SearchResult {
  videoId: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  publishedAt: string;
  thumbnailUrl: string;
}

export async function searchVideos(
  creds: YouTubeCredentials,
  options: SearchOptions,
  fresh = false,
): Promise<SearchResult[]> {
  const ck = cacheKey('search', options as unknown as Record<string, string | number | undefined>);
  if (!fresh) {
    const cached = readCache<SearchResult[]>(ck);
    if (cached) return cached;
  }

  const token = await getAccessToken(creds);
  const url = new URL(`${DATA_API_BASE}/search`);
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('type', 'video');
  url.searchParams.set('q', options.q);
  url.searchParams.set('maxResults', String(Math.min(options.maxResults ?? 20, 50)));
  if (options.order) url.searchParams.set('order', options.order);
  if (options.regionCode) url.searchParams.set('regionCode', options.regionCode);
  if (options.relevanceLanguage) url.searchParams.set('relevanceLanguage', options.relevanceLanguage);
  if (options.videoDuration) url.searchParams.set('videoDuration', options.videoDuration);
  if (options.publishedAfter) url.searchParams.set('publishedAfter', options.publishedAfter);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Data API search error (${res.status}): ${errBody}`);
  }

  const data = (await res.json()) as {
    items: Array<{
      id: { videoId: string };
      snippet: {
        title: string;
        description: string;
        channelId: string;
        channelTitle: string;
        publishedAt: string;
        thumbnails?: { medium?: { url: string } };
      };
    }>;
  };

  const results: SearchResult[] = (data.items ?? []).map((item) => ({
    videoId: item.id.videoId,
    title: item.snippet.title,
    description: item.snippet.description,
    channelId: item.snippet.channelId,
    channelTitle: item.snippet.channelTitle,
    publishedAt: item.snippet.publishedAt,
    thumbnailUrl: item.snippet.thumbnails?.medium?.url ?? '',
  }));

  writeCache(ck, results);
  return results;
}

// ── Data API: Channel Videos ──

export interface ChannelVideosOptions {
  channelId: string;
  maxResults?: number;  // 1–50, default 30
  order?: 'viewCount' | 'date' | 'relevance' | 'rating';
  publishedAfter?: string;
}

export async function getChannelVideos(
  creds: YouTubeCredentials,
  options: ChannelVideosOptions,
  fresh = false,
): Promise<SearchResult[]> {
  const ck = cacheKey('chvideos', options as unknown as Record<string, string | number | undefined>);
  if (!fresh) {
    const cached = readCache<SearchResult[]>(ck);
    if (cached) return cached;
  }

  const token = await getAccessToken(creds);

  // Step 1: resolve uploads playlist ID (channelId UC... → UU...)
  // This is more reliable than search.list?channelId which often returns 0 results
  const chUrl = new URL(`${DATA_API_BASE}/channels`);
  chUrl.searchParams.set('part', 'contentDetails,snippet');
  chUrl.searchParams.set('id', options.channelId);
  const chRes = await fetch(chUrl.toString(), { headers: { Authorization: `Bearer ${token}` } });
  if (!chRes.ok) throw new Error(`channels.list error (${chRes.status})`);
  const chData = (await chRes.json()) as {
    items: Array<{
      snippet: { title: string };
      contentDetails: { relatedPlaylists: { uploads: string } };
    }>;
  };
  const uploadsPlaylistId = chData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  if (!uploadsPlaylistId) throw new Error(`No uploads playlist found for channel ${options.channelId}`);

  // Step 2: fetch video IDs from the uploads playlist
  const maxResults = Math.min(options.maxResults ?? 30, 50);
  const plUrl = new URL(`${DATA_API_BASE}/playlistItems`);
  plUrl.searchParams.set('part', 'snippet,contentDetails');
  plUrl.searchParams.set('playlistId', uploadsPlaylistId);
  plUrl.searchParams.set('maxResults', String(maxResults));
  const plRes = await fetch(plUrl.toString(), { headers: { Authorization: `Bearer ${token}` } });
  if (!plRes.ok) {
    const errBody = await plRes.text();
    throw new Error(`playlistItems.list error (${plRes.status}): ${errBody}`);
  }
  const plData = (await plRes.json()) as {
    items: Array<{
      snippet: {
        title: string;
        description: string;
        channelId: string;
        channelTitle: string;
        publishedAt: string;
        thumbnails?: { medium?: { url: string } };
      };
      contentDetails: { videoId: string; videoPublishedAt?: string };
    }>;
  };

  let items = plData.items ?? [];

  // Filter by publishedAfter if requested
  if (options.publishedAfter) {
    const cutoff = new Date(options.publishedAfter).getTime();
    items = items.filter((item) => {
      const pub = item.contentDetails.videoPublishedAt ?? item.snippet.publishedAt;
      return new Date(pub).getTime() >= cutoff;
    });
  }

  const results: SearchResult[] = items.map((item) => ({
    videoId: item.contentDetails.videoId,
    title: item.snippet.title,
    description: item.snippet.description,
    channelId: item.snippet.channelId,
    channelTitle: item.snippet.channelTitle,
    publishedAt: item.contentDetails.videoPublishedAt ?? item.snippet.publishedAt,
    thumbnailUrl: item.snippet.thumbnails?.medium?.url ?? '',
  }));

  writeCache(ck, results);
  return results;
}

// ── Transcript (youtube-transcript) ──

export interface TranscriptSegment {
  text: string;
  start: number;    // seconds
  duration: number; // seconds
  lang: string;
}

export interface TranscriptResult {
  videoId: string;
  lang: string;
  segments: TranscriptSegment[];
  text: string;
}

export async function fetchTranscript(
  videoId: string,
  preferredLangs: string[] = ['zh-Hant', 'zh-TW', 'zh', 'zh-Hans', 'en'],
): Promise<TranscriptResult | { error: string }> {
  const ck = cacheKey('transcript', { videoId, langs: preferredLangs.join(',') });
  const cached = readCache<TranscriptResult | { error: string }>(ck);
  if (cached) return cached;

  try {
    const { YoutubeTranscript } = await import('youtube-transcript');
    let segments: TranscriptSegment[] = [];
    let usedLang = 'unknown';

    for (const lang of preferredLangs) {
      try {
        const raw = await YoutubeTranscript.fetchTranscript(videoId, { lang });
        if (raw && raw.length > 0) {
          segments = raw.map((s) => ({
            text: s.text,
            start: Math.round(s.offset / 10) / 100,      // ms → s
            duration: Math.round(s.duration / 10) / 100,
            lang: s.lang ?? lang,
          }));
          usedLang = raw[0]?.lang ?? lang;
          break;
        }
      } catch {
        continue;
      }
    }

    if (segments.length === 0) {
      const result = { error: 'no_transcript_found' };
      writeCache(ck, result);
      return result;
    }

    const result: TranscriptResult = {
      videoId,
      lang: usedLang,
      segments,
      text: segments.map((s) => s.text.replace(/\n/g, ' ')).join(' '),
    };
    writeCache(ck, result);
    return result;
  } catch (e) {
    const result = { error: String(e) };
    writeCache(ck, result);
    return result;
  }
}
