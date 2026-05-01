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
      'review',
      'new-card',
      'prepare-youtube',
      'publish-youtube',
      'release',
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

  it('onboard SKILL.md never combines a series-name argument with --skip-series', () => {
    // The CLI rejects `npx ars init <series> --skip-series` (and the reverse)
    // with `Cannot use --skip-series with a series name argument`. If the
    // onboarding skill instructs Claude to run that combination, Phase 2
    // bootstrap throws and the whole onboard flow stalls. Guard against the
    // regression at the doc level.
    const skillPath = path.join(repoRoot, 'plugin', 'skills', 'onboard', 'SKILL.md');
    const skill = fs.readFileSync(skillPath, 'utf-8');
    const codeFences = skill.split(/```[a-zA-Z0-9_-]*\n/).slice(1).map((chunk) => chunk.split('```')[0]);
    for (const block of codeFences) {
      for (const rawLine of block.split('\n')) {
        const line = rawLine.trim();
        if (!line.startsWith('npx ars init') && !line.startsWith('ars init')) continue;
        if (!line.includes('--skip-series')) continue;
        // Allow lines that pass --skip-series only (no positional series-name arg).
        const tokens = line
          .replace(/^npx\s+/, '')
          .replace(/^ars\s+init\s*/, '')
          .split(/\s+/)
          .filter(Boolean);
        const hasSeriesArg = tokens.some((token) => !token.startsWith('-'));
        expect(
          hasSeriesArg,
          `onboard SKILL.md still combines a series-name argument with --skip-series: "${line}"`,
        ).toBe(false);
      }
    }
  });

  it('keeps planning prompts on the Studio-first fast agenda path', () => {
    const planSkill = fs.readFileSync(
      path.join(repoRoot, 'plugin', 'skills', 'plan', 'SKILL.md'),
      'utf-8',
    );
    const interviewRef = fs.readFileSync(
      path.join(repoRoot, 'plugin', 'skills', 'plan', 'references', 'interview.md'),
      'utf-8',
    );
    const plannerAgent = fs.readFileSync(
      path.join(repoRoot, 'plugin', 'agents', 'planner.md'),
      'utf-8',
    );

    expect(planSkill).toContain('model: claude-sonnet-4-6');
    expect(planSkill).toContain('effort: medium');
    expect(plannerAgent).toContain('model: claude-sonnet-4-6');
    expect(plannerAgent).toContain('Default path: fast Studio agenda');
    expect(`${planSkill}\n${plannerAgent}`).not.toContain('claude-opus-4-6');
    expect(`${planSkill}\n${interviewRef}\n${plannerAgent}`).not.toContain('mode: "plan"');
    expect(`${planSkill}\n${interviewRef}\n${plannerAgent}`).not.toContain('ExitPlanMode');
  });
});
