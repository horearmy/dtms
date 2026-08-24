import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    globalSetup: ['./src/integration/global-setup.ts'],
    testTimeout: 15000,
    hookTimeout: 30000,
    // Semua suite integrasi berbagi satu server & DB yang sama —
    // jalankan file secara berurutan agar tidak saling mengganggu.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
