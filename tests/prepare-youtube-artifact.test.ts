import { describe, expect, it } from 'vitest';
import {
  getSelectedPreparedYoutubeMetadata,
  selectPreparedYoutubeCandidate,
  type YoutubePrepareArtifact,
  youtubeMetadataMatchesSelection,
} from '../src/studio/prepare-youtube-artifact';

function makeArtifact(): YoutubePrepareArtifact {
  return {
    phase: 'youtube',
    status: 'pending-review',
    generatedAt: '2026-05-16T00:00:00.000Z',
    target: {
      series: 'template',
      epId: 'ep-demo',
    },
    episode: {
      filePath: 'src/episodes/template/ep-demo.ts',
      title: 'Demo',
      subtitle: null,
      totalSteps: 1,
      totalDurationInSeconds: 10,
    },
    steps: [],
    chapters: [],
    youtube: {
      candidates: [
        {
          id: 'youtube-1',
          title: 'Chosen title',
          description: 'Chosen description',
          tags: ['ars', 'demo'],
          rationale: 'Best fit.',
          warnings: [],
        },
        {
          id: 'youtube-2',
          title: 'Other title',
          description: 'Other description',
          tags: ['other'],
          rationale: 'Different angle.',
          warnings: [],
        },
      ],
      selected: null,
      title: null,
      description: null,
      tags: [],
    },
    contextMarkdownPath: 'output/publish/template/ep-demo/prepare-youtube.md',
    note: 'test fixture',
  };
}

describe('prepare YouTube metadata selection', () => {
  it('requires episode metadata.youtube to match the selected candidate exactly', () => {
    const artifact = selectPreparedYoutubeCandidate(makeArtifact(), 'youtube-1');

    expect(getSelectedPreparedYoutubeMetadata(artifact)).toEqual({
      title: 'Chosen title',
      description: 'Chosen description',
      tags: ['ars', 'demo'],
    });
    expect(youtubeMetadataMatchesSelection(artifact, {
      title: 'Chosen title',
      description: 'Chosen description',
      tags: ['ars', 'demo'],
    })).toBe(true);
    expect(youtubeMetadataMatchesSelection(artifact, {
      title: 'Other title',
      description: 'Other description',
      tags: ['other'],
    })).toBe(false);
  });
});
