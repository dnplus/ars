/**
 * @module cli/lib/context
 * @description 解析 episode target 與 active series，提供路徑解析。
 *
 * 主要語法：npx ars <command> <epId>
 * 相容語法：npx ars <command> <series>/<epId>
 * 例如：  npx ars episode create ep-my-topic
 *         npx ars audio generate ep005
 *         npx ars review open ep005
 *         npx ars episode list
 */
import path from 'path';
import fs from 'fs';
import { configExists, getRepoRoot, readArsConfig, writeArsConfig } from './ars-config';

export interface SeriesContext {
  /** Series 名稱 (e.g. 'gss', 'template') */
  series: string;
  /** 向後相容 alias */
  project: string;
  /** Monorepo root */
  root: string;
  /** src/engine/ */
  engineDir: string;
  /** src/episodes/{series}/ */
  episodesDir: string;
  /** public/episodes/{series}/ */
  publicDir: string;
  /** public/episodes/{series}/ （同 publicDir，新架構 episodes 在 series 目錄下） */
  publicEpisodesDir: string;
  /** 向後相容 alias（= episodesDir） */
  projectDir: string;
}

/**
 * 驗證 epId 格式（寬鬆）
 * 只禁止：含 / 或空格
 */
export function validateEpId(epId: string): void {
  if (epId.includes('/')) {
    console.error(`❌ epId 不能含有 /：${epId}`);
    process.exit(1);
  }
  if (/\s/.test(epId)) {
    console.error(`❌ epId 不能含有空格：${epId}`);
    process.exit(1);
  }
}

export function validateSeriesName(series: string): void {
  if (!series || /\s/.test(series) || series.includes('/')) {
    console.error(`❌ Series name 不能包含空白或 /：${series}`);
    process.exit(1);
  }
}

/**
 * 解析 "series/epId" 字串
 * @returns { series, epId }
 */
export function parseTarget(target: string): { series: string; epId: string } {
  const slashIdx = target.indexOf('/');
  if (slashIdx === -1) {
    console.error(`❌ Target 格式錯誤，需要 <series>/<epId>：${target}`);
    console.error(`   例如：gss/ep005、gss/ep-my-topic`);
    process.exit(1);
  }
  const series = target.slice(0, slashIdx);
  const epId = target.slice(slashIdx + 1);

  if (!series) {
    console.error(`❌ Series 不能為空：${target}`);
    process.exit(1);
  }
  if (!epId) {
    console.error(`❌ epId 不能為空：${target}`);
    process.exit(1);
  }

  validateEpId(epId);
  return { series, epId };
}

export function getActiveSeries(root = getRepoRoot()): string | null {
  if (!configExists(root)) {
    return null;
  }

  const activeSeries = readArsConfig(root).project.activeSeries?.trim();
  return activeSeries ? activeSeries : null;
}

export function requireActiveSeries(root = getRepoRoot()): string {
  const activeSeries = getActiveSeries(root);
  if (!activeSeries) {
    console.error('❌ This repo has no active series configured.');
    console.error('   Run /ars:setup for guided onboarding or `npx ars init <series>` after setup.');
    process.exit(1);
  }

  return activeSeries;
}

export function setActiveSeries(series: string, root = getRepoRoot()): string {
  validateSeriesName(series);

  if (!configExists(root)) {
    console.error('❌ Missing .ars/config.json. Run `npx ars setup` first.');
    process.exit(1);
  }

  const config = readArsConfig(root);
  config.project.activeSeries = series;
  return writeArsConfig(config, root);
}

export function resolveEpisodeTarget(target: string, root = getRepoRoot()): { series: string; epId: string } {
  if (!target) {
    console.error('❌ Missing episode target.');
    process.exit(1);
  }

  if (target.includes('/')) {
    return parseTarget(target);
  }

  return {
    series: requireActiveSeries(root),
    epId: target,
  };
}

export function resolveSeriesArgument(seriesArg?: string, root = getRepoRoot()): string {
  if (!seriesArg) {
    return requireActiveSeries(root);
  }

  if (seriesArg.includes('/')) {
    console.error(`❌ Expected a series name, got episode target: ${seriesArg}`);
    process.exit(1);
  }

  return seriesArg;
}

/**
 * 根據 series 名稱解析路徑 context
 */
export function resolveSeriesContext(series: string): SeriesContext {
  validateSeriesName(series);
  const root = path.resolve(__dirname, '../..');
  const episodesDir = path.join(root, 'src/episodes', series);

  if (!fs.existsSync(episodesDir)) {
    const available = fs.readdirSync(path.join(root, 'src/episodes'))
      .filter(d => fs.statSync(path.join(root, 'src/episodes', d)).isDirectory());
    console.error(`❌ Series "${series}" not found at ${episodesDir}`);
    console.error(`   Available: ${available.join(', ')}`);
    process.exit(1);
  }

  const publicDir = path.join(root, 'public/episodes', series);

  return {
    series,
    project: series,
    root,
    engineDir: path.join(root, 'src/engine'),
    episodesDir,
    publicDir,
    publicEpisodesDir: publicDir,
    projectDir: episodesDir,
  };
}

/**
 * 列出所有可用 series
 */
export function listAvailableSeries(root: string): string[] {
  const episodesRoot = path.join(root, 'src/episodes');
  if (!fs.existsSync(episodesRoot)) return [];
  return fs.readdirSync(episodesRoot)
    .filter(d => fs.statSync(path.join(episodesRoot, d)).isDirectory());
}
