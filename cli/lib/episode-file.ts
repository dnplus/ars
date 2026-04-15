import fs from 'fs';
import path from 'path';
import * as ts from 'typescript';
import type { Episode, EpisodeMetadata } from '../../src/engine/shared/types';
import { resolveSeriesContext } from './context';

export interface LoadedEpisode {
  series: string;
  epId: string;
  root: string;
  filePath: string;
  sourceText: string;
  episode: Episode;
  metadata: EpisodeMetadata;
}

export function resolveEpisodeFilePath(series: string, epId: string): string {
  const ctx = resolveSeriesContext(series);
  return path.join(ctx.episodesDir, `${epId}.ts`);
}

export async function loadEpisode(series: string, epId: string): Promise<LoadedEpisode> {
  const ctx = resolveSeriesContext(series);
  const filePath = resolveEpisodeFilePath(series, epId);

  if (!fs.existsSync(filePath)) {
    console.error(`❌ Episode not found: ${filePath}`);
    process.exit(1);
  }

  const mod = await import(filePath);
  const camelId = epId.replace(/-([a-z0-9])/g, (_: string, c: string) => c.toUpperCase());
  const episode: Episode = mod[camelId] || mod[epId] || mod.default;

  if (!episode?.metadata || !Array.isArray(episode.steps)) {
    console.error(`❌ Episode export is invalid: ${filePath}`);
    process.exit(1);
  }

  return {
    series,
    epId,
    root: ctx.root,
    filePath,
    sourceText: fs.readFileSync(filePath, 'utf-8'),
    episode,
    metadata: episode.metadata,
  };
}

export async function loadEpisodeMetadata(series: string, epId: string): Promise<EpisodeMetadata | null> {
  const filePath = resolveEpisodeFilePath(series, epId);
  if (!fs.existsSync(filePath)) return null;
  return (await loadEpisode(series, epId)).metadata;
}

function getPropertyNameText(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  return null;
}

function createStringNode(value: string): ts.Expression {
  if (value.includes('\n')) {
    return ts.factory.createNoSubstitutionTemplateLiteral(value.replace(/\$\{/g, '\\${'));
  }

  return ts.factory.createStringLiteral(value);
}

function getLineIndent(sourceText: string, position: number): string {
  const lineStart = sourceText.lastIndexOf('\n', position) + 1;
  const match = sourceText.slice(lineStart).match(/^\s*/);
  return match?.[0] ?? '';
}

function reindentPrintedObject(printed: string, baseIndent: string): string {
  const baseIndentWidth = baseIndent.length;
  return printed
    .split('\n')
    .map((line, index) => {
      if (index === 0) return line;
      const leading = line.match(/^\s*/)?.[0].length ?? 0;
      const content = line.slice(leading);
      const desiredIndent = baseIndentWidth + Math.floor(leading / 2);
      return `${' '.repeat(desiredIndent)}${content}`;
    })
    .join('\n');
}

export async function writeEpisodePublishState(
  series: string,
  epId: string,
  publish: NonNullable<EpisodeMetadata['publish']>,
): Promise<void> {
  const loaded = await loadEpisode(series, epId);
  const sourceFile = ts.createSourceFile(
    loaded.filePath,
    loaded.sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  let metadataObject: ts.ObjectLiteralExpression | null = null;

  const visit = (node: ts.Node): void => {
    if (
      !metadataObject &&
      ts.isPropertyAssignment(node) &&
      getPropertyNameText(node.name) === 'metadata' &&
      ts.isObjectLiteralExpression(node.initializer)
    ) {
      metadataObject = node.initializer;
      return;
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);

  if (!metadataObject) {
    throw new Error(`metadata object not found in ${loaded.filePath}`);
  }

  const metadataNode: ts.ObjectLiteralExpression = metadataObject;

  const existingPublishProperty = metadataNode.properties.find((property) => (
    ts.isPropertyAssignment(property) &&
    getPropertyNameText(property.name) === 'publish' &&
    ts.isObjectLiteralExpression(property.initializer)
  )) as ts.PropertyAssignment | undefined;

  const existingPublishObject = existingPublishProperty?.initializer && ts.isObjectLiteralExpression(existingPublishProperty.initializer)
    ? existingPublishProperty.initializer
    : null;

  const keptMetadataProperties = metadataNode.properties.filter((property) => !(
    ts.isPropertyAssignment(property) && getPropertyNameText(property.name) === 'publish'
  ));

  const existingPublishProps = existingPublishObject?.properties.filter((property) => (
    !ts.isPropertyAssignment(property) ||
    !['youtubeVideoId', 'youtubeUrl', 'youtubeUploadedAt'].includes(getPropertyNameText(property.name) ?? '')
  )) ?? [];

  const publishProperties: ts.ObjectLiteralElementLike[] = [
    ...existingPublishProps,
  ];

  if (publish.youtubeVideoId) {
    publishProperties.push(
      ts.factory.createPropertyAssignment('youtubeVideoId', createStringNode(publish.youtubeVideoId)),
    );
  }
  if (publish.youtubeUrl) {
    publishProperties.push(
      ts.factory.createPropertyAssignment('youtubeUrl', createStringNode(publish.youtubeUrl)),
    );
  }
  if (publish.youtubeUploadedAt) {
    publishProperties.push(
      ts.factory.createPropertyAssignment('youtubeUploadedAt', createStringNode(publish.youtubeUploadedAt)),
    );
  }

  const nextMetadata = ts.factory.createObjectLiteralExpression([
    ...keptMetadataProperties,
    ts.factory.createPropertyAssignment(
      'publish',
      ts.factory.createObjectLiteralExpression(publishProperties, true),
    ),
  ], true);

  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const baseIndent = getLineIndent(loaded.sourceText, metadataNode.getStart(sourceFile));
  const printed = reindentPrintedObject(
    printer.printNode(ts.EmitHint.Expression, nextMetadata, sourceFile),
    baseIndent,
  );

  const nextSource = `${loaded.sourceText.slice(0, metadataNode.getStart(sourceFile))}${printed}${loaded.sourceText.slice(metadataNode.getEnd())}`;
  fs.writeFileSync(loaded.filePath, nextSource, 'utf-8');
}
