/**
 * @command card
 * @description Card catalog: list all registered card types with metadata
 *
 * Usage:
 *   npx ars card list [--series <name>] [--json]
 */

import fs from 'fs';
import path from 'path';
import ts from 'typescript';
import { getActiveSeries } from '../lib/context';
import { getRepoRoot } from '../lib/ars-config';

const ROOT = getRepoRoot();

const HELP = `
Usage: npx ars card <subcommand> [options]

Subcommands:
  list          List all card types with agentHints and live examples
  list --json   Output as JSON (for agent consumption)

Examples:
  npx ars card list
  npx ars card list --json
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
    .map(name => {
      const specPath = path.join(cardsDir, name, 'spec.ts');
      if (!fs.existsSync(specPath)) return null;
      const meta = parseSpecFile(specPath);
      if (!meta?.type) return null;
      return { ...meta, scope: 'engine' as const, specPath };
    })
    .filter((x): x is CardMeta => x !== null);
}

function discoverSeriesCards(filterSeries?: string): CardMeta[] {
  const episodesDir = path.join(ROOT, 'src/episodes');
  if (!fs.existsSync(episodesDir)) return [];

  const results: CardMeta[] = [];

  const seriesList = fs.readdirSync(episodesDir)
    .filter(name => fs.statSync(path.join(episodesDir, name)).isDirectory())
    .filter(name => !filterSeries || name === filterSeries);

  for (const series of seriesList) {
    const cardsDir = path.join(episodesDir, series, 'cards');
    if (!fs.existsSync(cardsDir)) continue;

    for (const cardName of fs.readdirSync(cardsDir).filter(name => fs.statSync(path.join(cardsDir, name)).isDirectory())) {
      const specPath = path.join(cardsDir, cardName, 'spec.ts');
      if (!fs.existsSync(specPath)) continue;
      const meta = parseSpecFile(specPath);
      if (!meta?.type) continue;
      results.push({ ...meta, scope: 'series', series, specPath });
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
    const asJson = rest.includes('--json');

    const engineCards = discoverEngineCards();
    const seriesCards = discoverSeriesCards();
    const all = [...engineCards, ...seriesCards];

    if (all.length === 0) {
      console.log('No card specs found.');
      return;
    }

    // Enrich with live examples and usage counts from the active series
    // Fallback: if no active series configured, use the first available series directory
    const activeSeries = getActiveSeries(ROOT) ?? (() => {
      const episodesDir = path.join(ROOT, 'src/episodes');
      if (!fs.existsSync(episodesDir)) return null;
      return fs.readdirSync(episodesDir).find(
        name => fs.statSync(path.join(episodesDir, name)).isDirectory(),
      ) ?? null;
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

    if (asJson) {
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
