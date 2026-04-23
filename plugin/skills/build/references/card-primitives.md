# Card Primitives Reference

Series-scoped custom cards must use only these three primitives from `src/engine/primitives/`.

---

## BaseSlide

Fullscreen card with no chrome. Default choice for most custom cards.

```tsx
import { BaseSlide } from "../../../../engine/primitives/BaseSlide";

<BaseSlide
  padding="md"          // 'none' | 'sm'(16px) | 'md'(24px) | 'lg'(32px) | 'xl'(40px) | number
  background={{ kind: "theme", token: "surfaceCard" }}  // see background options below
  align={{ justifyContent: "center", alignItems: "center" }}
  animation={{ skipEnter: false }}
  style={{ gap: 24 }}
>
  {children}
</BaseSlide>
```

### background options

```ts
// Use a theme color token
{ kind: "theme", token: "surfaceCard" }   // any keyof Theme["colors"]

// Use a raw CSS value
{ kind: "color", value: "#1e1e1e" }

// Render a background node (e.g. gradient, SVG)
{ kind: "node", render: () => <MyBgComponent /> }
```

### useCardContext

Inside any `BaseSlide` tree, access rendering context:

```tsx
import { useCardContext } from "../../../../engine/primitives/BaseSlide";

const { theme, frame, fps, progress } = useCardContext();
// progress: 0–1 across the step duration (useful for animations)
```

**Gotcha — hook placement.** `useCardContext` is a React hook that reads from the context `BaseSlide` provides. It must run **inside** the `<BaseSlide>` element, which means **inside a child component**, not in the outer component that returns `<BaseSlide>`.

```tsx
// ❌ WRONG — hook runs BEFORE <BaseSlide> is mounted, context is empty
export const MyCard: React.FC<CardRenderProps<MyData>> = ({ data }) => {
  const { theme } = useCardContext(); // throws: "must be used inside BaseSlide"
  return (
    <BaseSlide>
      <div style={{ color: theme.colors.primary }}>{data.title}</div>
    </BaseSlide>
  );
};

// ✅ RIGHT — split into a Body child so the hook runs inside BaseSlide
const Body: React.FC<{ data: MyData }> = ({ data }) => {
  const { theme } = useCardContext();
  return <div style={{ color: theme.colors.primary }}>{data.title}</div>;
};

export const MyCard: React.FC<CardRenderProps<MyData>> = ({ data }) => (
  <BaseSlide>
    <Body data={data} />
  </BaseSlide>
);
```

This applies to **any** hook that reads card context: `useCardContext`, `useTheme` (from `ThemeContext`), `useCurrentFrame` from Remotion when used alongside card-specific theme, etc. If your card needs theme + remotion hooks, put them in a child, not in the wrapper.

---

## WindowSlide

`BaseSlide` + window chrome (mac / terminal / browser / simple). Use when content should feel like an app window.

```tsx
import { WindowSlide } from "../../../../engine/primitives/WindowSlide";

<WindowSlide
  frame="mac"           // 'mac' | 'terminal' | 'browser' | 'simple' | 'none'
  title="My Window"
  tag="DEMO"
  tagColor="info"       // any keyof Theme["colors"] — or legacy: 'blue'|'green'|'purple'|'orange'|'yellow'|'red'
  innerPadding="md"     // padding inside the window body
  // + all BaseSlide props (padding, background, animation, style, align)
>
  {children}
</WindowSlide>
```

### frame styles

| frame | Appearance | Auto tag |
|-------|-----------|----------|
| `mac` | Dark header + traffic lights | none |
| `terminal` | Dark header + traffic lights, monospace title | `TERM` |
| `browser` | URL bar centered in header | none |
| `simple` | Minimal border, no traffic lights | none |
| `none` | No chrome, just content | — |

---

## ScrollSlide

`WindowSlide` + auto-scroll animation. Use for long content (logs, code, feeds).

```tsx
import { ScrollSlide } from "../../../../engine/primitives/ScrollSlide";

<ScrollSlide
  autoScroll={true}          // default true — animates scroll across step duration
  scrollStartRatio={0.05}    // start scrolling at 5% of step duration
  scrollEndRatio={0.95}      // finish scrolling at 95% of step duration
  frame="terminal"
  title="output.log"
  // + all WindowSlide props
>
  {children}
</ScrollSlide>
```

---

## Rules

- **Never hardcode hex colors** — use `useTheme()` or `useCardContext()` and reference `theme.colors.*`
- **Never import from deleted legacy cards** — ThreeSceneCard, SkiaMatrixRain, BaseCard, etc.
- **SVG text stability** — if rendering chart labels or legends with SVG `<text>`, snap `x`/`y` to integer pixels, especially with `textAnchor="middle"`. Add `textRendering="geometricPrecision"` to prevent shimmer in Remotion output.
- **Type check after creation** — run `./node_modules/.bin/tsc --noEmit`. Never use `npx tsc`.
