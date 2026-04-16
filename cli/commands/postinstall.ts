import { getRuntimePackageInfo } from '../lib/runtime-package';
import { resolveSetupTargetRoot, syncAgents, syncSkills } from '../lib/install';

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
      reason: 'No consumer repo root resolved for postinstall sync.',
    };
  }

  // Always sync skills and agents regardless of whether the repo has been
  // initialized yet. This keeps the plugin surface current without implicitly
  // bootstrapping a project during package install.
  try {
    syncSkills({ root, pluginRoot: runtime.pluginRoot, overwrite: true });
    syncAgents({ root, pluginRoot: runtime.pluginRoot, overwrite: true });
    return {
      skipped: false,
      root,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (process.env.ARS_POSTINSTALL_STRICT === '1') {
      throw error;
    }
    console.warn(`[ars] postinstall sync skipped: ${message}`);
    return {
      skipped: true,
      reason: message,
      root,
    };
  }
}
