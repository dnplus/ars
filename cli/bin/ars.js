#!/usr/bin/env node
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const entrypoint = path.resolve(__dirname, '..', 'index.ts');
const tsxLoader = import.meta.resolve('tsx');

const result = spawnSync(
  process.execPath,
  ['--import', tsxLoader, entrypoint, ...process.argv.slice(2)],
  {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  },
);

if (typeof result.status === 'number') {
  process.exit(result.status);
}

if (result.error) {
  throw result.error;
}

process.exit(1);
