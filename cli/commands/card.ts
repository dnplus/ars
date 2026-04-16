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

const ROOT = path.resolve(__dirname, '../..');

const HELP = `
Usage: npx ars card <subcommand> [options]

Subcommands:
  list                      List all card types (engine + series-scoped)
  list --series <name>      List cards for a specific series only
  list --json               Output as JSON (for agent consumption)

Examples:
  npx ars card list
  npx ars card list --series template
  npx ars card list --json
`;

// ── AST extraction ───────────────────────────────────────

type AgentHints = {
  whenToUse?: string;
  notForUseCases?: string;
  exampleData?: unknown;
};

type CardMeta = {
  type: string;
  title?: string;
  description?: string;
  agentHints?: AgentHints;
  scope: 'engine' | 'series';
  series?: string;
  specPath: string;
};

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
    if (
      ts.isPropertyAssignment(prop) &&
      getPropertyNameText(prop.name) === key
    ) {
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
    // export const cardSpec = { ... } satisfies CardSpec<...>
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === 'cardSpec' &&
      node.initializer
    ) {
      let init = node.initializer;
      // unwrap `satisfies` expression if present
      if (ts.isSatisfiesExpression(init)) {
        init = init.expression;
      }
      if (ts.isObjectLiteralExpression(init)) {
        cardSpecObject = init;
      }
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

    const cardDirs = fs.readdirSync(cardsDir)
      .filter(name => fs.statSync(path.join(cardsDir, name)).isDirectory());

    for (const cardName of cardDirs) {
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

    const engineCards = filterSeries ? [] : discoverEngineCards();
    const seriesCards = discoverSeriesCards(filterSeries);
    const all = [...engineCards, ...seriesCards];

    if (all.length === 0) {
      console.log('No card specs found.');
      return;
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
