/**
 * @module useIsSlidesMode
 * @description 統一的 Slides 模式偵測 Hook
 * 
 * @agent-note
 * 所有需要區分 Remotion / Slides 環境的組件，
 * 統一使用此 Hook，避免各自複製 window.__SLIDES_MODE__ 檢查邏輯。
 */

/**
 * 偵測當前是否在 Slides 模式下運行
 * @returns true = Slides 模式（靜態渲染），false = Remotion 模式（動畫渲染）
 */
export const useIsSlidesMode = (): boolean => {
    return (
        typeof window !== 'undefined' &&
        // @ts-expect-error - Slides mode flag set by mock
        window.__SLIDES_MODE__ === true
    );
};
