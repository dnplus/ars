import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(__dirname, '../..');

describe('plugin skill surface', () => {
  it('includes the current workflow skills', () => {
    const skillsRoot = path.join(repoRoot, 'plugin', 'skills');
    const skillDirs = fs.readdirSync(skillsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    expect(skillDirs).toEqual(expect.arrayContaining([
      'plan',
      'build',
      'apply-review',
      'polish',
      'reflect',
      'research',
      'review',
      'new-card',
      'prepare-youtube',
      'publish-youtube',
    ]));
  });

  it('keyword detector recommends only the new workflow commands', () => {
    const scriptPath = path.join(repoRoot, 'plugin', 'scripts', 'keyword-detector.mjs');
    const payload = JSON.stringify({
      prompt: '請先幫我 plan 這集，之後 build 起來，review 完再 fix',
    });

    const output = execFileSync('node', [scriptPath], {
      cwd: repoRoot,
      input: payload,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    expect(output).toContain('/ars:plan');
    expect(output).toContain('/ars:build');
    expect(output).toContain('/ars:apply-review');
    expect(output).not.toContain('/ars:scene-plan');
    expect(output).not.toContain('/ars:scene-build');
    expect(output).not.toContain('/ars:scene-fix');
  });

  it('keyword detector recommends onboarding for first-run setup prompts', () => {
    const scriptPath = path.join(repoRoot, 'plugin', 'scripts', 'keyword-detector.mjs');
    const payload = JSON.stringify({
      prompt: '第一次使用 ARS，幫我初始化這個 repo 跟系列設定',
    });

    const output = execFileSync('node', [scriptPath], {
      cwd: repoRoot,
      input: payload,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    expect(output).toContain('/ars:onboard');
  });

  it('keyword detector does not fire on generic review/fix prompts', () => {
    const scriptPath = path.join(repoRoot, 'plugin', 'scripts', 'keyword-detector.mjs');
    const payload = JSON.stringify({
      prompt: 'please review this diff and help me fix the failing tests',
    });

    const output = execFileSync('node', [scriptPath], {
      cwd: repoRoot,
      input: payload,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    expect(output.trim()).toBe('');
  });

  it('keyword detector recommends doctor and audio for readiness and pronunciation prompts', () => {
    const scriptPath = path.join(repoRoot, 'plugin', 'scripts', 'keyword-detector.mjs');
    const payload = JSON.stringify({
      prompt: '先幫我檢查一下這個 repo 為什麼不能用，然後修一下這集的發音跟字幕',
    });

    const output = execFileSync('node', [scriptPath], {
      cwd: repoRoot,
      input: payload,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    expect(output).toContain('/ars:doctor');
    expect(output).toContain('/ars:audio');
  });

  it('keyword detector recommends reflect for analytics-driven retrospectives', () => {
    const scriptPath = path.join(repoRoot, 'plugin', 'scripts', 'keyword-detector.mjs');
    const payload = JSON.stringify({
      prompt: '根據最近 analytics 跟幾支 episodes 的表現，幫我復盤一下然後更新 guide',
    });

    const output = execFileSync('node', [scriptPath], {
      cwd: repoRoot,
      input: payload,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    expect(output).toContain('/ars:reflect');
  });

  it('keyword detector recommends analytics for performance-report prompts', () => {
    const scriptPath = path.join(repoRoot, 'plugin', 'scripts', 'keyword-detector.mjs');
    const payload = JSON.stringify({
      prompt: '幫我看一下最近 YouTube analytics 跟影片表現，做個數據報告',
    });

    const output = execFileSync('node', [scriptPath], {
      cwd: repoRoot,
      input: payload,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    expect(output).toContain('/ars:analytics');
  });

  it('keyword detector recommends research for competitor and topic-direction prompts', () => {
    const scriptPath = path.join(repoRoot, 'plugin', 'scripts', 'keyword-detector.mjs');

    const competitorPrompt = JSON.stringify({
      prompt: '幫我看一下這個主題的競品有誰做過，順便優化一下方向',
    });
    const competitorOutput = execFileSync('node', [scriptPath], {
      cwd: repoRoot,
      input: competitorPrompt,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    expect(competitorOutput).toContain('/ars:research');

    const englishPrompt = JSON.stringify({
      prompt: 'do a competitor analysis on this topic before we plan',
    });
    const englishOutput = execFileSync('node', [scriptPath], {
      cwd: repoRoot,
      input: englishPrompt,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    expect(englishOutput).toContain('/ars:research');
  });

  it('keyword detector keeps reflect and research separate on overlapping prompts', () => {
    const scriptPath = path.join(repoRoot, 'plugin', 'scripts', 'keyword-detector.mjs');
    const payload = JSON.stringify({
      prompt: '根據最近 analytics 跟 episodes 的表現幫我復盤',
    });

    const output = execFileSync('node', [scriptPath], {
      cwd: repoRoot,
      input: payload,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    expect(output).toContain('/ars:reflect');
    expect(output).not.toContain('/ars:research');
  });
});
