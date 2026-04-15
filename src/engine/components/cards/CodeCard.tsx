/**
 * @component CodeCard
 * @description Syntax-Highlighted Code Editor View
 * 
 * @agent-note
 * **Use Case**: Showing code snippets, config files, or terminal commands.
 * **Features**:
 * - Uses `prism-react-renderer` for highlighting.
 * - **Frame**: Defaults to 'Mac' style (looks like VS Code).
 * - **Theme**: `vsDark`.
 * - **Auto-scroll**: Uses ScrollableCard for long content.
 */

import React, { useMemo } from "react";
import { Highlight } from "prism-react-renderer";
import { ScrollableCard } from "./ScrollableCard";
import { type WindowFrameType } from "../ui/WindowFrame";
import { useTheme } from '../../shared/ThemeContext';

export type CodeCardProps = {
    code: string;
    language?: string;
    title?: string;
    showLineNumbers?: boolean;
    /** 框架類型，預設 'mac' */
    frame?: WindowFrameType;
};

// vsDarkTheme 在 CodeCard 元件函式內定義（需要 theme context）
const makeVsDarkTheme = (surfaceCode: string) => ({
    plain: {
        color: "#9cdcfe",
        backgroundColor: surfaceCode
    },
    styles: [
        {
            types: ["prolog", "constant", "builtin"],
            style: {
                color: "rgb(86, 156, 214)"
            }
        },
        {
            types: ["inserted", "function"],
            style: {
                color: "rgb(220, 220, 170)"
            }
        },
        {
            types: ["deleted"],
            style: {
                color: "rgb(255, 76, 76)"
            }
        },
        {
            types: ["changed"],
            style: {
                color: "rgb(226, 192, 141)"
            }
        },
        {
            types: ["punctuation", "symbol"],
            style: {
                color: "rgb(212, 212, 212)"
            }
        },
        {
            types: ["string", "char", "tag", "selector"],
            style: {
                color: "rgb(206, 145, 120)"
            }
        },
        {
            types: ["keyword", "variable"],
            style: {
                color: "rgb(86, 156, 214)"
            }
        },
        {
            types: ["comment"],
            style: {
                color: "rgb(106, 153, 85)"
            }
        },
        {
            types: ["attr-name"],
            style: {
                color: "rgb(156, 220, 254)"
            }
        }
    ]
});

export const CodeCard: React.FC<CodeCardProps> = ({
    code,
    language = "tsx",
    title = "",
    showLineNumbers = true,
    frame = 'mac',
}) => {
  const theme = useTheme();
  const vsDarkTheme = useMemo(() => makeVsDarkTheme(theme.colors.surfaceCode), [theme.colors.surfaceCode]);
    return (
        <ScrollableCard
            frame={frame}
            frameTitle={title || `${language} snippet`}
            frameTag="CODE"
            frameTagColor="yellow"
            padding="none"
        >
            <div
                style={{
                    padding: 24,
                    flex: 1,
                    backgroundColor: theme.colors.surfaceCard,
                    fontFamily: theme.fonts.code,
                }}
            >
                <Highlight
                    theme={vsDarkTheme}
                    code={code.trim()}
                    language={language}
                >
                    {({ className, style, tokens, getLineProps, getTokenProps }) => (
                        <pre
                            className={className}
                            style={{
                                ...style,
                                margin: 0,
                                background: "transparent",
                                fontSize: 28,
                                lineHeight: 1.5,
                                fontFamily: "inherit",
                                whiteSpace: "pre-wrap",
                                wordBreak: "break-word",
                            }}
                        >
                            {tokens.map((line, i) => (
                                <div key={i} {...getLineProps({ line })}>
                                    {showLineNumbers && (
                                        <span
                                            style={{
                                                display: "inline-block",
                                                width: 50,
                                                opacity: 0.3,
                                                textAlign: "right",
                                                marginRight: 20,
                                                userSelect: "none",
                                            }}
                                        >
                                            {i + 1}
                                        </span>
                                    )}
                                    {line.map((token, key) => (
                                        <span key={key} {...getTokenProps({ token })} />
                                    ))}
                                </div>
                            ))}
                        </pre>
                    )}
                </Highlight>
            </div>
        </ScrollableCard>
    );
};
