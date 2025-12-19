import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  base: './',
  // Treat ONNX model files as static assets
  assetsInclude: ['**/*.onnx', '**/*.wasm'],
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
