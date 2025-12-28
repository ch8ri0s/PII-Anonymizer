/**
 * Country-Specific Recognizers
 *
 * Exports all country-specific recognizer modules.
 * Import from specific country modules for tree-shaking.
 *
 * @module shared/pii/countries
 */

// Core (universal) recognizers
export * from './core/index.js';

// Swiss recognizers
export * from './ch/index.js';

// EU recognizers
export * from './eu/index.js';

// US recognizers
export * from './us/index.js';
