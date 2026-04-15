import { loadCredentials } from '../../../cli/lib/youtube-client';
import {
  uploadCaption,
  uploadThumbnail,
  uploadVideo,
} from '../../../cli/lib/youtube-upload';
import type { IPublishAdapter, PublishArtifact, PublishOptions, PublishResult } from '../types';

export class YouTubePublishAdapter implements IPublishAdapter {
  readonly platformId = 'youtube';

  async upload(artifact: PublishArtifact, options: PublishOptions = {}): Promise<PublishResult> {
    if (options.dryRun) {
      return {
        platformId: this.platformId,
        remoteId: 'dry-run',
        url: undefined,
        uploadedAt: new Date().toISOString(),
        dryRun: true,
        metadata: {
          filePath: artifact.filePath,
          title: artifact.title,
        },
      };
    }

    const creds = loadCredentials();
    const result = await uploadVideo(creds, artifact.filePath, {
      title: artifact.title,
      description: artifact.description,
      tags: artifact.tags ?? [],
      categoryId: artifact.categoryId ?? '27',
      defaultLanguage: artifact.language ?? 'zh-TW',
      privacyStatus: options.privacyStatus ?? 'private',
      selfDeclaredMadeForKids: artifact.madeForKids ?? false,
      publishAt: options.publishAt,
      notifySubscribers: options.notifySubscribers,
      isShort: artifact.isShort,
    });

    if (artifact.thumbnailPath) {
      await uploadThumbnail(creds, result.videoId, artifact.thumbnailPath);
      result.thumbnailUploaded = true;
    }

    if (artifact.captionPath) {
      const caption = await uploadCaption(creds, result.videoId, artifact.captionPath, {
        language: artifact.language ?? 'zh-TW',
      });
      result.captionUploaded = true;
      result.captionTrackId = caption.captionId;
    }

    return {
      platformId: this.platformId,
      remoteId: result.videoId,
      url: `https://www.youtube.com/watch?v=${result.videoId}`,
      uploadedAt: result.uploadedAt,
      dryRun: false,
      metadata: {
        privacyStatus: result.privacyStatus,
        title: result.title,
        thumbnailUploaded: String(result.thumbnailUploaded),
        captionUploaded: String(result.captionUploaded ?? false),
      },
    };
  }
}
