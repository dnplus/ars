import {
  getRepoRoot,
  parseHookPayload,
  readStdin,
  updateWorkStateFromCommand,
} from './lib/ars-workstate.mjs';

async function main() {
  const payload = parseHookPayload(await readStdin());
  const toolName = String(payload.tool_name || payload.toolName || '').toLowerCase();
  const toolInput = payload.tool_input || payload.toolInput || {};
  const command = typeof toolInput.command === 'string' ? toolInput.command : '';
  const cwd = typeof payload.cwd === 'string' && payload.cwd ? payload.cwd : process.cwd();
  const sessionId =
    typeof payload.session_id === 'string'
      ? payload.session_id
      : typeof payload.sessionId === 'string'
        ? payload.sessionId
        : undefined;

  if (toolName !== 'bash' || !command) {
    console.log(JSON.stringify({ continue: true, suppressOutput: true }));
    return;
  }

  updateWorkStateFromCommand(getRepoRoot(cwd), sessionId, command);
  console.log(JSON.stringify({ continue: true, suppressOutput: true }));
}

main().catch(() => {
  console.log(JSON.stringify({ continue: true, suppressOutput: true }));
});
