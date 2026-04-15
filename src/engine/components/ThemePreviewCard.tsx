import React from 'react';
import { useTheme } from '../shared/ThemeContext';
import type { Theme } from '../shared/theme';

const GROUPS: Array<{ title: string; keys: Array<keyof Theme['colors']> }> = [
  {
    title: 'Surfaces',
    keys: [
      'primary',
      'secondary',
      'accent',
      'surfaceLight',
      'surfaceDark',
      'surfaceCard',
      'surfaceCardHeader',
      'surfaceCode',
      'surfaceOverlay',
      'bgLight',
      'bgDark',
      'cardBg',
      'cardHeaderBg',
      'codeBackground',
    ],
  },
  {
    title: 'Text',
    keys: [
      'onLight',
      'onDark',
      'onCard',
      'onCardMuted',
      'onPrimary',
      'onCode',
      'textMain',
      'textInverse',
      'textMuted',
      'textLight',
    ],
  },
  {
    title: 'Semantic',
    keys: ['positive', 'negative', 'info', 'warning', 'highlight'],
  },
  {
    title: 'Gradients',
    keys: ['gradientDark', 'gradientGold', 'gradientShimmer'],
  },
  {
    title: 'Borders/Shadows',
    keys: ['border', 'borderLight', 'shadow', 'shadowDark'],
  },
];

export const ThemePreviewCard: React.FC = () => {
  const theme = useTheme();

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 28,
        padding: 48,
        boxSizing: 'border-box',
        background: theme.colors.gradientDark,
        color: theme.colors.onDark,
        fontFamily: theme.fonts.main,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 24,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div
            style={{
              fontSize: 18,
              letterSpacing: 1.6,
              textTransform: 'uppercase',
              color: theme.colors.onCardMuted,
            }}
          >
            Theme Preview
          </div>
          <div
            style={{
              fontSize: 46,
              lineHeight: 1.05,
              fontWeight: 700,
            }}
          >
            Token swatches, gradients, borders, and font samples
          </div>
        </div>

        <div
          style={{
            padding: '14px 18px',
            borderRadius: 18,
            background: theme.colors.surfaceOverlay,
            border: `1px solid ${theme.colors.borderLight}`,
            color: theme.colors.onDark,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            minWidth: 320,
          }}
        >
          <div style={{ fontSize: 14, letterSpacing: 1.2, textTransform: 'uppercase' }}>
            Primary / Accent
          </div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>
            {theme.colors.primary} · {theme.colors.accent}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2.1fr) minmax(340px, 0.9fr)',
          gap: 24,
          flex: 1,
          minHeight: 0,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 20,
            alignContent: 'start',
          }}
        >
          {GROUPS.map((group) => (
            <section
              key={group.title}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                padding: 18,
                borderRadius: 24,
                background: theme.colors.surfaceOverlay,
                border: `1px solid ${theme.colors.borderLight}`,
                boxShadow: `0 18px 42px ${theme.colors.shadowDark}`,
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 700 }}>{group.title}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {group.keys.map((key) => renderToken(theme, key))}
              </div>
            </section>
          ))}
        </div>

        <aside
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            padding: 22,
            borderRadius: 24,
            background: theme.colors.surfaceOverlay,
            border: `1px solid ${theme.colors.borderLight}`,
            boxShadow: `0 18px 42px ${theme.colors.shadowDark}`,
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 700 }}>Font Preview</div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              padding: 18,
              borderRadius: 18,
              background: theme.colors.surfaceCard,
              color: theme.colors.onCard,
            }}
          >
            <div style={{ fontSize: 14, textTransform: 'uppercase', color: theme.colors.onCardMuted }}>
              Main Font
            </div>
            <div style={{ fontSize: 36, fontWeight: 700, fontFamily: theme.fonts.main }}>
              Agentic Remotion Studio
            </div>
            <div style={{ fontSize: 20, lineHeight: 1.5 }}>
              內容策略、腳本生成、場景敘事與系列視覺可以用同一套 theme token 驅動。
            </div>
            <div style={{ fontSize: 16, color: theme.colors.onCardMuted }}>{theme.fonts.main}</div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              padding: 18,
              borderRadius: 18,
              background: theme.colors.surfaceCode,
              color: theme.colors.onCode,
            }}
          >
            <div style={{ fontSize: 14, textTransform: 'uppercase', color: theme.colors.onCardMuted }}>
              Code Font
            </div>
            <div
              style={{
                fontSize: 22,
                lineHeight: 1.5,
                fontFamily: theme.fonts.code,
                whiteSpace: 'pre-wrap',
              }}
            >
              {`const theme = deriveTheme(seed);\npreview(theme.colors.gradientGold);\nrender('theme-preview');`}
            </div>
            <div style={{ fontSize: 16, color: theme.colors.onCardMuted }}>{theme.fonts.code}</div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 12,
            }}
          >
            <div
              style={{
                padding: 16,
                borderRadius: 18,
                background: theme.colors.gradientGold,
                color: theme.colors.onPrimary,
                boxShadow: `0 20px 40px ${theme.colors.shadow}`,
              }}
            >
              <div style={{ fontSize: 14, textTransform: 'uppercase' }}>Gradient Gold</div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 8 }}>CTA Surface</div>
            </div>

            <div
              style={{
                padding: 16,
                borderRadius: 18,
                background: theme.colors.surfaceCardHeader,
                color: theme.colors.onCard,
                border: `1px solid ${theme.colors.border}`,
                boxShadow: `0 20px 40px ${theme.colors.shadow}`,
              }}
            >
              <div style={{ fontSize: 14, textTransform: 'uppercase', color: theme.colors.onCardMuted }}>
                Border + Shadow
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, marginTop: 8 }}>Panel Surface</div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

function renderToken(theme: Theme, key: keyof Theme['colors']) {
  const value = theme.colors[key];
  const previewStyle = getPreviewStyle(theme, key, value);

  return (
    <div
      key={key}
      style={{
        display: 'grid',
        gridTemplateColumns: '40px minmax(0, 1fr)',
        gap: 12,
        alignItems: 'center',
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          ...previewStyle,
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: theme.colors.onDark }}>{key}</div>
        <div
          style={{
            fontSize: 12,
            color: theme.colors.onCardMuted,
            fontFamily: theme.fonts.code,
            wordBreak: 'break-all',
          }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function getPreviewStyle(
  theme: Theme,
  key: keyof Theme['colors'],
  value: string
): React.CSSProperties {
  if (key === 'shadow' || key === 'shadowDark') {
    return {
      background: theme.colors.surfaceCard,
      border: `1px solid ${theme.colors.borderLight}`,
      boxShadow: `0 14px 28px ${value}`,
    };
  }

  if (key === 'border' || key === 'borderLight') {
    return {
      background: theme.colors.surfaceLight,
      border: `3px solid ${value}`,
    };
  }

  return {
    background: value,
    border: `1px solid ${theme.colors.borderLight}`,
    boxShadow: `0 8px 18px ${theme.colors.shadow}`,
  };
}
