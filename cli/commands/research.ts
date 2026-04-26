import fs from 'fs';
import path from 'path';
import {
  loadCredentials,
  searchVideos,
  getMissingYouTubeCredentialKeys,
  daysAgo,
  isFresh,
  type SearchVideoResult,
} from '../lib/youtube-client';
import { readArsConfig, getRepoRoot } from '../lib/ars-config';

const HELP = `
Usage:
  npx ars research search <query> [options]
  npx ars research list-recent-topics [options]

Subcommands:
  search                 Run a YouTube competitive search and emit JSON results
  list-recent-topics     Read recent episode plans and emit each ## Topic block as JSON

Search options:
  --max N                Number of competitor videos to return (default 10, max 50)
  --days N               Restrict to videos published in the last N days (default 365)
  --region CODE          ISO-3166-1 region code, e.g. TW, US, JP
  --lang CODE            Relevance language hint, e.g. zh, en, ja
  --order MODE           One of: relevance | date | viewCount | rating (default relevance)
  --fresh                Bypass local cache for both Search.list and videos.list

list-recent-topics options:
  --series NAME          Override active series (default: project.activeSeries)
  --limit N              Max number of episodes to scan (default 5)

Common:
  --json                 Always emit JSON (default for both subcommands)
  -h, --help             Show this help

Notes:
  Reuses YouTube OAuth credentials configured for /ars:analytics. The default
  scope (https://www.googleapis.com/auth/youtube) already covers Search.list,
  so no re-authorization is needed.
`;

interface SearchOptions {
  query: string;
  max: number;
  days: number;
  region?: string;
  lang?: string;
  order: 'relevance' | 'date' | 'viewCount' | 'rating';
  fresh: boolean;
}

interface SearchSnapshot {
  query: string;
  fetchedAt: string;
  publishedAfter: string;
  count: number;
  results: SearchVideoResult[];
}

interface RecentTopicEntry {
  epId: string;
  series: string;
  planPath: string;
  topicBlock: string | null;
  thesis: string | null;
}

function readFlagValue(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1 || !args[idx + 1]) return undefined;
  return args[idx + 1];
}

const VALUE_FLAGS = new Set(['--max', '--days', '--region', '--lang', '--order']);

function parseSearchOptions(args: string[]): SearchOptions {
  const queryParts: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      if (VALUE_FLAGS.has(arg)) i += 1;
      continue;
    }
    queryParts.push(arg);
  }

  if (queryParts.length === 0) {
    throw new Error('research search requires a <query> argument.');
  }

  const query = queryParts.join(' ').trim();

  const maxRaw = readFlagValue(args, '--max');
  const max = maxRaw ? Math.min(Math.max(parseInt(maxRaw, 10) || 10, 1), 50) : 10;

  const daysRaw = readFlagValue(args, '--days');
  const days = daysRaw ? Math.min(Math.max(parseInt(daysRaw, 10) || 365, 1), 3650) : 365;

  const region = readFlagValue(args, '--region');
  const lang = readFlagValue(args, '--lang');

  const orderRaw = readFlagValue(args, '--order') ?? 'relevance';
  const allowedOrders = ['relevance', 'date', 'viewCount', 'rating'] as const;
  const order: SearchOptions['order'] = allowedOrders.includes(
    orderRaw as SearchOptions['order'],
  )
    ? (orderRaw as SearchOptions['order'])
    : 'relevance';

  return {
    query,
    max,
    days,
    region,
    lang,
    order,
    fresh: isFresh(args),
  };
}

async function runSearch(args: string[]): Promise<void> {
  const missing = getMissingYouTubeCredentialKeys();
  if (missing.length > 0) {
    console.error(
      `[ars] YouTube credentials missing: ${missing.join(', ')}. Add them to .env.`,
    );
    process.exit(1);
  }

  const options = parseSearchOptions(args);
  const creds = loadCredentials();

  const publishedAfter = `${daysAgo(options.days)}T00:00:00Z`;

  const results = await searchVideos(
    creds,
    options.query,
    {
      maxResults: options.max,
      publishedAfter,
      regionCode: options.region,
      relevanceLanguage: options.lang,
      order: options.order,
    },
    options.fresh,
  );

  const snapshot: SearchSnapshot = {
    query: options.query,
    fetchedAt: new Date().toISOString(),
    publishedAfter,
    count: results.length,
    results,
  };

  process.stdout.write(`${JSON.stringify(snapshot, null, 2)}\n`);
}

function extractTopicBlock(planMd: string): { block: string | null; thesis: string | null } {
  const lines = planMd.split(/\r?\n/);
  const start = lines.findIndex((line) => /^##\s+Topic\b/.test(line));
  if (start === -1) return { block: null, thesis: null };

  const after = lines.slice(start + 1);
  const endRel = after.findIndex((line) => /^##\s+/.test(line));
  const blockLines = endRel === -1 ? after : after.slice(0, endRel);
  const block = blockLines.join('\n').trim();

  const thesisMatch = block.match(/-\s*Thesis\s+(.*?)(?:\n|$)/);
  const thesis = thesisMatch ? thesisMatch[1].trim() : null;

  return { block: block || null, thesis };
}

async function runListRecentTopics(args: string[]): Promise<void> {
  const limitRaw = readFlagValue(args, '--limit');
  const limit = limitRaw ? Math.min(Math.max(parseInt(limitRaw, 10) || 5, 1), 50) : 5;

  const seriesOverride = readFlagValue(args, '--series');

  const repoRoot = getRepoRoot();
  let series = seriesOverride;
  if (!series) {
    try {
      series = readArsConfig(repoRoot).project.activeSeries;
    } catch {
      series = undefined;
    }
  }

  if (!series) {
    console.error('[ars] No active series found. Pass --series <name> or run /ars:onboard first.');
    process.exit(1);
  }

  const episodesDir = path.join(repoRoot, '.ars', 'episodes');
  let entries: string[] = [];
  if (fs.existsSync(episodesDir)) {
    entries = fs
      .readdirSync(episodesDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && /^ep\d+$/.test(entry.name))
      .map((entry) => entry.name)
      .sort()
      .reverse()
      .slice(0, limit);
  }

  const topics: RecentTopicEntry[] = entries.map((epId) => {
    const planPath = path.join(episodesDir, epId, 'plan.md');
    if (!fs.existsSync(planPath)) {
      return { epId, series: series!, planPath, topicBlock: null, thesis: null };
    }
    const md = fs.readFileSync(planPath, 'utf-8');
    const { block, thesis } = extractTopicBlock(md);
    return { epId, series: series!, planPath, topicBlock: block, thesis };
  });

  process.stdout.write(
    `${JSON.stringify({ series, count: topics.length, topics }, null, 2)}\n`,
  );
}

export async function run(args: string[]): Promise<void> {
  const [subcommand, ...rest] = args;

  if (!subcommand || subcommand === '-h' || subcommand === '--help') {
    console.log(HELP.trim());
    return;
  }

  if (subcommand === 'search') {
    await runSearch(rest);
    return;
  }

  if (subcommand === 'list-recent-topics') {
    await runListRecentTopics(rest);
    return;
  }

  console.error(`Unknown research subcommand: ${subcommand}`);
  console.log(HELP.trim());
  process.exit(1);
}
