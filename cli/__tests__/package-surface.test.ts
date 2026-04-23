import { spawnSync } from 'child_process';
import path from 'path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(__dirname, '../..');

describe('npm package surface', () => {
  it('excludes repo-local artifacts and includes required runtime files', () => {
    const result = spawnSync('npm', ['pack', '--dry-run'], {
      cwd: repoRoot,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;

    expect(output).toContain('cli/bin/ars.js');
    expect(output).toContain('plugin/skills/review/SKILL.md');
    expect(output).toContain('src/engine/Composition.tsx');
    expect(output).toContain('public/shared/fonts/NotoSansTC-Regular.otf');
    expect(output).toContain('public/episodes/template/shared/vtuber/ginseng_open.png');

    expect(output).not.toContain('.codex/environments/environment.toml');
    expect(output).not.toContain('.ars/episodes/ep-demo/plan.md');
    expect(output).not.toContain('cli/__tests__/skill-surface.test.ts');
    expect(output).not.toContain('docs/ars-cli-improvement-spec.md');
    expect(output).not.toContain('creator-studio.md');
  }, 20000);
});
