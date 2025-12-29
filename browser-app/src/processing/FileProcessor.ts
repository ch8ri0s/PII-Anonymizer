/**
 * File Processor - Browser Version
 *
 * Orchestrates the conversion, detection, and anonymization pipeline.
 * Uses shared core modules for anonymization logic.
 */

import type { ProcessingResult } from '../types';
import { convertToMarkdown, isSupported } from '../converters';
import { PIIDetector } from './PIIDetector';
import { anonymizeMarkdown, FileProcessingSession } from './Anonymizer';
import { createLogger } from '../utils/logger';

// Logger for file processing
const log = createLogger('processing:file');

export class FileProcessor {
  private detector: PIIDetector;

  constructor() {
    this.detector = new PIIDetector();
  }

  /**
   * Process a single file through the pipeline
   */
  async processFile(
    file: File,
    onProgress?: (progress: number, status: string) => void,
  ): Promise<ProcessingResult> {
    onProgress?.(0, 'Starting...');

    // Validate
    if (!isSupported(file)) {
      throw new Error(`Unsupported file type: ${file.type || file.name}`);
    }

    // Create isolated session (same as Electron version)
    const session = new FileProcessingSession();

    onProgress?.(10, 'Converting to Markdown...');

    // Convert to Markdown
    const markdown = await convertToMarkdown(file);

    onProgress?.(50, 'Detecting PII...');

    // Detect PII using multi-pass pipeline (includes format validation)
    // This filters false positives like years mistaken for postal codes
    const detectionResult = await this.detector.detectWithPipeline(markdown, {
      onProgress: (progress, stage) => {
        // Map pipeline progress (0-100) to our range (50-70)
        const mappedProgress = 50 + (progress * 0.2);
        onProgress?.(mappedProgress, stage);
      },
    });

    // Filter entities by minimum confidence (0.5 = 50%)
    // This removes low-confidence detections like year false positives
    const MIN_CONFIDENCE = 0.5;
    const piiMatches = detectionResult.entities
      .filter(e => e.confidence >= MIN_CONFIDENCE)
      .map(e => ({
        text: e.text,
        type: e.type,
        start: e.start,
        end: e.end,
        confidence: e.confidence,
        source: e.source,
      }));

    onProgress?.(70, 'Anonymizing...');

    // Anonymize using shared session and functions
    const { anonymizedMarkdown, mappingTable } = anonymizeMarkdown(
      markdown,
      piiMatches as unknown as import('@core/index').PIIMatch[],
      session,
    );

    onProgress?.(90, 'Generating statistics...');

    // Statistics
    // Cast to PIIMatch[] - ExtendedPIIMatch is structurally compatible (has all required fields)
    const stats = this.detector.getStatistics(piiMatches as unknown as import('@core/index').PIIMatch[]);

    onProgress?.(100, 'Complete');

    return {
      markdown,
      anonymizedMarkdown,
      piiMatches: piiMatches as unknown as import('@core/index').PIIMatch[],
      mappingTable,
      stats,
    };
  }

  /**
   * Process multiple files
   */
  async processFiles(
    files: File[],
    onFileProgress?: (fileIndex: number, progress: number, status: string) => void,
  ): Promise<Map<string, ProcessingResult>> {
    const results = new Map<string, ProcessingResult>();

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const result = await this.processFile(file, (progress, status) => {
          onFileProgress?.(i, progress, status);
        });
        results.set(file.name, result);
      } catch (error) {
        log.error('File processing failed', { fileName: file.name, error: error instanceof Error ? error.message : String(error) });
      }
    }

    return results;
  }

  /**
   * Get supported file extensions
   */
  getSupportedExtensions(): string[] {
    return ['.pdf', '.docx', '.xlsx', '.xls', '.csv', '.txt', '.md'];
  }

  /**
   * Generate combined mapping file
   */
  generateCombinedMapping(results: Map<string, ProcessingResult>): string {
    const lines = [
      '# Combined PII Mapping',
      '',
      `Generated: ${new Date().toISOString()}`,
      '',
      '---',
      '',
    ];

    for (const [filename, result] of results) {
      lines.push(`## ${filename}`);
      lines.push('');

      if (result.mappingTable.length === 0) {
        lines.push('No PII detected.');
      } else {
        lines.push('| Original | Replacement | Type | Count |');
        lines.push('| -------- | ----------- | ---- | ----- |');

        for (const entry of result.mappingTable) {
          lines.push(
            `| ${entry.original.replace(/\|/g, '\\|')} | ${entry.replacement} | ${entry.type} | ${entry.occurrences} |`,
          );
        }
      }

      lines.push('');
    }

    return lines.join('\n');
  }
}

export default FileProcessor;
