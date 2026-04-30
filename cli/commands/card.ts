/**
 * @command card
 * @description Card catalog: list all registered card types with metadata
 *
 * Usage:
 *   ars card list [target-root] [--series <name>] [--json]
 */

import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { getActiveSeries, isReservedSeriesName } from '../lib/context';
import { getRepoRoot } from '../lib/ars-config';

let ROOT = getRepoRoot();

const HELP = `
Usage: ars card <subcommand> [options]

Subcommands:
  list          List all card types with agentHints and live examples
  list --json   Output as JSON (for agent consumption)

Examples:
  ars card list
  ars card list ../gss-slides
  ars card list --root ../gss-slides --json
`;

// ── Types ─────────────────────────────────────────────────

type AgentHints = {
  whenToUse?: string;
  notForUseCases?: string;
};

type CardMeta = {
  type: string;
  title?: string;
  description?: string;
  agentHints?: AgentHints;
  liveExample?: LiveExample;
  usageCount?: number;
  scope: 'engine' | 'series';
  series?: string;
  specPath: string;
};

// ── AST: spec.ts extraction ───────────────────────────────

function getStringValue(node: ts.Expression): string | undefined {
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  return undefined;
}

function getPropertyNameText(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  return null;
}

function extractStringProp(obj: ts.ObjectLiteralExpression, key: string): string | undefined {
  for (const prop of obj.properties) {
    if (ts.isPropertyAssignment(prop) && getPropertyNameText(prop.name) === key) {
      return getStringValue(prop.initializer);
    }
  }
  return undefined;
}

function extractObjectProp(obj: ts.ObjectLiteralExpression, key: string): ts.ObjectLiteralExpression | undefined {
  for (const prop of obj.properties) {
    if (
      ts.isPropertyAssignment(prop) &&
      getPropertyNameText(prop.name) === key &&
      ts.isObjectLiteralExpression(prop.initializer)
    ) {
      return prop.initializer;
    }
  }
  return undefined;
}

function extractAgentHints(obj: ts.ObjectLiteralExpression): AgentHints | undefined {
  const hintsNode = extractObjectProp(obj, 'agentHints');
  if (!hintsNode) return undefined;
  return {
    whenToUse: extractStringProp(hintsNode, 'whenToUse'),
    notForUseCases: extractStringProp(hintsNode, 'notForUseCases'),
  };
}

function parseSpecFile(specPath: string): { type?: string; title?: string; description?: string; agentHints?: AgentHints } | null {
  const src = fs.readFileSync(specPath, 'utf-8');
  const sourceFile = ts.createSourceFile(specPath, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

  let cardSpecObject: ts.ObjectLiteralExpression | null = null;

  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'cardSpec' &&
      node.initializer
    ) {
      let init = node.initializer;
      if (ts.isSatisfiesExpression(init)) init = init.expression;
      if (ts.isObjectLiteralExpression(init)) cardSpecObject = init;
    }
    ts.forEachChild(node, visit);
  };

  ts.forEachChild(sourceFile, visit);
  if (!cardSpecObject) return null;

  return {
    type: extractStringProp(cardSpecObject, 'type'),
    title: extractStringProp(cardSpecObject, 'title'),
    description: extractStringProp(cardSpecObject, 'description'),
    agentHints: extractAgentHints(cardSpecObject),
  };
}

// ── Live example: scan recent episodes ───────────────────

type StepRecord = Record<string, unknown>;

type LoadedEpisode = {
  epId: string;
  steps: StepRecord[];
};

/**
 * Load episode files sorted by mtime (newest first) for the active series.
 */
async function loadRecentEpisodes(series: string): Promise<LoadedEpisode[]> {
  const episodesDir = path.join(ROOT, 'src/episodes', series);
  if (!fs.existsSync(episodesDir)) return [];

  const files = fs.readdirSync(episodesDir)
    .filter(f => f.endsWith('.ts') && !f.includes('template') && !f.includes('series-config') && !f.includes('.d.ts'))
    .map(f => ({ file: f, mtime: fs.statSync(path.join(episodesDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, 5); // scan at most 5 recent episodes

  const episodes: LoadedEpisode[] = [];

  for (const { file } of files) {
    const filePath = path.join(episodesDir, file);
    try {
      const mod = await import(filePath);
      const ep = Object.values(mod).find(
        (v): v is { steps: StepRecord[] } =>
          typeof v === 'object' && v !== null && Array.isArray((v as { steps?: unknown }).steps),
      );
      if (ep) episodes.push({ epId: file.replace(/\.ts$/, ''), steps: ep.steps });
    } catch {
      // skip files that fail to import (e.g. missing assets)
    }
  }

  return episodes;
}

type LiveExample = {
  _sourceEp: string;
  [key: string]: unknown;
};

type EpisodeStats = {
  liveExamples: Map<string, LiveExample>;
  usageCounts: Map<string, number>;
};

type ListOptions = {
  asJson: boolean;
  root: string;
  series?: string;
};

function readOptionValue(args: string[], index: number, option: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith('-')) {
    throw new Error(`${option} requires a value.`);
  }
  return value;
}

function parseListOptions(args: string[]): ListOptions {
  const defaultRoot = getRepoRoot();
  let root = defaultRoot;
  let rootSet = false;
  let series: string | undefined;
  let asJson = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--json') {
      asJson = true;
      continue;
    }

    if (arg === '--root' || arg === '--cwd') {
      root = path.resolve(defaultRoot, readOptionValue(args, i, arg));
      rootSet = true;
      i += 1;
      continue;
    }

    if (arg === '--series') {
      series = readOptionValue(args, i, arg);
      i += 1;
      continue;
    }

    if (arg.startsWith('-')) {
      throw new Error(`Unknown card list option: ${arg}`);
    }

    if (rootSet) {
      throw new Error(`Unexpected extra card list argument: ${arg}`);
    }

    root = path.resolve(defaultRoot, arg);
    rootSet = true;
  }

  return { asJson, root, series };
}

function assertRepoRoot(root: string): void {
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error(`Card list target does not exist or is not a directory: ${root}`);
  }
  if (!fs.existsSync(path.join(root, 'src', 'engine', 'cards'))) {
    throw new Error(`Missing src/engine/cards under ${root}. Run this inside an ARS repo or pass a valid target root.`);
  }
}

/**
 * Build usage stats from all episodes in the active series.
 * liveExamples: contentType → full step (with _sourceEp) from most recent episode
 * usageCounts: contentType → total step count across all episodes
 */
async function buildEpisodeStats(series: string): Promise<EpisodeStats> {
  const liveExamples = new Map<string, LiveExample>();
  const usageCounts = new Map<string, number>();
  const episodes = await loadRecentEpisodes(series);

  for (const { epId, steps } of episodes) {
    for (const step of steps) {
      const contentType = step.contentType as string;
      usageCounts.set(contentType, (usageCounts.get(contentType) ?? 0) + 1);
      if (!liveExamples.has(contentType)) {
        liveExamples.set(contentType, { _sourceEp: epId, ...step });
      }
    }
  }

  return { liveExamples, usageCounts };
}

// ── Discovery ────────────────────────────────────────────

function discoverEngineCards(): CardMeta[] {
  const cardsDir = path.join(ROOT, 'src/engine/cards');
  if (!fs.existsSync(cardsDir)) return [];

  return fs.readdirSync(cardsDir)
    .filter(name => fs.statSync(path.join(cardsDir, name)).isDirectory())
    .flatMap((name): CardMeta[] => {
      const specPath = path.join(cardsDir, name, 'spec.ts');
      if (!fs.existsSync(specPath)) return [];
      const meta = parseSpecFile(specPath);
      if (!meta?.type) return [];
      return [{ ...meta, type: meta.type, scope: 'engine', specPath }];
    });
}

function discoverSeriesCards(filterSeries?: string): CardMeta[] {
  const episodesDir = path.join(ROOT, 'src/episodes');
  if (!fs.existsSync(episodesDir)) return [];

  const results: CardMeta[] = [];

  const allSeries = fs.readdirSync(episodesDir)
    .filter(name => fs.statSync(path.join(episodesDir, name)).isDirectory())
    .filter(name => !filterSeries || name === filterSeries);
  const hasUserSeries = allSeries.some((series) => !isReservedSeriesName(series));
  const seriesList = allSeries.filter((series) => !(hasUserSeries && isReservedSeriesName(series)));

  for (const series of seriesList) {
    const cardsDir = path.join(episodesDir, series, 'cards');
    if (!fs.existsSync(cardsDir)) continue;

    for (const cardName of fs.readdirSync(cardsDir).filter(name => fs.statSync(path.join(cardsDir, name)).isDirectory())) {
      const specPath = path.join(cardsDir, cardName, 'spec.ts');
      if (!fs.existsSync(specPath)) continue;
      const meta = parseSpecFile(specPath);
      if (!meta?.type) continue;
      results.push({ ...meta, type: meta.type, scope: 'series', series, specPath });
    }
  }

  return results;
}

// ── Output ───────────────────────────────────────────────

function printCards(cards: CardMeta[]): void {
  const engine = cards.filter(c => c.scope === 'engine');
  const series = cards.filter(c => c.scope === 'series');

  if (engine.length > 0) {
    console.log('\n── Engine cards (built-in) ──────────────────────────────');
    for (const c of engine) {
      console.log(`\n  ${c.type}${c.usageCount != null ? ` (${c.usageCount} uses)` : ''}`);
      if (c.title) console.log(`    title       : ${c.title}`);
      if (c.description) console.log(`    description : ${c.description}`);
      if (c.agentHints?.whenToUse) console.log(`    whenToUse   : ${c.agentHints.whenToUse}`);
      if (c.agentHints?.notForUseCases) console.log(`    notFor      : ${c.agentHints.notForUseCases}`);
      if (c.liveExample != null) console.log(`    liveExample : ${JSON.stringify(c.liveExample)}`);
    }
  }

  if (series.length > 0) {
    console.log('\n── Series-scoped cards ──────────────────────────────────');
    let lastSeries = '';
    for (const c of series) {
      if (c.series !== lastSeries) {
        console.log(`\n  [${c.series}]`);
        lastSeries = c.series!;
      }
      console.log(`    ${c.type}${c.usageCount != null ? ` (${c.usageCount} uses)` : ''}`);
      if (c.description) console.log(`      description : ${c.description}`);
      if (c.agentHints?.whenToUse) console.log(`      whenToUse   : ${c.agentHints.whenToUse}`);
      if (c.agentHints?.notForUseCases) console.log(`      notFor      : ${c.agentHints.notForUseCases}`);
      if (c.liveExample != null) console.log(`      liveExample : ${JSON.stringify(c.liveExample)}`);
    }
  }

  console.log(`\nTotal: ${engine.length} engine, ${series.length} series-scoped\n`);
}

// ── Command entry ─────────────────────────────────────────

export async function run(args: string[]): Promise<void> {
  const [sub, ...rest] = args;

  if (!sub || sub === '--help' || sub === '-h') {
    console.log(HELP.trim());
    return;
  }

  if (sub === 'list') {
    const options = parseListOptions(rest);
    assertRepoRoot(options.root);
    ROOT = options.root;

    const engineCards = discoverEngineCards();
    const seriesCards = discoverSeriesCards(options.series);
    const all = [...engineCards, ...seriesCards];

    if (all.length === 0) {
      console.log('No card specs found.');
      return;
    }

    // Enrich with live examples and usage counts from the active series
    // Fallback: if no active series configured, use the first available series directory
    const activeSeries = options.series ?? getActiveSeries(ROOT) ?? (() => {
      const episodesDir = path.join(ROOT, 'src/episodes');
      if (!fs.existsSync(episodesDir)) return null;
      const allSeries = fs.readdirSync(episodesDir).filter(
        name => fs.statSync(path.join(episodesDir, name)).isDirectory(),
      );
      const preferredUserSeries = allSeries.find((name) => name !== 'template');
      return preferredUserSeries ?? allSeries[0] ?? null;
    })();
    if (activeSeries) {
      const stats = await buildEpisodeStats(activeSeries);
      for (const card of all) {
        const live = stats.liveExamples.get(card.type);
        if (live != null) card.liveExample = live;
        const count = stats.usageCounts.get(card.type);
        if (count != null) card.usageCount = count;
      }
    }

    if (options.asJson) {
      console.log(JSON.stringify(all, null, 2));
      return;
    }

    printCards(all);
    return;
  }

  console.error(`❌ Unknown card subcommand: ${sub}`);
  console.log(HELP.trim());
  process.exit(1);
}
