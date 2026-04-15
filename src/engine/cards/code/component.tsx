import React, { useMemo } from "react";
import { Highlight } from "prism-react-renderer";
import { ScrollSlide } from "../../primitives/ScrollSlide";
import { useCardContext } from "../../primitives/BaseSlide";
import type { Theme } from "../../shared/theme";
import type { WindowFrameKind } from "../../primitives/types";
import type { CardRenderProps } from "../types";

export type CodeCardData = {
  code: string;
  language?: string;
  title?: string;
  showLineNumbers?: boolean;
  frame?: WindowFrameKind;
};

const makeCodeTheme = (theme: Theme) => ({
  plain: {
    color: theme.colors.onCode,
    backgroundColor: theme.colors.surfaceCode,
  },
  styles: [
    {
      types: ["prolog", "constant", "builtin", "keyword"],
      style: { color: theme.colors.info },
    },
    {
      types: ["inserted", "function", "class-name"],
      style: { color: theme.colors.warning },
    },
    {
      types: ["deleted"],
      style: { color: theme.colors.negative },
    },
    {
      types: ["changed", "operator"],
      style: { color: theme.colors.accent },
    },
    {
      types: ["punctuation", "symbol"],
      style: { color: theme.colors.onCard },
    },
    {
      types: ["string", "char", "tag", "selector"],
      style: { color: theme.colors.highlight },
    },
    {
      types: ["variable", "parameter", "attr-name"],
      style: { color: theme.colors.primary },
    },
    {
      types: ["comment"],
      style: { color: theme.colors.onCardMuted },
    },
  ],
});

const CodeContent: React.FC<{
  code: string;
  language: string;
  showLineNumbers: boolean;
}> = ({ code, language, showLineNumbers }) => {
  const { theme } = useCardContext();
  const codeTheme = useMemo(() => makeCodeTheme(theme), [theme]);

  return (
    <div
      style={{
        padding: 24,
        flex: 1,
        backgroundColor: theme.colors.surfaceCard,
        fontFamily: theme.fonts.code,
      }}
    >
      <Highlight theme={codeTheme} code={code.trim()} language={language}>
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
            {tokens.map((line, index) => (
              <div key={index} {...getLineProps({ line })}>
                {showLineNumbers ? (
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
                    {index + 1}
                  </span>
                ) : null}
                {line.map((token, tokenIndex) => (
                  <span
                    key={`${index}-${tokenIndex}`}
                    {...getTokenProps({ token })}
                  />
                ))}
              </div>
            ))}
          </pre>
        )}
      </Highlight>
    </div>
  );
};

export const CodeCardComponent: React.FC<CardRenderProps<CodeCardData>> = ({
  data,
}) => {
  return (
    <ScrollSlide
      frame={data.frame ?? "mac"}
      title={data.title || `${data.language || "tsx"} snippet`}
      tag="CODE"
      tagColor="warning"
      innerPadding="none"
    >
      <CodeContent
        code={data.code}
        language={data.language || "tsx"}
        showLineNumbers={data.showLineNumbers ?? true}
      />
    </ScrollSlide>
  );
};
