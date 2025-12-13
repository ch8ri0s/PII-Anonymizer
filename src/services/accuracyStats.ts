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
   */
  async loadAllCorrectionLogs(): Promise<CorrectionEntry[]> {
    const entries: CorrectionEntry[] = [];

    try {
      const files = fs.readdirSync(this.logDir);
      const logFiles = files.filter((f) => f.match(/^corrections-\d{4}-\d{2}\.json$/));

      log.debug('Found correction log files', { count: logFiles.length });

      for (const filename of logFiles) {
        try {
          const filePath = path.join(this.logDir, filename);
          const content = fs.readFileSync(filePath, 'utf-8');
          const logFile = JSON.parse(content) as CorrectionLogFile;

          if (logFile.entries && Array.isArray(logFile.entries)) {
            entries.push(...logFile.entries);
          }
        } catch (err) {
          log.warn('Failed to parse log file', { filename, error: (err as Error).message });
        }
      }

      log.info('Loaded correction entries', { total: entries.length });
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

    // Apply date filters if provided
    if (options?.startDate) {
      const start = new Date(options.startDate);
      entries = entries.filter((e) => new Date(e.timestamp) >= start);
    }
    if (options?.endDate) {
      const end = new Date(options.endDate);
      entries = entries.filter((e) => new Date(e.timestamp) <= end);
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

    // Entity type breakdown
    lines.push('## Entity Type Breakdown');
    lines.push('EntityType,Dismissals,Additions,Total');
    for (const typeStats of stats.byEntityType) {
      lines.push(`${typeStats.entityType},${typeStats.dismissals},${typeStats.additions},${typeStats.total}`);
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
