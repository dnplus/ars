import fs from 'fs';
import path from 'path';

export type PreparedYoutubeCandidate = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  rationale: string;
  warnings: string[];
};

export type PrepareChapterEntry = {
  timestamp: string;
  label: string;
};

export type YoutubePrepareArtifact = {
  phase: 'youtube';
  status: 'pending-review' | 'ready';
  generatedAt: string;
  target: {
    series: string;
    epId: string;
  };
  episode: {
    filePath: string;
    title: string;
    subtitle: string | null;
    totalSteps: number;
    totalDurationInSeconds: number;
  };
  steps: Array<{
    id: string;
    heading: string;
    durationInSeconds: number;
    narrationSummary: string;
  }>;
  chapters: PrepareChapterEntry[];
  youtube: {
    candidates: PreparedYoutubeCandidate[];
    selected: string | null;
    title: string | null;
    description: string | null;
    tags: string[];
  };
  contextMarkdownPath: string;
  note: string;
};

export type PreparedYoutubeMetadata = {
  title: string;
  description: string;
  tags: string[];
};

function previewText(text: string, max: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, Math.max(0, max - 1))}…`;
}

function chaptersBlock(chapters: PrepareChapterEntry[]): string {
  if (chapters.length === 0) return '章節：\n00:00 開場';
  return ['章節：', ...chapters.map((chapter) => `${chapter.timestamp} ${chapter.label}`)].join('\n');
}

function descriptionBody(artifact: YoutubePrepareArtifact, intro: string): string {
  const subtitle = artifact.episode.subtitle?.trim();
  const lines = [
    intro.trim(),
    '',
    subtitle ? `本集副標：${subtitle}` : `本集主題：${artifact.episode.title}`,
    `總步驟數：${artifact.episode.totalSteps}`,
    '',
    chaptersBlock(artifact.chapters),
  ];
  return lines.join('\n');
}

function collectKeywords(artifact: YoutubePrepareArtifact): string[] {
  const raw = [
    artifact.target.series,
    artifact.episode.title,
    artifact.episode.subtitle ?? '',
    ...artifact.steps.slice(0, 4).map((step) => step.heading),
  ].join(' ');
  const seen = new Set<string>();
  return raw
    .split(/[^A-Za-z0-9_\-\u4e00-\u9fff]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .filter((token) => {
      if (seen.has(token.toLowerCase())) return false;
      seen.add(token.toLowerCase());
      return true;
    })
    .slice(0, 10);
}

export function getPrepareArtifactPath(rootDir: string, series: string, epId: string): string {
  return path.join(rootDir, 'output', 'publish', series, epId, 'prepare-youtube.json');
}

export function getPrepareMarkdownPath(rootDir: string, series: string, epId: string): string {
  return path.join(rootDir, 'output', 'publish', series, epId, 'prepare-youtube.md');
}

export function readPrepareArtifact(rootDir: string, series: string, epId: string): YoutubePrepareArtifact | null {
  const artifactPath = getPrepareArtifactPath(rootDir, series, epId);
  if (!fs.existsSync(artifactPath)) return null;
  return JSON.parse(fs.readFileSync(artifactPath, 'utf-8')) as YoutubePrepareArtifact;
}

function buildMarkdown(artifact: YoutubePrepareArtifact): string {
  const subtitle = artifact.episode.subtitle ?? '(none)';
  const stepsSection = artifact.steps.length > 0
    ? artifact.steps.map((step, index) => [
        `### ${index + 1}. ${step.heading}`,
        `- Step ID: ${step.id}`,
        `- Duration: ${step.durationInSeconds}s`,
        `- Narration Summary: ${step.narrationSummary}`,
      ].join('\n')).join('\n\n')
    : '_No steps found._';
  const selected = artifact.youtube.selected
    ? artifact.youtube.candidates.find((candidate) => candidate.id === artifact.youtube.selected) ?? null
    : null;
  const selectedSection = selected
    ? [
        '## Selected',
        `- Candidate: ${selected.id}`,
        `- Title: ${selected.title}`,
        '',
      ].join('\n')
    : '';
  const candidatesSection = artifact.youtube.candidates.length > 0
    ? artifact.youtube.candidates.map((candidate) => [
        `### ${candidate.id}`,
        `- Title: ${candidate.title}`,
        `- Tags: ${candidate.tags.join(', ')}`,
        `- Rationale: ${candidate.rationale}`,
        `- Warnings: ${candidate.warnings.join(' / ') || '(none)'}`,
        '',
        '```text',
        candidate.description,
        '```',
      ].join('\n')).join('\n\n')
    : 'TODO: Claude Code will fill this via /ars:prepare-youtube skill.';

  return [
    `# YouTube Prepare Context — ${artifact.target.series}/${artifact.target.epId}`,
    '',
    '## Episode Info',
    `- Series: ${artifact.target.series}`,
    `- Episode ID: ${artifact.target.epId}`,
    `- Episode File: ${artifact.episode.filePath}`,
    `- Title: ${artifact.episode.title}`,
    `- Subtitle: ${subtitle}`,
    `- Total Steps: ${artifact.episode.totalSteps}`,
    `- Estimated Duration: ${artifact.episode.totalDurationInSeconds}s`,
    '',
    selectedSection,
    '## Steps Summary',
    stepsSection,
    '',
    '## Chapters',
    ...artifact.chapters.map((chapter) => `- ${chapter.timestamp} ${chapter.label}`),
    '',
    '## YouTube Candidates',
    candidatesSection,
    '',
  ].filter(Boolean).join('\n');
}

export function writePrepareArtifact(rootDir: string, artifact: YoutubePrepareArtifact): void {
  const artifactPath = getPrepareArtifactPath(rootDir, artifact.target.series, artifact.target.epId);
  const markdownPath = getPrepareMarkdownPath(rootDir, artifact.target.series, artifact.target.epId);
  fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
  fs.writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`, 'utf-8');
  fs.writeFileSync(markdownPath, buildMarkdown(artifact), 'utf-8');
}

export function generatePreparedYoutubeCandidates(
  artifact: YoutubePrepareArtifact,
): PreparedYoutubeCandidate[] {
  const title = previewText(artifact.episode.title, 56);
  const subtitle = previewText(artifact.episode.subtitle ?? '', 48);
  const firstStep = artifact.steps[0]?.heading ?? '開場';
  const hotStep = artifact.steps[1]?.heading ?? firstStep;
  const tags = collectKeywords(artifact);
  const channelTag = artifact.target.series;
  const baseTags = [channelTag, ...tags].slice(0, 10);

  return [
    {
      id: 'youtube-1',
      title: previewText(`${title}：從 ${firstStep} 到可發布流程`, 68),
      description: descriptionBody(
        artifact,
        `這集從最卡的痛點切入，拆開 ${title} 背後真正會卡住的環節，最後收斂成一條可重複執行的工作流。`,
      ),
      tags: [...baseTags, 'workflow', 'creator'].slice(0, 12),
      rationale: '用最廣的痛點切入，適合第一次看到這個主題的觀眾。',
      warnings: [],
    },
    {
      id: 'youtube-2',
      title: previewText(`${title}｜${hotStep} 到實作細節`, 68),
      description: descriptionBody(
        artifact,
        `這版包裝把焦點放在具體實作與細節取捨，適合已經在做同類流程、想直接看方法與結構的人。`,
      ),
      tags: [...baseTags, 'engineering', 'implementation'].slice(0, 12),
      rationale: '技術導向標題更容易抓住知道問題在哪、正在找解法的觀眾。',
      warnings: subtitle ? [] : ['副標缺失，描述角度較依賴主標與章節摘要。'],
    },
    {
      id: 'youtube-3',
      title: previewText(`別再亂做 ${title}，先把 ${firstStep} 搞對`, 68),
      description: descriptionBody(
        artifact,
        `這版走觀點與立場，先指出最常見的錯誤做法，再用整集內容支持為什麼應該改成這條流程。`,
      ),
      tags: [...baseTags, 'opinion', 'strategy'].slice(0, 12),
      rationale: '觀點式包裝更容易提高停留與點擊，但語氣會比其他兩版更強。',
      warnings: ['語氣偏強，若系列定位較保守可在選定前再修。'],
    },
  ];
}

export function selectPreparedYoutubeCandidate(
  artifact: YoutubePrepareArtifact,
  candidateId: string,
): YoutubePrepareArtifact {
  const selected = artifact.youtube.candidates.find((candidate) => candidate.id === candidateId);
  if (!selected) {
    throw new Error(`Unknown candidate: ${candidateId}`);
  }
  return {
    ...artifact,
    status: 'ready',
    youtube: {
      ...artifact.youtube,
      selected: candidateId,
      title: selected.title,
      description: selected.description,
      tags: [...selected.tags],
    },
  };
}

export function getSelectedPreparedYoutubeMetadata(
  artifact: YoutubePrepareArtifact | null,
): PreparedYoutubeMetadata | null {
  if (!artifact?.youtube.selected) {
    return null;
  }

  const selected = artifact.youtube.candidates.find((candidate) => candidate.id === artifact.youtube.selected);
  const title = artifact.youtube.title ?? selected?.title;
  const description = artifact.youtube.description ?? selected?.description;
  const tags = artifact.youtube.tags.length > 0 ? artifact.youtube.tags : selected?.tags;

  if (!title || !description || !tags) {
    return null;
  }

  return {
    title,
    description,
    tags: [...tags],
  };
}

export function youtubeMetadataMatchesSelection(
  artifact: YoutubePrepareArtifact | null,
  metadata: PreparedYoutubeMetadata | null | undefined,
): boolean {
  if (!metadata) {
    return false;
  }

  const selected = getSelectedPreparedYoutubeMetadata(artifact);
  if (!selected) {
    return false;
  }

  return metadata.title === selected.title
    && metadata.description === selected.description
    && metadata.tags.length === selected.tags.length
    && metadata.tags.every((tag, index) => tag === selected.tags[index]);
}
