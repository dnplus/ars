import { config } from "@remotion/eslint-config-flat";

export default [
  ...config,
  {
    files: ["src/engine/studio/views/ReviewView.tsx"],
    rules: {
      "no-irregular-whitespace": "off",
    },
  },
  {
    files: [
      "src/Root.tsx",
      "src/engine/vite-studio-base.ts",
      "src/engine/layouts/ShortsLayout.tsx",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    files: ["src/engine/components/cards/ThumbnailCard.tsx"],
    rules: {
      "@remotion/warn-native-media-tag": "off",
    },
  },
];
