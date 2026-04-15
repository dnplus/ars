/**
 * @component MarkdownCard
 * @description Rich Text Container supporting GFM (GitHub Flavored Markdown).
 * 
 * @agent-note
 * **Use Case**: Complex structured text, tables, quotes, or lists.
 * **Libraries**: `react-markdown` + `remark-gfm` + `remark-breaks`.
 * **Styling**: Styles are injected via the `components` prop to match the video theme (Lo-Fi Earth).
 * **Auto-scroll**: Uses ScrollableCard for long content.
 */
import React, { useMemo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { ScrollableCard } from "./ScrollableCard";
import { type WindowFrameType } from "../ui/WindowFrame";
import { useTheme } from '../../shared/ThemeContext';

export type MarkdownCardProps = {
    /** Card title */
    cardTitle: string;
    /** Tag label (e.g., "Guide", "Info") */
    cardTag: string;
    /** Tag color */
    tagColor: string;
    /** Markdown content to render */
    content: string;
    /** 框架類型，預設 'mac' */
    frame?: WindowFrameType;
};

/**
 * Auto font scale: enlarge short content so it doesn't look empty.
 * Only scales UP — long content stays at 1.0.
 */
function computeFontScale(content: string): number {
    const lines = content.split('\n').filter(l => l.trim().length > 0);
    const lineCount = lines.length;

    if (lineCount <= 2) return 3.0;
    if (lineCount <= 4) return 2.5;
    if (lineCount <= 8) return 1.5;
    return 1.0;
}

export const MarkdownCard: React.FC<MarkdownCardProps> = ({
    cardTitle,
    cardTag,
    tagColor,
    content,
    frame = 'mac',
}) => {
    const theme = useTheme();
    const fontScale = useMemo(() => computeFontScale(content), [content]);

    const mdComponents: Components = useMemo(() => ({
        p: ({ children }) => (
            <p style={{ margin: `0 0 ${Math.round(16 * fontScale)}px 0`, fontFamily: theme.fonts.main, fontSize: Math.round(32 * fontScale), lineHeight: 1.6, color: theme.colors.onCard }}>{children}</p>
        ),
        h1: ({ children }) => (
            <h1 style={{ margin: `0 0 ${Math.round(20 * fontScale)}px 0`, fontFamily: theme.fonts.main, fontSize: Math.round(48 * fontScale), fontWeight: 700, color: theme.colors.onCard }}>{children}</h1>
        ),
        h2: ({ children }) => (
            <h2 style={{ margin: `0 0 ${Math.round(16 * fontScale)}px 0`, fontFamily: theme.fonts.main, fontSize: Math.round(40 * fontScale), fontWeight: 700, color: theme.colors.onCard }}>{children}</h2>
        ),
        h3: ({ children }) => (
            <h3 style={{ margin: `0 0 ${Math.round(12 * fontScale)}px 0`, fontFamily: theme.fonts.main, fontSize: Math.round(36 * fontScale), fontWeight: 600, color: theme.colors.onCard }}>{children}</h3>
        ),
        ul: ({ children }) => (
            <ul style={{ margin: `0 0 ${Math.round(8 * fontScale)}px 0`, paddingLeft: Math.round(40 * fontScale), listStyleType: "disc", listStylePosition: "outside", fontFamily: theme.fonts.main, fontSize: Math.round(32 * fontScale), lineHeight: 1.5, color: theme.colors.onCard, whiteSpace: "normal" }}>{children}</ul>
        ),
        ol: ({ children }) => (
            <ol style={{ margin: `0 0 ${Math.round(8 * fontScale)}px 0`, paddingLeft: Math.round(40 * fontScale), listStyleType: "decimal", listStylePosition: "outside", fontFamily: theme.fonts.main, fontSize: Math.round(32 * fontScale), lineHeight: 1.5, color: theme.colors.onCard, whiteSpace: "normal" }}>{children}</ol>
        ),
        li: ({ children }) => (
            <li style={{ marginBottom: Math.round(8 * fontScale), paddingLeft: Math.round(4 * fontScale), whiteSpace: "normal" }}>{children}</li>
        ),
        code: ({ children, className }) => {
            const isCodeBlock = className?.startsWith("language-");
            if (isCodeBlock) {
                return (
                    <code style={{ display: "block", padding: Math.round(16 * fontScale), backgroundColor: theme.colors.surfaceCode, borderRadius: 8, fontFamily: theme.fonts.code, fontSize: Math.round(28 * fontScale), lineHeight: 1.5, color: theme.colors.onCard, overflowX: "auto", marginBottom: Math.round(16 * fontScale) }}>{children}</code>
                );
            }
            return (
                <code style={{ padding: "2px 8px", backgroundColor: theme.colors.surfaceCode, borderRadius: 4, fontFamily: theme.fonts.code, fontSize: Math.round(28 * fontScale), color: theme.colors.warning }}>{children}</code>
            );
        },
        strong: ({ children }) => (
            <strong style={{ fontWeight: 700, color: theme.colors.primary }}>{children}</strong>
        ),
        em: ({ children }) => (
            <em style={{ fontStyle: "italic", color: theme.colors.onCard }}>{children}</em>
        ),
        a: ({ children, href }) => (
            <a href={href} style={{ color: theme.colors.primary, textDecoration: "underline", fontWeight: 600 }}>{children}</a>
        ),
        blockquote: ({ children }) => (
            <blockquote style={{ margin: `0 0 ${Math.round(16 * fontScale)}px 0`, paddingLeft: 20, borderLeft: `4px solid ${theme.colors.primary}`, fontFamily: theme.fonts.main, fontSize: Math.round(30 * fontScale), fontStyle: "italic", color: theme.colors.onCardMuted }}>{children}</blockquote>
        ),
        table: ({ children }) => (
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: Math.round(24 * fontScale), marginTop: 8, fontSize: Math.round(28 * fontScale), fontFamily: theme.fonts.main, tableLayout: "auto" }}>{children}</table>
        ),
        thead: ({ children }) => (
            <thead style={{ backgroundColor: theme.colors.surfaceCardHeader, borderBottom: `2px solid ${theme.colors.border}` }}>{children}</thead>
        ),
        tbody: ({ children }) => <tbody>{children}</tbody>,
        tr: ({ children }) => (
            <tr style={{ borderBottom: `1px solid ${theme.colors.border}` }}>{children}</tr>
        ),
        th: ({ children }) => (
            <th style={{ padding: `${Math.round(16 * fontScale)}px ${Math.round(20 * fontScale)}px`, textAlign: "left", fontWeight: 700, color: theme.colors.primary, whiteSpace: "nowrap" }}>{children}</th>
        ),
        td: ({ children }) => (
            <td style={{ padding: `${Math.round(16 * fontScale)}px ${Math.round(20 * fontScale)}px`, textAlign: "left", color: theme.colors.onCard, verticalAlign: "top", lineHeight: 1.5 }}>{children}</td>
        ),
    }), [fontScale, theme]);

    return (
        <ScrollableCard
            frame={frame}
            frameTitle={cardTitle}
            frameTag={cardTag}
            frameTagColor={tagColor}
            padding="none"
        >
            <div
                style={{
                    flex: 1,
                    padding: 28,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                }}
            >
                <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkBreaks]}
                    components={mdComponents}
                >
                    {content}
                </ReactMarkdown>
            </div>
        </ScrollableCard>
    );
};
