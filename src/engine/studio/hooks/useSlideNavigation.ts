/**
 * @hook useSlideNavigation
 * @description 處理簡報導航：鍵盤、觸控、Hash 路由同步
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { NavigationState, NavigationActions } from '../types';

type UseSlideNavigationOptions = {
  totalSlides: number;
  initialIndex?: number;
  onToggleFullscreen?: () => void;
};

type UseSlideNavigationReturn = NavigationState & NavigationActions;

export function useSlideNavigation({
  totalSlides,
  initialIndex = 0,
  onToggleFullscreen,
}: UseSlideNavigationOptions): UseSlideNavigationReturn {
  // 從 URL hash 讀取初始 index
  const getIndexFromHash = useCallback((): number => {
    const hash = window.location.hash;
    const match = hash.match(/^#slide-(\d+)$/);
    if (match) {
      const index = parseInt(match[1], 10) - 1; // hash 是 1-based
      if (index >= 0 && index < totalSlides) {
        return index;
      }
    }
    return initialIndex;
  }, [totalSlides, initialIndex]);

  const [currentIndex, setCurrentIndex] = useState<number>(getIndexFromHash);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showNotes, setShowNotes] = useState<boolean>(false);

  // Touch 滑動追蹤
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);

  // 導航函數
  const goTo = useCallback(
    (index: number) => {
      const clampedIndex = Math.max(0, Math.min(index, totalSlides - 1));
      setCurrentIndex(clampedIndex);
      window.location.hash = `slide-${clampedIndex + 1}`;
    },
    [totalSlides]
  );

  const next = useCallback(() => {
    if (currentIndex < totalSlides - 1) {
      goTo(currentIndex + 1);
    }
  }, [currentIndex, totalSlides, goTo]);

  const prev = useCallback(() => {
    if (currentIndex > 0) {
      goTo(currentIndex - 1);
    }
  }, [currentIndex, goTo]);

  const goToFirst = useCallback(() => {
    goTo(0);
  }, [goTo]);

  const goToLast = useCallback(() => {
    goTo(totalSlides - 1);
  }, [goTo, totalSlides]);

  const toggleFullscreen = useCallback(async () => {
    // 如果有提供自訂的 fullscreen handler，使用它
    if (onToggleFullscreen) {
      onToggleFullscreen();
      return;
    }
    // 預設行為
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.warn('Fullscreen not supported:', err);
    }
  }, [onToggleFullscreen]);

  const toggleNotes = useCallback(() => {
    setShowNotes((prev) => !prev);
  }, []);

  // 鍵盤事件處理
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 忽略輸入框內的按鍵
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case ' ':
        case 'PageDown':
          e.preventDefault();
          next();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          e.preventDefault();
          prev();
          break;
        case 'Home':
          e.preventDefault();
          goToFirst();
          break;
        case 'End':
          e.preventDefault();
          goToLast();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'n':
        case 'N':
          e.preventDefault();
          toggleNotes();
          break;
        case 'Escape':
          if (isFullscreen) {
            // Let browser handle fullscreen exit
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [next, prev, goToFirst, goToLast, toggleFullscreen, toggleNotes, isFullscreen]);

  // Hash 變更監聽
  useEffect(() => {
    const handleHashChange = () => {
      const newIndex = getIndexFromHash();
      if (newIndex !== currentIndex) {
        setCurrentIndex(newIndex);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [currentIndex, getIndexFromHash]);

  // Fullscreen 變更監聽
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // 觸控滑動支援
  useEffect(() => {
    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;

      const deltaX = touchEndX - touchStartX.current;
      const deltaY = touchEndY - touchStartY.current;

      // 只有水平滑動距離大於垂直滑動且超過閾值時才觸發
      const minSwipeDistance = 50;
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
        if (deltaX > 0) {
          prev(); // 向右滑 = 上一頁
        } else {
          next(); // 向左滑 = 下一頁
        }
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [next, prev]);

  // 初始化 hash
  useEffect(() => {
    if (!window.location.hash) {
      window.location.hash = `slide-${currentIndex + 1}`;
    }
  }, [currentIndex]);

  return {
    currentIndex,
    totalSlides,
    isFullscreen,
    showNotes,
    goTo,
    next,
    prev,
    goToFirst,
    goToLast,
    toggleFullscreen,
    toggleNotes,
  };
}
