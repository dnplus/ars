/**
 * @module slides/types
 * @description 網頁簡報的類型定義
 */

import { Step } from '../shared/types';

// ========================================
// Slide 類型定義
// ========================================

export type SlideType = 'cover' | 'content' | 'summary';

export type Slide = {
  id: string;
  index: number;
  type: SlideType;
  step: Step;
  audioSrc?: string;
};

export type CoverSlide = Slide & {
  type: 'cover';
  step: Step & { contentType: 'cover' };
};

export type ContentSlide = Slide & {
  type: 'content';
  step: Step;
};

export type SummarySlide = Slide & {
  type: 'summary';
  step: Step & { contentType: 'summary' };
};

// ========================================
// 導航狀態
// ========================================

export type NavigationState = {
  currentIndex: number;
  totalSlides: number;
  isFullscreen: boolean;
  showNotes: boolean;
  showOverview: boolean;
};

export type NavigationActions = {
  goTo: (index: number) => void;
  next: () => void;
  prev: () => void;
  goToFirst: () => void;
  goToLast: () => void;
  toggleFullscreen: () => void;
  toggleNotes: () => void;
  toggleOverview: () => void;
};

// ========================================
// 元件 Props
// ========================================

export type SlideContainerProps = {
  slide: Slide;
  isActive: boolean;
  showNotes: boolean;
};

export type SlideNavigationProps = {
  currentIndex: number;
  totalSlides: number;
  onNavigate: (index: number) => void;
};

export type SlideProgressProps = {
  current: number;
  total: number;
};
