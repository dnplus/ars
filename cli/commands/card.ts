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

const ROOT = path.resolve(__dirname, '../..');

const HELP = `
Usage: npx ars card <subcommand> [options]

Subcommands:
  list                      List all card types (engine + series-scoped)
  list --series <name>      Use <name> as the live-example source series
  list --json               Output as JSON (for agent consumption)

Examples:
  npx ars card list
  npx ars card list --series template
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
  liveExample?: unknown;
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

/**
 * Load episode files sorted by mtime (newest first) for the active series.
 * Returns dynamic import results — only works with tsx/ts-node runtime.
 */
async function loadRecentEpisodes(series: string): Promise<Array<{ steps: Array<{ contentType: string; data?: unknown }> }>> {
  const episodesDir = path.join(ROOT, 'src/episodes', series);
  if (!fs.existsSync(episodesDir)) return [];

  const files = fs.readdirSync(episodesDir)
    .filter(f => f.endsWith('.ts') && !f.includes('template') && !f.includes('series-config') && !f.includes('.d.ts'))
    .map(f => ({ file: f, mtime: fs.statSync(path.join(episodesDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
    .map(f => path.join(episodesDir, f.file));

  const episodes: Array<{ steps: Array<{ contentType: string; data?: unknown }> }> = [];

  for (const filePath of files.slice(0, 5)) { // scan at most 5 recent episodes
    try {
      const mod = await import(filePath);
      const ep = Object.values(mod).find(
        (v): v is { steps: Array<{ contentType: string; data?: unknown }> } =>
          typeof v === 'object' && v !== null && Array.isArray((v as { steps?: unknown }).steps),
      );
      if (ep) episodes.push(ep);
    } catch {
      // skip files that fail to import (e.g. missing assets)
    }
  }

  return episodes;
}

/**
 * Build a map of contentType → first real step.data found in recent episodes.
 */
async function buildLiveExampleMap(series: string): Promise<Map<string, unknown>> {
  const map = new Map<string, unknown>();
  const episodes = await loadRecentEpisodes(series);

  for (const ep of episodes) {
    for (const step of ep.steps) {
      if (!map.has(step.contentType) && step.data != null) {
        map.set(step.contentType, step.data);
      }
    }
  }

  return map;
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
      console.log(`\n  ${c.type}`);
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
      console.log(`    ${c.type}`);
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
    const seriesFlag = rest.indexOf('--series');
    const filterSeries = seriesFlag >= 0 ? rest[seriesFlag + 1] : undefined;
    const asJson = rest.includes('--json');

    const engineCards = discoverEngineCards();
    const seriesCards = discoverSeriesCards(filterSeries);
    const all = [...engineCards, ...seriesCards];

    if (all.length === 0) {
      console.log('No card specs found.');
      return;
    }

    // Enrich with live examples from the most recent episodes
    const activeSeries = filterSeries ?? getActiveSeries(ROOT);
    if (activeSeries) {
      const liveMap = await buildLiveExampleMap(activeSeries);
      for (const card of all) {
        const live = liveMap.get(card.type);
        if (live != null) card.liveExample = live;
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
