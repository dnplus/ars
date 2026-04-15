/**
 * @module cli/lib/youtube-upload
 * @description YouTube Data API v3 — video upload, thumbnail set, metadata update.
 *
 * Uses resumable upload flow for reliable large file uploads.
 * Reuses auth from youtube-client.ts (same OAuth credentials).
 *
 * Environment variables required:
 *   YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN
 */
import fs from 'fs';
import path from 'path';
import { getAccessToken, type YouTubeCredentials } from './youtube-client';

const UPLOAD_BASE = 'https://www.googleapis.com/upload/youtube/v3';
const DATA_API_BASE = 'https://www.googleapis.com/youtube/v3';

// ── Types ──

export interface VideoMetadata {
  title: string;
  description: string;
  tags: string[];
  categoryId: string;
  defaultLanguage: string;
  privacyStatus: 'public' | 'unlisted' | 'private';
  selfDeclaredMadeForKids: boolean;
  publishAt?: string; // ISO 8601, for scheduled publishing
  notifySubscribers?: boolean;
  isShort?: boolean;
}

export interface UploadResult {
  videoId: string;
  title: string;
  privacyStatus: string;
  publishAt?: string;
  thumbnailUploaded: boolean;
  captionUploaded?: boolean;
  captionTrackId?: string;
  uploadedAt: string;
}

export interface CaptionUploadResult {
  captionId: string;
  language: string;
  name: string;
  isDraft: boolean;
}

// ── Resumable Upload ──

/**
 * Upload a video file to YouTube using resumable upload.
 *
 * Step 1: Initiate → get resumable URI
 * Step 2: PUT the file to that URI
 */
export async function uploadVideo(
  creds: YouTubeCredentials,
  videoPath: string,
  metadata: VideoMetadata,
): Promise<UploadResult> {
  const token = await getAccessToken(creds);
  const fileSize = fs.statSync(videoPath).size;

  console.log(`   📦 File: ${path.basename(videoPath)} (${(fileSize / 1024 / 1024).toFixed(1)} MB)`);

  // Step 1: Initiate resumable upload
  const body = {
    snippet: {
      title: metadata.title,
      description: metadata.description,
      tags: metadata.tags,
      categoryId: metadata.categoryId,
      defaultLanguage: metadata.defaultLanguage,
    },
    status: {
      privacyStatus: metadata.privacyStatus,
      selfDeclaredMadeForKids: metadata.selfDeclaredMadeForKids,
      ...(metadata.publishAt ? { publishAt: metadata.publishAt } : {}),
    },
  };

  const initRes = await fetch(
    `${UPLOAD_BASE}/videos?uploadType=resumable&part=snippet,status&notifySubscribers=${metadata.notifySubscribers ?? true}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Length': String(fileSize),
        'X-Upload-Content-Type': 'video/mp4',
      },
      body: JSON.stringify(body),
    },
  );

  if (!initRes.ok) {
    const errBody = await initRes.text();
    throw new Error(`Failed to initiate upload (${initRes.status}): ${errBody}`);
  }

  const resumableUri = initRes.headers.get('location');
  if (!resumableUri) {
    throw new Error('No resumable URI in response headers');
  }

  console.log(`   🔗 Resumable session started`);

  // Step 2: Upload the file
  const fileBuffer = fs.readFileSync(videoPath);

  console.log(`   ⬆️  Uploading...`);
  const uploadRes = await fetch(resumableUri, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': String(fileSize),
    },
    body: fileBuffer,
  });

  if (!uploadRes.ok) {
    const errBody = await uploadRes.text();
    throw new Error(`Upload failed (${uploadRes.status}): ${errBody}`);
  }

  const result = (await uploadRes.json()) as {
    id: string;
    snippet: { title: string };
    status: { privacyStatus: string; publishAt?: string };
  };

  return {
    videoId: result.id,
    title: result.snippet.title,
    privacyStatus: result.status.privacyStatus,
    publishAt: result.status.publishAt,
    thumbnailUploaded: false,
    uploadedAt: new Date().toISOString(),
  };
}

// ── Thumbnail ──

/**
 * Upload a custom thumbnail for a video.
 * Requires channel phone verification.
 */
export async function uploadThumbnail(
  creds: YouTubeCredentials,
  videoId: string,
  thumbnailPath: string,
): Promise<void> {
  const token = await getAccessToken(creds);
  const fileBuffer = fs.readFileSync(thumbnailPath);
  const ext = path.extname(thumbnailPath).toLowerCase();
  const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';

  const res = await fetch(
    `${UPLOAD_BASE}/thumbnails/set?videoId=${videoId}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': mimeType,
      },
      body: fileBuffer,
    },
  );

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Thumbnail upload failed (${res.status}): ${errBody}`);
  }
}

export async function uploadCaption(
  creds: YouTubeCredentials,
  videoId: string,
  captionPath: string,
  options?: {
    language?: string;
    name?: string;
    isDraft?: boolean;
  },
): Promise<CaptionUploadResult> {
  const token = await getAccessToken(creds);
  const fileBuffer = fs.readFileSync(captionPath);
  const boundary = `ars-caption-${Date.now()}`;
  const metadata = {
    snippet: {
      videoId,
      language: options?.language ?? 'zh-TW',
      name: options?.name ?? 'Traditional Chinese',
      isDraft: options?.isDraft ?? false,
    },
  };

  const multipartBody = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\n` +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      'Content-Type: application/x-subrip\r\n\r\n',
      'utf-8',
    ),
    fileBuffer,
    Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8'),
  ]);

  const res = await fetch(
    `${UPLOAD_BASE}/captions?part=snippet&uploadType=multipart`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody,
    },
  );

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Caption upload failed (${res.status}): ${errBody}`);
  }

  const result = (await res.json()) as {
    id: string;
    snippet: {
      language: string;
      name: string;
      isDraft: boolean;
    };
  };

  return {
    captionId: result.id,
    language: result.snippet.language,
    name: result.snippet.name,
    isDraft: result.snippet.isDraft,
  };
}

// ── Metadata Update ──

/**
 * Update video metadata (e.g. change privacy from private → public).
 */
export async function updateVideoMetadata(
  creds: YouTubeCredentials,
  videoId: string,
  updates: Partial<VideoMetadata>,
): Promise<void> {
  const token = await getAccessToken(creds);

  const body: Record<string, unknown> = { id: videoId };

  if (updates.title || updates.description || updates.tags || updates.categoryId) {
    body.snippet = {
      ...(updates.title ? { title: updates.title } : {}),
      ...(updates.description ? { description: updates.description } : {}),
      ...(updates.tags ? { tags: updates.tags } : {}),
      // categoryId is REQUIRED even for partial updates
      categoryId: updates.categoryId ?? '22',
    };
  }

  if (updates.privacyStatus) {
    body.status = {
      privacyStatus: updates.privacyStatus,
      ...(updates.publishAt ? { publishAt: updates.publishAt } : {}),
    };
  }

  const parts: string[] = [];
  if (body.snippet) parts.push('snippet');
  if (body.status) parts.push('status');

  if (parts.length === 0) return;

  const res = await fetch(
    `${DATA_API_BASE}/videos?part=${parts.join(',')}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Metadata update failed (${res.status}): ${errBody}`);
  }
}
