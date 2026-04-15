import React from "react";
import { Img, staticFile } from "remotion";

const resolveSrc = (src: string) => {
  if (src.startsWith("http") || src.startsWith("data:")) {
    return src;
  }

  const cleanSrc = src.split("?")[0];
  return staticFile(cleanSrc.startsWith("/") ? cleanSrc.slice(1) : cleanSrc);
};

export const BrowserView: React.FC<{
  device: "desktop" | "mobile";
  url?: string;
  imageSrc?: string;
  mode?: "meta" | "snapshot";
  layout?: "normal" | "square" | "mobile";
}> = ({
  device,
  url,
  imageSrc,
  mode = "meta",
  layout = "normal",
}) => {
  const barHeight = device === "mobile" ? 54 : 52;
  const shouldShowImage = Boolean(imageSrc && mode === "snapshot");
  const resolvedImageSrc = imageSrc ? resolveSrc(imageSrc) : null;
  const shellPadding = device === "mobile" ? "10px 12px 14px" : "12px 16px 18px";
  const contentPadding = "0";

  return (
    <div
      style={{
        flex: 1,
        height: "100%",
        display: "flex",
        padding: shellPadding,
        boxSizing: "border-box",
        backgroundColor: "#f7f2e8",
        color: "#e5edf5",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minHeight: 0,
          borderRadius: device === "mobile" ? 20 : 16,
          overflow: "hidden",
          backgroundColor: "#121826",
          boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            height: barHeight,
            flexShrink: 0,
            padding: device === "mobile" ? "0 14px" : "0 18px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            background: "linear-gradient(180deg, #1f2937 0%, #17212e 100%)",
          }}
        >
          {device === "desktop" && (
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: 999, background: "#ef4444" }} />
              <div style={{ width: 10, height: 10, borderRadius: 999, background: "#f59e0b" }} />
              <div style={{ width: 10, height: 10, borderRadius: 999, background: "#22c55e" }} />
            </div>
          )}
          <div
            style={{
              flex: 1,
              height: 34,
              borderRadius: 999,
              backgroundColor: "rgba(255,255,255,0.08)",
              display: "flex",
              alignItems: "center",
              padding: "0 14px",
              fontSize: 16,
              color: "#b8c6d8",
              overflow: "hidden",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
            }}
          >
            {url || "https://example.com"}
          </div>
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            position: "relative",
            overflow: "hidden",
          }}
        >
          {shouldShowImage && resolvedImageSrc ? (
            <>
              <Img
                src={resolvedImageSrc}
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform: "scale(1.18)",
                  filter: "blur(48px)",
                  opacity: 0.42,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: contentPadding,
                  boxSizing: "border-box",
                }}
              >
                <Img
                  src={resolvedImageSrc}
                  style={{
                    width: "auto",
                    height: "100%",
                    maxWidth: "none",
                    maxHeight: "100%",
                    boxShadow: "0 10px 30px rgba(0, 0, 0, 0.5)",
                  }}
                />
              </div>
            </>
          ) : (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(180deg, rgba(17,24,39,0.96) 0%, rgba(15,23,42,0.98) 100%)",
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};
