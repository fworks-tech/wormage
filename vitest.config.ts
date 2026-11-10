import { defineConfig } from 'vitest/config';

// Playwright owns tests/*.spec.ts; browserless unit tests live under tests/unit.
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
