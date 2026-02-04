import {defineConfig} from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    isolate: false,
    sequence: {
      concurrent: false,
    },
  },
});
