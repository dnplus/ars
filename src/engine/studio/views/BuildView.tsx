/**
 * @component BuildView
 * @description Build phase placeholder. Phase 1 only shows static guidance and
 *              an episode-scope ActionBar. Real build orchestration lands in a
 *              later phase.
 */
import React from 'react';
import { ActionBar } from '../components/ActionBar';

type BuildViewProps = {
  series: string;
  epId: string;
};

export const BuildView: React.FC<BuildViewProps> = ({ series, epId }) => (
  <div style={containerStyle}>
    <div style={cardStyle}>
      <header style={cardHeaderStyle}>
        <span>{series} / {epId}</span>
        <ActionBar
          anchor={{ type: 'episode', id: epId }}
          source="build"
          series={series}
          epId={epId}
          kind="other"
        />
      </header>
      <div style={cardBodyStyle}>
        <p style={{ margin: 0 }}>
          Build phase 還沒接 build orchestration。
        </p>
        <p style={{ margin: 0 }}>
          下一步請回 TUI 跑 <code style={codeStyle}>/ars:build {epId}</code>。
        </p>
        <p style={{ margin: 0, color: 'color-mix(in srgb, var(--color-text-on-dark, #e2e8f0) 56%, transparent)' }}>
          build 完成後切到 Review phase 即可開始檢視。
        </p>
      </div>
    </div>
  </div>
);

const containerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
  padding: '40px 24px',
  background: 'var(--color-bg-dark, #0a1628)',
  color: 'var(--color-text-on-dark, #e2e8f0)',
};

const cardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 520,
  background: 'var(--color-overlay-bg, rgba(15,23,42,0.8))',
  border: '1px solid var(--color-border-light, rgba(255,255,255,0.12))',
  borderRadius: 14,
  overflow: 'hidden',
  fontFamily: 'var(--font-main, system-ui, sans-serif)',
};

const cardHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px 18px',
  borderBottom: '1px solid var(--color-border-light, rgba(255,255,255,0.08))',
  fontSize: 13,
};

const cardBodyStyle: React.CSSProperties = {
  padding: '20px 18px',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  fontSize: 14,
  lineHeight: 1.7,
};

const codeStyle: React.CSSProperties = {
  fontFamily: 'var(--font-code, ui-monospace, monospace)',
  fontSize: 13,
  padding: '1px 6px',
  borderRadius: 4,
  background: 'color-mix(in srgb, var(--color-text-on-dark, #e2e8f0) 8%, transparent)',
};

export default BuildView;
