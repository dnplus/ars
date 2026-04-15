/**
 * @component BaseCard
 * @description Abstract UI Shell for all Window-based Cards.
 * 
 * @agent-note
 * **Role**: Component Primitives.
 * **Features**:
 * - Wraps content in a `WindowFrame` (Mac/Terminal style).
 * - Handles uniform padding and layout structure.
 * - **Not used directly** in `WebinarScene`; used by other Cards.
 */
import React from "react";
import { WindowFrame, type WindowFrameType } from "../ui/WindowFrame";
import { CARD_SPACING, type CardSpacing } from "../../shared/constants";

export type BaseCardProps = {
  /** 框架類型：mac（預設）| terminal | none */
  frame?: WindowFrameType;
  /** 框架標題 */
  frameTitle?: string;
  /** 框架標籤 */
  frameTag?: string;
  /** 標籤顏色 */
  frameTagColor?: string;
  /** 內容區域 padding */
  padding?: CardSpacing;
  /** 是否啟用進場動畫 */
  animate?: boolean;
  maxHeight?: number | string;
  titleSuffix?: React.ReactNode; // Extra slot for header content if needed, though BaseCard doesn't expose it to WindowFrame yet. 
  // actually BaseCard just passes props to WindowFrame. 
  // Let's stick to simple maxHeight first.
  children: React.ReactNode;
};

export const BaseCard: React.FC<BaseCardProps> = ({
  frame = 'mac',
  frameTitle = '',
  frameTag = 'INFO',
  frameTagColor = 'blue',
  padding = 'md',
  animate = true,
  maxHeight,
  children,
}) => {
  const paddingValue = CARD_SPACING[padding];

  return (
    <WindowFrame
      type={frame}
      title={frameTitle}
      tag={frameTag}
      tagColor={frameTagColor}
      animate={animate}
    >
      <div
        style={{
          flex: 1,
          padding: paddingValue,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          position: "relative",
          maxHeight: maxHeight,
        }}
      >
        {children}
      </div>
    </WindowFrame>
  );
};
