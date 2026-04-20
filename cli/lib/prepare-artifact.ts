import fs from 'fs';
import path from 'path';
import { getRepoRoot } from './ars-config';

export interface PreparedYoutubeCandidate {
  id: string;
  title: string;
  description: string;
  tags: string[];
}

interface LegacyPrepareArtifact {
  selected?: {
    youtubeCandidateId?: string | null;
  };
  youtube?: {
    candidates?: PreparedYoutubeCandidate[];
    selected?: string | null;
  };
}

interface ReadyYoutubePrepareArtifact {
  status?: 'pending-review' | 'ready';
  youtube?: {
    title?: string | null;
    description?: string | null;
    tags?: string[];
  };
}

const ROOT = getRepoRoot();

function readJsonIfExists<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

export function getPrepareArtifactPath(
  series: string,
  epId: string,
  phase: 'youtube',
): string {
  return path.join(ROOT, 'output', 'publish', series, epId, `prepare-${phase}.json`);
}

export function readPreparedYoutubeCandidate(
  series: string,
  epId: string,
): { artifactPath: string; candidate: PreparedYoutubeCandidate } | null {
  const artifactPath = getPrepareArtifactPath(series, epId, 'youtube');
  const artifact = readJsonIfExists<LegacyPrepareArtifact | ReadyYoutubePrepareArtifact>(artifactPath);
  const readyArtifact = artifact as ReadyYoutubePrepareArtifact | null;
  const readyCandidate = readyArtifact?.status === 'ready'
    ? readyArtifact.youtube
    : null;

  if (
    readyCandidate &&
    typeof readyCandidate.title === 'string' &&
    readyCandidate.title.trim().length > 0 &&
    typeof readyCandidate.description === 'string' &&
    readyCandidate.description.trim().length > 0
  ) {
    return {
      artifactPath,
      candidate: {
        id: 'youtube-ready',
        title: readyCandidate.title,
        description: readyCandidate.description,
        tags: Array.isArray(readyCandidate.tags) ? readyCandidate.tags : [],
      },
    };
  }

  const legacyArtifact = artifact as LegacyPrepareArtifact | null;
  const candidates = legacyArtifact?.youtube?.candidates ?? [];
  if (candidates.length === 0) return null;

  const selectedId =
    legacyArtifact?.youtube?.selected
    ?? legacyArtifact?.selected?.youtubeCandidateId
    ?? candidates[0]?.id;
  const candidate = candidates.find((item) => item.id === selectedId) ?? candidates[0];
  if (!candidate) return null;

  return { artifactPath, candidate };
}
