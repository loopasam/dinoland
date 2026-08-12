import { defineConfig } from 'vite';

export default defineConfig({
  base: '/dinoland/',
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 1_300,
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
