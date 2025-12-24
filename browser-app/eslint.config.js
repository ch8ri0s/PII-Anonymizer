import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import security from 'eslint-plugin-security';
import noSecrets from 'eslint-plugin-no-secrets';
import sonarjs from 'eslint-plugin-sonarjs';

export default [
  js.configs.recommended,

  // ===========================================
  // JavaScript Configuration
  // ===========================================
  {
    files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        FormData: 'readonly',
        Event: 'readonly',
        CustomEvent: 'readonly',
        HTMLElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLTextAreaElement: 'readonly',
        HTMLSelectElement: 'readonly',
        HTMLButtonElement: 'readonly',
        HTMLDivElement: 'readonly',
        HTMLCanvasElement: 'readonly',
        MutationObserver: 'readonly',
        // Browser timer globals
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        // Browser API globals
        URL: 'readonly',
        Blob: 'readonly',
        File: 'readonly',
        FileReader: 'readonly',
        FileList: 'readonly',
        alert: 'readonly',
        fetch: 'readonly',
        crypto: 'readonly',
        DOMException: 'readonly',
        AbortController: 'readonly',
        AbortSignal: 'readonly',
        Worker: 'readonly',
        navigator: 'readonly',
        self: 'readonly',
        // Console
        console: 'readonly',
        // Performance API
        performance: 'readonly',
        // Test globals (Vitest)
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        vi: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
      },
    },
    plugins: {
      security,
      'no-secrets': noSecrets,
      sonarjs,
    },
    rules: {
      // ===== Error Prevention =====
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-console': 'off',
      'no-debugger': 'warn',

      // ===== Best Practices =====
      'eqeqeq': ['error', 'always'],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'prefer-const': 'warn',
      'no-var': 'error',
      'no-new-func': 'error',

      // ===== Code Style =====
      'indent': ['error', 2, { SwitchCase: 1 }],
      'quotes': ['error', 'single', { avoidEscape: true }],
      'semi': ['error', 'always'],
      'comma-dangle': ['error', 'always-multiline'],

      // ===== Security Rules (critical for PII handling) =====
      'security/detect-object-injection': 'warn',
      'security/detect-eval-with-expression': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-buffer-noassert': 'error',
      'security/detect-disable-mustache-escape': 'error',
      'security/detect-new-buffer': 'error',
      'security/detect-possible-timing-attacks': 'warn',
      'security/detect-pseudoRandomBytes': 'warn',
      'security/detect-unsafe-regex': 'warn',

      // ===== No Secrets (prevent hardcoded credentials) =====
      'no-secrets/no-secrets': ['error', { tolerance: 5 }],

      // ===== SonarJS Code Quality =====
      'sonarjs/no-all-duplicated-branches': 'error',
      'sonarjs/no-duplicated-branches': 'error',
      'sonarjs/no-identical-functions': 'warn',
      'sonarjs/no-redundant-jump': 'error',
      'sonarjs/no-unused-collection': 'warn',
      'sonarjs/prefer-immediate-return': 'warn',
      'sonarjs/cognitive-complexity': ['warn', 20],
      'sonarjs/no-collapsible-if': 'warn',
      'sonarjs/no-collection-size-mischeck': 'error',
      'sonarjs/no-duplicate-string': ['warn', { threshold: 4 }],
      'sonarjs/no-gratuitous-expressions': 'error',
      'sonarjs/no-identical-conditions': 'error',
      'sonarjs/no-identical-expressions': 'error',
      'sonarjs/no-inverted-boolean-check': 'warn',
      'sonarjs/no-nested-conditional': 'warn',
      'sonarjs/no-same-line-conditional': 'warn',
      'sonarjs/no-small-switch': 'warn',
      'sonarjs/no-use-of-empty-return-value': 'error',
      'sonarjs/prefer-object-literal': 'warn',
      'sonarjs/prefer-single-boolean-return': 'warn',
      'sonarjs/prefer-while': 'warn',
      'sonarjs/no-nested-switch': 'warn',
      'sonarjs/no-redundant-boolean': 'warn',

      // ===== Maintainability Limits =====
      'max-lines': ['warn', { max: 500, skipComments: true, skipBlankLines: true }],
      'max-lines-per-function': ['warn', { max: 150, skipComments: true, skipBlankLines: true }],
      'complexity': ['warn', { max: 20 }],
      'max-depth': ['error', { max: 5 }],
      'max-nested-callbacks': ['error', { max: 4 }],
      'max-params': ['warn', { max: 6 }],
    },
  },

  // ===========================================
  // TypeScript Configuration
  // ===========================================
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json',
      },
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        URL: 'readonly',
        Blob: 'readonly',
        File: 'readonly',
        FileReader: 'readonly',
        FileList: 'readonly',
        alert: 'readonly',
        fetch: 'readonly',
        HTMLElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLCanvasElement: 'readonly',
        crypto: 'readonly',
        Worker: 'readonly',
        console: 'readonly',
        performance: 'readonly',
        navigator: 'readonly',
        self: 'readonly',
        indexedDB: 'readonly',
        IDBDatabase: 'readonly',
        IDBKeyRange: 'readonly',
        IDBRequest: 'readonly',
        IDBCursorWithValue: 'readonly',
        IDBOpenDBRequest: 'readonly',
        // Test globals (Vitest)
        describe: 'readonly',
        it: 'readonly',
        test: 'readonly',
        expect: 'readonly',
        vi: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      security,
      'no-secrets': noSecrets,
      sonarjs,
    },
    rules: {
      // ===== TypeScript-specific Rules =====
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': 'error',

      // Disable base rule as it conflicts with TypeScript
      'no-unused-vars': 'off',

      // ===== Best Practices =====
      'eqeqeq': ['error', 'always'],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'prefer-const': 'warn',
      'no-var': 'error',
      'no-new-func': 'error',

      // ===== Code Style =====
      'indent': ['error', 2, { SwitchCase: 1 }],
      'quotes': ['error', 'single', { avoidEscape: true }],
      'semi': ['error', 'always'],
      'comma-dangle': ['error', 'always-multiline'],

      // ===== Security Rules =====
      'security/detect-object-injection': 'warn',
      'security/detect-eval-with-expression': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-buffer-noassert': 'error',
      'security/detect-disable-mustache-escape': 'error',
      'security/detect-new-buffer': 'error',
      'security/detect-possible-timing-attacks': 'warn',
      'security/detect-pseudoRandomBytes': 'warn',
      'security/detect-unsafe-regex': 'warn',

      // ===== No Secrets =====
      'no-secrets/no-secrets': ['error', { tolerance: 5 }],

      // ===== SonarJS Code Quality =====
      'sonarjs/no-all-duplicated-branches': 'error',
      'sonarjs/no-duplicated-branches': 'error',
      'sonarjs/no-identical-functions': 'warn',
      'sonarjs/no-redundant-jump': 'error',
      'sonarjs/cognitive-complexity': ['warn', 20],
      'sonarjs/no-collapsible-if': 'warn',
      'sonarjs/no-duplicate-string': ['warn', { threshold: 4 }],
      'sonarjs/no-identical-conditions': 'error',
      'sonarjs/no-identical-expressions': 'error',
      'sonarjs/no-nested-conditional': 'warn',
      'sonarjs/no-nested-switch': 'warn',
      'sonarjs/no-redundant-boolean': 'warn',

      // ===== Maintainability Limits =====
      'max-lines': ['warn', { max: 500, skipComments: true, skipBlankLines: true }],
      'max-lines-per-function': ['warn', { max: 150, skipComments: true, skipBlankLines: true }],
      'complexity': ['warn', { max: 20 }],
      'max-depth': ['error', { max: 5 }],
      'max-nested-callbacks': ['error', { max: 4 }],
      'max-params': ['warn', { max: 6 }],
    },
  },

  // ===========================================
  // Relaxed rules for i18n module
  // (legitimate object injection for translation lookups)
  // ===========================================
  {
    files: ['src/i18n/**/*.ts', 'src/i18n/**/*.js'],
    rules: {
      'security/detect-object-injection': 'off',
      'complexity': ['warn', { max: 25 }],
      'sonarjs/cognitive-complexity': ['warn', 25],
    },
  },

  // ===========================================
  // Relaxed rules for PII detection module
  // (complex pattern matching requires higher complexity)
  // ===========================================
  {
    files: ['src/pii/**/*.ts', 'src/pii/**/*.js'],
    rules: {
      'complexity': ['warn', { max: 30 }],
      'sonarjs/cognitive-complexity': ['warn', 30],
      'max-lines': ['warn', { max: 800, skipComments: true, skipBlankLines: true }],
      'max-lines-per-function': ['warn', { max: 200, skipComments: true, skipBlankLines: true }],
      'sonarjs/no-duplicate-string': 'off',
      'security/detect-unsafe-regex': 'off',
      'security/detect-object-injection': 'off',
    },
  },

  // ===========================================
  // Relaxed rules for UI components
  // ===========================================
  {
    files: ['src/ui/**/*.ts', 'src/ui/**/*.js', 'src/components/**/*.ts'],
    rules: {
      'security/detect-object-injection': 'off',
      'max-lines': ['warn', { max: 600, skipComments: true, skipBlankLines: true }],
      'sonarjs/no-duplicate-string': 'off',
    },
  },

  // ===========================================
  // Relaxed rules for processing modules
  // ===========================================
  {
    files: ['src/processing/**/*.ts', 'src/workers/**/*.ts'],
    rules: {
      'security/detect-object-injection': 'off',
      'security/detect-unsafe-regex': 'off',
    },
  },

  // ===========================================
  // Relaxed rules for converters (may reference Node.js APIs for isomorphic code)
  // ===========================================
  {
    files: ['src/converters/**/*.ts'],
    languageOptions: {
      globals: {
        process: 'readonly',
        Buffer: 'readonly',
      },
    },
    rules: {
      'security/detect-object-injection': 'off',
    },
  },

  // ===========================================
  // Relaxed rules for error handling (legitimate object access)
  // ===========================================
  {
    files: ['src/errors/**/*.ts'],
    rules: {
      'security/detect-object-injection': 'off',
    },
  },

  // ===========================================
  // Relaxed rules for download utilities
  // ===========================================
  {
    files: ['src/download/**/*.ts'],
    rules: {
      'security/detect-object-injection': 'off',
    },
  },

  // ===========================================
  // Relaxed rules for batch processing
  // ===========================================
  {
    files: ['src/batch/**/*.ts'],
    rules: {
      'security/detect-object-injection': 'off',
      'max-lines-per-function': ['warn', { max: 200, skipComments: true, skipBlankLines: true }],
    },
  },

  // ===========================================
  // Relaxed rules for utilities
  // ===========================================
  {
    files: ['src/utils/**/*.ts'],
    rules: {
      'security/detect-object-injection': 'off',
    },
  },

  // ===========================================
  // Relaxed rules for services (feedback logging)
  // ===========================================
  {
    files: ['src/services/**/*.ts'],
    rules: {
      'security/detect-object-injection': 'off',
      'sonarjs/no-duplicate-string': 'off',
    },
  },

  // ===========================================
  // Relaxed rules for test files
  // ===========================================
  {
    files: ['test/**/*.ts', 'test/**/*.js', 'e2e/**/*.ts'],
    languageOptions: {
      globals: {
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        atob: 'readonly',
        btoa: 'readonly',
      },
    },
    rules: {
      'max-lines': 'off',
      'max-lines-per-function': 'off',
      'max-nested-callbacks': 'off',
      'sonarjs/no-identical-functions': 'off',
      'sonarjs/no-duplicate-string': 'off',
      'sonarjs/no-nested-conditional': 'off',
      'no-secrets/no-secrets': 'off',
      'security/detect-object-injection': 'off',
      'security/detect-unsafe-regex': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },

  // ===========================================
  // Relaxed rules for scripts (Node.js environment)
  // ===========================================
  {
    files: ['scripts/**/*.js', 'scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        Buffer: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
      'max-lines-per-function': 'off',
    },
  },

  // ===========================================
  // Config files (CommonJS)
  // ===========================================
  {
    files: ['*.config.cjs', '*.cjs'],
    languageOptions: {
      globals: {
        module: 'readonly',
        require: 'readonly',
        __dirname: 'readonly',
      },
    },
  },

  // ===========================================
  // Global Ignores
  // ===========================================
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'dev-dist/**',
      'build/**',
      'public/**',
      '*.config.js',
      '*.config.ts',
      '.claude/**',
      '**/*.d.ts',
      'playwright-report/**',
      'test-results/**',
    ],
  },
];
