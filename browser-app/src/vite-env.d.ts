/// <reference types="vite/client" />

/**
 * Vite Environment Variables
 *
 * Type declarations for import.meta.env variables used in the browser-app.
 */

interface ImportMetaEnv {
  /** Development mode flag (set by Vite) */
  readonly DEV: boolean;
  /** Production mode flag (set by Vite) */
  readonly PROD: boolean;
  /** Build mode (development | production) */
  readonly MODE: string;
  /** Base URL for the application */
  readonly BASE_URL: string;
  /** Log level override for LoggerFactory */
  readonly VITE_LOG_LEVEL?: 'debug' | 'info' | 'warn' | 'error';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** App version injected at build time from package.json */
declare const __APP_VERSION__: string;
