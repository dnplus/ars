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
      'review-open',
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

    expect(output).toContain('/ars:plan <epId>');
    expect(output).toContain('/ars:build <epId>');
    expect(output).toContain('/ars:apply-review');
    expect(output).not.toContain('/ars:scene-plan');
    expect(output).not.toContain('/ars:scene-build');
    expect(output).not.toContain('/ars:scene-fix');
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
});
