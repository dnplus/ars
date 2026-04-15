# Layout System Design

## 1. 目標

`ShortsLayout.tsx` 目前只是和 `StreamingLayout.tsx` 並列的一個元件，但整個 layout 選擇機制仍是硬編碼：

- built-in layout 只能用字串 union `'streaming' | 'shorts'`
- `getLayout()` 只是一個物件 lookup
- `series-config.ts` 不能像 card system 那樣擴充，只能選內建值

這份設計要把 layout system 提升到和 card registry 同一個等級，同時保留兩種使用方式：

1. 內建 layout 用字串 key 選擇，例如 `'streaming'`、`'shorts'`
2. 系列客製 layout 直接在 `series-config.ts` 的 `shell.layout` 傳 React component reference

## 2. 現況摘要

目前關鍵實作如下：

- [src/engine/layouts/index.ts](/Users/dylan_lu/cowork-workspace/ars/src/engine/layouts/index.ts:1)
  - `LayoutRegistry` 是靜態 object
  - `getLayout(type)` 只能接 `LayoutType = 'streaming' | 'shorts'`
- [src/engine/shared/types.ts](/Users/dylan_lu/cowork-workspace/ars/src/engine/shared/types.ts:162)
  - `ShellConfig.layout` 也是固定 union
- [src/engine/Composition.tsx](/Users/dylan_lu/cowork-workspace/ars/src/engine/Composition.tsx:43)
  - 影片渲染直接 `getLayout(shell.layout)`
- [src/slides-main.tsx](/Users/dylan_lu/cowork-workspace/ars/src/slides-main.tsx:56)
  - slides runtime 會把 `series-config.ts` 的 `shell` 注入 episode

對照 card system：

- [src/engine/cards/registry.ts](/Users/dylan_lu/cowork-workspace/ars/src/engine/cards/registry.ts:1)
  - 透過 registry 統一收集 card spec
  - duplicate type 會 throw
  - unknown type 會 throw
  - resolution 和 validation 都集中

layout system 缺的是同樣的「集中式 resolution 邏輯」與「擴充入口」。

## 3. 設計原則

1. 不破壞既有 series config
2. 內建 layout 仍可用短字串指定
3. 客製 layout 不要求額外註冊檔，直接傳 component reference
4. 所有 call site 都透過同一個 resolver，不能各自 `typeof layout === ...`
5. `shorts` 這類 built-in identity 判斷要有 helper，不能再直接比較 `shell.layout === 'shorts'`

## 4. 提案

### 4.1 新的型別

新增一個泛化後的 layout component 型別：

```ts
export type LayoutComponent = React.ComponentType<StreamingLayoutProps>;
export type BuiltInLayoutKey = 'streaming' | 'shorts';
export type LayoutReference = BuiltInLayoutKey | LayoutComponent;
```

然後把 `ShellConfig.layout` 改成：

```ts
export type ShellConfig = {
  layout: LayoutReference;
  scene: 'webinar';
  config: StreamingLayoutConfig;
  theme?: Theme;
  bgm?: { src: string; volume?: number };
};
```

這樣 `series-config.ts` 會同時支援：

```ts
shell: {
  layout: 'streaming',
  ...
}
```

以及：

```ts
import { MySeriesLayout } from './layouts/MySeriesLayout';

shell: {
  layout: MySeriesLayout,
  ...
}
```

### 4.2 built-in registry 改成 spec-based

為了和 card registry 對齊，內建 layout 不再只是一個裸 object，而是改成 spec：

```ts
export type LayoutSpec = {
  type: BuiltInLayoutKey;
  component: LayoutComponent;
  description?: string;
};
```

每個 built-in layout 匯出自己的 spec：

```ts
export const layoutSpec: LayoutSpec = {
  type: 'streaming',
  component: StreamingLayout,
};
```

```ts
export const layoutSpec: LayoutSpec = {
  type: 'shorts',
  component: ShortsLayout,
};
```

registry 實作維持 card registry 的語氣與行為：

- collect all built-in layout specs
- duplicate key 直接 throw
- `getBuiltInLayout(key)` 找不到直接 throw

這裡不需要像 card registry 用 `import.meta.glob('../../episodes/*/cards/*.tsx')` 掃系列 layout，因為需求明確指定 series custom layout 走 component reference，不走字串註冊。

### 4.3 統一 resolver API

layout resolution 應集中在 `src/engine/layouts/registry.ts` 或延續 `index.ts`，但 API 要明確分成三層：

```ts
export const BUILT_IN_LAYOUT_REGISTRY = collect();

export function isBuiltInLayout(value: LayoutReference): value is BuiltInLayoutKey

export function resolveLayout(layout: LayoutReference): LayoutComponent {
  if (typeof layout === 'string') return getBuiltInLayout(layout).component;
  return layout;
}

export function getLayoutKey(layout: LayoutReference): BuiltInLayoutKey | null {
  return typeof layout === 'string' ? layout : null;
}
```

`resolveLayout()` 是主要入口。所有 renderer 只拿 component，不自行判斷來源。

### 4.4 call site 修改

#### `Composition.tsx`

目前：

```ts
const Layout = getLayout(shell.layout);
const isShorts = shell.layout === 'shorts';
```

改成：

```ts
const Layout = resolveLayout(shell.layout);
const layoutKey = getLayoutKey(shell.layout);
const isShorts = layoutKey === 'shorts';
```

#### `SlideApp.tsx`

如果 slides runtime 也需要渲染 shell，應同樣只透過 `resolveLayout()` 取得 component，不再硬寫 `StreamingLayout`。

#### `series-config.ts`

既有字串 config 不變。需要自訂 shell 時才 import component。

## 5. 為什麼這樣比「把 union 加大」更合理

只把 `layout` 改成 `'streaming' | 'shorts' | React.ComponentType<...>` 還不夠，因為那只是在型別層開洞，沒有建立統一 resolution 規則。結果會變成：

- `Composition.tsx` 自己判斷一次
- slides runtime 再判斷一次
- 未來 export/runtime 再判斷一次

這會重複 card system 已經解過的問題。把 resolver 收斂成單一 API 才是真的「mirror the card registry」。

## 6. 相容性與 migration

這個設計可以無痛相容現有專案：

- `layout: 'streaming'` 與 `layout: 'shorts'` 不需改
- `StreamingLayoutConfig` 與 `shell.config` 結構不需改
- `Root.tsx`、`slides-main.tsx` 注入 `SeriesConfig.shell` 的流程不需改

唯一要同步更新的是型別和所有使用 `shell.layout === ...` 的地方。

建議 migration 順序：

1. 新增 `LayoutReference`、`LayoutSpec`、`resolveLayout()`、`getLayoutKey()`
2. 修改 `Composition.tsx` 改用 resolver
3. 修改 slides runtime 改用 resolver
4. 最後才新增一個示範 series custom layout，確認 `series-config.ts` 直接傳 component 可運作

## 7. 驗收條件

### 內建 layout

- `layout: 'streaming'` 可正常渲染
- `layout: 'shorts'` 可正常渲染
- duplicate built-in layout key 會在啟動時 throw
- unknown built-in layout key 會在 resolution 時 throw

### 客製 layout

- `series-config.ts` 可 `import { MyLayout } ...` 並直接設 `shell.layout = MyLayout`
- `Composition.tsx` 和 slides runtime 都能吃同一份 `SeriesConfig`
- `isShorts` 這類 built-in special-case 只依賴 `getLayoutKey()`，不因 custom component 崩潰

## 8. 建議檔案變更

- `src/engine/layouts/index.ts`
- `src/engine/layouts/StreamingLayout.tsx`
- `src/engine/layouts/ShortsLayout.tsx`
- `src/engine/shared/types.ts`
- `src/engine/Composition.tsx`
- `src/engine/slides/SlideApp.tsx`
- `src/episodes/template/series-config.ts`

## 9. 最終建議

採用「built-in 走 spec registry、series custom 走 direct component reference」的雙軌模型。

理由很直接：

- 內建 layout 仍保有短字串可讀性與 registry safety
- 系列客製 layout 不需要額外檔案掃描或命名註冊
- renderer 端只需要一個 `resolveLayout()`，心智模型最乾淨
- 這是最接近現有 card registry 思路、但又符合 task 要求的最小設計
