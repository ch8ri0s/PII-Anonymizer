import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import security from 'eslint-plugin-security';
import noSecrets from 'eslint-plugin-no-secrets';
import sonarjs from 'eslint-plugin-sonarjs';

export default [
  js.configs.recommended,

  // ===========================================
  // JavaScript Configuration (main process, renderer, tests)
  // ===========================================
  {
    files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // Node.js globals
        __dirname: 'readonly',
        __filename: 'readonly',
        Buffer: 'readonly',
        console: 'readonly',
        exports: 'readonly',
        global: 'readonly',
        module: 'readonly',
        process: 'readonly',
        require: 'readonly',
        // Electron globals
        electron: 'readonly',
        // Browser globals (for renderer)
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        FormData: 'readonly',
        Event: 'readonly',
        CustomEvent: 'readonly',
        HTMLElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLTextAreaElement: 'readonly',
        HTMLSelectElement: 'readonly',
        HTMLButtonElement: 'readonly',
        HTMLDivElement: 'readonly',
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
        FileReader: 'readonly',
        alert: 'readonly',
        fetch: 'readonly',
        crypto: 'readonly',
        // Test globals (Mocha + Chai)
        describe: 'readonly',
        it: 'readonly',
        before: 'readonly',
        after: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        // Performance API
        performance: 'readonly',
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
      'no-console': 'off', // Console needed for Electron main process
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
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-eval-with-expression': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-buffer-noassert': 'error',
      'security/detect-child-process': 'warn',
      'security/detect-disable-mustache-escape': 'error',
      'security/detect-new-buffer': 'error',
      'security/detect-possible-timing-attacks': 'warn',
      'security/detect-pseudoRandomBytes': 'warn',
      'security/detect-unsafe-regex': 'warn',

      // ===== No Secrets (prevent hardcoded credentials) =====
      'no-secrets/no-secrets': ['error', { tolerance: 5 }],

      // ===== SonarJS Code Quality (v3.x rules) =====
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
    ignores: ['specs/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        project: './tsconfig.json',
      },
      globals: {
        // Node.js globals
        Buffer: 'readonly',
        console: 'readonly',
        process: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        // Browser globals (for renderer TypeScript files)
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        URL: 'readonly',
        Blob: 'readonly',
        FileReader: 'readonly',
        alert: 'readonly',
        fetch: 'readonly',
        HTMLElement: 'readonly',
        HTMLInputElement: 'readonly',
        crypto: 'readonly',
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
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-eval-with-expression': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-buffer-noassert': 'error',
      'security/detect-child-process': 'warn',
      'security/detect-disable-mustache-escape': 'error',
      'security/detect-new-buffer': 'error',
      'security/detect-possible-timing-attacks': 'warn',
      'security/detect-pseudoRandomBytes': 'warn',
      'security/detect-unsafe-regex': 'warn',

      // ===== No Secrets =====
      'no-secrets/no-secrets': ['error', { tolerance: 5 }],

      // ===== SonarJS Code Quality (v3.x rules) =====
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
  // Relaxed rules for Electron main process
  // (legitimate file system and child process operations)
  // ===========================================
  {
    files: ['main.js', 'fileProcessor.js', 'preload.cjs'],
    rules: {
      'security/detect-non-literal-fs-filename': 'off',
      'security/detect-child-process': 'off',
      'security/detect-object-injection': 'off',
      'max-lines': ['warn', { max: 700, skipComments: true, skipBlankLines: true }],
      'max-lines-per-function': ['warn', { max: 200, skipComments: true, skipBlankLines: true }],
    },
  },

  // ===========================================
  // Relaxed rules for TypeScript services (main process)
  // ===========================================
  {
    files: ['src/services/**/*.ts', 'src/utils/**/*.ts', 'src/converters/**/*.ts'],
    rules: {
      'security/detect-non-literal-fs-filename': 'off',
      'security/detect-object-injection': 'off',
      'security/detect-unsafe-regex': 'off', // PDF/text processing patterns are bounded
    },
  },

  // ===========================================
  // Relaxed rules for i18n module
  // (legitimate object injection for translation lookups)
  // ===========================================
  {
    files: ['src/i18n/**/*.js', 'src/i18n/**/*.ts'],
    rules: {
      'security/detect-object-injection': 'off', // Translation key lookups are safe
      'complexity': ['warn', { max: 25 }],
      'sonarjs/cognitive-complexity': ['warn', 25],
    },
  },

  // ===========================================
  // Relaxed rules for Electron main entry point (TypeScript)
  // ===========================================
  {
    files: ['src/main.ts'],
    rules: {
      'security/detect-non-literal-fs-filename': 'off',
      'security/detect-object-injection': 'off',
      'sonarjs/cognitive-complexity': ['warn', 25],
      'sonarjs/no-collapsible-if': 'off', // Sometimes clearer to keep separate
    },
  },

  // ===========================================
  // Relaxed rules for config files
  // ===========================================
  {
    files: ['src/config/**/*.js', 'src/config/**/*.ts'],
    rules: {
      'security/detect-unsafe-regex': 'off', // Logging patterns are bounded
    },
  },

  // ===========================================
  // Relaxed rules for PII detection module
  // (complex pattern matching requires higher complexity)
  // ===========================================
  {
    files: ['src/pii/**/*.js', 'src/pii/**/*.ts'],
    rules: {
      'complexity': ['warn', { max: 30 }],
      'sonarjs/cognitive-complexity': ['warn', 30],
      'max-lines': ['warn', { max: 800, skipComments: true, skipBlankLines: true }],
      'max-lines-per-function': ['warn', { max: 200, skipComments: true, skipBlankLines: true }],
      'sonarjs/no-duplicate-string': 'off', // Regex patterns often repeat
      'security/detect-unsafe-regex': 'off', // PII patterns are intentionally complex but bounded
      'security/detect-object-injection': 'off', // Dynamic entity type lookups are safe
    },
  },

  // ===========================================
  // Relaxed rules for renderer/UI files
  // ===========================================
  {
    files: ['renderer.js', 'src/ui/**/*.ts', 'src/ui/**/*.js', 'accuracyDashboard.js'],
    rules: {
      'security/detect-object-injection': 'off',
      'max-lines': ['warn', { max: 600, skipComments: true, skipBlankLines: true }],
      'sonarjs/no-duplicate-string': 'off', // HTML templates often repeat
    },
  },

  // ===========================================
  // Relaxed rules for test files
  // ===========================================
  {
    files: ['test/**/*.js', 'test/**/*.ts', 'test/**/*.cjs'],
    rules: {
      'max-lines': 'off',
      'max-lines-per-function': 'off',
      'max-nested-callbacks': 'off', // Mocha describe/it nesting
      'sonarjs/no-identical-functions': 'off',
      'sonarjs/no-duplicate-string': 'off',
      'sonarjs/no-nested-conditional': 'off',
      'no-secrets/no-secrets': 'off',
      'security/detect-object-injection': 'off',
      'security/detect-non-literal-fs-filename': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
    },
  },

  // ===========================================
  // Relaxed rules for scripts and utilities
  // ===========================================
  {
    files: ['scripts/**/*.js', 'scripts/**/*.mjs'],
    rules: {
      'no-console': 'off',
      'security/detect-non-literal-fs-filename': 'off',
      'security/detect-child-process': 'off',
      'max-lines-per-function': 'off',
    },
  },

  // ===========================================
  // Global Ignores
  // ===========================================
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'models/**',
      'test/output/**',
      '*.config.js',
      'output.css',
      'specs/**',
      '.bmad/**',
      '.agent/**',
      '.claude/**',
      '**/*.d.ts',
      'docs/**',
      'locales/**',
    ],
  },
];
