/**
 * @module cli/lib/imgur-upload
 * @description Imgur anonymous image upload — returns a public URL.
 *
 * Used by Threads IMAGE posts which require a publicly accessible image URL.
 * Uses Imgur API v3 anonymous upload (Client-ID auth, no account needed).
 *
 * Environment:
 *   IMGUR_CLIENT_ID — Get from https://api.imgur.com/oauth2/addclient
 */
import fs from 'fs';

export async function uploadImage(filePath: string): Promise<string> {
  const clientId = process.env.IMGUR_CLIENT_ID;
  if (!clientId) {
    throw new Error('Missing IMGUR_CLIENT_ID env var. Get one at https://api.imgur.com/oauth2/addclient');
  }

  const imageData = fs.readFileSync(filePath);
  const base64 = imageData.toString('base64');

  const res = await fetch('https://api.imgur.com/3/image', {
    method: 'POST',
    headers: {
      Authorization: `Client-ID ${clientId}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ image: base64, type: 'base64' }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Imgur upload failed (${res.status}): ${errBody}`);
  }

  const data = (await res.json()) as { data: { link: string } };
  return data.data.link;
}
