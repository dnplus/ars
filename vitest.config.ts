import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['cli/**/*.test.ts', 'tests/**/*.test.ts'],
    restoreMocks: true,
    clearMocks: true,
  },
});
