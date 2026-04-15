/**
 * @component FlowchartCard
 * @description Pure React SVG flowchart with dagre auto-layout + Remotion spring animations.
 *
 * @agent-note
 * - dagre handles node positioning — no manual coordinates needed
 * - Remotion spring() drives node entrance + edge draw-in + camera tracking
 * - focusOrder controls reveal sequence; omit for static display
 * - Camera lerps between focused nodes, then zooms out to panorama
 */

import React, { useMemo } from "react";
import {
  useCurrentFrame,
  useVideoConfig,
  spring,
  interpolate,
  Easing,
} from "remotion";
import dagre from "@dagrejs/dagre";
import { BaseCard } from "./BaseCard";
import { type WindowFrameType } from "../ui/WindowFrame";
import { useIsSlidesMode } from "../../shared/effects/useIsSlidesMode";
import { useTheme } from "../../shared/ThemeContext";

// ── Types ──

type FlowNode = { id: string; label: string; icon?: string };
type FlowEdge = { from: string; to: string; label?: string };

export type FlowchartCardProps = {
  nodes: FlowNode[];
  edges: FlowEdge[];
  direction?: "TB" | "LR";
  focusOrder?: string[];
  title?: string;
  frame?: WindowFrameType;
};

// ── Constants ──

const NODE_W = 200;
const NODE_H = 80;
const NODE_RX = 16;
const PADDING = 60;
const ARROW_SIZE = 10;
// Fixed durations (seconds)
const NODE_APPEAR_SEC = 0.4;  // node spring entrance
const FOCUS_HOLD_SEC = 0.6;   // camera holds on node after it appears
const EDGE_DRAW_SEC = 0.4;    // edge draw-in
const CAM_MOVE_SEC = 0.3;     // camera pan to next node (fast!)
const ZOOM_OUT_SEC = 0.6;     // final zoom out to panorama

// ── Layout (dagre) ──

type LayoutNode = {
  id: string;
  label: string;
  icon?: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type LayoutEdge = {
  from: string;
  to: string;
  label?: string;
  points: { x: number; y: number }[];
  pathD: string;
  pathLength: number;
};

type LayoutResult = {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  viewBox: { x: number; y: number; w: number; h: number };
};

/** Convert dagre polyline points to a smooth cubic bezier SVG path (Catmull-Rom → Bezier) */
function pointsToSmoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return "";
  if (pts.length === 2) return `M${pts[0].x},${pts[0].y} L${pts[1].x},${pts[1].y}`;

  let d = `M${pts[0].x},${pts[0].y}`;

  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];

    // Catmull-Rom to cubic bezier control points (alpha = 0.5 / tension factor 6)
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }

  return d;
}

function computeLayout(
  nodes: FlowNode[],
  edges: FlowEdge[],
  direction: "TB" | "LR"
): LayoutResult {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: direction, nodesep: 80, ranksep: 100, marginx: PADDING, marginy: PADDING });
  g.setDefaultEdgeLabel(() => ({}));

  for (const n of nodes) {
    g.setNode(n.id, { width: NODE_W, height: NODE_H });
  }
  for (const e of edges) {
    g.setEdge(e.from, e.to);
  }

  dagre.layout(g);

  const layoutNodes: LayoutNode[] = nodes.map((n) => {
    const pos = g.node(n.id) as dagre.Node;
    return {
      ...n,
      x: pos.x - pos.width / 2,
      y: pos.y - pos.height / 2,
      width: pos.width,
      height: pos.height,
    };
  });

  const layoutEdges: LayoutEdge[] = edges.map((e) => {
    const edgeData = g.edge(e.from, e.to) as dagre.GraphEdge;
    const pts = edgeData.points;
    const pathD = pointsToSmoothPath(pts);

    // Approximate path length from points (straight-line segments as estimate)
    let pathLength = 0;
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i - 1].x;
      const dy = pts[i].y - pts[i - 1].y;
      pathLength += Math.sqrt(dx * dx + dy * dy);
    }
    // Curves are ~10-15% longer than straight lines
    pathLength *= 1.12;

    return {
      ...e,
      points: pts,
      pathD,
      pathLength,
    };
  });

  // Bounding box
  const graphLabel = g.graph();
  const gw = graphLabel.width ?? 800;
  const gh = graphLabel.height ?? 600;

  return {
    nodes: layoutNodes,
    edges: layoutEdges,
    viewBox: { x: 0, y: 0, w: gw, h: gh },
  };
}

// ── Camera helpers ──

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function cameraForNode(
  node: LayoutNode,
  panorama: { x: number; y: number; w: number; h: number },
  aspect: number
): { x: number; y: number; w: number; h: number } {
  // Zoom to ~2.5x around the focused node
  const zoomW = panorama.w / 2.5;
  const zoomH = zoomW / aspect;
  const cx = node.x + node.width / 2;
  const cy = node.y + node.height / 2;
  return {
    x: Math.max(panorama.x, Math.min(cx - zoomW / 2, panorama.x + panorama.w - zoomW)),
    y: Math.max(panorama.y, Math.min(cy - zoomH / 2, panorama.y + panorama.h - zoomH)),
    w: zoomW,
    h: zoomH,
  };
}

function lerpCamera(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
  t: number
) {
  // Ease-out: fast departure, slow settle
  const eased = Easing.out(Easing.cubic)(Math.max(0, Math.min(1, t)));
  return {
    x: lerp(a.x, b.x, eased),
    y: lerp(a.y, b.y, eased),
    w: lerp(a.w, b.w, eased),
    h: lerp(a.h, b.h, eased),
  };
}

// ── Component ──

export const FlowchartCard: React.FC<FlowchartCardProps> = ({
  nodes,
  edges,
  direction = "TB",
  focusOrder,
  title,
  frame = "simple",
}) => {
  const theme = useTheme();
  const isSlidesMode = useIsSlidesMode();
  const currentFrame = useCurrentFrame();
  const { fps, durationInFrames, width } = useVideoConfig();

  const layout = useMemo(
    () => computeLayout(nodes, edges, direction),
    [nodes, edges, direction]
  );

  const nodeMap = useMemo(() => {
    const map: Record<string, LayoutNode> = {};
    for (const n of layout.nodes) map[n.id] = n;
    return map;
  }, [layout.nodes]);

  // Empty state
  if (nodes.length === 0) {
    return (
      <BaseCard frame={frame} frameTitle={title || "Flowchart"} frameTag="FLOW" frameTagColor="blue">
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: theme.colors.onCardMuted,
            fontSize: 24,
            fontFamily: theme.fonts.main,
          }}
        >
          No data
        </div>
      </BaseCard>
    );
  }

  const hasFocus = focusOrder && focusOrder.length > 0;
  const steps = hasFocus ? focusOrder! : [];

  // ── Timeline per focus node ──
  // For each focusOrder node, compute absolute frame timestamps:
  //   nodeAppear → camArrive → holdEnd → edgeEnd
  // Timeline: [node appears] → [cam moves to it] → [hold] → [edge draws out] → next node...
  const timeline = useMemo(() => {
    if (!hasFocus) return [];
    const nodeAppearF = Math.floor(NODE_APPEAR_SEC * fps);
    const camMoveF = Math.floor(CAM_MOVE_SEC * fps);
    const holdF = Math.floor(FOCUS_HOLD_SEC * fps);
    const edgeDrawF = Math.floor(EDGE_DRAW_SEC * fps);

    let cursor = 0;
    return steps.map((nodeId, i) => {
      const appear = cursor;                             // node starts appearing
      const camStart = appear + nodeAppearF;             // camera starts moving here
      const camEnd = i === 0 ? camStart : camStart + camMoveF; // first node: instant
      const holdEnd = camEnd + holdF;                    // hold/focus
      // Find outgoing edges to next focus node
      const edgeIndices: number[] = [];
      if (i < steps.length - 1) {
        const toId = steps[i + 1];
        layout.edges.forEach((e, ei) => {
          if (e.from === nodeId && e.to === toId) edgeIndices.push(ei);
        });
      }
      const edgeStart = holdEnd;
      const edgeEnd = edgeIndices.length > 0 ? holdEnd + edgeDrawF : holdEnd;
      cursor = edgeEnd;
      return { nodeId, appear, camStart, camEnd, holdEnd, edgeStart, edgeEnd, edgeIndices };
    });
  }, [hasFocus, steps, layout.edges, fps]);

  const zoomOutFrames = hasFocus ? Math.floor(ZOOM_OUT_SEC * fps) : 0;

  // Collect all edges already scheduled in the timeline
  const scheduledEdges = useMemo(() => {
    const set = new Set<number>();
    timeline.forEach((t) => t.edgeIndices.forEach((ei) => set.add(ei)));
    return set;
  }, [timeline]);

  // Schedule remaining edges (back-edges, cross-edges) after the last focus node,
  // each getting its own EDGE_DRAW_SEC slot, drawn one by one.
  const remainingEdgeSchedule = useMemo(() => {
    if (!hasFocus || timeline.length === 0) return [] as { edgeIdx: number; start: number }[];
    const edgeDrawF = Math.floor(EDGE_DRAW_SEC * fps);
    let cursor = timeline[timeline.length - 1].edgeEnd;
    const result: { edgeIdx: number; start: number }[] = [];
    layout.edges.forEach((_, ei) => {
      if (!scheduledEdges.has(ei)) {
        result.push({ edgeIdx: ei, start: cursor });
        cursor += edgeDrawF;
      }
    });
    return result;
  }, [hasFocus, timeline, scheduledEdges, layout.edges, fps]);

  const animEndFrame = remainingEdgeSchedule.length > 0
    ? remainingEdgeSchedule[remainingEdgeSchedule.length - 1].start + Math.floor(EDGE_DRAW_SEC * fps)
    : (timeline.length > 0 ? timeline[timeline.length - 1].edgeEnd : 0);

  // Build lookup maps from timeline + remaining edges
  const nodeAppearFrame = useMemo(() => {
    const map: Record<string, number> = {};
    timeline.forEach((t) => { map[t.nodeId] = t.appear; });
    return map;
  }, [timeline]);

  const edgeStartFrame = useMemo(() => {
    const map: Record<number, number> = {};
    timeline.forEach((t) => {
      t.edgeIndices.forEach((ei) => { map[ei] = t.edgeStart; });
    });
    remainingEdgeSchedule.forEach((r) => { map[r.edgeIdx] = r.start; });
    return map;
  }, [timeline, remainingEdgeSchedule]);

  // ── Node animation ──
  function getNodeProgress(nodeId: string): number {
    if (isSlidesMode || !hasFocus) return 1;
    const appear = nodeAppearFrame[nodeId];
    if (appear === undefined) return 1;
    return spring({
      frame: Math.max(0, currentFrame - appear),
      fps,
      config: { damping: 14, stiffness: 60, mass: 1.2 },
    });
  }

  // ── Edge animation ──
  function getEdgeProgress(edgeLayoutIdx: number): number {
    if (isSlidesMode || !hasFocus) return 1;
    const start = edgeStartFrame[edgeLayoutIdx];
    if (start === undefined) return 1; // shouldn't happen — all edges are now scheduled
    return spring({
      frame: Math.max(0, currentFrame - start),
      fps,
      config: { damping: 200, stiffness: 80, mass: 1 },
    });
  }

  // ── Visibility ──
  function isNodeVisible(nodeId: string): boolean {
    if (isSlidesMode || !hasFocus) return true;
    const appear = nodeAppearFrame[nodeId];
    if (appear === undefined) return true;
    return currentFrame >= appear;
  }

  // ── Camera ──
  // Camera follows AFTER node appears, not before.
  // Between nodes: fast pan during camStart→camEnd window.
  // After all nodes: zoom out, then hold panorama for rest of duration.
  const panorama = layout.viewBox;
  const isNarrow = width <= 1080;
  const svgAspect = isNarrow ? 9 / 16 : 16 / 9;

  // Camera focus for an edge: zoom to the midpoint between source and target nodes
  function cameraForEdge(
    edgeIdx: number,
    pan: typeof panorama,
    aspect: number
  ): typeof panorama {
    const edge = layout.edges[edgeIdx];
    const fromNode = nodeMap[edge.from];
    const toNode = nodeMap[edge.to];
    if (!fromNode || !toNode) return pan;
    // Create a virtual node at the midpoint between source and target
    const midNode: LayoutNode = {
      id: '_mid',
      label: '',
      x: (fromNode.x + toNode.x) / 2,
      y: (fromNode.y + toNode.y) / 2,
      width: Math.abs(toNode.x - fromNode.x) + NODE_W,
      height: Math.abs(toNode.y - fromNode.y) + NODE_H,
    };
    return cameraForNode(midNode, pan, aspect);
  }

  const camera = useMemo(() => {
    if (isSlidesMode || !hasFocus || timeline.length === 0) return panorama;

    const edgeDrawF = Math.floor(EDGE_DRAW_SEC * fps);
    const camMoveF = Math.floor(CAM_MOVE_SEC * fps);

    // After animation: zoom out then hold
    const zoomOutStart = animEndFrame;
    if (currentFrame >= zoomOutStart) {
      const zoomT = interpolate(
        currentFrame,
        [zoomOutStart, zoomOutStart + zoomOutFrames],
        [0, 1],
        { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
      );
      // Determine what the camera was looking at right before zoom out
      let lastCam: typeof panorama;
      if (remainingEdgeSchedule.length > 0) {
        const lastRemaining = remainingEdgeSchedule[remainingEdgeSchedule.length - 1];
        lastCam = cameraForEdge(lastRemaining.edgeIdx, panorama, svgAspect);
      } else {
        const lastNode = nodeMap[steps[steps.length - 1]];
        lastCam = lastNode ? cameraForNode(lastNode, panorama, svgAspect) : panorama;
      }
      return lerpCamera(lastCam, panorama, zoomT);
    }

    // Check if we're in the remaining-edges phase (after all focus nodes)
    const lastTimelineEnd = timeline[timeline.length - 1].edgeEnd;
    if (currentFrame >= lastTimelineEnd && remainingEdgeSchedule.length > 0) {
      // Find which remaining edge we're on
      let currentEdgeIdx = 0;
      for (let i = 0; i < remainingEdgeSchedule.length; i++) {
        if (currentFrame >= remainingEdgeSchedule[i].start) {
          currentEdgeIdx = i;
        }
      }

      const currentEntry = remainingEdgeSchedule[currentEdgeIdx];
      const edgeCam = cameraForEdge(currentEntry.edgeIdx, panorama, svgAspect);

      // Pan from previous position to this edge's focus
      // Previous position: last focus node or previous remaining edge
      let prevCam: typeof panorama;
      if (currentEdgeIdx === 0) {
        const lastNode = nodeMap[steps[steps.length - 1]];
        prevCam = lastNode ? cameraForNode(lastNode, panorama, svgAspect) : panorama;
      } else {
        prevCam = cameraForEdge(remainingEdgeSchedule[currentEdgeIdx - 1].edgeIdx, panorama, svgAspect);
      }

      // Quick pan at the start of each remaining edge
      const panEnd = currentEntry.start + camMoveF;
      if (currentFrame < panEnd) {
        const t = interpolate(
          currentFrame,
          [currentEntry.start, panEnd],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );
        return lerpCamera(prevCam, edgeCam, t);
      }
      return edgeCam;
    }

    // Normal focus-node phase
    let focusedIdx = 0;
    for (let i = 0; i < timeline.length; i++) {
      if (currentFrame >= timeline[i].camEnd) {
        focusedIdx = i;
      }
    }

    // Check if we're in a cam-move transition to the next node
    for (let i = 1; i < timeline.length; i++) {
      const entry = timeline[i];
      if (currentFrame >= entry.camStart && currentFrame < entry.camEnd) {
        const prevNode = nodeMap[steps[i - 1]];
        const thisNode = nodeMap[steps[i]];
        if (!prevNode || !thisNode) break;
        const camA = cameraForNode(prevNode, panorama, svgAspect);
        const camB = cameraForNode(thisNode, panorama, svgAspect);
        const t = interpolate(
          currentFrame,
          [entry.camStart, entry.camEnd],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
        );
        return lerpCamera(camA, camB, t);
      }
    }

    // Settled on a node
    const node = nodeMap[steps[focusedIdx]];
    if (!node) return panorama;
    return cameraForNode(node, panorama, svgAspect);
  }, [currentFrame, isSlidesMode, hasFocus, timeline, animEndFrame, zoomOutFrames, steps, nodeMap, panorama, svgAspect, remainingEdgeSchedule, fps]);

  const viewBoxStr = `${camera.x} ${camera.y} ${camera.w} ${camera.h}`;

  // ── Colors — primary fill + white text for contrast ──
  const nodeFill = theme.colors.primary;
  const nodeStroke = theme.colors.surfaceDark;
  const nodeText = theme.colors.onPrimary;
  const edgeStroke = theme.colors.surfaceDark;
  const edgeLabelColor = theme.colors.onCard;

  return (
    <BaseCard
      frame={frame}
      frameTitle={title || "Flowchart"}
      frameTag="FLOW"
      frameTagColor="blue"
      padding="none"
    >
      <svg
        viewBox={viewBoxStr}
        style={{
          width: "100%",
          height: "100%",
          display: "block",
        }}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <filter id="node-glow">
            <feDropShadow dx="0" dy="2" stdDeviation="6" floodColor={nodeFill} floodOpacity="0.4" />
          </filter>
          <marker
            id="flowchart-arrow"
            viewBox={`0 0 ${ARROW_SIZE} ${ARROW_SIZE}`}
            refX={ARROW_SIZE}
            refY={ARROW_SIZE / 2}
            markerWidth={ARROW_SIZE}
            markerHeight={ARROW_SIZE}
            orient="auto-start-reverse"
          >
            <path
              d={`M0,0 L${ARROW_SIZE},${ARROW_SIZE / 2} L0,${ARROW_SIZE} Z`}
              fill={edgeStroke}
            />
          </marker>
        </defs>

        {/* Edges */}
        {layout.edges.map((edge, i) => {
          const progress = getEdgeProgress(i);
          const bothVisible = isNodeVisible(edge.from) && isNodeVisible(edge.to);
          if (!bothVisible && hasFocus && !isSlidesMode) return null;

          const dashOffset = edge.pathLength * (1 - progress);

          return (
            <g key={`edge-${i}`}>
              <path
                d={edge.pathD}
                fill="none"
                stroke={edgeStroke}
                strokeWidth={3}
                strokeDasharray={edge.pathLength}
                strokeDashoffset={dashOffset}
                markerEnd={progress > 0.8 ? "url(#flowchart-arrow)" : undefined}
                opacity={interpolate(progress, [0, 0.1], [0, 0.8], {
                  extrapolateRight: "clamp",
                })}
              />
              {/* Edge label — offset away from the line along its normal */}
              {edge.label && edge.points.length >= 2 && (() => {
                const pts = edge.points;
                const midIdx = Math.floor(pts.length / 2);
                const midPt = pts[midIdx];
                // Compute tangent at midpoint to get perpendicular offset
                const before = pts[Math.max(0, midIdx - 1)];
                const after = pts[Math.min(pts.length - 1, midIdx + 1)];
                const dx = after.x - before.x;
                const dy = after.y - before.y;
                const len = Math.sqrt(dx * dx + dy * dy) || 1;
                // Normal vector (perpendicular, pointing "left" of travel direction)
                const nx = -dy / len;
                const ny = dx / len;
                const OFFSET = 18; // pixels away from line
                const lx = midPt.x + nx * OFFSET;
                const ly = midPt.y + ny * OFFSET;

                const labelOpacity = interpolate(progress, [0.4, 0.8], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                });
                return (
                  <text
                    x={lx}
                    y={ly}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={edgeLabelColor}
                    fontSize={14}
                    fontWeight={500}
                    fontFamily={theme.fonts.main}
                    opacity={labelOpacity}
                  >
                    {edge.label}
                  </text>
                );
              })()}
            </g>
          );
        })}

        {/* Nodes */}
        {layout.nodes.map((node) => {
          const progress = getNodeProgress(node.id);
          const opacity = interpolate(progress, [0, 0.3], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          const scale = interpolate(progress, [0, 1], [0.6, 1]);
          const cx = node.x + node.width / 2;
          const cy = node.y + node.height / 2;

          // Split label by \n for multi-line
          const lines = node.label.split("\n");
          const hasIcon = !!node.icon;

          return (
            <g
              key={node.id}
              transform={`translate(${cx},${cy}) scale(${scale}) translate(${-cx},${-cy})`}
              opacity={opacity}
            >
              {/* Node background */}
              <rect
                x={node.x}
                y={node.y}
                width={node.width}
                height={node.height}
                rx={NODE_RX}
                ry={NODE_RX}
                fill={nodeFill}
                stroke={nodeStroke}
                strokeWidth={2}
                filter="url(#node-glow)"
              />

              {/* Icon */}
              {hasIcon && (
                <text
                  x={cx}
                  y={node.y + 26}
                  textAnchor="middle"
                  fontSize={24}
                  dominantBaseline="middle"
                >
                  {node.icon}
                </text>
              )}

              {/* Label lines */}
              {lines.map((line, li) => (
                <text
                  key={li}
                  x={cx}
                  y={
                    hasIcon
                      ? node.y + 48 + li * 18
                      : cy + (li - (lines.length - 1) / 2) * 18
                  }
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={nodeText}
                  fontSize={15}
                  fontWeight={600}
                  fontFamily={theme.fonts.main}
                >
                  {line}
                </text>
              ))}
            </g>
          );
        })}
      </svg>
    </BaseCard>
  );
};
