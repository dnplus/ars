/**
 * @module cli/lib/youtube-oauth
 * @description YouTube OAuth 2.0 local server flow helpers.
 *
 * Provides:
 *   runYouTubeOAuthFlow  — full OAuth flow, returns refresh token
 *   patchEnvFile         — update or append a key=value in .env
 *   openBrowser          — open URL in default browser (mac/linux)
 *   startCallbackServer  — HTTP server that captures OAuth callback code
 */
import http from 'http';
import { execSync } from 'child_process';
import fs from 'fs';
import crypto from 'crypto';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/youtube';
const CALLBACK_TIMEOUT_MS = 30_000;

// ── Browser ──

export function openBrowser(url: string): void {
  const platform = process.platform;
  const cmd = platform === 'darwin' ? 'open' : 'xdg-open';
  try {
    execSync(`${cmd} "${url}"`, { stdio: 'ignore' });
  } catch {
    // Silently fail — caller already printed the URL for manual fallback
  }
}

// ── HTTP Callback Server ──

/**
 * Start a local HTTP server on the given port, wait for a request to
 * /callback?code=<code>, then close and return the code.
 * Rejects after CALLBACK_TIMEOUT_MS (30 s).
 */
export function startCallbackServer(port: number, redirectUri: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      server.close();
      reject(new Error('OAuth callback timed out after 30 seconds. Please try again.'));
    }, CALLBACK_TIMEOUT_MS);

    const server = http.createServer((req, res) => {
      const reqUrl = new URL(req.url ?? '/', `http://localhost:${port}`);

      if (reqUrl.pathname !== '/callback') {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const code = reqUrl.searchParams.get('code');
      const error = reqUrl.searchParams.get('error');

      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(`<html><body><h2>Authorization failed: ${error}</h2><p>You may close this tab.</p></body></html>`);
        clearTimeout(timer);
        server.close();
        reject(new Error(`OAuth authorization denied: ${error}`));
        return;
      }

      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<html><body><h2>Missing authorization code.</h2><p>You may close this tab.</p></body></html>');
        clearTimeout(timer);
        server.close();
        reject(new Error('No authorization code received from Google.'));
        return;
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><body><h2>Authorization successful!</h2><p>You may close this tab and return to your terminal.</p></body></html>');
      clearTimeout(timer);
      server.close();
      resolve(code);
    });

    server.listen(port, '127.0.0.1', () => {
      // Server is ready
    });

    server.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

// ── Token Exchange ──

async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
): Promise<{ refresh_token: string; access_token: string }> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    error?: string;
    error_description?: string;
  };

  if (data.error || !data.access_token) {
    throw new Error(
      `Token exchange failed: ${data.error ?? 'no access_token'} — ${data.error_description ?? ''}`,
    );
  }

  if (!data.refresh_token) {
    throw new Error(
      'No refresh_token returned. If you have authorized this app before, revoke access at https://myaccount.google.com/permissions and try again.',
    );
  }

  return { refresh_token: data.refresh_token, access_token: data.access_token };
}

// ── Main Flow ──

/**
 * Run the full YouTube OAuth 2.0 authorization code flow.
 * Opens a browser, waits for callback, exchanges code for tokens.
 * Returns the refresh token.
 */
export async function runYouTubeOAuthFlow(
  clientId: string,
  clientSecret: string,
): Promise<string> {
  // Pick a random ephemeral port in the unprivileged range
  const port = 8080 + Math.floor(Math.random() * 1000);
  const redirectUri = `http://localhost:${port}/callback`;
  const state = crypto.randomBytes(8).toString('hex');

  const authUrl = new URL(GOOGLE_AUTH_URL);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', SCOPE);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');

  console.log('\nOpening browser for Google authorization...');
  console.log(`If the browser does not open, visit:\n  ${authUrl.toString()}\n`);

  // Start server before opening browser to avoid race condition
  const codePromise = startCallbackServer(port, redirectUri);
  openBrowser(authUrl.toString());

  console.log(`Waiting for OAuth callback on port ${port}...`);
  const code = await codePromise;

  console.log('Authorization code received. Exchanging for tokens...');
  const tokens = await exchangeCodeForTokens(code, clientId, clientSecret, redirectUri);

  return tokens.refresh_token;
}

// ── .env Patcher ──

/**
 * Update an existing key=value line in the .env file, or append it if absent.
 * Does not disturb other lines or comments.
 */
export function patchEnvFile(envPath: string, key: string, value: string): void {
  let content = '';
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, 'utf-8');
  }

  const lines = content.split('\n');
  const keyPrefix = `${key}=`;
  let found = false;

  const patched = lines.map((line) => {
    if (line.startsWith(keyPrefix) || line.startsWith(`${key} =`)) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });

  if (!found) {
    // Ensure file ends with newline before appending
    if (patched.length > 0 && patched[patched.length - 1] !== '') {
      patched.push('');
    }
    patched.push(`${key}=${value}`);
    patched.push('');
  }

  fs.writeFileSync(envPath, patched.join('\n'), 'utf-8');
}
