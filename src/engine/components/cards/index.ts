/**
 * @module components/cards/index
 * @description Cards 匯出中心
 *
 * @deprecated Legacy switch-case card exports.
 * Prefer adding new cards under `src/engine/cards/` and registering them via
 * `src/engine/cards/registry.ts`. Keep this module only for compatibility with
 * the existing `WebinarScene` / `Root` / `Composition` flow until the renderer
 * is fully registry-based.
 */

export * from "./CoverCard";
export * from "./MarkdownCard";
export * from "./CodeCard";
export * from "./ImageCard";
export * from "./MermaidCard";
export * from './ContextCard';
export * from './CompareCard';
export * from './StatsCard';
export * from './TimelineCard';
export * from './SummaryCard';
export * from './TickerCard';
export * from './MockAppCard';
export * from './FlowchartCard';
