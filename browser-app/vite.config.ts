import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { readFileSync } from 'fs';

// Read version from package.json
const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  base: './',
  // Treat ONNX model files as static assets
  assetsInclude: ['**/*.onnx', '**/*.wasm'],
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      // Include service worker in dev mode for testing
      devOptions: {
        enabled: true,
        type: 'module',
      },
      // Workbox configuration for service worker
      workbox: {
        // Cache static assets with cache-first strategy
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // Don't precache ML model files (they're cached in IndexedDB by @huggingface/transformers)
        globIgnores: ['**/node_modules/**/*', '**/*.onnx', '**/*.wasm'],
        // Maximum file size to precache (2MB)
        maximumFileSizeToCacheInBytes: 2 * 1024 * 1024,
        // Runtime caching for additional assets
        runtimeCaching: [
          {
            // Cache locale files
            urlPattern: /\/locales\/.*\.json$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'locales-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
          {
            // Cache images
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
          {
            // Network-only for external API calls (HuggingFace model downloads)
            urlPattern: /^https:\/\/huggingface\.co\//,
            handler: 'NetworkOnly',
          },
          {
            // Network-only for CDN model downloads
            urlPattern: /^https:\/\/cdn-lfs\.huggingface\.co\//,
            handler: 'NetworkOnly',
          },
        ],
        // Clean up old caches
        cleanupOutdatedCaches: true,
        // Skip waiting to activate new service worker immediately
        skipWaiting: true,
        // Take control of clients immediately
        clientsClaim: true,
      },
      // Inline the manifest (we have our own manifest.json in public/)
      injectManifest: {
        injectionPoint: undefined,
      },
      // Use our existing manifest.json
      manifest: false,
      // Enable strategies for auto-update with user notification
      selfDestroying: false,
    }),
  ],
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'esnext', // Support top-level await
    rollupOptions: {
      // Ensure onnxruntime-node is not bundled (browser should use onnxruntime-web)
      external: ['onnxruntime-node'],
    },
  },
  esbuild: {
    target: 'esnext', // Support top-level await in esbuild
  },
  resolve: {
    alias: {
      // Import shared core modules from parent project
      '@core': path.resolve(__dirname, '../src/core'),
      '@pii': path.resolve(__dirname, '../src/pii'),
      '@types': path.resolve(__dirname, '../src/types'),
      '@utils': path.resolve(__dirname, '../src/utils'),
      // Import shared modules
      '@shared/feedback': path.resolve(__dirname, '../shared/pii/feedback'),
      '@shared/pii': path.resolve(__dirname, '../shared/pii'),
      // Ensure browser uses onnxruntime-web, not onnxruntime-node
      'onnxruntime-node': 'onnxruntime-web',
    },
  },
  optimizeDeps: {
    // Don't pre-bundle these - let them load their own assets
    exclude: ['@huggingface/transformers', 'pdfjs-dist', 'onnxruntime-node', 'onnxruntime-web'],
    include: ['mammoth', 'exceljs'],
    esbuildOptions: {
      target: 'esnext', // Support top-level await in dependency optimization
    },
  },
  worker: {
    format: 'es',
  },
  // Development server configuration
  server: {
    // Note: COOP/COEP headers would enable SharedArrayBuffer for WASM threading
    // but they block cross-origin requests to HuggingFace CDN for model downloads.
    // We disable threading instead (numThreads=1 in ModelManager) to avoid this.
  },
});
