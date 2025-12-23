/**
 * Re-export detection types from parent project
 *
 * This file resolves TS6137 errors by re-exporting types from the parent
 * project's implementation file rather than declaration files.
 */

export type {
  Entity,
  EntityType,
  EntitySource,
  ValidationStatus,
  AddressComponent,
  AddressComponentType,
  AddressPatternType,
  GroupedAddress,
  LinkedAddressGroup,
  ContextFactor,
  DetectionPass,
  PipelineContext,
  PassResult,
  DocumentType,
  PipelineConfig,
  DetectionResult,
  ValidationRule,
  ValidationResult,
  ContextRule,
  MappingEntry,
  MappingFile,
} from '../../../src/types/detection.js';
