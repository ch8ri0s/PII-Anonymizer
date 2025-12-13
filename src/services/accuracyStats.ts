/**
 * Accuracy Statistics Service (Epic 5, Story 5.3)
 *
 * Aggregates correction logs to calculate accuracy statistics for the dashboard.
 *
 * Security: Only reads local correction logs from app userData directory.
 * Privacy: All data is already anonymized by FeedbackLogger.
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { createLogger } from '../utils/logger.js';
import type { CorrectionEntry, CorrectionLogFile } from '../types/feedback.js';
import type {
  AccuracyStatistics,
  AccuracySummary,
  EntityTypeStats,
  TrendPoint,
  GetStatsOptions,
} from '../types/accuracy.js';

const log = createLogger('accuracy-stats');

// Resource limits to prevent memory exhaustion
const MAX_LOG_FILES = 60; // ~5 years of monthly logs
const MAX_ENTRIES_PER_FILE = 10000;
const MAX_TOTAL_ENTRIES = 100000;

/**
 * Escape CSV cell value to prevent formula injection (CSV injection attack)
 * Prevents: =cmd|' /C calc'!A1, @SUM(), +cmd, -cmd, etc.
 */
function escapeCsvCell(value: string | number): string {
  const strValue = String(value);

  // Prevent formula injection: escape leading =, +, -, @, tab, carriage return
  if (/^[=+\-@\t\r]/.test(strValue)) {
    return `"'${strValue.replace(/"/g, '""')}"`;
  }

  // Escape commas, quotes, newlines
  if (/[,"\n]/.test(strValue)) {
    return `"${strValue.replace(/"/g, '""')}"`;
  }

  return strValue;
}

/**
 * Safely parse JSON log file with prototype pollution protection
 */
function safeParseLogFile(content: string): CorrectionLogFile | null {
  try {
    const parsed = JSON.parse(content) as unknown;

    // Reject objects with dangerous prototype keys
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      if ('__proto__' in obj || 'constructor' in obj || 'prototype' in obj) {
        log.warn('Rejected log file with dangerous prototype keys');
        return null;
      }
    }

    // Validate structure
    const logFile = parsed as CorrectionLogFile;
    if (!logFile.entries || !Array.isArray(logFile.entries)) {
      return null;
    }

    return logFile;
  } catch {
    return null;
  }
}

/**
 * Validate ISO 8601 date string
 */
function parseIsoDate(dateStr: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/.test(dateStr)) {
    return null;
  }

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return null;
  }

  return date;
}

/**
 * Get ISO week number from date
 */
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/**
 * Get week label in YYYY-Www format
 */
function getWeekLabel(date: Date): string {
  const year = date.getFullYear();
  const week = getWeekNumber(date);
  return `${year}-W${week.toString().padStart(2, '0')}`;
}

/**
 * Get month label in YYYY-MM format
 */
function getMonthLabel(date: Date): string {
  return date.toISOString().slice(0, 7);
}

/**
 * AccuracyStats class for calculating accuracy statistics
 */
export class AccuracyStats {
  private logDir: string;

  constructor() {
    this.logDir = app.getPath('userData');
    log.info('AccuracyStats initialized', { logDir: this.logDir });
  }

  /**
   * Load all correction log files from the userData directory
   * Uses async I/O to avoid blocking the event loop
   * Applies resource limits to prevent memory exhaustion
   */
  async loadAllCorrectionLogs(): Promise<CorrectionEntry[]> {
    const entries: CorrectionEntry[] = [];
    let totalEntries = 0;
    let limitReached = false;

    try {
      // Use async readdir to avoid blocking
      const files = await fs.promises.readdir(this.logDir);
      let logFiles = files.filter((f) => f.match(/^corrections-\d{4}-\d{2}\.json$/));

      // Apply file limit (most recent files first)
      logFiles.sort().reverse();
      if (logFiles.length > MAX_LOG_FILES) {
        log.warn('Log file limit reached, processing most recent only', {
          total: logFiles.length,
          limit: MAX_LOG_FILES,
        });
        logFiles = logFiles.slice(0, MAX_LOG_FILES);
      }

      log.debug('Found correction log files', { count: logFiles.length });

      for (const filename of logFiles) {
        // Check if we've hit the total entry limit
        if (totalEntries >= MAX_TOTAL_ENTRIES) {
          limitReached = true;
          log.warn('Total entry limit reached, stopping log loading', {
            limit: MAX_TOTAL_ENTRIES,
          });
          break;
        }

        try {
          const filePath = path.join(this.logDir, filename);
          // Use async readFile to avoid blocking
          const content = await fs.promises.readFile(filePath, 'utf-8');

          // Use safe JSON parsing with prototype pollution protection
          const logFile = safeParseLogFile(content);
          if (!logFile) {
            log.warn('Failed to parse or validate log file', { filename });
            continue;
          }

          // Apply per-file entry limit
          let fileEntries = logFile.entries;
          if (fileEntries.length > MAX_ENTRIES_PER_FILE) {
            log.warn('Per-file entry limit exceeded, truncating', {
              filename,
              actual: fileEntries.length,
              limit: MAX_ENTRIES_PER_FILE,
            });
            fileEntries = fileEntries.slice(0, MAX_ENTRIES_PER_FILE);
          }

          // Calculate remaining capacity
          const remainingCapacity = MAX_TOTAL_ENTRIES - totalEntries;
          const entriesToAdd = fileEntries.slice(0, remainingCapacity);

          entries.push(...entriesToAdd);
          totalEntries += entriesToAdd.length;
        } catch (err) {
          log.warn('Failed to read log file', { filename, error: (err as Error).message });
        }
      }

      log.info('Loaded correction entries', {
        total: entries.length,
        limitReached,
      });
    } catch (err) {
      log.error('Failed to read log directory', { error: (err as Error).message });
    }

    return entries;
  }

  /**
   * Calculate summary statistics from entries
   */
  private calculateSummary(entries: CorrectionEntry[]): AccuracySummary {
    const documentHashes = new Set(entries.map((e) => e.documentHash));
    const dismissals = entries.filter((e) => e.action === 'DISMISS').length;
    const additions = entries.filter((e) => e.action === 'ADD').length;
    const total = entries.length;

    return {
      documentsProcessed: documentHashes.size,
      totalCorrections: total,
      dismissals,
      manualAdditions: additions,
      falsePositiveRate: total > 0 ? dismissals / total : 0,
      falseNegativeEstimate: total > 0 ? additions / total : 0,
    };
  }

  /**
   * Calculate per-entity-type breakdown
   */
  private calculateByEntityType(entries: CorrectionEntry[]): EntityTypeStats[] {
    const typeMap = new Map<string, { dismissals: number; additions: number }>();

    for (const entry of entries) {
      const entityType = entry.entityType;
      if (!typeMap.has(entityType)) {
        typeMap.set(entityType, { dismissals: 0, additions: 0 });
      }

      const stats = typeMap.get(entityType)!;
      if (entry.action === 'DISMISS') {
        stats.dismissals++;
      } else {
        stats.additions++;
      }
    }

    const result: EntityTypeStats[] = [];
    for (const [entityType, stats] of typeMap) {
      result.push({
        entityType,
        dismissals: stats.dismissals,
        additions: stats.additions,
        total: stats.dismissals + stats.additions,
      });
    }

    // Sort by total descending
    return result.sort((a, b) => b.total - a.total);
  }

  /**
   * Calculate weekly trend data
   */
  private calculateWeeklyTrends(entries: CorrectionEntry[]): TrendPoint[] {
    const weekMap = new Map<string, { dismissals: number; additions: number }>();

    for (const entry of entries) {
      const date = new Date(entry.timestamp);
      const weekLabel = getWeekLabel(date);

      if (!weekMap.has(weekLabel)) {
        weekMap.set(weekLabel, { dismissals: 0, additions: 0 });
      }

      const stats = weekMap.get(weekLabel)!;
      if (entry.action === 'DISMISS') {
        stats.dismissals++;
      } else {
        stats.additions++;
      }
    }

    const result: TrendPoint[] = [];
    for (const [period, stats] of weekMap) {
      const total = stats.dismissals + stats.additions;
      result.push({
        period,
        dismissals: stats.dismissals,
        additions: stats.additions,
        total,
        fpRate: total > 0 ? stats.dismissals / total : 0,
        fnEstimate: total > 0 ? stats.additions / total : 0,
      });
    }

    // Sort by period ascending
    return result.sort((a, b) => a.period.localeCompare(b.period));
  }

  /**
   * Calculate monthly trend data
   */
  private calculateMonthlyTrends(entries: CorrectionEntry[]): TrendPoint[] {
    const monthMap = new Map<string, { dismissals: number; additions: number }>();

    for (const entry of entries) {
      const date = new Date(entry.timestamp);
      const monthLabel = getMonthLabel(date);

      if (!monthMap.has(monthLabel)) {
        monthMap.set(monthLabel, { dismissals: 0, additions: 0 });
      }

      const stats = monthMap.get(monthLabel)!;
      if (entry.action === 'DISMISS') {
        stats.dismissals++;
      } else {
        stats.additions++;
      }
    }

    const result: TrendPoint[] = [];
    for (const [period, stats] of monthMap) {
      const total = stats.dismissals + stats.additions;
      result.push({
        period,
        dismissals: stats.dismissals,
        additions: stats.additions,
        total,
        fpRate: total > 0 ? stats.dismissals / total : 0,
        fnEstimate: total > 0 ? stats.additions / total : 0,
      });
    }

    // Sort by period ascending
    return result.sort((a, b) => a.period.localeCompare(b.period));
  }

  /**
   * Calculate all statistics from correction logs
   */
  async calculateStatistics(options?: GetStatsOptions): Promise<AccuracyStatistics> {
    let entries = await this.loadAllCorrectionLogs();

    // Apply date filters if provided (with validation)
    if (options?.startDate) {
      const start = parseIsoDate(options.startDate);
      if (!start) {
        log.warn('Invalid startDate format, ignoring filter', { startDate: options.startDate });
      } else {
        entries = entries.filter((e) => new Date(e.timestamp) >= start);
      }
    }
    if (options?.endDate) {
      const end = parseIsoDate(options.endDate);
      if (!end) {
        log.warn('Invalid endDate format, ignoring filter', { endDate: options.endDate });
      } else {
        entries = entries.filter((e) => new Date(e.timestamp) <= end);
      }
    }

    // Calculate period bounds
    let periodStart = new Date().toISOString();
    let periodEnd = new Date().toISOString();

    if (entries.length > 0) {
      const timestamps = entries.map((e) => new Date(e.timestamp).getTime());
      periodStart = new Date(Math.min(...timestamps)).toISOString();
      periodEnd = new Date(Math.max(...timestamps)).toISOString();
    }

    return {
      period: {
        start: periodStart,
        end: periodEnd,
      },
      summary: this.calculateSummary(entries),
      byEntityType: this.calculateByEntityType(entries),
      trends: {
        weekly: this.calculateWeeklyTrends(entries),
        monthly: this.calculateMonthlyTrends(entries),
      },
    };
  }

  /**
   * Generate CSV report content
   */
  generateCsvReport(stats: AccuracyStatistics): string {
    const lines: string[] = [];

    // Header section
    lines.push('# Accuracy Report');
    lines.push(`# Generated: ${new Date().toISOString()}`);
    lines.push(`# Period: ${stats.period.start} to ${stats.period.end}`);
    lines.push('');

    // Summary section
    lines.push('## Summary');
    lines.push('Metric,Value');
    lines.push(`Documents Processed,${stats.summary.documentsProcessed}`);
    lines.push(`Total Corrections,${stats.summary.totalCorrections}`);
    lines.push(`Dismissals (False Positives),${stats.summary.dismissals}`);
    lines.push(`Manual Additions (False Negatives),${stats.summary.manualAdditions}`);
    lines.push(`False Positive Rate,${(stats.summary.falsePositiveRate * 100).toFixed(2)}%`);
    lines.push(`False Negative Estimate,${(stats.summary.falseNegativeEstimate * 100).toFixed(2)}%`);
    lines.push('');

    // Entity type breakdown (with CSV injection protection)
    lines.push('## Entity Type Breakdown');
    lines.push('EntityType,Dismissals,Additions,Total');
    for (const typeStats of stats.byEntityType) {
      lines.push(`${escapeCsvCell(typeStats.entityType)},${typeStats.dismissals},${typeStats.additions},${typeStats.total}`);
    }
    lines.push('');

    // Monthly trends
    lines.push('## Monthly Trends');
    lines.push('Period,Dismissals,Additions,Total,FPRate,FNEstimate');
    for (const point of stats.trends.monthly) {
      lines.push(
        `${point.period},${point.dismissals},${point.additions},${point.total},${(point.fpRate * 100).toFixed(2)}%,${(point.fnEstimate * 100).toFixed(2)}%`,
      );
    }

    return lines.join('\n');
  }
}

// Singleton instance
let accuracyStatsInstance: AccuracyStats | null = null;

/**
 * Get the singleton AccuracyStats instance
 */
export function getAccuracyStats(): AccuracyStats {
  if (!accuracyStatsInstance) {
    accuracyStatsInstance = new AccuracyStats();
  }
  return accuracyStatsInstance;
}
