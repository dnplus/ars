import { setupCommand } from './setup';
import { getRuntimePackageInfo } from '../lib/runtime-package';
import { resolveSetupTargetRoot } from '../lib/install';

export interface PostinstallResult {
  skipped: boolean;
  reason?: string;
  root?: string;
}

export async function postinstallCommand(): Promise<PostinstallResult> {
  const runtime = getRuntimePackageInfo(import.meta.url);
  const root = resolveSetupTargetRoot(process.env, runtime.packageRoot);

  if (!root) {
    return {
      skipped: true,
      reason: 'No consumer repo root resolved for postinstall setup.',
    };
  }

  try {
    await setupCommand({
      root,
      force: false,
      forceEngine: false,
      forceConfig: false,
      forceClaudeMd: false,
      yes: true,
      quiet: true,
    });

    return {
      skipped: false,
      root,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (process.env.ARS_POSTINSTALL_STRICT === '1') {
      throw error;
    }

    console.warn(`[ars] postinstall setup skipped: ${message}`);
    return {
      skipped: true,
      reason: message,
      root,
    };
  }
}
