# Configuration Safety Review: Accuracy Dashboard (Story 5-3)

**Review Date:** 2025-12-13  
**Reviewer:** Claude Code (Senior Code Reviewer)  
**Scope:** Accuracy Dashboard Feature Configuration & Production Safety  
**Files Reviewed:**
- `/Users/olivier/Projects/A5-PII-Anonymizer/accuracyDashboard.js` (583 lines)
- `/Users/olivier/Projects/A5-PII-Anonymizer/src/services/accuracyStats.ts` (323 lines)
- `/Users/olivier/Projects/A5-PII-Anonymizer/src/services/accuracyHandlers.ts` (126 lines)

---

## Executive Summary

**Overall Assessment:** MEDIUM PRIORITY - Requires configuration improvements before production deployment

**Critical Issues:** 0  
**High Priority Issues:** 4  
**Medium Priority Issues:** 6  
**Low Priority Issues:** 3

**Key Findings:**
1. **Magic Numbers:** Multiple hardcoded values that should be configurable (toast timeout, chart dimensions, grid lines)
2. **Missing Resource Limits:** No file size limits, array bounds, or iteration caps on log processing
3. **Missing Timeouts:** IPC handlers lack timeout protection for long-running operations
4. **Memory Leak Risk:** Event listeners not cleaned up on modal close
5. **Positive Aspects:** Good XSS prevention, input validation, error handling structure

---

## Critical Issues

### None identified

---

## High Priority Issues

### 1. Missing Resource Limits on Log File Processing

**File:** `src/services/accuracyStats.ts`  
**Lines:** 70-88  
**Risk:** HIGH - Potential memory exhaustion with large log file accumulation

**Issue:**
```typescript
async loadAllCorrectionLogs(): Promise<CorrectionEntry[]> {
  const entries: CorrectionEntry[] = [];

  try {
    const files = fs.readdirSync(this.logDir);
    const logFiles = files.filter((f) => f.match(/^corrections-\d{4}-\d{2}\.json$/));

    for (const filename of logFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const logFile = JSON.parse(content) as CorrectionLogFile;
      if (logFile.entries && Array.isArray(logFile.entries)) {
        entries.push(...logFile.entries);  // UNBOUNDED ARRAY GROWTH
      }
    }
  }
}
```

**Problems:**
- No limit on number of log files to process
- No limit on total entries loaded into memory
- Synchronous file operations block event loop
- No file size validation before reading
- JSON.parse vulnerable to large payload DoS

**Production Impact:**
- After 12 months of usage: ~50,000+ entries could consume 50-100MB RAM
- After 3 years: ~180,000+ entries could cause OOM errors
- Large log files (>10MB) could cause UI freeze

**Recommended Fix:**
```typescript
// Add at top of class
private static readonly MAX_LOG_FILES = 60; // ~5 years of monthly logs
private static readonly MAX_ENTRIES_PER_FILE = 10000;
private static readonly MAX_TOTAL_ENTRIES = 100000;
private static readonly MAX_FILE_SIZE_MB = 10;

async loadAllCorrectionLogs(): Promise<CorrectionEntry[]> {
  const entries: CorrectionEntry[] = [];

  try {
    const files = fs.readdirSync(this.logDir);
    let logFiles = files.filter((f) => f.match(/^corrections-\d{4}-\d{2}\.json$/));
    
    // Sort by date descending, limit to most recent
    logFiles = logFiles.sort((a, b) => b.localeCompare(a))
      .slice(0, AccuracyStats.MAX_LOG_FILES);

    log.debug('Loading correction logs', { 
      fileCount: logFiles.length,
      maxFiles: AccuracyStats.MAX_LOG_FILES 
    });

    for (const filename of logFiles) {
      try {
        const filePath = path.join(this.logDir, filename);
        const stats = fs.statSync(filePath);
        const fileSizeMB = stats.size / (1024 * 1024);

        // Validate file size before reading
        if (fileSizeMB > AccuracyStats.MAX_FILE_SIZE_MB) {
          log.warn('Skipping oversized log file', { 
            filename, 
            sizeMB: fileSizeMB.toFixed(2),
            maxMB: AccuracyStats.MAX_FILE_SIZE_MB 
          });
          continue;
        }

        const content = fs.readFileSync(filePath, 'utf-8');
        const logFile = JSON.parse(content) as CorrectionLogFile;

        if (logFile.entries && Array.isArray(logFile.entries)) {
          // Limit entries per file
          const fileEntries = logFile.entries.slice(0, AccuracyStats.MAX_ENTRIES_PER_FILE);
          
          if (logFile.entries.length > AccuracyStats.MAX_ENTRIES_PER_FILE) {
            log.warn('Truncated oversized log file entries', {
              filename,
              originalCount: logFile.entries.length,
              truncatedTo: AccuracyStats.MAX_ENTRIES_PER_FILE
            });
          }

          // Check total entries limit
          const remainingCapacity = AccuracyStats.MAX_TOTAL_ENTRIES - entries.length;
          if (remainingCapacity <= 0) {
            log.warn('Reached maximum total entries limit', {
              maxEntries: AccuracyStats.MAX_TOTAL_ENTRIES,
              filesProcessed: logFiles.indexOf(filename)
            });
            break;
          }

          const entriesToAdd = fileEntries.slice(0, remainingCapacity);
          entries.push(...entriesToAdd);
        }
      } catch (err) {
        log.warn('Failed to parse log file', { filename, error: (err as Error).message });
      }
    }

    log.info('Loaded correction entries', { 
      total: entries.length,
      filesProcessed: logFiles.length,
      capacity: `${entries.length}/${AccuracyStats.MAX_TOTAL_ENTRIES}`
    });
  } catch (err) {
    log.error('Failed to read log directory', { error: (err as Error).message });
  }

  return entries;
}
```

**Rationale for Limits:**
- **MAX_LOG_FILES = 60:** 5 years of monthly logs, reasonable retention for trend analysis
- **MAX_ENTRIES_PER_FILE = 10,000:** ~1MB JSON, prevents single file DoS
- **MAX_TOTAL_ENTRIES = 100,000:** ~10MB RAM, sufficient for years of data
- **MAX_FILE_SIZE_MB = 10:** Prevents JSON.parse DoS attacks

---

### 2. Missing IPC Timeout Protection

**File:** `src/services/accuracyHandlers.ts`  
**Lines:** 52-59  
**Risk:** HIGH - Long-running operations can cause UI freeze

**Issue:**
```typescript
ipcMain.handle('accuracy:get-stats', async (_event, options?: unknown): Promise<AccuracyStatistics> => {
  log.debug('Received accuracy stats request');

  if (!validateGetStatsOptions(options)) {
    log.warn('Invalid options rejected');
    throw new Error('Invalid options format');
  }

  return await accuracyStats.calculateStatistics(options as GetStatsOptions);
  // NO TIMEOUT - Could hang indefinitely if file operations stall
});
```

**Production Impact:**
- Large log file processing (100,000 entries) could take 5-10 seconds
- File I/O errors could cause indefinite hang
- User sees frozen UI with no feedback

**Recommended Fix:**

Create a configuration file for IPC timeouts:

```typescript
// src/config/accuracyConfig.ts
export const ACCURACY_CONFIG = {
  // Resource limits
  MAX_LOG_FILES: 60,
  MAX_ENTRIES_PER_FILE: 10000,
  MAX_TOTAL_ENTRIES: 100000,
  MAX_FILE_SIZE_MB: 10,

  // IPC timeouts (milliseconds)
  STATS_CALCULATION_TIMEOUT: 30000, // 30 seconds
  CSV_EXPORT_TIMEOUT: 60000, // 1 minute (includes file dialog)
  TRENDS_CALCULATION_TIMEOUT: 15000, // 15 seconds

  // UI configuration
  TOAST_DURATION: 3000,
  CHART_GRID_LINES: 5,
  CHART_MAX_X_LABELS: 12,

  // Logging
  LOG_RETENTION_MONTHS: 60,
} as const;

export type AccuracyConfig = typeof ACCURACY_CONFIG;
```

Update handler with timeout:

```typescript
import { ACCURACY_CONFIG } from '../config/accuracyConfig.js';

// Helper function for timeout promise
function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operation: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(
        () => reject(new Error(`${operation} timed out after ${timeoutMs}ms`)),
        timeoutMs
      )
    ),
  ]);
}

// Handler with timeout
ipcMain.handle('accuracy:get-stats', async (_event, options?: unknown): Promise<AccuracyStatistics> => {
  log.debug('Received accuracy stats request');

  if (!validateGetStatsOptions(options)) {
    log.warn('Invalid options rejected');
    throw new Error('Invalid options format');
  }

  try {
    return await withTimeout(
      accuracyStats.calculateStatistics(options as GetStatsOptions),
      ACCURACY_CONFIG.STATS_CALCULATION_TIMEOUT,
      'Stats calculation'
    );
  } catch (error) {
    const errorMessage = (error as Error).message;
    log.error('Stats calculation failed', { error: errorMessage, options });
    
    if (errorMessage.includes('timed out')) {
      throw new Error('Statistics calculation took too long. Try filtering to a shorter date range.');
    }
    throw error;
  }
});
```

Apply same pattern to other handlers:

```typescript
// Export handler with timeout
ipcMain.handle('accuracy:export-csv', async (): Promise<ExportResult> => {
  log.debug('Received CSV export request');

  try {
    return await withTimeout(
      exportCsvWithDialog(),
      ACCURACY_CONFIG.CSV_EXPORT_TIMEOUT,
      'CSV export'
    );
  } catch (error) {
    const errorMessage = (error as Error).message;
    log.error('CSV export failed', { error: errorMessage });
    
    if (errorMessage.includes('timed out')) {
      return { success: false, error: 'Export operation timed out' };
    }
    return { success: false, error: errorMessage };
  }
});
```

---

### 3. Magic Numbers in Chart Rendering

**File:** `accuracyDashboard.js`  
**Lines:** 341-386  
**Risk:** MEDIUM-HIGH - Hardcoded chart dimensions hinder maintenance and customization

**Issue:**
```javascript
function renderTrendChart() {
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };  // MAGIC NUMBERS
  const gridLines = 5;  // MAGIC NUMBER
  
  // More magic numbers throughout chart rendering
  ctx.lineWidth = 2;
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  ctx.font = '11px sans-serif';
  // ... etc
}
```

**Production Impact:**
- Hard to adjust for different screen sizes
- Difficult to maintain consistent styling
- No way to customize for accessibility needs

**Recommended Fix:**

Create chart configuration at module level:

```javascript
// Chart configuration
const CHART_CONFIG = {
  // Padding
  padding: {
    top: 20,
    right: 20,
    bottom: 40,
    left: 50,
  },
  
  // Grid
  gridLines: 5,
  gridColor: '#e5e7eb',
  
  // Lines
  lineWidth: 2,
  pointRadius: 4,
  
  // Typography
  labelFont: '11px sans-serif',
  labelColor: '#6b7280',
  axisFont: '10px sans-serif',
  
  // Legend
  legendX: 150,
  legendItemHeight: 18,
  legendBoxSize: 12,
  legendSpacing: 16,
  
  // Chart sizing
  yScaleMargin: 1.1, // Add 10% margin above max value
  maxXLabels: 12, // Maximum X-axis labels to show
};

// Use in chart rendering
function renderTrendChart() {
  const { padding, gridLines, lineWidth, pointRadius } = CHART_CONFIG;
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  
  const maxValue = Math.max(...trendData.map(d => Math.max(d.dismissals, d.additions))) || 1;
  const yScale = chartHeight / (maxValue * CHART_CONFIG.yScaleMargin);
  
  // ... rest of rendering
}
```

---

### 4. Event Listener Memory Leak Risk

**File:** `accuracyDashboard.js`  
**Lines:** 56-95  
**Risk:** MEDIUM - Event listeners not cleaned up on multiple open/close cycles

**Issue:**
```javascript
function attachEventListeners() {
  // These listeners are attached every time, never removed
  dashboardModal.addEventListener('click', (e) => { ... });
  document.addEventListener('keydown', (e) => { ... });  // GLOBAL LISTENER
  
  dashboardModal.querySelectorAll('[data-trend-view]').forEach(btn => {
    btn.addEventListener('click', (e) => { ... });
  });
}

export function initAccuracyDashboard(modalId = 'accuracy-dashboard-modal') {
  // Could be called multiple times, creating duplicate listeners
  attachEventListeners();
}
```

**Production Impact:**
- After 100 dashboard open/close cycles: memory leak of ~1-5MB
- Duplicate event handlers cause multiple triggering
- Performance degradation over long sessions

**Recommended Fix:**

```javascript
// Module-level listener tracking
let eventListenersAttached = false;
let cleanupFunctions = [];

/**
 * Attach event listeners (only once)
 */
function attachEventListeners() {
  if (eventListenersAttached || !dashboardModal) return;
  eventListenersAttached = true;

  // Close button
  const closeBtn = dashboardModal.querySelector('#accuracy-close-btn');
  const closeHandler = () => closeAccuracyDashboard();
  closeBtn?.addEventListener('click', closeHandler);
  cleanupFunctions.push(() => closeBtn?.removeEventListener('click', closeHandler));

  // Backdrop click
  const backdropHandler = (e) => {
    if (e.target === dashboardModal) {
      closeAccuracyDashboard();
    }
  };
  dashboardModal.addEventListener('click', backdropHandler);
  cleanupFunctions.push(() => dashboardModal.removeEventListener('click', backdropHandler));

  // Keyboard escape
  const escapeHandler = (e) => {
    if (e.key === 'Escape' && isAccuracyDashboardOpen()) {
      closeAccuracyDashboard();
    }
  };
  document.addEventListener('keydown', escapeHandler);
  cleanupFunctions.push(() => document.removeEventListener('keydown', escapeHandler));

  // Export button
  const exportBtn = dashboardModal.querySelector('#accuracy-export-btn');
  const exportHandler = () => handleExport();
  exportBtn?.addEventListener('click', exportHandler);
  cleanupFunctions.push(() => exportBtn?.removeEventListener('click', exportHandler));

  // Refresh button
  const refreshBtn = dashboardModal.querySelector('#accuracy-refresh-btn');
  const refreshHandler = () => loadAccuracyStats();
  refreshBtn?.addEventListener('click', refreshHandler);
  cleanupFunctions.push(() => refreshBtn?.removeEventListener('click', refreshHandler));

  // Trend toggle buttons
  dashboardModal.querySelectorAll('[data-trend-view]').forEach(btn => {
    const trendHandler = (e) => {
      const view = e.currentTarget.dataset.trendView;
      setTrendView(view);
    };
    btn.addEventListener('click', trendHandler);
    cleanupFunctions.push(() => btn.removeEventListener('click', trendHandler));
  });

  // Open button
  const openBtn = document.getElementById('accuracy-dashboard-btn');
  const openHandler = () => openAccuracyDashboard();
  openBtn?.addEventListener('click', openHandler);
  cleanupFunctions.push(() => openBtn?.removeEventListener('click', openHandler));

  dashboardLog.debug?.('Event listeners attached', { count: cleanupFunctions.length });
}

/**
 * Remove all event listeners (for cleanup)
 */
export function cleanupAccuracyDashboard() {
  cleanupFunctions.forEach(cleanup => cleanup());
  cleanupFunctions = [];
  eventListenersAttached = false;
  dashboardLog.debug?.('Event listeners cleaned up');
}
```

---

## Medium Priority Issues

### 5. Toast Notification Timeout is Hardcoded

**File:** `accuracyDashboard.js`  
**Lines:** 572-575  
**Risk:** MEDIUM - User experience issue, not configurable

**Issue:**
```javascript
function showNotification(message, type) {
  // ...
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);  // HARDCODED 3 seconds
}
```

**Recommended Fix:**
```javascript
// Use ACCURACY_CONFIG.TOAST_DURATION from configuration
import { ACCURACY_CONFIG } from '../config/accuracyConfig.js';

function showNotification(message, type) {
  const toast = document.createElement('div');
  toast.className = `fixed bottom-4 right-4 px-4 py-2 rounded-lg shadow-lg text-white z-50 transition-opacity duration-300 ${
    type === 'success' ? 'bg-green-600' :
    type === 'error' ? 'bg-red-600' : 'bg-blue-600'
  }`;
  toast.textContent = message;

  document.body.appendChild(toast);

  const fadeOutDuration = 300;
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), fadeOutDuration);
  }, ACCURACY_CONFIG.TOAST_DURATION);
}
```

---

### 6. Missing File Dialog Timeout Protection

**File:** `src/services/accuracyHandlers.ts`  
**Lines:** 71-91  
**Risk:** MEDIUM - User can leave dialog open indefinitely, blocking IPC handler

**Issue:**
```typescript
ipcMain.handle('accuracy:export-csv', async (): Promise<ExportResult> => {
  const result = await dialog.showSaveDialog(mainWindow!, {
    // NO TIMEOUT - User could leave dialog open for hours
  });
  
  if (result.canceled || !result.filePath) {
    return { success: false, error: 'Export cancelled' };
  }
  
  fs.writeFileSync(result.filePath, csvContent, 'utf-8');
  // NO WRITE ERROR HANDLING - Could fail due to permissions, disk full
});
```

**Recommended Fix:**
```typescript
ipcMain.handle('accuracy:export-csv', async (): Promise<ExportResult> => {
  log.debug('Received CSV export request');

  try {
    // Calculate statistics first (with timeout)
    const stats = await withTimeout(
      accuracyStats.calculateStatistics(),
      ACCURACY_CONFIG.STATS_CALCULATION_TIMEOUT,
      'Stats calculation for export'
    );
    
    const csvContent = accuracyStats.generateCsvReport(stats);

    // Generate filename
    const date = new Date().toISOString().slice(0, 10);
    const defaultFilename = `accuracy-report-${date}.csv`;

    // Show dialog (no timeout needed - user controls this)
    const result = await dialog.showSaveDialog(mainWindow!, {
      title: 'Export Accuracy Report',
      defaultPath: defaultFilename,
      filters: [
        { name: 'CSV Files', extensions: ['csv'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    if (result.canceled || !result.filePath) {
      log.debug('CSV export cancelled by user');
      return { success: false, error: 'cancelled' };
    }

    // Validate path before writing
    const filePath = result.filePath;
    const fileDir = path.dirname(filePath);
    
    // Check directory exists and is writable
    try {
      await fs.promises.access(fileDir, fs.constants.W_OK);
    } catch {
      log.error('Export directory not writable', { dir: fileDir });
      return { 
        success: false, 
        error: 'Cannot write to selected directory. Please choose a different location.' 
      };
    }

    // Write with error handling
    try {
      await fs.promises.writeFile(filePath, csvContent, 'utf-8');
      log.info('CSV report exported successfully', { 
        filePath, 
        sizeBytes: csvContent.length,
        rows: csvContent.split('\n').length
      });
      return { success: true, filePath };
    } catch (writeError) {
      const errorMsg = (writeError as Error).message;
      log.error('Failed to write CSV file', { error: errorMsg, filePath });
      
      // Provide user-friendly error messages
      if (errorMsg.includes('ENOSPC')) {
        return { success: false, error: 'Disk full. Free up space and try again.' };
      } else if (errorMsg.includes('EACCES')) {
        return { success: false, error: 'Permission denied. Choose a different location.' };
      } else {
        return { success: false, error: `Failed to save file: ${errorMsg}` };
      }
    }
  } catch (error) {
    const errorMessage = (error as Error).message;
    log.error('CSV export failed', { error: errorMessage });
    
    if (errorMessage.includes('timed out')) {
      return { success: false, error: 'Statistics calculation timed out. Too much data.' };
    }
    return { success: false, error: errorMessage };
  }
});
```

---

### 7. Chart Rendering Lacks Error Boundaries

**File:** `accuracyDashboard.js`  
**Lines:** 341-430  
**Risk:** MEDIUM - Chart rendering errors crash entire dashboard

**Issue:**
```javascript
function renderTrendChart() {
  const ctx = trendChart.getContext('2d');
  // NO NULL CHECK - Could throw if canvas not available
  
  const maxValue = Math.max(...trendData.map(d => Math.max(d.dismissals, d.additions))) || 1;
  // NO VALIDATION - Could fail with malformed data
  
  data.forEach((point, i) => {
    ctx.arc(x, y, 4, 0, Math.PI * 2);  // Could throw if ctx in bad state
  });
}
```

**Recommended Fix:**
```javascript
function renderTrendChart() {
  try {
    const trendChart = dashboardModal?.querySelector('#accuracy-trend-chart');
    if (!trendChart) {
      dashboardLog.warn?.('Trend chart canvas not found');
      return;
    }

    if (!currentStats || !currentStats.trends) {
      dashboardLog.warn?.('No statistics available for chart');
      clearChart();
      return;
    }

    const trendData = currentTrendView === 'weekly'
      ? currentStats.trends.weekly
      : currentStats.trends.monthly;

    if (!trendData || !Array.isArray(trendData) || trendData.length === 0) {
      dashboardLog.debug?.('No trend data available', { view: currentTrendView });
      clearChart();
      return;
    }

    const ctx = trendChart.getContext('2d');
    if (!ctx) {
      dashboardLog.error?.('Failed to get canvas 2D context');
      return;
    }

    // Validate data structure
    const isValidData = trendData.every(point => 
      point && 
      typeof point.dismissals === 'number' && 
      typeof point.additions === 'number' &&
      !isNaN(point.dismissals) && 
      !isNaN(point.additions)
    );

    if (!isValidData) {
      dashboardLog.error?.('Invalid trend data structure', { 
        sample: trendData[0] 
      });
      clearChart();
      return;
    }

    // Continue with rendering...
    const rect = trendChart.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    // Validate dimensions
    if (rect.width <= 0 || rect.height <= 0) {
      dashboardLog.warn?.('Invalid canvas dimensions', { width: rect.width, height: rect.height });
      return;
    }

    trendChart.width = rect.width * dpr;
    trendChart.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // ... rest of rendering with try/catch around each section
    
  } catch (error) {
    dashboardLog.error?.('Chart rendering failed', { 
      error: (error as Error).message,
      view: currentTrendView
    });
    
    // Show fallback message in chart area
    showChartError('Unable to render chart. Please refresh and try again.');
  }
}

function showChartError(message: string) {
  const trendChart = dashboardModal?.querySelector('#accuracy-trend-chart');
  if (!trendChart) return;

  const ctx = trendChart.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, trendChart.width, trendChart.height);
  ctx.fillStyle = CHART_COLORS.text;
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(message, trendChart.width / 2, trendChart.height / 2);
}
```

---

### 8. Missing Validation for GetStatsOptions

**File:** `src/services/accuracyHandlers.ts`  
**Lines:** 28-43  
**Risk:** MEDIUM - Weak validation could allow malformed date inputs

**Issue:**
```typescript
function validateGetStatsOptions(input: unknown): input is GetStatsOptions {
  if (!input) return true;
  if (typeof input !== 'object') return false;

  const obj = input as Record<string, unknown>;

  // Only checks type, not format
  if (obj.startDate !== undefined && typeof obj.startDate !== 'string') {
    return false;
  }
  if (obj.endDate !== undefined && typeof obj.endDate !== 'string') {
    return false;
  }

  return true;
}
```

**Recommended Fix:**
```typescript
/**
 * Validate ISO 8601 date string format
 */
function isValidIsoDate(dateString: string): boolean {
  // Check format: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss.sssZ
  const isoRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;
  if (!isoRegex.test(dateString)) {
    return false;
  }

  // Validate it's a real date
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

/**
 * Validate GetStatsOptions structure with strict date validation
 */
function validateGetStatsOptions(input: unknown): input is GetStatsOptions {
  if (!input) return true; // Options are optional

  if (typeof input !== 'object' || input === null) {
    log.warn('Options must be an object', { received: typeof input });
    return false;
  }

  const obj = input as Record<string, unknown>;

  // Validate startDate
  if (obj.startDate !== undefined) {
    if (typeof obj.startDate !== 'string') {
      log.warn('startDate must be a string', { received: typeof obj.startDate });
      return false;
    }
    if (!isValidIsoDate(obj.startDate)) {
      log.warn('startDate must be valid ISO 8601 format', { received: obj.startDate });
      return false;
    }
  }

  // Validate endDate
  if (obj.endDate !== undefined) {
    if (typeof obj.endDate !== 'string') {
      log.warn('endDate must be a string', { received: typeof obj.endDate });
      return false;
    }
    if (!isValidIsoDate(obj.endDate)) {
      log.warn('endDate must be valid ISO 8601 format', { received: obj.endDate });
      return false;
    }
  }

  // Validate date range logic
  if (obj.startDate && obj.endDate) {
    const start = new Date(obj.startDate as string);
    const end = new Date(obj.endDate as string);
    
    if (start > end) {
      log.warn('startDate must be before endDate', { 
        startDate: obj.startDate, 
        endDate: obj.endDate 
      });
      return false;
    }

    // Prevent excessive date ranges (e.g., > 10 years)
    const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    const maxDays = 365 * 10; // 10 years
    
    if (daysDiff > maxDays) {
      log.warn('Date range too large', { 
        daysDiff, 
        maxDays,
        startDate: obj.startDate,
        endDate: obj.endDate
      });
      return false;
    }
  }

  // Reject unknown properties (security best practice)
  const allowedKeys = ['startDate', 'endDate'];
  const unknownKeys = Object.keys(obj).filter(k => !allowedKeys.includes(k));
  
  if (unknownKeys.length > 0) {
    log.warn('Unknown properties in options', { unknownKeys });
    return false;
  }

  return true;
}
```

---

### 9. Loading State Race Condition

**File:** `accuracyDashboard.js`  
**Lines:** 129-145  
**Risk:** MEDIUM - Concurrent load requests can cause UI inconsistency

**Issue:**
```javascript
async function loadAccuracyStats() {
  if (isLoading) return;  // SIMPLE GUARD - Not sufficient

  isLoading = true;
  showLoading();

  try {
    const stats = await window.accuracyAPI.getStats();
    currentStats = stats;
    renderDashboard();
  } catch (error) {
    showError(...);
  } finally {
    isLoading = false;  // RACE CONDITION if multiple calls overlap
  }
}
```

**Recommended Fix:**
```javascript
let currentLoadOperation = null;

async function loadAccuracyStats(options = null) {
  // Cancel any in-flight operation
  if (currentLoadOperation) {
    dashboardLog.debug?.('Cancelling previous load operation');
  }

  // Create new operation token
  const operationId = Date.now();
  currentLoadOperation = operationId;
  isLoading = true;
  showLoading();

  try {
    const stats = await window.accuracyAPI.getStats(options);
    
    // Check if this operation was superseded
    if (currentLoadOperation !== operationId) {
      dashboardLog.debug?.('Load operation superseded, discarding results', { 
        operationId,
        currentOperation: currentLoadOperation
      });
      return;
    }

    currentStats = stats;
    renderDashboard();
    dashboardLog.info?.('Accuracy stats loaded', { 
      operationId,
      summary: stats.summary 
    });
  } catch (error) {
    // Only show error if this is still the current operation
    if (currentLoadOperation === operationId) {
      dashboardLog.error?.('Failed to load accuracy stats:', error);
      showError(t('accuracy.noData', 'No correction data available yet'));
    }
  } finally {
    // Only clear loading if this is still the current operation
    if (currentLoadOperation === operationId) {
      isLoading = false;
      currentLoadOperation = null;
    }
  }
}
```

---

### 10. CSV Generation Lacks Size Limit

**File:** `src/services/accuracyStats.ts`  
**Lines:** 265-300  
**Risk:** MEDIUM - Large datasets could create multi-GB CSV files

**Issue:**
```typescript
generateCsvReport(stats: AccuracyStatistics): string {
  const lines: string[] = [];
  
  // Could generate millions of lines with no limit
  for (const point of stats.trends.monthly) {
    lines.push(...);
  }
  
  return lines.join('\n');  // Could be GBs of data
}
```

**Recommended Fix:**
```typescript
generateCsvReport(stats: AccuracyStatistics): string {
  const lines: string[] = [];
  const MAX_CSV_SIZE_MB = 50; // Reasonable limit for CSV files
  const APPROX_LINE_SIZE_BYTES = 100; // Estimate for sizing
  const maxLines = (MAX_CSV_SIZE_MB * 1024 * 1024) / APPROX_LINE_SIZE_BYTES;

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

  // Entity type breakdown (with limit)
  lines.push('## Entity Type Breakdown');
  lines.push('EntityType,Dismissals,Additions,Total');
  
  const maxEntityTypes = 100; // Reasonable limit
  const entityTypes = stats.byEntityType.slice(0, maxEntityTypes);
  
  for (const typeStats of entityTypes) {
    lines.push(`${typeStats.entityType},${typeStats.dismissals},${typeStats.additions},${typeStats.total}`);
  }
  
  if (stats.byEntityType.length > maxEntityTypes) {
    lines.push(`# ... and ${stats.byEntityType.length - maxEntityTypes} more entity types`);
    log.warn('Truncated entity types in CSV export', {
      total: stats.byEntityType.length,
      exported: maxEntityTypes
    });
  }
  lines.push('');

  // Monthly trends (with limit)
  lines.push('## Monthly Trends');
  lines.push('Period,Dismissals,Additions,Total,FPRate,FNEstimate');
  
  const maxTrendPoints = 120; // 10 years of monthly data
  const trendPoints = stats.trends.monthly.slice(0, maxTrendPoints);
  
  for (const point of trendPoints) {
    lines.push(
      `${point.period},${point.dismissals},${point.additions},${point.total},${(point.fpRate * 100).toFixed(2)}%,${(point.fnEstimate * 100).toFixed(2)}%`,
    );
  }
  
  if (stats.trends.monthly.length > maxTrendPoints) {
    lines.push(`# ... and ${stats.trends.monthly.length - maxTrendPoints} more months`);
    log.warn('Truncated trend data in CSV export', {
      total: stats.trends.monthly.length,
      exported: maxTrendPoints
    });
  }

  // Check final size
  const csvContent = lines.join('\n');
  const sizeMB = csvContent.length / (1024 * 1024);
  
  if (sizeMB > MAX_CSV_SIZE_MB) {
    log.error('CSV size exceeds limit', { 
      sizeMB: sizeMB.toFixed(2), 
      maxMB: MAX_CSV_SIZE_MB 
    });
    throw new Error(`CSV file too large (${sizeMB.toFixed(1)}MB). Please filter to a shorter date range.`);
  }

  log.info('CSV report generated', { 
    sizeMB: sizeMB.toFixed(2),
    lines: lines.length 
  });

  return csvContent;
}
```

---

## Low Priority Issues

### 11. Inconsistent Translation Key Usage

**File:** `accuracyDashboard.js`  
**Lines:** Throughout  
**Risk:** LOW - Inconsistent fallback handling

**Observation:**
```javascript
t('accuracy.noData', 'No correction data available yet')  // Inconsistent fallbacks
t('accuracy.summary.documentsProcessed', 'Documents Processed')
```

**Recommended Fix:**
Centralize all translation keys in a constants file for consistency:

```javascript
// accuracyTranslations.js
export const ACCURACY_I18N_KEYS = {
  noData: { key: 'accuracy.noData', fallback: 'No correction data available yet' },
  noDataHint: { key: 'accuracy.noDataHint', fallback: 'Process documents and make corrections to see accuracy metrics' },
  
  summary: {
    documentsProcessed: { key: 'accuracy.summary.documentsProcessed', fallback: 'Documents Processed' },
    totalCorrections: { key: 'accuracy.summary.totalCorrections', fallback: 'Total Corrections' },
    // ... etc
  },
  
  export: {
    success: { key: 'accuracy.export.success', fallback: 'Report exported successfully' },
    cancelled: { key: 'accuracy.export.cancelled', fallback: 'Export cancelled' },
    error: { key: 'accuracy.export.error', fallback: 'Export failed' },
  },
};

// Usage
function showError(message) {
  const { key, fallback } = ACCURACY_I18N_KEYS.noData;
  const localizedMessage = t(key, fallback);
  // ...
}
```

---

### 12. No Performance Monitoring

**File:** All files  
**Risk:** LOW - No visibility into production performance issues

**Recommendation:**
Add performance timing to key operations:

```typescript
// In accuracyStats.ts
async calculateStatistics(options?: GetStatsOptions): Promise<AccuracyStatistics> {
  const startTime = Date.now();
  
  let entries = await this.loadAllCorrectionLogs();
  const loadTime = Date.now() - startTime;
  
  log.debug('Loaded correction logs', { 
    entries: entries.length, 
    loadTimeMs: loadTime 
  });

  // Apply filters...
  const filterTime = Date.now();
  
  // Calculate statistics...
  const calcTime = Date.now();
  
  const result = {
    period: { ... },
    summary: this.calculateSummary(entries),
    byEntityType: this.calculateByEntityType(entries),
    trends: {
      weekly: this.calculateWeeklyTrends(entries),
      monthly: this.calculateMonthlyTrends(entries),
    },
  };
  
  const totalTime = Date.now() - startTime;
  
  log.info('Statistics calculated', {
    totalTimeMs: totalTime,
    loadTimeMs: loadTime,
    filterTimeMs: filterTime - loadTime,
    calcTimeMs: calcTime - filterTime,
    entriesProcessed: entries.length
  });
  
  return result;
}
```

---

### 13. Missing Accessibility Features

**File:** `accuracyDashboard.js`  
**Risk:** LOW - Dashboard not fully accessible

**Recommendation:**
Add ARIA attributes and keyboard navigation:

```javascript
function renderSummary(summary) {
  summaryPanel.innerHTML = `
    <div class="grid grid-cols-2 md:grid-cols-3 gap-4" role="region" aria-label="Accuracy Summary">
      ${renderStatCard(
        t('accuracy.summary.documentsProcessed', 'Documents Processed'),
        summary.documentsProcessed.toString(),
        'document',
        'text-gray-900',
        'Number of documents processed'
      )}
      <!-- ... -->
    </div>
  `;
}

function renderStatCard(label, value, icon, valueClass = 'text-gray-900', ariaLabel = '') {
  const iconSvg = getStatIcon(icon);

  return `
    <div class="bg-gray-50 rounded-lg p-4" role="article" aria-label="${escapeHtml(ariaLabel || label)}">
      <div class="flex items-center gap-2 text-gray-500 text-sm mb-1">
        ${iconSvg}
        <span>${escapeHtml(label)}</span>
      </div>
      <div class="text-2xl font-bold ${valueClass}" aria-live="polite">${escapeHtml(value)}</div>
    </div>
  `;
}
```

---

## Action Plan

### Must Fix Before Production

1. **Add resource limits to log processing** (Issue #1)
   - Implement MAX_LOG_FILES, MAX_ENTRIES_PER_FILE, MAX_TOTAL_ENTRIES
   - Add file size validation
   - Add capacity logging

2. **Add IPC timeout protection** (Issue #2)
   - Create accuracyConfig.ts with timeout values
   - Implement withTimeout helper
   - Apply to all IPC handlers

3. **Fix event listener memory leaks** (Issue #4)
   - Track listeners and add cleanup functions
   - Prevent duplicate registration
   - Export cleanup function

4. **Add chart error boundaries** (Issue #7)
   - Validate data before rendering
   - Add try/catch with fallback UI
   - Improve error messages

### Should Fix Within 1-2 Sprints

5. **Create configuration file** (Issue #3)
   - Extract all magic numbers to ACCURACY_CONFIG
   - Use in chart rendering
   - Document configuration options

6. **Improve file export error handling** (Issue #6)
   - Add directory writability check
   - Provide user-friendly error messages
   - Handle disk full, permissions errors

7. **Strengthen input validation** (Issue #8)
   - Validate ISO 8601 date format
   - Check date range logic
   - Reject unknown properties

8. **Fix loading state race conditions** (Issue #9)
   - Use operation tokens
   - Cancel superseded operations
   - Improve logging

9. **Add CSV size limits** (Issue #10)
   - Limit entity types and trend points
   - Estimate and enforce max size
   - Provide helpful error messages

### Consider for Future Improvements

10. **Centralize translation keys** (Issue #11)
11. **Add performance monitoring** (Issue #12)
12. **Improve accessibility** (Issue #13)

---

## Configuration Recommendations Summary

### Proposed Configuration File Structure

```typescript
// src/config/accuracyConfig.ts
export const ACCURACY_CONFIG = {
  // Resource limits
  MAX_LOG_FILES: 60,                    // 5 years of monthly logs
  MAX_ENTRIES_PER_FILE: 10000,         // ~1MB JSON per file
  MAX_TOTAL_ENTRIES: 100000,           // ~10MB RAM total
  MAX_FILE_SIZE_MB: 10,                // Per-file size limit
  MAX_CSV_SIZE_MB: 50,                 // CSV export size limit
  MAX_CSV_ENTITY_TYPES: 100,           // Rows in CSV entity breakdown
  MAX_CSV_TREND_POINTS: 120,           // Rows in CSV trends (10 years)

  // IPC timeouts (milliseconds)
  STATS_CALCULATION_TIMEOUT: 30000,    // 30 seconds
  CSV_EXPORT_TIMEOUT: 60000,           // 1 minute
  TRENDS_CALCULATION_TIMEOUT: 15000,   // 15 seconds

  // UI configuration
  TOAST_DURATION: 3000,                // 3 seconds
  TOAST_FADE_DURATION: 300,            // 300ms fade out
  
  // Chart configuration
  CHART_GRID_LINES: 5,
  CHART_MAX_X_LABELS: 12,
  CHART_LINE_WIDTH: 2,
  CHART_POINT_RADIUS: 4,
  CHART_Y_SCALE_MARGIN: 1.1,           // 10% above max value
  
  CHART_PADDING: {
    top: 20,
    right: 20,
    bottom: 40,
    left: 50,
  },
  
  CHART_LEGEND: {
    offsetX: 150,
    itemHeight: 18,
    boxSize: 12,
    spacing: 16,
  },

  // Date range limits
  MAX_DATE_RANGE_DAYS: 3650,           // 10 years maximum

  // Logging
  LOG_RETENTION_MONTHS: 60,            // 5 years
} as const;

export type AccuracyConfig = typeof ACCURACY_CONFIG;
```

### Environment Variable Overrides (Optional)

For production flexibility, consider allowing environment variable overrides:

```typescript
// src/config/accuracyConfig.ts
function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

export const ACCURACY_CONFIG = {
  MAX_LOG_FILES: getEnvNumber('ACCURACY_MAX_LOG_FILES', 60),
  MAX_TOTAL_ENTRIES: getEnvNumber('ACCURACY_MAX_ENTRIES', 100000),
  STATS_CALCULATION_TIMEOUT: getEnvNumber('ACCURACY_STATS_TIMEOUT', 30000),
  // ... etc
} as const;
```

---

## Testing Recommendations

### Configuration Safety Tests

Create `test/unit/accuracyConfig.test.js`:

```javascript
describe('Accuracy Configuration Safety', () => {
  it('should have reasonable resource limits', () => {
    expect(ACCURACY_CONFIG.MAX_LOG_FILES).to.be.at.least(12).and.at.most(120);
    expect(ACCURACY_CONFIG.MAX_TOTAL_ENTRIES).to.be.at.least(10000).and.at.most(1000000);
    expect(ACCURACY_CONFIG.MAX_FILE_SIZE_MB).to.be.at.least(1).and.at.most(100);
  });

  it('should have appropriate timeouts', () => {
    expect(ACCURACY_CONFIG.STATS_CALCULATION_TIMEOUT).to.be.at.least(10000);
    expect(ACCURACY_CONFIG.CSV_EXPORT_TIMEOUT).to.be.at.least(30000);
  });

  it('should have UI timings that enhance UX', () => {
    expect(ACCURACY_CONFIG.TOAST_DURATION).to.be.at.least(2000).and.at.most(10000);
    expect(ACCURACY_CONFIG.TOAST_FADE_DURATION).to.be.at.least(100).and.at.most(1000);
  });
});
```

### Load Testing Scenarios

Create `test/performance/accuracyLoadTest.js`:

```javascript
describe('Accuracy Stats Load Testing', () => {
  it('should handle 100,000 entries within timeout', async function() {
    this.timeout(ACCURACY_CONFIG.STATS_CALCULATION_TIMEOUT + 5000);
    
    const mockEntries = generateMockEntries(100000);
    const stats = new AccuracyStats();
    
    const startTime = Date.now();
    const result = await stats.calculateStatistics();
    const duration = Date.now() - startTime;
    
    expect(duration).to.be.lessThan(ACCURACY_CONFIG.STATS_CALCULATION_TIMEOUT);
    expect(result.summary.totalCorrections).to.equal(100000);
  });

  it('should reject oversized log files', async () => {
    const stats = new AccuracyStats();
    const oversizedFile = path.join(testDir, 'corrections-2025-01.json');
    
    // Create 15MB file
    const largeEntries = generateMockEntries(150000);
    fs.writeFileSync(oversizedFile, JSON.stringify({ entries: largeEntries }));
    
    const entries = await stats.loadAllCorrectionLogs();
    
    // Should skip oversized file
    expect(entries.length).to.equal(0);
  });
});
```

---

## Monitoring & Observability

### Key Metrics to Track

Add to logging:

```typescript
// In accuracyStats.ts
log.info('Statistics calculation performance', {
  totalTimeMs: duration,
  entriesProcessed: entries.length,
  logFilesRead: fileCount,
  memoryUsedMB: process.memoryUsage().heapUsed / 1024 / 1024,
  cpuPercent: process.cpuUsage().user / 1000000,
});

// In accuracyHandlers.ts
log.info('IPC handler performance', {
  handler: 'accuracy:get-stats',
  durationMs: duration,
  success: true,
  dataSize: JSON.stringify(result).length,
});
```

### Production Dashboard Alerts

Consider monitoring:
- Average stats calculation time > 10 seconds
- IPC timeout errors > 5 per hour
- Memory usage > 500MB for accuracy operations
- CSV export failures > 10% of attempts

---

## Security Considerations

### Already Implemented (Good!)

- XSS prevention via `escapeHtml()`
- Input validation on IPC handlers
- No direct file path construction from user input
- Proper use of contextBridge isolation

### Additional Recommendations

1. **Sanitize CSV output** to prevent CSV injection:

```typescript
function sanitizeCsvField(field: string): string {
  // Prevent formula injection (=, +, -, @)
  if (/^[=+\-@]/.test(field)) {
    return "'" + field; // Prefix with single quote
  }
  
  // Escape double quotes
  if (field.includes(',') || field.includes('"') || field.includes('\n')) {
    return '"' + field.replace(/"/g, '""') + '"';
  }
  
  return field;
}

// Use in CSV generation
lines.push(`${sanitizeCsvField(typeStats.entityType)},${typeStats.dismissals},...`);
```

2. **Add content-type validation** for file operations
3. **Consider rate limiting** IPC handlers to prevent abuse

---

## Documentation Requirements

Update project documentation:

1. **CLAUDE.md** - Add accuracy dashboard configuration section
2. **README.md** - Document environment variables for configuration
3. **docs/accuracy-dashboard.md** - Create comprehensive feature documentation
4. **inline comments** - Add JSDoc for all configuration constants

---

## Conclusion

The Accuracy Dashboard feature has a **solid foundation** with good security practices (XSS prevention, input validation) and clean architecture. However, it requires **configuration safety improvements** before production deployment to prevent resource exhaustion, memory leaks, and poor error handling under load.

**Priority Actions:**
1. Create centralized `accuracyConfig.ts` with all magic numbers
2. Add resource limits to log file processing
3. Implement IPC timeout protection
4. Fix event listener memory leaks
5. Add chart rendering error boundaries

**Estimated Effort:** 1-2 days for must-fix issues, 3-4 days for complete implementation

**Risk if deployed without fixes:** MEDIUM - Could experience memory leaks, UI freezes, and poor UX under production load with large datasets.

---

**Next Steps:**
1. Review this report with the team
2. Prioritize fixes based on release timeline
3. Create tickets for each issue
4. Implement fixes with tests
5. Conduct load testing before production deployment

