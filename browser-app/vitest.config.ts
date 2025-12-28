import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['test/**/*.test.ts'],
    globals: true,
    testTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/main.ts'],
    },
    setupFiles: ['./test/setup.ts'],
  },
  resolve: {
    alias: {
      '@': '/src',
      // Import shared core modules from parent project
      '@core': path.resolve(__dirname, '../src/core'),
      '@pii': path.resolve(__dirname, '../src/pii'),
      '@types': path.resolve(__dirname, '../src/types'),
      '@utils': path.resolve(__dirname, '../src/utils'),
      // Import shared test utilities
      '@shared-test': path.resolve(__dirname, '../shared/test'),
      // Import shared feedback module (Story 8.9)
      '@shared/feedback': path.resolve(__dirname, '../shared/pii/feedback/index.ts'),
      // Mock virtual PWA module for tests (Vite PWA plugin virtual module)
      'virtual:pwa-register': path.resolve(__dirname, 'test/mocks/pwa-register.ts'),
    },
  },
});
