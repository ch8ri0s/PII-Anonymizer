/**
 * Recognizers Module
 *
 * Exports all recognizer-related types, classes, and utilities.
 *
 * @module shared/pii/recognizers
 */

// Types and interfaces
export {
  type PatternDefinition,
  type RecognizerConfig,
  type RecognizerMatch,
  type RecognizerSpecificity,
  type RegistryGlobalConfig,
  type Recognizer,
  type RecognizerFilter,
  type RegistryAnalysisResult,
  DEFAULT_RECOGNIZER_CONFIG,
  DEFAULT_REGISTRY_CONFIG,
} from './types.js';

// Base recognizer class
export { BaseRecognizer } from './BaseRecognizer.js';

// Registry
export { RecognizerRegistry } from './Registry.js';

// YAML Loader for code-free extensibility
export {
  type YamlRecognizerConfig,
  type YamlRecognizerDef,
  type YamlPatternDef,
  GenericRecognizer,
  parseYamlConfig,
  yamlDefToConfig,
  createRecognizersFromConfig,
  loadRecognizersFromYaml,
  validateYamlConfig,
} from './YamlLoader.js';
