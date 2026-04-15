/**
 * @module extensions/social/threads-client
 * @description Threads API client — create text/media posts via Meta's official API.
 */
const API_BASE = 'https://graph.threads.net/v1.0';

export interface ThreadsCredentials {
  accessToken: string;
  userId: string;
}

export interface ThreadsPostResult {
  containerId: string;
  postId: string;
  permalink?: string;
  publishedAt: string;
}

export function loadThreadsCredentials(): ThreadsCredentials {
  const accessToken = process.env.THREADS_ACCESS_TOKEN;
  const userId = process.env.THREADS_USER_ID;

  if (!accessToken || !userId) {
    const missing = [
      !accessToken && 'THREADS_ACCESS_TOKEN',
      !userId && 'THREADS_USER_ID',
    ].filter(Boolean);

    console.error(`❌ Missing environment variables: ${missing.join(', ')}`);
    console.error(`\n   Get them from Meta Developer Portal:`);
    console.error(`   https://developers.facebook.com/apps/\n`);
    process.exit(1);
  }

  return { accessToken, userId };
}

export async function publishTextPost(
  creds: ThreadsCredentials,
  text: string,
): Promise<ThreadsPostResult> {
  const containerRes = await fetch(`${API_BASE}/${creds.userId}/threads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media_type: 'TEXT',
      text,
      access_token: creds.accessToken,
    }),
  });

  if (!containerRes.ok) {
    const errBody = await containerRes.text();
    throw new Error(`Threads container creation failed (${containerRes.status}): ${errBody}`);
  }

  const container = (await containerRes.json()) as { id: string };
  const publishRes = await fetch(`${API_BASE}/${creds.userId}/threads_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id: container.id,
      access_token: creds.accessToken,
    }),
  });

  if (!publishRes.ok) {
    const errBody = await publishRes.text();
    throw new Error(`Threads publish failed (${publishRes.status}): ${errBody}`);
  }

  const published = (await publishRes.json()) as { id: string };
  return {
    containerId: container.id,
    postId: published.id,
    publishedAt: new Date().toISOString(),
  };
}

export async function publishImagePost(
  creds: ThreadsCredentials,
  imageUrl: string,
  text: string,
): Promise<ThreadsPostResult> {
  const containerRes = await fetch(`${API_BASE}/${creds.userId}/threads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media_type: 'IMAGE',
      image_url: imageUrl,
      text,
      access_token: creds.accessToken,
    }),
  });

  if (!containerRes.ok) {
    const errBody = await containerRes.text();
    throw new Error(`Threads image container failed (${containerRes.status}): ${errBody}`);
  }

  const container = (await containerRes.json()) as { id: string };
  const publishRes = await fetch(`${API_BASE}/${creds.userId}/threads_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id: container.id,
      access_token: creds.accessToken,
    }),
  });

  if (!publishRes.ok) {
    const errBody = await publishRes.text();
    throw new Error(`Threads image publish failed (${publishRes.status}): ${errBody}`);
  }

  const published = (await publishRes.json()) as { id: string };
  return {
    containerId: container.id,
    postId: published.id,
    publishedAt: new Date().toISOString(),
  };
}

export async function publishVideoPost(
  creds: ThreadsCredentials,
  videoUrl: string,
  text: string,
): Promise<ThreadsPostResult> {
  const containerRes = await fetch(`${API_BASE}/${creds.userId}/threads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media_type: 'VIDEO',
      video_url: videoUrl,
      text,
      access_token: creds.accessToken,
    }),
  });

  if (!containerRes.ok) {
    const errBody = await containerRes.text();
    throw new Error(`Threads video container failed (${containerRes.status}): ${errBody}`);
  }

  const container = (await containerRes.json()) as { id: string };
  console.log(`   ⏳ Waiting for Threads video processing...`);
  await waitForContainerReady(creds, container.id);

  const publishRes = await fetch(`${API_BASE}/${creds.userId}/threads_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id: container.id,
      access_token: creds.accessToken,
    }),
  });

  if (!publishRes.ok) {
    const errBody = await publishRes.text();
    throw new Error(`Threads video publish failed (${publishRes.status}): ${errBody}`);
  }

  const published = (await publishRes.json()) as { id: string };
  return {
    containerId: container.id,
    postId: published.id,
    publishedAt: new Date().toISOString(),
  };
}

export async function replyToPost(
  creds: ThreadsCredentials,
  replyToId: string,
  text: string,
): Promise<ThreadsPostResult> {
  const containerRes = await fetch(`${API_BASE}/${creds.userId}/threads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media_type: 'TEXT',
      text,
      reply_to_id: replyToId,
      access_token: creds.accessToken,
    }),
  });

  if (!containerRes.ok) {
    const errBody = await containerRes.text();
    throw new Error(`Threads reply container failed (${containerRes.status}): ${errBody}`);
  }

  const container = (await containerRes.json()) as { id: string };
  const publishRes = await fetch(`${API_BASE}/${creds.userId}/threads_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      creation_id: container.id,
      access_token: creds.accessToken,
    }),
  });

  if (!publishRes.ok) {
    const errBody = await publishRes.text();
    throw new Error(`Threads reply publish failed (${publishRes.status}): ${errBody}`);
  }

  const published = (await publishRes.json()) as { id: string };
  return {
    containerId: container.id,
    postId: published.id,
    publishedAt: new Date().toISOString(),
  };
}

async function waitForContainerReady(
  creds: ThreadsCredentials,
  containerId: string,
  maxAttempts = 30,
  intervalMs = 5000,
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(
      `${API_BASE}/${containerId}?fields=status,error_message&access_token=${creds.accessToken}`,
    );

    if (!res.ok) {
      throw new Error(`Container status check failed (${res.status})`);
    }

    const data = (await res.json()) as {
      status: 'IN_PROGRESS' | 'FINISHED' | 'ERROR' | 'EXPIRED' | 'PUBLISHED';
      error_message?: string;
    };

    if (data.status === 'FINISHED') return;
    if (data.status === 'ERROR' || data.status === 'EXPIRED') {
      throw new Error(`Container processing failed: ${data.status} — ${data.error_message ?? 'unknown'}`);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error(`Container processing timed out after ${(maxAttempts * intervalMs) / 1000}s`);
}

export function parseThreadsCopy(markdown: string): string[] {
  const posts: string[] = [];
  const sections = markdown.split(/\n---\n/);

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;

    if (trimmed.includes('Hook 版本') || trimmed.startsWith('A.') || trimmed.startsWith('### 3')) {
      continue;
    }

    if (/^#\w/.test(trimmed) && !trimmed.includes('\n')) {
      posts.push(trimmed);
      continue;
    }

    const cleaned = trimmed
      .replace(/^###?\s+.*\n?/gm, '')
      .replace(/^\*\*.*?\*\*\s*/gm, '')
      .trim();

    if (cleaned) {
      posts.push(cleaned);
    }
  }

  return posts;
}
