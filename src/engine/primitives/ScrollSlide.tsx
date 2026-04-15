import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { WindowSlide } from "./WindowSlide";
import type { ScrollSlideProps } from "./types";

export const ScrollSlide: React.FC<ScrollSlideProps> = ({
  autoScroll = true,
  scrollStartRatio = 0.05,
  scrollEndRatio = 0.95,
  children,
  ...windowSlideProps
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [maxScrollTop, setMaxScrollTop] = useState(0);
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  useLayoutEffect(() => {
    const raf = requestAnimationFrame(() => {
      if (!containerRef.current || !contentRef.current) {
        return;
      }

      const containerHeight = containerRef.current.clientHeight;
      const contentHeight = contentRef.current.scrollHeight;
      setMaxScrollTop(Math.max(0, contentHeight - containerHeight));
    });

    return () => cancelAnimationFrame(raf);
  }, [children]);

  const scrollTop =
    autoScroll && maxScrollTop > 0
      ? interpolate(
          frame,
          [
            Math.floor(durationInFrames * scrollStartRatio),
            Math.floor(durationInFrames * scrollEndRatio),
          ],
          [0, maxScrollTop],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.inOut(Easing.ease),
          },
        )
      : 0;

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    containerRef.current.scrollTop = scrollTop;
  }, [scrollTop]);

  return (
    <WindowSlide {...windowSlideProps}>
      <div
        ref={containerRef}
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          overflowY: "hidden",
          overflowX: "hidden",
          position: "relative",
        }}
      >
        <div
          ref={contentRef}
          style={{
            display: "flex",
            flexDirection: "column",
            minHeight: "100%",
          }}
        >
          {children}
        </div>
      </div>
    </WindowSlide>
  );
};
