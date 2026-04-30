import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  RESERVED_SERIES_NAMES,
  isReservedSeriesName,
  listAvailableSeries,
  listUserSeries,
} from '../lib/context';

const tempRoots: string[] = [];

function makeTempRepo(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ars-context-'));
  tempRoots.push(root);
  fs.mkdirSync(path.join(root, 'src', 'episodes', 'template'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src', 'episodes', 'demo-series'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src', 'episodes', 'b-series'), { recursive: true });
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

describe('series helpers', () => {
  it('RESERVED_SERIES_NAMES contains the template fixture and isReservedSeriesName agrees', () => {
    expect(RESERVED_SERIES_NAMES.has('template')).toBe(true);
    expect(isReservedSeriesName('template')).toBe(true);
    expect(isReservedSeriesName('demo-series')).toBe(false);
  });

  it('listAvailableSeries keeps reserved fixtures so explicit `template` flows still work', () => {
    const root = makeTempRepo();
    const all = listAvailableSeries(root).sort();
    expect(all).toEqual(['b-series', 'demo-series', 'template']);
  });

  it('listUserSeries filters every reserved fixture from the listing', () => {
    const root = makeTempRepo();
    const userSeries = listUserSeries(root).sort();
    expect(userSeries).toEqual(['b-series', 'demo-series']);
    expect(userSeries).not.toContain('template');
  });

  it('listUserSeries returns empty array when src/episodes/ does not exist', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ars-context-empty-'));
    tempRoots.push(root);
    expect(listUserSeries(root)).toEqual([]);
  });
});
