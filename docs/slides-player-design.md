# Slides Player Design

## 1. 目標

把 [src/engine/slides/SlideApp.tsx](/Users/dylan_lu/cowork-workspace/ars/src/engine/slides/SlideApp.tsx:283) 現在的靜態：

- `StreamingLayout`
- `WebinarScene`
- `useCurrentFrame() === Infinity`

改成真正的 Remotion `<Player>` 播放每一頁 slide 的動畫，並且在每頁最後一幀自動停住。

目標行為：

1. 進入某一頁時，自動從第 0 幀開始播放
2. 播完該頁後停在最後一幀，不跳回開頭
3. 換頁時重新從新 slide 的第 0 幀播放
4. 保留現有 notes、overview、fullscreen、ActionBar、export UI

## 2. 現況摘要

### 2.1 為什麼現在是靜態畫面

目前 slides build 在 [src/engine/vite-slides-base.ts](/Users/dylan_lu/cowork-workspace/ars/src/engine/vite-slides-base.ts:185) 把這些模組全 alias 到 mock：

- `remotion`
- `@remotion/player`

而 mock 實作 [src/engine/slides/mocks/remotion.tsx](/Users/dylan_lu/cowork-workspace/ars/src/engine/slides/mocks/remotion.tsx:24) 直接：

- `useCurrentFrame()` 回傳 `Infinity`
- `useVideoConfig()` 回傳固定值
- `Series` / `Sequence` 退化成 no-op
- `window.__SLIDES_MODE__ = true`

結果是：

- `StepTransition` 在 slides mode 直接跳過動畫
- `CardEffect` 在 slides mode 直接跳過動畫
- `useStepAnimation()` 直接回傳完成狀態
- 任何 `interpolate(..., {extrapolateRight:'clamp'})` 都會落在最終值

所以現在 `SlideApp` 看起來是「完整重用影片元件」，但實際上是「把影片樹直接 render 成最後一幀的靜態 DOM」。

### 2.2 `SlideApp` 現在的 rendering path

`SlideApp` 目前在 render 階段直接做這件事：

```tsx
<StreamingLayout ...>
  <WebinarScene ... />
</StreamingLayout>
```

也就是說它完全繞過了 [src/engine/Composition.tsx](/Users/dylan_lu/cowork-workspace/ars/src/engine/Composition.tsx:1) 裡真正的 Remotion 時間線：

- 沒有 `Series.Sequence`
- 沒有 step duration in frames
- 沒有 `StepTransition`
- 沒有真正同步的 `Audio`

## 3. Player API 關鍵點

根據 `@remotion/player` typings：

- package types: [node_modules/@remotion/player/package.json](/Users/dylan_lu/cowork-workspace/ars/node_modules/@remotion/player/package.json:1)
- `Player` props: [node_modules/@remotion/player/dist/cjs/Player.d.ts](/Users/dylan_lu/cowork-workspace/ars/node_modules/@remotion/player/dist/cjs/Player.d.ts:1)
- imperative API: [node_modules/@remotion/player/dist/cjs/player-methods.d.ts](/Users/dylan_lu/cowork-workspace/ars/node_modules/@remotion/player/dist/cjs/player-methods.d.ts:1)
- events: [node_modules/@remotion/player/dist/cjs/event-emitter.d.ts](/Users/dylan_lu/cowork-workspace/ars/node_modules/@remotion/player/dist/cjs/event-emitter.d.ts:1)

這次設計會直接用到：

- `durationInFrames`
- `compositionWidth`
- `compositionHeight`
- `fps`
- `loop={false}`
- `moveToBeginningWhenEnded={false}`
- `initialFrame={0}`
- `autoPlay`
- `PlayerRef`
  - `play()`
  - `pause()`
  - `seekTo(frame)`
  - `getCurrentFrame()`
- player event
  - `ended`
  - `frameupdate`

## 4. 核心設計

### 4.1 新增單頁 composition，而不是在 `SlideApp` 內手拼 layout

不要直接把 `<Player>` 包住現有 DOM。正確作法是抽出「單一 slide composition component」，讓 Player 播放真正的 Remotion tree。

建議新增：

- `src/engine/slides/SlideComposition.tsx`

職責：

- 接收單一 slide 的 `step`
- 接收 episode shell / theme / metadata
- 計算 `prevLayoutMode`
- 用和影片相同的組裝方式 render

結構應該接近：

```tsx
<ThemeProvider theme={theme}>
  <AbsoluteFill>
    <StepTransition skipEnter={...} skipExit={...}>
      <ResolvedLayout ...>
        <Scene ... />
      </ResolvedLayout>
    </StepTransition>
    {!skipAudio && hasNarration && audioSrc ? <Audio src={staticFile(audioSrc)} /> : null}
  </AbsoluteFill>
</ThemeProvider>
```

重點是它要盡量重用 `Composition.tsx` 的邏輯，不要在 slides side 再發明一套 step timing 規則。

### 4.2 每個 slide 都有自己的 `durationInFrames`

slide duration 計算必須和 `Composition.tsx` 一致：

```ts
const actualDuration = stepSubtitles?.length
  ? Math.ceil(stepSubtitles[stepSubtitles.length - 1].endTime)
  : step.durationInSeconds;

const durationInFrames = actualDuration * fps;
```

建議把這段抽成共用 helper，例如：

- `src/engine/shared/get-step-duration-in-frames.ts`

這樣影片 renderer 和 slides player 用同一套 duration 規則。

### 4.3 `SlideApp` 改成 render `<Player>`

`SlideApp` 的中心區塊改成：

```tsx
<Player
  ref={playerRef}
  component={SlideComposition}
  inputProps={slideCompositionProps}
  durationInFrames={currentSlide.durationInFrames}
  compositionWidth={episode.metadata.width ?? 1920}
  compositionHeight={episode.metadata.height ?? 1080}
  fps={episode.metadata.fps ?? 30}
  controls={false}
  loop={false}
  autoPlay
  clickToPlay={false}
  moveToBeginningWhenEnded={false}
  initialFrame={0}
  style={{ width: '100%', height: '100%' }}
/>
```

外層的：

- scale-to-fit
- fullscreen
- notes
- overview
- ActionBar

都保留在 `SlideApp`，只把目前的「靜態 slide 畫布」換成 Player。

### 4.4 自動停在最後一幀

建議同時使用兩層保護：

1. `moveToBeginningWhenEnded={false}`
2. 監聽 `ended` 後顯式停在最後一幀

推薦流程：

```ts
const lastFrame = durationInFrames - 1;

playerRef.current?.addEventListener('ended', () => {
  playerRef.current?.pause();
  playerRef.current?.seekTo(lastFrame);
});
```

這樣即使 package 行為未來調整，也能保證畫面停在 terminal frame。

### 4.5 換頁時的控制流程

當 `currentIndex` 改變時：

1. 更新 Player 的 `inputProps`
2. `seekTo(0)`
3. `play()`

也就是：

```ts
useEffect(() => {
  if (!playerRef.current) return;
  playerRef.current.seekTo(0);
  playerRef.current.play();
}, [currentIndex]);
```

若要避免舊 slide 事件 listener 洩漏，應把 `ended` listener 綁在 `playerRef` + `durationInFrames` effect 中，並在 cleanup 時移除。

## 5. 對現有 slides mock 系統的影響

這是這次設計真正麻煩的地方。

### 5.1 現在的 mock 不能和真正的 Player 共存

只要 slides build 還把：

- `remotion`
- `@remotion/player`

alias 到 mock，Player 就不會得到真正的 Remotion timeline。

所以要上 Player，`vite-slides-base.ts` 至少要做下面調整：

1. 移除 `@remotion/player` alias
2. 讓 Player subtree 使用真正的 `remotion`

更實際的做法是直接移除 `remotion` alias，讓 slides build 改用真實 Remotion runtime。

### 5.2 `__SLIDES_MODE__` 需要從「布林」升級成「render mode」

很多元件目前用 `useIsSlidesMode()` 決定要不要跳過動畫。這在 Player 版會出問題，因為：

- slides app 仍然是 slides
- 但畫布內部不再是 static slides，而是 animated player

因此不能再用「是不是 slides app」決定要不要跳過動畫，而要改成「目前是不是 static render mode」。

建議把：

- `window.__SLIDES_MODE__`
- `useIsSlidesMode()`

改成：

```ts
type RenderMode = 'remotion' | 'slides-static' | 'slides-player';
```

然後提供：

- `useRenderMode()`
- `useShouldSkipAnimations()` 只在 `slides-static` 回傳 `true`

這樣：

- 真正影片 render: `remotion`
- 舊的靜態簡報 fallback: `slides-static`
- 新的 Player 簡報: `slides-player`

Player 內部就不會再被當成靜態最後一幀。

## 6. 建議 rollout

### Phase 1: 抽共用 composition

- 把單頁 render 從 `SlideApp.tsx` 抽到 `SlideComposition.tsx`
- 把 step duration 計算抽成 shared helper
- 先不接 Player，只讓結構和 `Composition.tsx` 對齊

### Phase 2: 引入 render mode

- `useIsSlidesMode()` 改造成更細的 render mode 判斷
- `StepTransition`、`CardEffect`、`useStepAnimation()` 只在 `slides-static` 跳過動畫

### Phase 3: 真正接上 `@remotion/player`

- `vite-slides-base.ts` 移除 `@remotion/player` alias
- 視情況一併移除 `remotion` alias
- `SlideApp` 改成 render `<Player>`
- 換頁時 reset + autoplay
- `ended` 時 pause on last frame

### Phase 4: 保留或移除 static fallback

如果 PDF/PPT export 仍需要 deterministic 靜態 DOM，可以保留 `slides-static` 路徑。

但它應該成為明確 fallback，而不是目前整個 slides runtime 的唯一模式。

## 7. 驗收條件

### 動畫行為

- 每頁進場會播放 `StepTransition`
- card-level animation 不再全部直接落到 final state
- 播放完會停在最後一幀
- 不會 loop

### 導航行為

- `next()` / `prev()` 後新頁會從第 0 幀播放
- overview 點擊跳頁後同樣會重播當頁
- fullscreen / notes / overview 行為不退化

### 音訊行為

- 有 narration 的 slide，audio 與畫面同時播放
- 換頁時舊頁音訊停止，不會殘留

### 相容性

- 影片輸出 `Composition.tsx` 行為不變
- slides runtime 不再依賴 `useCurrentFrame() === Infinity`

## 8. 建議變更檔案

- `src/engine/slides/SlideApp.tsx`
- `src/engine/slides/SlideComposition.tsx`
- `src/engine/slides/adapters/episodeToSlides.ts`
- `src/engine/shared/get-step-duration-in-frames.ts`
- `src/engine/shared/effects/useIsSlidesMode.ts`
- `src/engine/shared/effects/StepTransition.tsx`
- `src/engine/shared/effects/CardEffect.tsx`
- `src/engine/shared/hooks/useStepAnimation.ts`
- `src/engine/vite-slides-base.ts`

## 9. 最終建議

不要直接把現有 `StreamingLayout + WebinarScene` 包進一個 Player 容器就算完成。真正需要替換的是整個 slides runtime 的時間模型：

- 從「mock Remotion + 最後一幀 DOM」
- 改成「單頁 composition + 真正的 Remotion Player」

只要這個切換做對，這個系統就能自然得到：

- step-level timeline
- card animation
- audio sync
- pause on last frame

而且能和影片輸出共用同一套內容渲染邏輯。
