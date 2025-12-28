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
        DOMException: 'readonly',
        AbortController: 'readonly',
        AbortSignal: 'readonly',
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
      'no-console': 'error', // Story 10.1: Enforce LoggerFactory usage - see eslint overrides for exclusions
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
      // Note: detect-object-injection has too many false positives for map/array access
      'security/detect-object-injection': 'off',
      // Note: detect-non-literal-fs-filename is too strict - paths are validated elsewhere
      'security/detect-non-literal-fs-filename': 'off',
      'security/detect-eval-with-expression': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-buffer-noassert': 'error',
      'security/detect-child-process': 'warn',
      'security/detect-disable-mustache-escape': 'error',
      'security/detect-new-buffer': 'error',
      'security/detect-possible-timing-attacks': 'off',
      'security/detect-pseudoRandomBytes': 'warn',
      // Note: detect-unsafe-regex has false positives for bounded patterns in tests
      'security/detect-unsafe-regex': 'off',

      // ===== No Secrets (prevent hardcoded credentials) =====
      'no-secrets/no-secrets': ['error', { tolerance: 5 }],

      // ===== SonarJS Code Quality (v3.x rules) =====
      'sonarjs/no-all-duplicated-branches': 'error',
      'sonarjs/no-duplicated-branches': 'error',
      'sonarjs/no-identical-functions': 'off', // Too strict for similar helper functions
      'sonarjs/no-redundant-jump': 'error',
      'sonarjs/no-unused-collection': 'warn',
      'sonarjs/prefer-immediate-return': 'off', // Style preference, not a bug
      'sonarjs/cognitive-complexity': 'off', // Complexity limits handled by max-depth
      'sonarjs/no-collapsible-if': 'off', // Sometimes separate ifs are clearer
      'sonarjs/no-collection-size-mischeck': 'error',
      'sonarjs/no-duplicate-string': 'off', // Too many false positives
      'sonarjs/no-gratuitous-expressions': 'error',
      'sonarjs/no-identical-conditions': 'error',
      'sonarjs/no-identical-expressions': 'error',
      'sonarjs/no-inverted-boolean-check': 'off', // Style preference
      'sonarjs/no-nested-conditional': 'off', // Sometimes ternaries are clearer
      'sonarjs/no-same-line-conditional': 'warn',
      'sonarjs/no-small-switch': 'off', // Small switches can be intentional
      'sonarjs/no-use-of-empty-return-value': 'error',
      'sonarjs/prefer-object-literal': 'off', // Style preference
      'sonarjs/prefer-single-boolean-return': 'off', // Style preference
      'sonarjs/prefer-while': 'off', // Style preference
      'sonarjs/no-nested-switch': 'warn',
      'sonarjs/no-redundant-boolean': 'off', // Sometimes explicit is clearer

      // ===== Maintainability Limits =====
      'max-lines': 'off', // File size limits are too strict for this codebase
      'max-lines-per-function': 'off', // Function size handled by complexity checks
      'complexity': 'off', // Complexity limits handled elsewhere
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
        NodeJS: 'readonly',
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
      '@typescript-eslint/no-non-null-assertion': 'off', // Too strict - assertion is valid when null-check is done elsewhere
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': 'error',

      // Disable base rule as it conflicts with TypeScript
      'no-unused-vars': 'off',

      // ===== Error Prevention =====
      'no-console': 'error', // Story 10.1: Enforce LoggerFactory usage

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
      'security/detect-object-injection': 'off',
      'security/detect-non-literal-fs-filename': 'off',
      'security/detect-eval-with-expression': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-buffer-noassert': 'error',
      'security/detect-child-process': 'warn',
      'security/detect-disable-mustache-escape': 'error',
      'security/detect-new-buffer': 'error',
      'security/detect-possible-timing-attacks': 'off',
      'security/detect-pseudoRandomBytes': 'warn',
      'security/detect-unsafe-regex': 'off',

      // ===== No Secrets =====
      'no-secrets/no-secrets': ['error', { tolerance: 5 }],

      // ===== SonarJS Code Quality (v3.x rules) =====
      'sonarjs/no-all-duplicated-branches': 'error',
      'sonarjs/no-duplicated-branches': 'error',
      'sonarjs/no-identical-functions': 'off',
      'sonarjs/no-redundant-jump': 'error',
      'sonarjs/cognitive-complexity': 'off',
      'sonarjs/no-collapsible-if': 'off',
      'sonarjs/no-duplicate-string': 'off',
      'sonarjs/no-identical-conditions': 'error',
      'sonarjs/no-identical-expressions': 'error',
      'sonarjs/no-nested-conditional': 'off',
      'sonarjs/no-nested-switch': 'warn',
      'sonarjs/no-redundant-boolean': 'off',

      // ===== Maintainability Limits =====
      'max-lines': 'off',
      'max-lines-per-function': 'off',
      'complexity': 'off',
      'max-depth': ['error', { max: 5 }],
      'max-nested-callbacks': ['error', { max: 4 }],
      'max-params': ['warn', { max: 6 }],
    },
  },

  // ===========================================
  // Relaxed rules for i18n module
  // ===========================================
  {
    files: ['src/i18n/**/*.js', 'src/i18n/**/*.ts'],
    rules: {
      // All noisy rules already disabled globally
    },
  },

  // ===========================================
  // Relaxed rules for Electron main entry point (TypeScript)
  // ===========================================
  {
    files: ['src/main.ts'],
    rules: {
      // All noisy rules already disabled globally
    },
  },

  // ===========================================
  // Relaxed rules for config files
  // ===========================================
  {
    files: ['src/config/**/*.js', 'src/config/**/*.ts'],
    rules: {
      // All noisy rules already disabled globally
    },
  },

  // ===========================================
  // Relaxed rules for PII detection module
  // ===========================================
  {
    files: ['src/pii/**/*.js', 'src/pii/**/*.ts'],
    rules: {
      // All noisy rules already disabled globally
      'security/detect-object-injection': 'off', // Dynamic entity type lookups are safe
    },
  },

  // ===========================================
  // Relaxed rules for renderer/UI files
  // ===========================================
  {
    files: ['renderer.js', 'src/ui/**/*.ts', 'src/ui/**/*.js', 'accuracyDashboard.js'],
    rules: {
      // All noisy rules already disabled globally
    },
  },

  // ===========================================
  // Relaxed rules for test files
  // Story 10.8: Migration complete - console enforcement enabled
  // ===========================================
  {
    files: ['test/**/*.js', 'test/**/*.ts', 'test/**/*.cjs'],
    rules: {
      'no-console': 'warn', // Story 10.8: Migration complete - use testLogger helper
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
  // Relaxed rules for root-level test scripts
  // Story 10.1: Standalone test utilities exempt from no-console
  // ===========================================
  {
    files: ['test-*.js', 'test-*.mjs'],
    rules: {
      'no-console': 'off',
      'security/detect-non-literal-fs-filename': 'off',
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
      'browser-app/**',
      'shared/**', // Has its own tsconfig.json
    ],
  },
];
