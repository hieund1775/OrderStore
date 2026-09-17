import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    // Tests exercise the mounted API contract. Never inherit a developer's
    // standalone UI setting from .env.local.
    env: {
      VITE_STANDALONE: 'false',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
