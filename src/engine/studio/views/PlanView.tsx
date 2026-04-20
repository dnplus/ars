/**
 * @component PlanView
 * @description Plan phase of the Studio shell — live render of the
 *              `.ars/episodes/<epId>/plan.md` file. Headings double as anchors
 *              for StudioIntent submission so the user can point Claude at a
 *              specific section without leaving the browser.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { MarkdownSection } from '../../shared/markdown-anchor';
import { extractSections } from '../../shared/markdown-anchor';
import { ActionBar } from '../components/ActionBar';

const POLL_INTERVAL_MS = 3000;

type PlanPayload = {
  series: string;
  epId: string;
  path: string;
  markdown: string;
  mtime: number;
  sections: MarkdownSection[];
};

type PlanResponse = {
  ok: boolean;
  plan?: PlanPayload;
  expectedPath?: string;
  error?: string;
};

type BuildStatusLite = {
  lastBuildAt?: string;
  episodeSourceMtime?: string;
  pendingIntentId?: string;
  state?: string;
};

type BuildStatusResponse = {
  ok: boolean;
  build?: BuildStatusLite;
  error?: string;
};

type TriggerResponse = {
  ok: boolean;
  intentId?: string;
  writtenAt?: string;
  error?: string;
};

type PlanViewProps = {
  series: string;
  epId: string;
  onBuildStarted?: (intentId: string) => void;
  dirtyHintFromShell?: boolean;
};

export const PlanView: React.FC<PlanViewProps> = ({
  series,
  epId,
  onBuildStarted,
  dirtyHintFromShell,
}) => {
  const [plan, setPlan] = useState<PlanPayload | null>(null);
  const [missingPath, setMissingPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [buildMeta, setBuildMeta] = useState<BuildStatusLite>({});
  const [triggering, setTriggering] = useState(false);
  const [triggerError, setTriggerError] = useState<string | null>(null);
  const lastMtimeRef = useRef<number>(0);

  const fetchPlan = useCallback(async () => {
    try {
      const params = new URLSearchParams({ series, ep: epId });
      const res = await fetch(`/__ars/plan?${params.toString()}`);
      const payload = (await res.json()) as PlanResponse;
      if (res.status === 404) {
        setMissingPath(payload.expectedPath ?? `.ars/episodes/${epId}/plan.md`);
        setPlan(null);
        setError(null);
        return;
      }
      if (!res.ok || !payload.plan) {
        throw new Error(payload.error ?? `HTTP ${res.status}`);
      }
      setMissingPath(null);
      setError(null);
      if (payload.plan.mtime !== lastMtimeRef.current) {
        lastMtimeRef.current = payload.plan.mtime;
        setPlan(payload.plan);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [series, epId]);

  const fetchBuildMeta = useCallback(async () => {
    try {
      const params = new URLSearchParams({ series, ep: epId });
      const res = await fetch(`/__ars/build-status?${params.toString()}`);
      if (!res.ok) return;
      const payload = (await res.json()) as BuildStatusResponse;
      if (payload.build) {
        setBuildMeta({
          lastBuildAt: payload.build.lastBuildAt,
          episodeSourceMtime: payload.build.episodeSourceMtime,
          pendingIntentId: payload.build.pendingIntentId,
          state: payload.build.state,
        });
      }
    } catch {
      // Soft-fail — trigger UI just hides the timestamp.
    }
  }, [series, epId]);

  useEffect(() => {
    void fetchPlan();
    void fetchBuildMeta();
    const timer = window.setInterval(() => {
      void fetchPlan();
      void fetchBuildMeta();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [fetchPlan, fetchBuildMeta]);

  const handleTriggerBuild = useCallback(async () => {
    if (triggering) return;
    setTriggering(true);
    setTriggerError(null);
    try {
      const res = await fetch('/__ars/build-trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ series, epId }),
      });
      const payload = (await res.json()) as TriggerResponse;
      if (res.status === 409) {
        // Already pending — still show overlay so user sees progress.
        if (payload.intentId) {
          onBuildStarted?.(payload.intentId);
        } else {
          setTriggerError('已有 build 正在排隊');
        }
        return;
      }
      if (!res.ok || !payload.intentId) {
        throw new Error(payload.error ?? `HTTP ${res.status}`);
      }
      onBuildStarted?.(payload.intentId);
    } catch (err) {
      setTriggerError(err instanceof Error ? err.message : String(err));
    } finally {
      setTriggering(false);
    }
  }, [series, epId, triggering, onBuildStarted]);

  const derivedDirty = (() => {
    if (dirtyHintFromShell) return true;
    const built = buildMeta.lastBuildAt ? Date.parse(buildMeta.lastBuildAt) : NaN;
    const source = buildMeta.episodeSourceMtime ? Date.parse(buildMeta.episodeSourceMtime) : NaN;
    if (Number.isFinite(built) && Number.isFinite(source)) return source > built;
    return !buildMeta.lastBuildAt;
  })();

  const lastBuiltLabel = buildMeta.lastBuildAt
    ? new Date(buildMeta.lastBuildAt).toLocaleString()
    : '從未 build';

  // Compute section anchors client-side as a fallback if server data is missing
  const sections = useMemo<MarkdownSection[]>(
    () => plan?.sections ?? (plan?.markdown ? extractSections(plan.markdown) : []),
    [plan],
  );

  const headingComponents = useMemo(() => makeHeadingComponents(sections, series, epId), [sections, series, epId]);

  if (error && !plan) {
    return <PlanMessage tone="error">無法讀取 plan：{error}</PlanMessage>;
  }

  if (missingPath) {
    return (
      <PlanMessage tone="info">
        <strong>{missingPath}</strong> 尚未存在。<br />
        在 TUI 跑 <code>/ars:plan {epId}</code>，這裡會自動 render。
      </PlanMessage>
    );
  }

  if (!plan) {
    return <PlanMessage tone="muted">載入 plan…</PlanMessage>;
  }

  return (
    <div style={planContainerStyle}>
      <header style={planHeaderStyle}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--color-text-on-dark)' }}>
            {plan.series} / {plan.epId}
          </div>
          <div style={{ fontSize: 11, color: 'color-mix(in srgb, var(--color-text-on-dark) 56%, transparent)' }}>
            {plan.path} · 最後更新 {new Date(plan.mtime).toLocaleTimeString()}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <ActionBar
            anchor={{ type: 'plan', id: 'plan' }}
            source="plan"
            series={plan.series}
            epId={plan.epId}
            kind="plan-section"
          />
          <button
            type="button"
            onClick={() => void fetchPlan()}
            style={refreshButtonStyle}
            title="立即重抓 plan.md"
          >
            ↻
          </button>
        </div>
      </header>

      <article style={planArticleStyle}>
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={headingComponents}>
          {plan.markdown}
        </ReactMarkdown>

        <div className="studio-plan-trigger">
          <div className="studio-plan-trigger-meta">
            <span className="studio-plan-trigger-label">LAST BUILD</span>
            <span className="studio-plan-trigger-time">{lastBuiltLabel}</span>
            {derivedDirty && <span className="studio-plan-dirty">● plan 已變更</span>}
            {triggerError && (
              <span className="studio-plan-dirty" style={{ color: 'var(--color-negative, #8b5e3c)' }}>
                {triggerError}
              </span>
            )}
          </div>
          <button
            type="button"
            className="studio-plan-trigger-btn"
            onClick={() => void handleTriggerBuild()}
            disabled={triggering}
            title="觸發 /ars:build，Claude Code 收到 intent 後開跑"
          >
            {triggering ? '送出中…' : '🚀 Build & Review'}
          </button>
        </div>
      </article>
    </div>
  );
};

function makeHeadingComponents(sections: MarkdownSection[], series: string, epId: string) {
  const slugByTitle = new Map<string, MarkdownSection>();
  for (const section of sections) {
    if (!slugByTitle.has(section.title)) {
      slugByTitle.set(section.title, section);
    }
  }

  const renderHeading = (level: 1 | 2 | 3 | 4 | 5 | 6) => {
    const Tag = `h${level}` as const;
    const HeadingComponent: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
      const text = childrenToText(children);
      const section = slugByTitle.get(text);
      const slug = section?.slug ?? text;
      return (
        <Tag id={slug} style={{ display: 'flex', alignItems: 'center', gap: 8, scrollMarginTop: 24 }}>
          <span style={{ flex: 1 }}>{children}</span>
          <span style={{ flexShrink: 0 }}>
            <ActionBar
              anchor={{
                type: 'markdown-section',
                id: slug,
                meta: { title: text, line: section?.line },
              }}
              source="plan"
              series={series}
              epId={epId}
              kind="plan-section"
            />
          </span>
        </Tag>
      );
    };
    HeadingComponent.displayName = `PlanHeading${level}`;
    return HeadingComponent;
  };

  return {
    h1: renderHeading(1),
    h2: renderHeading(2),
    h3: renderHeading(3),
    h4: renderHeading(4),
    h5: renderHeading(5),
    h6: renderHeading(6),
  };
}

function childrenToText(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(childrenToText).join('');
  if (React.isValidElement(node)) {
    const props = node.props as { children?: React.ReactNode };
    return childrenToText(props.children);
  }
  return '';
}

const planContainerStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  background: 'var(--color-bg-dark, #0a1628)',
  color: 'var(--color-text-on-dark, #e2e8f0)',
};

const planHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '10px 20px',
  borderBottom: '1px solid var(--color-border-light, rgba(255,255,255,0.08))',
  flexShrink: 0,
};

const planArticleStyle: React.CSSProperties = {
  flex: 1,
  overflow: 'auto',
  padding: '24px 32px 80px',
  fontFamily: 'var(--font-main, system-ui, sans-serif)',
  fontSize: 15,
  lineHeight: 1.7,
};

const refreshButtonStyle: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 8,
  border: '1px solid var(--color-border-light, rgba(255,255,255,0.12))',
  background: 'var(--color-overlay-bg, rgba(15,23,42,0.8))',
  color: 'var(--color-text-on-dark, #e2e8f0)',
  cursor: 'pointer',
  fontSize: 14,
};

const PlanMessage: React.FC<{ tone: 'muted' | 'info' | 'error'; children: React.ReactNode }> = ({ tone, children }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: '40px 24px',
    color: tone === 'error'
      ? 'var(--color-negative, #f87171)'
      : tone === 'info'
        ? 'var(--color-text-on-dark, #e2e8f0)'
        : 'color-mix(in srgb, var(--color-text-on-dark, #e2e8f0) 62%, transparent)',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 1.7,
  }}>
    <div>{children}</div>
  </div>
);

export default PlanView;
