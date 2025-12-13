/**
 * Accuracy Dashboard UI (Epic 5, Story 5.3)
 *
 * Separate module for accuracy dashboard functionality.
 * Single concern: Dashboard UI rendering and interaction handling.
 *
 * Usage: Include via <script type="module"> and call initAccuracyDashboard()
 */

// Chart colors
const CHART_COLORS = {
  dismissals: '#ef4444', // red-500
  additions: '#22c55e',  // green-500
  grid: '#e5e7eb',       // gray-200
  text: '#6b7280',       // gray-500
  axis: '#374151',       // gray-700
};

// Module state
let dashboardModal = null;
let currentStats = null;
let currentTrendView = 'weekly';
let isLoading = false;

// Logger
const dashboardLog = window.log?.scope?.('accuracy-dashboard') ?? console;

/**
 * Translation helper with fallback
 */
function t(key, fallback) {
  return window.i18n?.t?.(key, fallback) ?? fallback;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Initialize the accuracy dashboard
 * Called from renderer.js on DOMContentLoaded
 */
export function initAccuracyDashboard(modalId = 'accuracy-dashboard-modal') {
  dashboardModal = document.getElementById(modalId);
  if (!dashboardModal) {
    dashboardLog.warn?.('Accuracy dashboard modal not found:', modalId);
    return;
  }

  attachEventListeners();
  dashboardLog.info?.('AccuracyDashboard initialized');
}

/**
 * Attach event listeners
 */
function attachEventListeners() {
  if (!dashboardModal) return;

  // Close button
  const closeBtn = dashboardModal.querySelector('#accuracy-close-btn');
  closeBtn?.addEventListener('click', closeAccuracyDashboard);

  // Backdrop click to close
  dashboardModal.addEventListener('click', (e) => {
    if (e.target === dashboardModal) {
      closeAccuracyDashboard();
    }
  });

  // Export button
  const exportBtn = dashboardModal.querySelector('#accuracy-export-btn');
  exportBtn?.addEventListener('click', handleExport);

  // Refresh button
  const refreshBtn = dashboardModal.querySelector('#accuracy-refresh-btn');
  refreshBtn?.addEventListener('click', loadAccuracyStats);

  // Trend toggle buttons
  dashboardModal.querySelectorAll('[data-trend-view]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const view = e.currentTarget.dataset.trendView;
      setTrendView(view);
    });
  });

  // Keyboard escape to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isAccuracyDashboardOpen()) {
      closeAccuracyDashboard();
    }
  });

  // Open button (in entity review header)
  const openBtn = document.getElementById('accuracy-dashboard-btn');
  openBtn?.addEventListener('click', openAccuracyDashboard);
}

/**
 * Check if dashboard is open
 */
export function isAccuracyDashboardOpen() {
  return dashboardModal?.classList.contains('flex') ?? false;
}

/**
 * Open the dashboard modal and load data
 */
export async function openAccuracyDashboard() {
  if (!dashboardModal) return;

  dashboardModal.classList.remove('hidden');
  dashboardModal.classList.add('flex');
  document.body.classList.add('overflow-hidden');

  await loadAccuracyStats();
  dashboardLog.info?.('Accuracy dashboard opened');
}

/**
 * Close the dashboard modal
 */
export function closeAccuracyDashboard() {
  if (!dashboardModal) return;

  dashboardModal.classList.add('hidden');
  dashboardModal.classList.remove('flex');
  document.body.classList.remove('overflow-hidden');
  dashboardLog.info?.('Accuracy dashboard closed');
}

/**
 * Load statistics from backend
 */
async function loadAccuracyStats() {
  if (isLoading) return;

  isLoading = true;
  showLoading();

  try {
    const stats = await window.accuracyAPI.getStats();
    currentStats = stats;
    renderDashboard();
    dashboardLog.info?.('Accuracy stats loaded', stats.summary);
  } catch (error) {
    dashboardLog.error?.('Failed to load accuracy stats:', error);
    showError(t('accuracy.noData', 'No correction data available yet'));
  } finally {
    isLoading = false;
  }
}

/**
 * Show loading state
 */
function showLoading() {
  const summaryPanel = dashboardModal?.querySelector('#accuracy-summary');
  if (summaryPanel) {
    summaryPanel.innerHTML = `
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
function showError(message) {
  const summaryPanel = dashboardModal?.querySelector('#accuracy-summary');
  if (summaryPanel) {
    summaryPanel.innerHTML = `
      <div class="text-center py-8 text-gray-500">
        <svg class="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p class="text-lg font-medium">${escapeHtml(message)}</p>
        <p class="mt-2 text-sm">${escapeHtml(t('accuracy.noDataHint', 'Process documents and make corrections to see accuracy metrics'))}</p>
      </div>
    `;
  }

  const breakdownTable = dashboardModal?.querySelector('#accuracy-breakdown-table');
  if (breakdownTable) {
    breakdownTable.innerHTML = '';
  }

  clearChart();
}

/**
 * Render all dashboard components
 */
function renderDashboard() {
  if (!currentStats) return;

  renderSummary(currentStats.summary);
  renderBreakdownTable(currentStats.byEntityType);
  renderTrendChart();
}

/**
 * Render summary statistics cards
 */
function renderSummary(summary) {
  const summaryPanel = dashboardModal?.querySelector('#accuracy-summary');
  if (!summaryPanel) return;

  summaryPanel.innerHTML = `
    <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
      ${renderStatCard(
        t('accuracy.summary.documentsProcessed', 'Documents Processed'),
        summary.documentsProcessed.toString(),
        'document'
      )}
      ${renderStatCard(
        t('accuracy.summary.totalCorrections', 'Total Corrections'),
        summary.totalCorrections.toString(),
        'edit'
      )}
      ${renderStatCard(
        t('accuracy.summary.falsePositives', 'False Positives'),
        summary.dismissals.toString(),
        'dismiss',
        'text-red-600'
      )}
      ${renderStatCard(
        t('accuracy.summary.falseNegatives', 'False Negatives'),
        summary.manualAdditions.toString(),
        'add',
        'text-green-600'
      )}
      ${renderStatCard(
        t('accuracy.summary.fpRate', 'FP Rate'),
        `${(summary.falsePositiveRate * 100).toFixed(1)}%`,
        'percent',
        summary.falsePositiveRate > 0.2 ? 'text-red-600' : 'text-gray-700'
      )}
      ${renderStatCard(
        t('accuracy.summary.fnRate', 'FN Rate'),
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
function renderStatCard(label, value, icon, valueClass = 'text-gray-900') {
  const iconSvg = getStatIcon(icon);

  return `
    <div class="bg-gray-50 rounded-lg p-4">
      <div class="flex items-center gap-2 text-gray-500 text-sm mb-1">
        ${iconSvg}
        <span>${escapeHtml(label)}</span>
      </div>
      <div class="text-2xl font-bold ${valueClass}">${escapeHtml(value)}</div>
    </div>
  `;
}

/**
 * Get icon SVG for stat card
 */
function getStatIcon(type) {
  const icons = {
    document: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>',
    edit: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>',
    dismiss: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>',
    add: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>',
    percent: '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>',
  };
  return icons[type] || icons.document;
}

/**
 * Render entity type breakdown table
 */
function renderBreakdownTable(byEntityType) {
  const breakdownTable = dashboardModal?.querySelector('#accuracy-breakdown-table');
  if (!breakdownTable) return;

  if (!byEntityType || byEntityType.length === 0) {
    breakdownTable.innerHTML = `
      <p class="text-gray-500 text-center py-4">${escapeHtml(t('accuracy.noData', 'No data available'))}</p>
    `;
    return;
  }

  // Sort by total corrections descending
  const sorted = [...byEntityType].sort((a, b) => b.total - a.total);

  breakdownTable.innerHTML = `
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-gray-200">
          <th class="text-left py-2 px-3 font-medium text-gray-600">${escapeHtml(t('accuracy.entityBreakdown.entityType', 'Entity Type'))}</th>
          <th class="text-right py-2 px-3 font-medium text-gray-600">${escapeHtml(t('accuracy.entityBreakdown.dismissals', 'Dismissals'))}</th>
          <th class="text-right py-2 px-3 font-medium text-gray-600">${escapeHtml(t('accuracy.entityBreakdown.additions', 'Additions'))}</th>
          <th class="text-right py-2 px-3 font-medium text-gray-600">${escapeHtml(t('accuracy.entityBreakdown.total', 'Total'))}</th>
        </tr>
      </thead>
      <tbody>
        ${sorted.map(row => `
          <tr class="border-b border-gray-100 hover:bg-gray-50">
            <td class="py-2 px-3 font-medium">${escapeHtml(formatEntityType(row.entityType))}</td>
            <td class="py-2 px-3 text-right text-red-600">${Number(row.dismissals) || 0}</td>
            <td class="py-2 px-3 text-right text-green-600">${Number(row.additions) || 0}</td>
            <td class="py-2 px-3 text-right font-medium">${Number(row.total) || 0}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

/**
 * Format entity type for display
 */
function formatEntityType(type) {
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
function setTrendView(view) {
  currentTrendView = view;

  // Update toggle buttons
  dashboardModal?.querySelectorAll('[data-trend-view]').forEach(btn => {
    const btnView = btn.dataset.trendView;
    btn.classList.toggle('bg-indigo-600', btnView === view);
    btn.classList.toggle('text-white', btnView === view);
    btn.classList.toggle('bg-gray-200', btnView !== view);
    btn.classList.toggle('text-gray-700', btnView !== view);
  });

  renderTrendChart();
}

/**
 * Render trend chart on canvas
 */
function renderTrendChart() {
  const trendChart = dashboardModal?.querySelector('#accuracy-trend-chart');
  if (!trendChart || !currentStats) return;

  const trendData = currentTrendView === 'weekly'
    ? currentStats.trends.weekly
    : currentStats.trends.monthly;

  if (!trendData || trendData.length === 0) {
    clearChart();
    return;
  }

  const ctx = trendChart.getContext('2d');
  if (!ctx) return;

  // Get canvas dimensions
  const rect = trendChart.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  trendChart.width = rect.width * dpr;
  trendChart.height = rect.height * dpr;
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
  drawLine(ctx, trendData, 'dismissals', CHART_COLORS.dismissals, {
    padding, xStep, yScale, chartHeight,
  });

  // Draw additions line (green)
  drawLine(ctx, trendData, 'additions', CHART_COLORS.additions, {
    padding, xStep, yScale, chartHeight,
  });

  // Draw X-axis labels
  ctx.fillStyle = CHART_COLORS.text;
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  trendData.forEach((point, i) => {
    if (trendData.length <= 12 || i % Math.ceil(trendData.length / 12) === 0) {
      const x = padding.left + i * xStep;
      ctx.fillText(formatPeriodLabel(point.period), x, height - padding.bottom + 20);
    }
  });

  // Draw legend
  drawLegend(ctx, width, padding.top);
}

/**
 * Draw a line on the chart
 */
function drawLine(ctx, data, key, color, opts) {
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
function drawLegend(ctx, width, top) {
  const legendX = width - 150;
  const legendY = top;

  ctx.font = '11px sans-serif';

  // Dismissals legend
  ctx.fillStyle = CHART_COLORS.dismissals;
  ctx.fillRect(legendX, legendY, 12, 12);
  ctx.fillStyle = CHART_COLORS.text;
  ctx.textAlign = 'left';
  ctx.fillText(t('accuracy.summary.falsePositives', 'False Positives'), legendX + 16, legendY + 10);

  // Additions legend
  ctx.fillStyle = CHART_COLORS.additions;
  ctx.fillRect(legendX, legendY + 18, 12, 12);
  ctx.fillStyle = CHART_COLORS.text;
  ctx.fillText(t('accuracy.summary.falseNegatives', 'False Negatives'), legendX + 16, legendY + 28);
}

/**
 * Format period label for display
 */
function formatPeriodLabel(period) {
  // Weekly: "2025-W01" -> "W01"
  if (period.includes('-W')) {
    const weekPart = period.split('-W')[1];
    return weekPart ? `W${weekPart}` : period;
  }
  // Monthly: "2025-01" -> "Jan"
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const parts = period.split('-');
  if (parts.length === 2) {
    const monthIdx = parseInt(parts[1], 10) - 1;
    return months[monthIdx] || period;
  }
  return period;
}

/**
 * Clear the chart canvas
 */
function clearChart() {
  const trendChart = dashboardModal?.querySelector('#accuracy-trend-chart');
  if (!trendChart) return;

  const ctx = trendChart.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, trendChart.width, trendChart.height);
  }
}

/**
 * Handle export button click
 */
async function handleExport() {
  try {
    const result = await window.accuracyAPI.exportCsv();

    if (result.success) {
      showNotification(t('accuracy.export.success', 'Report exported successfully'), 'success');
      dashboardLog.info?.('Exported accuracy report to:', result.filePath);
    } else if (result.error === 'cancelled') {
      showNotification(t('accuracy.export.cancelled', 'Export cancelled'), 'info');
    } else {
      showNotification(t('accuracy.export.error', 'Export failed'), 'error');
      dashboardLog.error?.('Export failed:', result.error);
    }
  } catch (error) {
    showNotification(t('accuracy.export.error', 'Export failed'), 'error');
    dashboardLog.error?.('Export error:', error);
  }
}

/**
 * Show a notification toast
 */
function showNotification(message, type) {
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

// Export functions for use in renderer.js
export {
  openAccuracyDashboard,
  closeAccuracyDashboard,
  isAccuracyDashboardOpen,
};
