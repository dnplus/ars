import {
  buildPromptContext,
  getRepoRoot,
  parseHookPayload,
  readStdin,
} from './lib/ars-workstate.mjs';

async function main() {
  const payload = parseHookPayload(await readStdin());
  const cwd = typeof payload.cwd === 'string' && payload.cwd ? payload.cwd : process.cwd();
  const sessionId =
    typeof payload.session_id === 'string'
      ? payload.session_id
      : typeof payload.sessionId === 'string'
        ? payload.sessionId
        : undefined;

  const lines = buildPromptContext(getRepoRoot(cwd), payload, sessionId);
  if (lines.length === 0) {
    console.log(JSON.stringify({ continue: true, suppressOutput: true }));
    return;
  }

  console.log(JSON.stringify({
    continue: true,
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: lines.join('\n'),
    },
  }));
}

main().catch(() => {
  console.log(JSON.stringify({ continue: true, suppressOutput: true }));
});
