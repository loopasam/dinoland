import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: '/dinoland/',
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 1_300,
    rollupOptions: {
      input: {
        game: resolve(__dirname, 'index.html'),
        lab: resolve(__dirname, 'lab/index.html'),
        trexLab: resolve(__dirname, 'lab/trex/index.html'),
        brachiosaurusLab: resolve(__dirname, 'lab/brachiosaurus/index.html'),
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
