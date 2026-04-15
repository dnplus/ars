import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  assertNoDowngrade,
  compareVersions,
  readInstalledVersion,
  writeInstalledVersion,
} from '../lib/version';

const tempRoots: string[] = [];

function makeTempRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ars-version-test-'));
  tempRoots.push(root);
  return root;
}

afterEach(() => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    if (root) {
      fs.rmSync(root, { recursive: true, force: true });
    }
  }
});

describe('compareVersions', () => {
  it('orders stable releases correctly', () => {
    expect(compareVersions('1.2.0', '1.1.9')).toBe(1);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('1.0.0', '1.0.1')).toBe(-1);
  });

  it('treats stable releases as newer than prereleases', () => {
    expect(compareVersions('1.0.0', '1.0.0-beta.1')).toBe(1);
    expect(compareVersions('1.0.0-beta.1', '1.0.0-beta.2')).toBe(-1);
    expect(compareVersions('1.0.0-rc.1', '1.0.0-beta.9')).toBe(1);
  });
});

describe('version metadata', () => {
  it('writes and reads .ars/.ars-version.json', () => {
    const root = makeTempRoot();
    writeInstalledVersion(
      {
        version: '1.2.3',
        installedAt: '2026-04-15T00:00:00.000Z',
        lastUpdatedAt: '2026-04-15T00:00:00.000Z',
        installMethod: 'npm-local',
        configSchemaVersion: 2,
      },
      root,
    );

    expect(readInstalledVersion(root)).toMatchObject({
      version: '1.2.3',
      installMethod: 'npm-local',
      configSchemaVersion: 2,
    });
  });

  it('falls back to legacy engine-version.json', () => {
    const root = makeTempRoot();
    const arsDir = path.join(root, '.ars');
    fs.mkdirSync(arsDir, { recursive: true });
    fs.writeFileSync(
      path.join(arsDir, 'engine-version.json'),
      JSON.stringify({
        commit: 'version:0.9.0',
        copiedAt: '2026-04-15T00:00:00.000Z',
        source: '/tmp/pkg/node_modules/agentic-remotion-studio',
      }),
    );

    expect(readInstalledVersion(root)).toMatchObject({
      version: '0.9.0',
      installMethod: 'npm-local',
      configSchemaVersion: 1,
    });
  });

  it('rejects downgrades', () => {
    expect(() => assertNoDowngrade('1.2.0', '1.1.9')).toThrow(
      'Refusing to downgrade ARS',
    );
    expect(() => assertNoDowngrade('1.2.0', '1.2.0')).not.toThrow();
  });
});
