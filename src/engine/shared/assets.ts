/**
 * 資源路徑解析器
 *
 * 提供資源路徑的工具函式（相對於 public/ 目錄）
 */

/**
 * 取得通用資源路徑（相對於 public/shared/）
 * @param relativePath 相對於 shared 目錄的路徑
 * @returns 完整資源路徑
 *
 * @example
 * getAssetPath('live-bg.html') // 'shared/live-bg.html'
 */
export function getAssetPath(relativePath: string): string {
  return `shared/${relativePath}`;
}
