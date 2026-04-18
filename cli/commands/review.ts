/**
 * @command review
 * @deprecated Phase 1 turned `review` into a thin shim that forwards to
 *             `ars studio` (open) and `ars studio intent` (intent subcommands).
 *             `review close` is preserved verbatim — workstate stage handling
 *             is out of scope for the studio rename.
 */
import { resolveEpisodeTarget } from '../lib/context';
import { getRepoRoot } from '../lib/ars-config';

const HELP = `
Usage: npx ars review <subcommand> [options]   (deprecated — use ars studio)

Subcommands:
  open <epId>             → forwards to: ars studio <epId> --phase review
  intent <sub> ...        → forwards to: ars studio intent <sub> ...
  close <epId>            Mark review as done and advance stage to audio
`;

let warnedThisProcess = false;
function warn(replacement: string): void {
  if (warnedThisProcess) return;
  warnedThisProcess = true;
  console.warn(`[ars] "ars review" is deprecated; use "${replacement}" instead.`);
}

export async function run(args: string[]) {
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(HELP);
    return;
  }

  const [subcommand, ...rest] = args;

  switch (subcommand) {
    case 'open': {
      const epIdArg = rest[0];
      if (!epIdArg) {
        console.error('❌ Usage: npx ars review open <epId>');
        process.exit(1);
      }
      warn(`ars studio ${epIdArg} --phase review`);
      const studio = await import('./studio');
      const passthrough = rest.slice(1).filter((arg) => arg !== '--phase');
      return studio.run([epIdArg, '--phase', 'review', ...passthrough]);
    }
    case 'intent': {
      warn(`ars studio intent ${rest.join(' ')}`);
      const studio = await import('./studio');
      return studio.run(['intent', ...rest]);
    }
    case 'close':
      return closeReview(rest);
    default:
      console.error(`❌ Unknown review subcommand: ${subcommand}`);
      console.log(HELP);
      process.exit(1);
  }
}

async function closeReview(args: string[]): Promise<void> {
  const target = args[0];
  const root = getRepoRoot();

  if (!target) {
    console.error('❌ 請提供 epId。');
    console.log('Usage: npx ars review close <epId>');
    process.exit(1);
  }

  const { epId } = resolveEpisodeTarget(target, root);
  console.log(`✅ Review closed for ${epId}. Stage advanced to audio.`);
}
