/**
 * @module cli/lib/estimate-duration
 * @description Estimate TTS audio duration from narration text.
 *
 * Calibrated against MiniMax TTS (speech-02-hd) with real episode data:
 *   - EP002 (sample-series): formula=83s, actual=77s (+8%)
 *   - EP005 (sample-series): formula=268s, actual=256s (+5%)
 *   - EP006 (sample-series): formula=127s, actual=126s (+1%)
 *
 * Default rate: 5.5 chars/sec (JS string length, including Chinese, English, punctuation).
 * Slightly overestimates (1-8%), which is safer than underestimating.
 */

/** Default TTS speaking rate: characters per second (JS string length) */
const DEFAULT_CHARS_PER_SECOND = 5.5;

/**
 * Estimate TTS audio duration from narration text.
 *
 * @param narration - The narration text
 * @param speed - TTS speed multiplier (default 1.0, range 0.5-2.0)
 * @returns Estimated duration in seconds (rounded up)
 */
export function estimateNarrationDuration(
  narration: string,
  speed: number = 1.0,
): number {
  if (!narration || narration.trim().length === 0) return 0;
  const chars = narration.length;
  return Math.ceil(chars / (DEFAULT_CHARS_PER_SECOND * speed));
}

export interface StepDurationAnalysis {
  stepId: string;
  charCount: number;
  estimatedSeconds: number;
}

export interface EpisodeDurationAnalysis {
  steps: StepDurationAnalysis[];
  totalDeclared: number;
  totalEstimated: number;
}

/**
 * Analyze all steps in an episode, estimating duration from narration length.
 */
export function analyzeEpisodeDuration(
  steps: Array<{ id?: string; narration?: string; durationInSeconds: number }>,
  speed: number = 1.0,
): EpisodeDurationAnalysis {
  const analyzed: StepDurationAnalysis[] = [];
  let totalDeclared = 0;
  let totalEstimated = 0;

  for (const step of steps) {
    if (!step.id) continue;
    const charCount = step.narration?.length ?? 0;
    const estimated = step.narration
      ? estimateNarrationDuration(step.narration, speed)
      : step.durationInSeconds;

    analyzed.push({
      stepId: step.id,
      charCount,
      estimatedSeconds: estimated,
    });

    totalDeclared += step.durationInSeconds;
    totalEstimated += estimated;
  }

  return {
    steps: analyzed,
    totalDeclared,
    totalEstimated,
  };
}

/**
 * Format duration analysis as a console-printable report.
 */
export function formatDurationReport(analysis: EpisodeDurationAnalysis): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('   Duration analysis (estimated from narration length):');
  lines.push(
    '   ' +
    'Step'.padEnd(25) +
    'Chars'.padStart(6) +
    'Estimated'.padStart(11),
  );
  lines.push('   ' + '─'.repeat(42));

  for (const s of analysis.steps) {
    lines.push(
      '   ' +
      s.stepId.padEnd(25) +
      String(s.charCount).padStart(6) +
      `${s.estimatedSeconds}s`.padStart(11),
    );
  }

  lines.push('   ' + '─'.repeat(42));
  lines.push(
    '   ' +
    'TOTAL'.padEnd(25) +
    ''.padStart(6) +
    `${analysis.totalEstimated}s`.padStart(11) +
    ` (${(analysis.totalEstimated / 60).toFixed(1)}min)`,
  );

  return lines.join('\n');
}
