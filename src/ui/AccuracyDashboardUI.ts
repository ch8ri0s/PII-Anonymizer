/**
 * Accuracy Dashboard UI Component (Epic 5, Story 5.3)
 *
 * Provides accuracy statistics display including:
 * - Summary statistics (docs processed, FP rate, FN estimate)
 * - Per-entity-type breakdown table
 * - Trend chart visualization
 * - CSV export functionality
 *
 * Single concern: Dashboard UI rendering and interaction handling
 */

import type {
  AccuracyStatistics,
  AccuracySummary,
  EntityTypeStats,
  TrendPoint,
  ExportResult,
} from '../types/accuracy.js';

// Type declarations for global window APIs
declare global {
  interface Window {
    accuracyAPI: {
      getStats: (options?: { startDate?: string; endDate?: string }) => Promise<AccuracyStatistics>;
      getTrends: (view: 'weekly' | 'monthly') => Promise<TrendPoint[]>;
      exportCsv: () => Promise<ExportResult>;
    };
    i18n: {
      t: (key: string, fallback?: string) => string;
    };
    log: {
      scope: (name: string) => {
        info: (...args: unknown[]) => void;
        error: (...args: unknown[]) => void;
        warn: (...args: unknown[]) => void;
      };
    };
  }
}

// Chart colors
const CHART_COLORS = {
  dismissals: '#ef4444', // red-500
  additions: '#22c55e',  // green-500
  grid: '#e5e7eb',       // gray-200
  text: '#6b7280',       // gray-500
  axis: '#374151',       // gray-700
};

// Logger
const dashboardLog = window.log?.scope?.('accuracy-dashboard') ?? console;

/**
 * Accuracy Dashboard UI Manager
 *
 * Handles all UI interactions for the accuracy dashboard modal.
 */
export class AccuracyDashboardUI {
  private modal: HTMLElement | null = null;
  private currentStats: AccuracyStatistics | null = null;
  private currentTrendView: 'weekly' | 'monthly' = 'weekly';
  private isLoading = false;

  // UI Elements
  private summaryPanel: HTMLElement | null = null;
  private breakdownTable: HTMLElement | null = null;
  private trendChart: HTMLCanvasElement | null = null;

  /**
   * Initialize the dashboard UI
   */
  initialize(modalId: string): void {
    this.modal = document.getElementById(modalId);
    if (!this.modal) {
      dashboardLog.error?.(`Modal not found: ${modalId}`);
      return;
    }

    this.cacheElements();
    this.attachEventListeners();
    dashboardLog.info?.('AccuracyDashboardUI initialized');
  }

  /**
   * Cache DOM elements for performance
   */
  private cacheElements(): void {
    if (!this.modal) return;

    this.summaryPanel = this.modal.querySelector('#accuracy-summary');
    this.breakdownTable = this.modal.querySelector('#accuracy-breakdown-table');
    this.trendChart = this.modal.querySelector('#accuracy-trend-chart') as HTMLCanvasElement;
  }

  /**
   * Attach event listeners
   */
  private attachEventListeners(): void {
    if (!this.modal) return;

    // Close button
    const closeBtn = this.modal.querySelector('#accuracy-close-btn');
    closeBtn?.addEventListener('click', () => this.close());

    // Backdrop click to close
    this.modal.addEventListener('click', (e) => {
      if (e.target === this.modal) {
        this.close();
      }
    });

    // Export button
    const exportBtn = this.modal.querySelector('#accuracy-export-btn');
    exportBtn?.addEventListener('click', () => this.handleExport());

    // Refresh button
    const refreshBtn = this.modal.querySelector('#accuracy-refresh-btn');
    refreshBtn?.addEventListener('click', () => this.loadStats());

    // Trend toggle buttons
    this.modal.querySelectorAll('[data-trend-view]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const view = (e.currentTarget as HTMLElement).dataset['trendView'] as 'weekly' | 'monthly';
        this.setTrendView(view);
      });
    });

    // Keyboard escape to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) {
        this.close();
      }
    });
  }

  /**
   * Open the dashboard modal and load data
   */
  async open(): Promise<void> {
    if (!this.modal) return;

    this.modal.classList.remove('hidden');
    this.modal.classList.add('flex');
    document.body.classList.add('overflow-hidden');

    await this.loadStats();
    dashboardLog.info?.('Accuracy dashboard opened');
  }

  /**
   * Close the dashboard modal
   */
  close(): void {
    if (!this.modal) return;

    this.modal.classList.add('hidden');
    this.modal.classList.remove('flex');
    document.body.classList.remove('overflow-hidden');
    dashboardLog.info?.('Accuracy dashboard closed');
  }

  /**
   * Check if modal is open
   */
  isOpen(): boolean {
    return this.modal?.classList.contains('flex') ?? false;
  }

  /**
   * Load statistics from backend
   */
  async loadStats(): Promise<void> {
    if (this.isLoading) return;

    this.isLoading = true;
    this.showLoading();

    try {
      const stats = await window.accuracyAPI.getStats();
      this.currentStats = stats;
      this.render();
      dashboardLog.info?.('Accuracy stats loaded', stats.summary);
    } catch (error) {
      dashboardLog.error?.('Failed to load accuracy stats:', error);
      this.showError(this.t('accuracy.noData', 'No correction data available yet'));
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Translation helper
   */
  private t(key: string, fallback: string): string {
    return window.i18n?.t?.(key, fallback) ?? fallback;
  }

  /**
   * Show loading state
   */
  private showLoading(): void {
    if (this.summaryPanel) {
      this.summaryPanel.innerHTML = `
        <div class="flex items-center justify-center py-8">
          <svg class="animate-spin h-8 w-8 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      `;
    }
  }

  /**
   * Show error message
   */
  private showError(message: string): void {
    if (this.summaryPanel) {
      this.summaryPanel.innerHTML = `
        <div class="text-center py-8 text-gray-500">
          <svg class="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <p class="text-lg font-medium">${this.escapeHtml(message)}</p>
          <p class="mt-2 text-sm">${this.escapeHtml(this.t('accuracy.noDataHint', 'Process documents and make corrections to see accuracy metrics'))}</p>
        </div>
      `;
    }

    if (this.breakdownTable) {
      this.breakdownTable.innerHTML = '';
    }

    this.clearChart();
  }

  /**
   * Render all dashboard components
   */
  private render(): void {
    if (!this.currentStats) return;

    this.renderSummary(this.currentStats.summary);
    this.renderBreakdownTable(this.currentStats.byEntityType);
    this.renderTrendChart();
  }

  /**
   * Render summary statistics cards
   */
  private renderSummary(summary: AccuracySummary): void {
    if (!this.summaryPanel) return;

    this.summaryPanel.innerHTML = `
      <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
        ${this.renderStatCard(
          this.t('accuracy.summary.documentsProcessed', 'Documents Processed'),
          summary.documentsProcessed.toString(),
          'document'
        )}
        ${this.renderStatCard(
          this.t('accuracy.summary.totalCorrections', 'Total Corrections'),
          summary.totalCorrections.toString(),
          'edit'
        )}
        ${this.renderStatCard(
          this.t('accuracy.summary.falsePositives', 'False Positives'),
          summary.dismissals.toString(),
          'dismiss',
          'text-red-600'
        )}
        ${this.renderStatCard(
          this.t('accuracy.summary.falseNegatives', 'False Negatives'),
          summary.manualAdditions.toString(),
          'add',
          'text-green-600'
        )}
        ${this.renderStatCard(
          this.t('accuracy.summary.fpRate', 'FP Rate'),
          `${(summary.falsePositiveRate * 100).toFixed(1)}%`,
          'percent',
          summary.falsePositiveRate > 0.2 ? 'text-red-600' : 'text-gray-700'
        )}
        ${this.renderStatCard(
          this.t('accuracy.summary.fnRate', 'FN Rate'),
          `${(summary.falseNegativeEstimate * 100).toFixed(1)}%`,
          'percent',
          summary.falseNegativeEstimate > 0.2 ? 'text-amber-600' : 'text-gray-700'
        )}
      </div>
    `;
  }

  /**
   * Render a single stat card
   */
  private renderStatCard(label: string, value: string, icon: string, valueClass = 'text-gray-900'): string {
    const iconSvg = this.getStatIcon(icon);

    return `
      <div class="bg-gray-50 rounded-lg p-4">
        <div class="flex items-center gap-2 text-gray-500 text-sm mb-1">
          ${iconSvg}
          <span>${this.escapeHtml(label)}</span>
        </div>
        <div class="text-2xl font-bold ${valueClass}">${this.escapeHtml(value)}</div>
      </div>
    `;
  }

  /**
   * Get icon SVG for stat card
   */
  private getStatIcon(type: string): string {
    const icons: Record<string, string> = {
      document: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>',
      edit: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>',
      dismiss: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>',
      add: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>',
      percent: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>',
    };
    return icons[type] ?? icons['document'] ?? '';
  }

  /**
   * Render entity type breakdown table
   */
  private renderBreakdownTable(byEntityType: EntityTypeStats[]): void {
    if (!this.breakdownTable) return;

    if (byEntityType.length === 0) {
      this.breakdownTable.innerHTML = `
        <p class="text-gray-500 text-center py-4">${this.escapeHtml(this.t('accuracy.noData', 'No data available'))}</p>
      `;
      return;
    }

    // Sort by total corrections descending
    const sorted = [...byEntityType].sort((a, b) => b.total - a.total);

    this.breakdownTable.innerHTML = `
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-gray-200">
            <th class="text-left py-2 px-3 font-medium text-gray-600">${this.escapeHtml(this.t('accuracy.entityBreakdown.entityType', 'Entity Type'))}</th>
            <th class="text-right py-2 px-3 font-medium text-gray-600">${this.escapeHtml(this.t('accuracy.entityBreakdown.dismissals', 'Dismissals'))}</th>
            <th class="text-right py-2 px-3 font-medium text-gray-600">${this.escapeHtml(this.t('accuracy.entityBreakdown.additions', 'Additions'))}</th>
            <th class="text-right py-2 px-3 font-medium text-gray-600">${this.escapeHtml(this.t('accuracy.entityBreakdown.total', 'Total'))}</th>
          </tr>
        </thead>
        <tbody>
          ${sorted.map(row => `
            <tr class="border-b border-gray-100 hover:bg-gray-50">
              <td class="py-2 px-3 font-medium">${this.escapeHtml(this.formatEntityType(row.entityType))}</td>
              <td class="py-2 px-3 text-right text-red-600">${row.dismissals}</td>
              <td class="py-2 px-3 text-right text-green-600">${row.additions}</td>
              <td class="py-2 px-3 text-right font-medium">${row.total}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  /**
   * Format entity type for display
   */
  private formatEntityType(type: string): string {
    // Convert SNAKE_CASE to Title Case
    return type
      .toLowerCase()
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Set trend view (weekly or monthly)
   */
  private setTrendView(view: 'weekly' | 'monthly'): void {
    this.currentTrendView = view;

    // Update toggle buttons
    this.modal?.querySelectorAll('[data-trend-view]').forEach(btn => {
      const btnView = (btn as HTMLElement).dataset['trendView'];
      btn.classList.toggle('bg-indigo-600', btnView === view);
      btn.classList.toggle('text-white', btnView === view);
      btn.classList.toggle('bg-gray-200', btnView !== view);
      btn.classList.toggle('text-gray-700', btnView !== view);
    });

    this.renderTrendChart();
  }

  /**
   * Render trend chart on canvas
   */
  private renderTrendChart(): void {
    if (!this.trendChart || !this.currentStats) return;

    const trendData = this.currentTrendView === 'weekly'
      ? this.currentStats.trends.weekly
      : this.currentStats.trends.monthly;

    if (trendData.length === 0) {
      this.clearChart();
      return;
    }

    const ctx = this.trendChart.getContext('2d');
    if (!ctx) return;

    // Get canvas dimensions
    const rect = this.trendChart.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.trendChart.width = rect.width * dpr;
    this.trendChart.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Find max value for scaling
    const maxValue = Math.max(...trendData.map(d => Math.max(d.dismissals, d.additions))) || 1;
    const yScale = chartHeight / (maxValue * 1.1);
    const xStep = chartWidth / (trendData.length - 1 || 1);

    // Draw grid lines
    ctx.strokeStyle = CHART_COLORS.grid;
    ctx.lineWidth = 1;
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + (chartHeight * i) / gridLines;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      // Y-axis labels
      const value = Math.round(maxValue * (1 - i / gridLines));
      ctx.fillStyle = CHART_COLORS.text;
      ctx.font = '11px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(value.toString(), padding.left - 8, y + 4);
    }

    // Draw dismissals line (red)
    this.drawLine(ctx, trendData, 'dismissals', CHART_COLORS.dismissals, {
      padding, xStep, yScale, chartHeight,
    });

    // Draw additions line (green)
    this.drawLine(ctx, trendData, 'additions', CHART_COLORS.additions, {
      padding, xStep, yScale, chartHeight,
    });

    // Draw X-axis labels
    ctx.fillStyle = CHART_COLORS.text;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    trendData.forEach((point, i) => {
      if (trendData.length <= 12 || i % Math.ceil(trendData.length / 12) === 0) {
        const x = padding.left + i * xStep;
        ctx.fillText(this.formatPeriodLabel(point.period), x, height - padding.bottom + 20);
      }
    });

    // Draw legend
    this.drawLegend(ctx, width, padding.top);
  }

  /**
   * Draw a line on the chart
   */
  private drawLine(
    ctx: CanvasRenderingContext2D,
    data: TrendPoint[],
    key: 'dismissals' | 'additions',
    color: string,
    opts: { padding: { top: number; left: number }; xStep: number; yScale: number; chartHeight: number },
  ): void {
    const { padding, xStep, yScale, chartHeight } = opts;

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();

    data.forEach((point, i) => {
      const x = padding.left + i * xStep;
      const y = padding.top + chartHeight - point[key] * yScale;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw points
    ctx.fillStyle = color;
    data.forEach((point, i) => {
      const x = padding.left + i * xStep;
      const y = padding.top + chartHeight - point[key] * yScale;

      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  /**
   * Draw chart legend
   */
  private drawLegend(ctx: CanvasRenderingContext2D, width: number, top: number): void {
    const legendX = width - 150;
    const legendY = top;

    ctx.font = '11px sans-serif';

    // Dismissals legend
    ctx.fillStyle = CHART_COLORS.dismissals;
    ctx.fillRect(legendX, legendY, 12, 12);
    ctx.fillStyle = CHART_COLORS.text;
    ctx.textAlign = 'left';
    ctx.fillText(this.t('accuracy.summary.falsePositives', 'False Positives'), legendX + 16, legendY + 10);

    // Additions legend
    ctx.fillStyle = CHART_COLORS.additions;
    ctx.fillRect(legendX, legendY + 18, 12, 12);
    ctx.fillStyle = CHART_COLORS.text;
    ctx.fillText(this.t('accuracy.summary.falseNegatives', 'False Negatives'), legendX + 16, legendY + 28);
  }

  /**
   * Format period label for display
   */
  private formatPeriodLabel(period: string): string {
    // Weekly: "2025-W01" -> "W01"
    if (period.includes('-W')) {
      return period.split('-W')[1] ? `W${period.split('-W')[1]}` : period;
    }
    // Monthly: "2025-01" -> "Jan"
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const parts = period.split('-');
    if (parts.length === 2 && parts[1]) {
      const monthIdx = parseInt(parts[1], 10) - 1;
      return months[monthIdx] ?? period;
    }
    return period;
  }

  /**
   * Clear the chart canvas
   */
  private clearChart(): void {
    if (!this.trendChart) return;

    const ctx = this.trendChart.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, this.trendChart.width, this.trendChart.height);
    }
  }

  /**
   * Handle export button click
   */
  private async handleExport(): Promise<void> {
    try {
      const result = await window.accuracyAPI.exportCsv();

      if (result.success) {
        this.showNotification(this.t('accuracy.export.success', 'Report exported successfully'), 'success');
        dashboardLog.info?.('Exported accuracy report to:', result.filePath);
      } else if (result.error === 'cancelled') {
        this.showNotification(this.t('accuracy.export.cancelled', 'Export cancelled'), 'info');
      } else {
        this.showNotification(this.t('accuracy.export.error', 'Export failed'), 'error');
        dashboardLog.error?.('Export failed:', result.error);
      }
    } catch (error) {
      this.showNotification(this.t('accuracy.export.error', 'Export failed'), 'error');
      dashboardLog.error?.('Export error:', error);
    }
  }

  /**
   * Show a notification toast
   */
  private showNotification(message: string, type: 'success' | 'error' | 'info'): void {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg text-white z-50 transition-opacity duration-300 ${
      type === 'success' ? 'bg-green-600' :
      type === 'error' ? 'bg-red-600' : 'bg-blue-600'
    }`;
    toast.textContent = message;

    document.body.appendChild(toast);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  /**
   * Escape HTML to prevent XSS
   */
  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

/**
 * Singleton instance
 */
let dashboardInstance: AccuracyDashboardUI | null = null;

/**
 * Get or create the AccuracyDashboardUI singleton
 */
export function getAccuracyDashboardUI(): AccuracyDashboardUI {
  if (!dashboardInstance) {
    dashboardInstance = new AccuracyDashboardUI();
  }
  return dashboardInstance;
}

/**
 * Initialize and return the dashboard UI
 * Call this from renderer.js
 */
export function initAccuracyDashboard(modalId = 'accuracy-dashboard-modal'): AccuracyDashboardUI {
  const dashboard = getAccuracyDashboardUI();
  dashboard.initialize(modalId);
  return dashboard;
}
