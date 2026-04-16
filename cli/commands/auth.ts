import path from 'path';
import { getRepoRoot } from '../lib/ars-config';
import { runYouTubeOAuthFlow, patchEnvFile } from '../lib/youtube-oauth';

const HELP = `
Usage: npx ars auth <subcommand> [options]

Subcommands:
  youtube    Authorize YouTube API access via OAuth 2.0

Options:
  --force    Re-run authorization even if credentials already exist
  -h, --help Show this help
`;

const YOUTUBE_SETUP_GUIDE = `
YouTube API credentials are not configured.

To set up YouTube publishing:

  1. Go to https://console.cloud.google.com/
  2. Create a new project (or select an existing one)
  3. Enable the YouTube Data API v3:
       APIs & Services > Library > "YouTube Data API v3" > Enable
  4. Create OAuth 2.0 credentials:
       APIs & Services > Credentials > Create Credentials > OAuth client ID
       Application type: Web application
       Authorized redirect URIs: http://localhost:3847/callback
         (Add exactly this URI — ARS always uses port 3847)
  5. Download the client_secret.json (optional, not required here)
  6. Copy the Client ID and Client Secret, then add them to your .env:

       YOUTUBE_CLIENT_ID=your-client-id.apps.googleusercontent.com
       YOUTUBE_CLIENT_SECRET=your-client-secret

  Then run: npx ars auth youtube
`;

export async function run(args: string[]): Promise<void> {
  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    console.log(HELP.trim());
    return;
  }

  const [subcommand, ...rest] = args;

  if (subcommand === 'youtube') {
    await runYouTubeAuth(rest);
    return;
  }

  console.error(`Unknown auth subcommand: ${subcommand}`);
  console.log(HELP.trim());
  process.exit(1);
}

async function runYouTubeAuth(args: string[]): Promise<void> {
  const force = args.includes('--force');

  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const existingToken = process.env.YOUTUBE_REFRESH_TOKEN;

  // Case 1: missing client credentials
  if (!clientId || !clientSecret) {
    console.log(YOUTUBE_SETUP_GUIDE.trim());
    process.exit(1);
  }

  // Case 2: already configured and no --force
  if (existingToken && !force) {
    console.log('YouTube refresh token already configured.');
    console.log('To re-authorize, run: npx ars auth youtube --force');
    return;
  }

  // Case 3: run OAuth flow
  const envPath = path.join(getRepoRoot(), '.env');

  try {
    const refreshToken = await runYouTubeOAuthFlow(clientId, clientSecret);
    patchEnvFile(envPath, 'YOUTUBE_REFRESH_TOKEN', refreshToken);
    console.log('\nYouTube authorization successful!');
    console.log(`YOUTUBE_REFRESH_TOKEN written to ${envPath}`);
    process.exit(0);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`\nAuthorization failed: ${message}`);
    process.exit(1);
  }
}
