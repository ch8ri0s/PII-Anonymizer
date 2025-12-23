/**
 * PDF Table Detection and Markdown Conversion (Electron Re-export)
 *
 * Re-exports the shared pdfTableDetector module for use in Electron app.
 * All table detection logic has been moved to shared/utils/pdfTableDetector.ts
 */

export { TableDetector, TableToMarkdownConverter } from '../../shared/dist/utils/pdfTableDetector.js';
