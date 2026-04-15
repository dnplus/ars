/**
 * @component ContextCard
 * @description Visualization of LLM Context Window (Tokens/Chips).
 * 
 * @agent-note
 * **Use Case**: Explaining RAG, Context Windows, or Memory management.
 * **Visuals**:
 * - "Chips" grid representing tokens/chunks.
 * - Dynamic coloring based on token type (System, User, AI, Tool, etc.).
 * - Legend auto-generated based on active types.
 * **Props**: Accepts a generic `ctx` object (dictionary) to configure counts.
 */
import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, random } from "remotion";
import { BaseCard } from "./BaseCard";

// Chip 顏色映射
const chipColors: Record<string, string> = {
    sys: "#fbbf24",
    user: "#60a5fa",
    rag: "#f97316", // Adjusted to match HTML 'c-rag' better (orange)
    graph_rag: "#f43f5e", // Matching 'c-graph'
    tool_def: "#34d399",
    tool_res: "#a3e635",
    tool: "#34d399",
    ai: "#a78bfa",
    img: "#ec4899",
    cot: "#d8b4fe",
    reasoning: "#f472b6",
    obs: "#fdba74",
    empty: "#e2e8f0",
    
    // Additional mappings from HTML logic
    hist: "#cbd5e1",
    data: "#2563eb",
    long: "#3b82f6", 
    dim: "#94a3b8",
};

export type ContextConfig = Record<string, string | number | boolean | undefined>;

type ChipProps = {
    color: string;
    delay?: number;
    opacity?: number;
    scale?: number;
};

const Chip: React.FC<ChipProps> = ({ color, delay = 0, opacity = 1 }) => {
    const frame = useCurrentFrame();
    const { fps } = useVideoConfig();

    const scaleAnim = interpolate(frame - delay, [0, fps * 0.2], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    });

    return (
        <div
            style={{
                width: 16,
                height: 16,
                borderRadius: 2,
                backgroundColor: color,
                transform: `scale(${scaleAnim})`,
                opacity: opacity,
            }}
        />
    );
};

// 渲染格子視圖
const ChipGrid: React.FC<{ ctx: ContextConfig }> = ({ ctx }) => {
    const chips: { color: string; delay: number; opacity?: number }[] = [];
    let delayIndex = 0;

    const addChips = (count: number | undefined, colorKey: string, customOpacity?: number) => {
        if (!count) return;
        for (let i = 0; i < count; i++) {
            chips.push({ 
                color: chipColors[colorKey] || chipColors.empty, 
                delay: delayIndex * 0.5,
                opacity: customOpacity
            });
            delayIndex++;
        }
    };

    // Special handling based on ctx.type
    if (ctx.type === 'capacity_demo') {
        // 20 used (green), remaining blocked (red opacity)
        addChips(20, "tool_res"); 
        for(let i=0; i<80; i++) chips.push({ color: "#ef4444", delay: delayIndex * 0.5, opacity: 0.3 });
    }
    else if (ctx.type === 'wipe') {
        // All white/cleared
         for(let i=0; i<100; i++) chips.push({ color: "#ffffff", delay: i * 0.1 });
    }
    else if (ctx.type === 'long_context_demo') {
        // Fill all with long context blue
        addChips(100, "long");
    }
    else if (ctx.type === 'long_context_limitation') {
        // U-shape attention: High (Blue) -> Low (Dim) -> High (Blue)
        addChips(20, "long");
        for(let i=0; i<60; i++) chips.push({ color: chipColors.dim || "#94a3b8", delay: delayIndex + i * 0.1, opacity: 0.4 });
        addChips(20, "long");
    }
    else if (ctx.type === 'data_readiness_dirty') {
         // Silos: Random scattered blocks (using Remotion's deterministic random)
         for(let i=0; i<60; i++) {
             chips.push({
                 color: i % 3 === 0 ? "#78716c" : "#a8a29e", // Stone colors
                 delay: random(`dirty-chip-${i}`) * 20,
                 opacity: 1
             });
         }
    }
    else if (ctx.type === 'data_readiness_clean') {
         // Organized: Connected API blocks
         // Visualizing abstractly as green (API) blocks aligned
         addChips(10, "tool"); // API
         addChips(10, "tool"); // API
         addChips(10, "tool"); // API
    }
    else if (ctx.type === 'data_privacy') {
        // User (Red) -> Block (Grey) -> Data (Gold)
        // Abstract representation
        addChips(10, "user"); // User
        addChips(5, "empty"); // Gap
        for(let i=0; i<10; i++) chips.push({ color: "#ef4444", delay: 10, opacity: 1 }); // Barrier
        addChips(5, "empty"); // Gap
        addChips(20, "data"); // Sensitive Data
    }
    else if (ctx.type === 'skill_progressive') {
        // Progressive Disclosure: Skill 漸進式揭露
        const metadataColor = "#fbbf24"; // 黃色代表 Metadata (清單)
        const skillColor = "#a78bfa"; // 紫色代表 Skill 指示
        const scriptColor = "#34d399"; // 綠色代表 Script
        const resourceColor = "#f97316"; // 橘色代表 Resource

        // 第一層：Skill 清單 Metadata (最先出現，少量)
        for(let i=0; i<4; i++) chips.push({ color: metadataColor, delay: i * 2, opacity: 1 });

        // 間隔
        for(let i=0; i<1; i++) chips.push({ color: chipColors.empty, delay: 0 });

        // 第二層：SKILL.md 核心指示 (呼叫後載入)
        for(let i=0; i<10; i++) chips.push({ color: skillColor, delay: 12 + i * 2, opacity: 1 });

        // 間隔
        for(let i=0; i<2; i++) chips.push({ color: chipColors.empty, delay: 0 });

        // 第三層：Scripts (按需展開)
        for(let i=0; i<6; i++) chips.push({ color: scriptColor, delay: 35 + i * 2, opacity: 0.8 });

        // 間隔
        for(let i=0; i<2; i++) chips.push({ color: chipColors.empty, delay: 0 });

        // 第四層：Resources (按需載入)
        for(let i=0; i<8; i++) chips.push({ color: resourceColor, delay: 50 + i * 2, opacity: 0.6 });

        // 潛在更多內容 (虛線效果 - 非常淡)
        for(let i=0; i<17; i++) chips.push({ color: "#94a3b8", delay: 70 + i, opacity: 0.2 });
    }
    else {
        // Standard numeric visualisation
        addChips(Number(ctx.sys), "sys");
        addChips(Number(ctx.hist_paste), "hist");
        addChips(Number(ctx.hist_user), "hist");
        addChips(Number(ctx.hist_ai), "hist");
        addChips(Number(ctx.tool_def), "tool_def");
        addChips(Number(ctx.paste), "data");
        addChips(Number(ctx.long_ctx), "long");
        
        addChips(Number(ctx.user || ctx.new_user), "user");
        addChips(Number(ctx.img), "img");
        addChips(Number(ctx.reasoning), "reasoning");
        addChips(Number(ctx.cot), "cot");
        addChips(Number(ctx.ai_call), "ai");
        addChips(Number(ctx.tool), "tool");
        addChips(Number(ctx.obs), "obs");
        addChips(Number(ctx.cot2), "ai");
        addChips(Number(ctx.rag), "rag");
        addChips(Number(ctx.graph_rag), "graph_rag");
        addChips(Number(ctx.tool_res), "tool");
        addChips(Number(ctx.ai || ctx.new_ai || ctx.final_ai), "ai");
    }

    // Fill remaining with empty if not special type that handles filling
    // If we used a special type, we might want to respect its count or fill up.
    // For simplicity, we ensure at least 100 chips for grid stability, unless it's a specific pattern.
    
    // For graph/tree metaphors which are hard to do with chips, we fallback to a simpler representation or empty for now if not handled above.
    
    // Default fill
    const totalChips = 100;
    while (chips.length < totalChips) {
        chips.push({ color: chipColors.empty, delay: 0 });
    }

    return (
        <div
            style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(16px, 1fr))",
                gap: 4,
                padding: 0,
                minHeight: 100,
                alignContent: "flex-start",
            }}
        >
            {chips.slice(0, 100).map((chip, i) => (
                <Chip key={i} color={chip.color} delay={chip.delay} opacity={chip.opacity} />
            ))}
        </div>
    );
};


export type ContextCardProps = {
    ctx?: ContextConfig;
    visTitle?: string;
    visIcon?: string;
};

export const ContextCard: React.FC<ContextCardProps> = ({
    ctx,
    visTitle,
    visIcon,
}) => {
    if (!ctx) return null;

    const capacityLabel = ctx.type === 'long_context_demo' ? '1M+ Blocks' : '100 Blocks';
    const title = `${visIcon || '🧠'} ${visTitle || 'Context'}`;

    // Determine active keys for Legend
    const activeKeys: string[] = [];
    if (ctx.type === 'capacity_demo') activeKeys.push('tool');
    else if (ctx.type === 'long_context_demo' || ctx.type === 'long_context_limitation') activeKeys.push('long');
    else if (ctx.type === 'skill_progressive') activeKeys.push('metadata', 'skill', 'script', 'resource');
    else {
        // Standard keys detection
        Object.keys(ctx).forEach(k => {
            const val = ctx[k];
            if (typeof val !== 'number' || val <= 0) return;

            if (k.includes('sys')) activeKeys.push('sys');
            if (k.includes('user') || k === 'new_user') activeKeys.push('user');
            if (k === 'ai' || k === 'final_ai' || k === 'new_ai' || k === 'ai_call') activeKeys.push('ai');
            if (k === 'cot' || k === 'cot2') activeKeys.push('cot');
            if (k === 'reasoning') activeKeys.push('reasoning');
            if (k === 'rag') activeKeys.push('rag');
            if (k === 'graph_rag') activeKeys.push('graph_rag');
            if (k.includes('tool') && !k.includes('res')) activeKeys.push('tool');
            if (k === 'tool_res') activeKeys.push('tool_res');
            if (k === 'paste') activeKeys.push('paste');
            if (k.includes('hist')) activeKeys.push('hist');
            if (k === 'img') activeKeys.push('img');
            if (k === 'obs') activeKeys.push('obs');
        });
    }
    const uniqueKeys = Array.from(new Set(activeKeys));

    return (
        <BaseCard
            frame="simple"
            frameTitle={title}
            frameTag={capacityLabel}
            frameTagColor="slate"
            padding="sm" // Revert to sm for tighter fit
        >
            <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                <div style={{ flex: 1, minHeight: 0 }}>
                     <ChipGrid ctx={ctx} />
                </div>
                
                {/* Legend */}
                 <div style={{
                     display: "flex",
                     flexWrap: "wrap",
                     gap: 12,
                     marginTop: 8,
                     paddingTop: 8,
                     borderTop: "1px solid #f1f5f9",
                     fontSize: 10,
                     color: "#64748b",
                     fontFamily: "monospace"
                 }}>
                    {uniqueKeys.includes('sys') && <LegendItem color={chipColors.sys} label="System" />}
                    {uniqueKeys.includes('user') && <LegendItem color={chipColors.user} label="User" />}
                    {uniqueKeys.includes('paste') && <LegendItem color={chipColors.data} label="Paste" />}
                    {uniqueKeys.includes('hist') && <LegendItem color={chipColors.hist} label="History" />}
                    {uniqueKeys.includes('rag') && <LegendItem color={chipColors.rag} label="RAG" />}
                    {uniqueKeys.includes('graph_rag') && <LegendItem color={chipColors.graph_rag} label="Graph" />}
                    {uniqueKeys.includes('img') && <LegendItem color={chipColors.img} label="Image" />}
                    {uniqueKeys.includes('cot') && <LegendItem color={chipColors.cot} label="CoT" />}
                    {uniqueKeys.includes('reasoning') && <LegendItem color={chipColors.reasoning} label="Reasoning" />}
                    {uniqueKeys.includes('tool') && <LegendItem color={chipColors.tool_def} label="Tool" />}
                    {uniqueKeys.includes('tool_res') && <LegendItem color={chipColors.tool_res} label="Result" />}
                    {uniqueKeys.includes('obs') && <LegendItem color={chipColors.obs} label="Observe" />}
                    {uniqueKeys.includes('ai') && <LegendItem color={chipColors.ai} label="LLM Response" />}
                    {uniqueKeys.includes('long') && <LegendItem color={chipColors.long} label="Context" />}
                    {uniqueKeys.includes('metadata') && <LegendItem color="#fbbf24" label="Metadata" />}
                    {uniqueKeys.includes('skill') && <LegendItem color="#a78bfa" label="Skill" />}
                    {uniqueKeys.includes('script') && <LegendItem color="#34d399" label="Script" />}
                    {uniqueKeys.includes('resource') && <LegendItem color="#f97316" label="Resource" />}
                 </div>
            </div>
        </BaseCard>
    );
};

const LegendItem: React.FC<{color: string, label: string}> = ({color, label}) => (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: color }} />
        <span>{label}</span>
    </div>
);
