/**
 * @module mocks/remotion-google-fonts
 * @description Mock @remotion/google-fonts
 */

// Mock loadFont 函數 - 返回字體名稱，實際字體透過 HTML link 載入
export function loadFont() {
  return {
    fontFamily: '"Noto Sans TC", sans-serif',
    getInfo: () => ({
      fontFamily: 'Noto Sans TC',
      weights: ['400', '500', '600', '700'],
      styles: ['normal'],
    }),
  };
}

// 直接導出常用字體的 mock
export const NotoSansTC = {
  loadFont,
};

export default { loadFont };
