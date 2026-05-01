import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(__dirname, '../..');

function read(relPath: string): string {
  return fs.readFileSync(path.join(repoRoot, relPath), 'utf-8');
}

describe('cross-platform command surfaces', () => {
  it('avoids Unix-only stdio and import.meta URL path assumptions', () => {
    expect(read('plugin/scripts/ars-statusline.mjs')).not.toContain('/dev/stdin');
    expect(read('src/engine/vite-studio-base.ts')).not.toContain('new URL(import.meta.url).pathname');
    expect(read('src/engine/vite-studio-base.ts')).toContain('fileURLToPath(import.meta.url)');
  });

  it('does not spawn package .bin shims for Studio, publish, or export', () => {
    const runtimeSurfaces = [
      read('cli/lib/studio-launcher.ts'),
      read('cli/commands/publish.ts'),
      read('cli/commands/export.ts'),
    ].join('\n');

    expect(runtimeSurfaces).not.toContain("node_modules', '.bin'");
    expect(runtimeSurfaces).toContain('process.execPath');
    expect(runtimeSurfaces).toContain("npmCommand('npx')");
  });

  it('uses platform-aware npm-package shims for Node-installed CLIs', () => {
    const platformCommand = read('cli/lib/platform-command.ts');
    const init = read('cli/commands/init.ts');
    const doctor = read('cli/commands/doctor.ts');
    const launch = read('cli/commands/launch.ts');
    const repoInit = read('cli/lib/repo-init.ts');

    expect(platformCommand).toContain("process.platform === 'win32'");
    expect(repoInit).toContain("npmCommand('npm')");
    expect(repoInit).toContain("npmCommand('npx')");
    expect(`${init}\n${doctor}\n${launch}`).toContain('resolveClaudeCommand()');
    expect(`${init}\n${doctor}\n${launch}`).not.toContain("spawnSync('claude'");
    expect(launch).not.toContain("execFileSync('claude'");
  });

  it('opens OAuth URLs without shell string interpolation', () => {
    const oauth = read('cli/lib/youtube-oauth.ts');
    expect(oauth).toContain('execFileSync(command.bin, command.args');
    expect(oauth).toContain('rundll32');
    expect(oauth).not.toContain('execSync(`${cmd}');
  });
});
