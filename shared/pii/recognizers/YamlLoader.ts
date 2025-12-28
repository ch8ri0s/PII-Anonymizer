/**
 * YAML Loader for Recognizers
 *
 * Enables code-free addition of recognizers via YAML configuration.
 * Parses YAML files and creates GenericRecognizer instances.
 *
 * Following Microsoft Presidio pattern for extensibility.
 *
 * @module shared/pii/recognizers/YamlLoader
 */

import { z } from 'zod';
import { BaseRecognizer } from './BaseRecognizer.js';
import {
  RecognizerConfig,
  PatternDefinition,
  RecognizerSpecificity,
  DEFAULT_RECOGNIZER_CONFIG,
} from './types.js';
import { RecognizerRegistry } from './Registry.js';

/**
 * Zod schema for pattern definition in YAML.
 */
const PatternDefSchema = z.object({
  regex: z.string(),
  score: z.number().min(0).max(1),
  entityType: z.string(),
  name: z.string().optional(),
  isWeakPattern: z.boolean().optional(),
});

/**
 * Zod schema for recognizer configuration in YAML.
 */
const RecognizerDefSchema = z.object({
  name: z.string(),
  supportedLanguages: z.array(z.string()),
  supportedCountries: z.array(z.string()),
  patterns: z.array(PatternDefSchema),
  priority: z.number().optional(),
  specificity: z.enum(['country', 'region', 'global']).optional(),
  contextWords: z.array(z.string()).optional(),
  denyPatterns: z.array(z.string()).optional(),
  useGlobalContext: z.boolean().optional(),
  useGlobalDenyList: z.boolean().optional(),
});

/**
 * Zod schema for YAML configuration file.
 */
const YamlConfigSchema = z.object({
  version: z.string().optional(),
  recognizers: z.array(RecognizerDefSchema),
});

/**
 * Type for parsed YAML config.
 */
export type YamlRecognizerConfig = z.infer<typeof YamlConfigSchema>;
export type YamlRecognizerDef = z.infer<typeof RecognizerDefSchema>;
export type YamlPatternDef = z.infer<typeof PatternDefSchema>;

/**
 * Generic recognizer created from YAML configuration.
 * Uses the configuration directly without custom logic.
 */
export class GenericRecognizer extends BaseRecognizer {
  readonly config: RecognizerConfig;

  constructor(config: RecognizerConfig) {
    super();
    this.config = config;
  }
}

/**
 * Parse a YAML string into a validated configuration.
 *
 * @param yamlContent - YAML content as string
 * @returns Validated configuration object
 * @throws Error if YAML is invalid or doesn't match schema
 */
export function parseYamlConfig(yamlContent: string): YamlRecognizerConfig {
  // Note: This function expects pre-parsed YAML (as JSON-compatible object).
  // In a real implementation, you would use a YAML parser like js-yaml.
  // For browser compatibility, we accept JSON or pre-parsed YAML.
  let parsed: unknown;
  try {
    parsed = JSON.parse(yamlContent);
  } catch {
    throw new Error(
      'YAML parsing not available. Pass pre-parsed YAML as JSON string, ' +
        'or use a YAML parser like js-yaml in your environment.'
    );
  }

  const result = YamlConfigSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Invalid recognizer config: ${result.error.message}`);
  }

  return result.data;
}

/**
 * Convert a YAML recognizer definition to a RecognizerConfig.
 *
 * @param def - YAML recognizer definition
 * @returns Complete RecognizerConfig
 */
export function yamlDefToConfig(def: YamlRecognizerDef): RecognizerConfig {
  const patterns: PatternDefinition[] = def.patterns.map((p) => ({
    regex: new RegExp(p.regex),
    score: p.score,
    entityType: p.entityType,
    name: p.name,
    isWeakPattern: p.isWeakPattern,
  }));

  return {
    name: def.name,
    supportedLanguages: def.supportedLanguages,
    supportedCountries: def.supportedCountries,
    patterns,
    priority: def.priority ?? DEFAULT_RECOGNIZER_CONFIG.priority ?? 50,
    specificity:
      (def.specificity as RecognizerSpecificity) ??
      DEFAULT_RECOGNIZER_CONFIG.specificity ??
      'country',
    contextWords: def.contextWords ?? [],
    denyPatterns: def.denyPatterns ?? [],
    useGlobalContext:
      def.useGlobalContext ?? DEFAULT_RECOGNIZER_CONFIG.useGlobalContext ?? true,
    useGlobalDenyList:
      def.useGlobalDenyList ??
      DEFAULT_RECOGNIZER_CONFIG.useGlobalDenyList ??
      true,
  };
}

/**
 * Create recognizers from a YAML configuration.
 *
 * @param config - Validated YAML configuration
 * @returns Array of GenericRecognizer instances
 */
export function createRecognizersFromConfig(
  config: YamlRecognizerConfig
): GenericRecognizer[] {
  return config.recognizers.map((def) => {
    const recognizerConfig = yamlDefToConfig(def);
    return new GenericRecognizer(recognizerConfig);
  });
}

/**
 * Load recognizers from YAML/JSON content and register them.
 *
 * This is the main entry point for code-free recognizer addition.
 *
 * @param content - YAML/JSON content as string
 * @returns Array of registered recognizer names
 *
 * @example
 * ```typescript
 * const yamlContent = `{
 *   "version": "1.0",
 *   "recognizers": [{
 *     "name": "USPhoneNumber",
 *     "supportedCountries": ["US"],
 *     "supportedLanguages": ["en"],
 *     "patterns": [{
 *       "regex": "\\\\b\\\\d{3}[-.\\\\s]?\\\\d{3}[-.\\\\s]?\\\\d{4}\\\\b",
 *       "score": 0.4,
 *       "entityType": "PHONE_NUMBER",
 *       "isWeakPattern": true
 *     }],
 *     "contextWords": ["phone", "call", "tel"],
 *     "useGlobalContext": true,
 *     "useGlobalDenyList": true
 *   }]
 * }`;
 *
 * const names = loadRecognizersFromYaml(yamlContent);
 * // names = ['USPhoneNumber']
 * ```
 */
export function loadRecognizersFromYaml(content: string): string[] {
  const config = parseYamlConfig(content);
  const recognizers = createRecognizersFromConfig(config);
  const names: string[] = [];

  for (const recognizer of recognizers) {
    RecognizerRegistry.register(recognizer);
    names.push(recognizer.config.name);
  }

  return names;
}

/**
 * Validate YAML content without registering recognizers.
 * Useful for config validation before deployment.
 *
 * @param content - YAML/JSON content as string
 * @returns Validation result with success flag and any errors
 */
export function validateYamlConfig(content: string): {
  valid: boolean;
  errors: string[];
  recognizerCount: number;
} {
  try {
    const config = parseYamlConfig(content);
    return {
      valid: true,
      errors: [],
      recognizerCount: config.recognizers.length,
    };
  } catch (error) {
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : String(error)],
      recognizerCount: 0,
    };
  }
}
