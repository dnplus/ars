/**
 * @module components/cards/LiveSceneCard
 * @description 動態像素房間背景卡片
 *
 * 以 iframe 嵌入獨立的 live-bg.html，作為動態背景使用。
 * 透過 postMessage 將 Remotion 的 frame number 傳給 iframe，
 * 確保 render 時動畫與 Remotion 幀同步。
 *
 * @architectural-role Card（卡片）
 * Used in: WebinarScene.tsx via contentType 'liveScene'
 */

import React, { useRef, useEffect, useCallback } from "react";
import { staticFile, useCurrentFrame } from "remotion";
import { getAssetPath } from "../../shared/assets";

export interface LiveSceneCardProps {
  content: string; // unused for now — scene data is embedded in live-bg.html
  frame?: "mac" | "simple" | "none";
}

export const LiveSceneCard: React.FC<LiveSceneCardProps> = ({ frame = "mac" }) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const currentFrame = useCurrentFrame();

  // Send frame number to iframe for deterministic rendering
  useEffect(() => {
    const iframe = iframeRef.current;
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'remotion-frame', frame: currentFrame }, '*');
    }
  }, [currentFrame]);

  // Handle iframe load - send initial frame
  const handleLoad = useCallback(() => {
    const iframe = iframeRef.current;
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'remotion-frame', frame: currentFrame }, '*');
    }
  }, [currentFrame]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        borderRadius: frame === "mac" ? 8 : 0,
        position: "relative",
        zIndex: 0,
      }}
    >
      <iframe
        ref={iframeRef}
        src={`${staticFile(getAssetPath("live-bg.html"))}?remotion=1`}
        // @ts-expect-error allowTransparency is valid for iframes
        allowTransparency="true"
        onLoad={handleLoad}
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          display: "block",
          pointerEvents: "none",
          background: "transparent",
        }}
        title="Live Scene Background"
      />
    </div>
  );
};
