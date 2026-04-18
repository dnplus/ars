/**
 * @module studio/types
 * @description Studio preview/navigation 的類型定義
 */

import { Step } from '../shared/types';
import type { SubtitlePhrase } from '../shared/subtitle';

export type StudioStepEntry = {
  id: string;
  index: number;
  step: Step;
  audioSrc?: string;
  subtitles?: SubtitlePhrase[];
  sourceFilePath?: string;
  sourceStartLine?: number;
};

// ========================================
// 導航狀態
// ========================================

export type NavigationState = {
  currentIndex: number;
  totalSteps: number;
  isFullscreen: boolean;
  showNotes: boolean;
};

export type NavigationActions = {
  goTo: (index: number) => void;
  next: () => void;
  prev: () => void;
  goToFirst: () => void;
  goToLast: () => void;
  toggleFullscreen: () => void;
  toggleNotes: () => void;
};

// ========================================
// 元件 Props
// ========================================

export type SlideContainerProps = {
  entry: StudioStepEntry;
  isActive: boolean;
  showNotes: boolean;
};

export type SlideNavigationProps = {
  currentIndex: number;
  totalSteps: number;
  onNavigate: (index: number) => void;
};

export type SlideProgressProps = {
  current: number;
  total: number;
};
