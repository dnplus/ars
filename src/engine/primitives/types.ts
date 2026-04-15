import type { CSSProperties, ReactNode } from "react";
import type { EffectConfig, StepEffect } from "../shared/effects/CardEffect";
import type { Theme } from "../shared/theme";

export interface SlideAnimation {
  effect?: StepEffect;
  effectConfig?: EffectConfig;
  skipEnter?: boolean;
  skipExit?: boolean;
}

export type SlidePadding = "none" | "sm" | "md" | "lg" | "xl" | number;

export type SlideBackground =
  | { kind: "theme"; token: keyof Theme["colors"] }
  | { kind: "color"; value: string }
  | { kind: "node"; render: () => ReactNode };

export interface SlideAlignment {
  justifyContent?: CSSProperties["justifyContent"];
  alignItems?: CSSProperties["alignItems"];
  textAlign?: CSSProperties["textAlign"];
}

export interface BaseSlideProps {
  children: ReactNode;
  background?: SlideBackground;
  animation?: SlideAnimation;
  padding?: SlidePadding;
  style?: CSSProperties;
  align?: SlideAlignment;
}

export type WindowFrameKind = "mac" | "terminal" | "browser" | "simple" | "none";

export interface WindowSlideProps extends BaseSlideProps {
  frame?: WindowFrameKind;
  title?: string;
  tag?: string;
  tagColor?: keyof Theme["colors"];
  titleSlot?: ReactNode;
  innerPadding?: SlidePadding;
}

export interface ScrollSlideProps extends WindowSlideProps {
  autoScroll?: boolean;
  scrollStartRatio?: number;
  scrollEndRatio?: number;
  allowManualScroll?: boolean;
}
