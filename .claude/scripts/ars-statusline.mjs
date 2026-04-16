#!/usr/bin/env node

import {
  getRepoRoot,
  parseHookPayload,
  readStdin,
  renderStatusLine,
} from '../../plugin/scripts/lib/ars-workstate.mjs';

async function main() {
  const payload = parseHookPayload(await readStdin());
  const cwd = typeof payload.cwd === 'string' && payload.cwd ? payload.cwd : process.cwd();
  const sessionId =
    typeof payload.session_id === 'string'
      ? payload.session_id
      : typeof payload.sessionId === 'string'
        ? payload.sessionId
        : undefined;

  console.log(renderStatusLine(getRepoRoot(cwd), sessionId));
}

main().catch(() => {
  console.log('ARS');
});
