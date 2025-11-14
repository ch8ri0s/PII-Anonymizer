/**
 * Renderer Process - New UI
 * Integrates with beautiful card-based design
 */

// ✅ SECURITY: Use contextBridge APIs
const ipcRenderer = window.electronAPI;
const fs = window.fsAPI;
const path = window.pathAPI;

// State
let currentFile = null;
let currentFilePath = null;
let processingResult = null;

// DOM Elements
const uploadZone = document.getElementById('upload-zone');
const fileInput = document.getElementById('file-input');
const processingView = document.getElementById('processing-view');
const resetBtn = document.getElementById('reset-btn');
const processButton = document.getElementById('process-button');

// Metadata elements
const metaFilename = document.getElementById('meta-filename');
const metaTypeBadge = document.getElementById('meta-type-badge');
const metaSize = document.getElementById('meta-size');
const metaModified = document.getElementById('meta-modified');
const metaLines = document.getElementById('meta-lines');
const metaWords = document.getElementById('meta-words');
const previewContent = document.getElementById('preview-content');

// Processing elements
const initialState = document.getElementById('initial-state');
const processingSpinner = document.getElementById('processing-spinner');
const processingResultDiv = document.getElementById('processing-result');
const piiCountText = document.getElementById('pii-count-text');
const downloadButtons = document.getElementById('download-buttons');
const sanitizedMarkdown = document.getElementById('sanitized-markdown');
const changeList = document.getElementById('change-list');

// Download buttons
const downloadMarkdownBtn = document.getElementById('download-markdown');
const downloadMappingBtn = document.getElementById('download-mapping');

// Tabs
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

// ====================
// Event Listeners
// ====================

// Upload zone drag & drop
uploadZone.addEventListener('click', (e) => {
  // Don't trigger if clicking on the input itself or the browse button
  if (e.target === fileInput || e.target.closest('.browse-button')) {
    return;
  }
  fileInput.click();
});

uploadZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadZone.classList.add('dragging');
});

uploadZone.addEventListener('dragleave', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('dragging');
});

uploadZone.addEventListener('drop', async (e) => {
  e.preventDefault();
  uploadZone.classList.remove('dragging');

  const files = e.dataTransfer.files;
  if (files.length > 0) {
    await handleFileSelection(files[0]);
  }
});

// File input change
fileInput.addEventListener('change', async (e) => {
  if (e.target.files.length > 0) {
    const file = e.target.files[0];
    // Clear the input so the same file can be selected again
    e.target.value = '';
    await handleFileSelection(file);
  }
});

// Reset button
resetBtn.addEventListener('click', reset);

// Process button
processButton.addEventListener('click', processFile);

// Tab switching
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    // Remove active from all
    tabs.forEach(t => t.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));

    // Add active to clicked
    tab.classList.add('active');
    const targetId = 'tab-' + tab.dataset.tab;
    document.getElementById(targetId).classList.add('active');
  });
});

// Download handlers
downloadMarkdownBtn.addEventListener('click', downloadMarkdown);
downloadMappingBtn.addEventListener('click', downloadMapping);

// ====================
// File Handling
// ====================

async function handleFileSelection(file) {
  console.log('📁 File selected:', file.name);

  // Check if file has path property (Electron)
  let filePath = file.path;

  if (!filePath) {
    console.warn('File has no path property, creating temp file...');
    filePath = await createTempFile(file);
    if (!filePath) {
      alert('Failed to process file');
      return;
    }
  }

  currentFile = file;
  currentFilePath = filePath;

  // Show processing view FIRST so DOM elements exist
  showProcessingView();

  // Small delay to ensure DOM is rendered
  await new Promise(resolve => setTimeout(resolve, 50));

  // Load metadata and preview
  await loadFileData(filePath);

  // Enable process button
  processButton.disabled = false;
}

async function createTempFile(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuffer = reader.result;
      const uint8Array = new Uint8Array(arrayBuffer);
      const tempDir = window.osAPI.tmpdir();
      const tempPath = path.join(tempDir, file.name);

      fs.writeFile(tempPath, uint8Array, (err) => {
        if (err) {
          console.error('Error writing temp file:', err);
          resolve(null);
        } else {
          resolve(tempPath);
        }
      });
    };
    reader.onerror = () => {
      console.error('Error reading file');
      resolve(null);
    };
    reader.readAsArrayBuffer(file);
  });
}

async function loadFileData(filePath) {
  console.log('📊 Loading file metadata...');

  try {
    // Re-query DOM elements to ensure they exist
    const metaFilename = document.getElementById('meta-filename');
    const metaTypeBadge = document.getElementById('meta-type-badge');
    const metaSize = document.getElementById('meta-size');
    const metaModified = document.getElementById('meta-modified');
    const previewContent = document.getElementById('preview-content');

    if (!metaFilename || !metaTypeBadge || !metaSize || !metaModified || !previewContent) {
      console.error('Required DOM elements not found');
      return;
    }

    // Load metadata
    const metadata = await ipcRenderer.getFileMetadata(filePath);

    if ('error' in metadata) {
      console.error('Metadata error:', metadata.error);
      showError(`Failed to load metadata: ${metadata.error}`);
      return;
    }

    console.log('✓ Metadata loaded:', metadata);

    // Populate metadata panel directly
    metaFilename.textContent = metadata.filename;

    const typeInfo = getFileTypeInfo(metadata.extension);
    metaTypeBadge.textContent = typeInfo.label;
    metaTypeBadge.className = `badge ${typeInfo.badgeClass}`;

    // Use i18n formatting if available, otherwise fallback to metadata
    if (window.i18n && metadata.fileSize) {
      metaSize.textContent = window.i18n.formatFileSize(metadata.fileSize);
    } else {
      metaSize.textContent = metadata.fileSizeFormatted;
    }

    const date = new Date(metadata.lastModified);
    if (window.i18n) {
      metaModified.textContent = `${window.i18n.formatDate(date)} ${window.i18n.formatTime(date)}`;
    } else {
      metaModified.textContent = `${date.toLocaleDateString()} at ${date.toLocaleTimeString()}`;
    }

    // Load preview
    console.log('📄 Loading file preview...');
    const preview = await ipcRenderer.getFilePreview(filePath, {
      lines: 20,
      chars: 1000
    });

    if ('error' in preview) {
      console.error('Preview error:', preview.error);
      previewContent.textContent = 'Preview not available';
    } else {
      console.log('✓ Preview loaded');
      previewContent.textContent = preview.content;

      if (preview.isTruncated) {
        const truncatedMsg = document.createElement('div');
        truncatedMsg.style.cssText = 'margin-top: 1rem; padding: 0.5rem; background: var(--slate-100); border-radius: var(--radius-sm); color: var(--slate-600); font-style: italic;';
        truncatedMsg.textContent = `Preview truncated (showing first ${preview.previewLineCount} lines)`;
        previewContent.parentElement.appendChild(truncatedMsg);
      }
    }
  } catch (error) {
    console.error('Error loading file data:', error);
    showError('Failed to load file data');
  }
}

function populateMetadata(metadata) {
  // Check if elements exist
  if (!metaFilename || !metaTypeBadge || !metaSize || !metaModified) {
    console.error('Metadata elements not found in DOM');
    return;
  }

  // Filename
  metaFilename.textContent = metadata.filename;

  // Type badge
  const typeInfo = getFileTypeInfo(metadata.extension);
  metaTypeBadge.textContent = typeInfo.label;
  metaTypeBadge.className = `badge ${typeInfo.badgeClass}`;

  // Size
  if (window.i18n && metadata.fileSize) {
    metaSize.textContent = window.i18n.formatFileSize(metadata.fileSize);
  } else {
    metaSize.textContent = metadata.fileSizeFormatted;
  }

  // Modified
  const date = new Date(metadata.lastModified);
  if (window.i18n) {
    metaModified.textContent = `${window.i18n.formatDate(date)} ${window.i18n.formatTime(date)}`;
  } else {
    metaModified.textContent = `${date.toLocaleDateString()} at ${date.toLocaleTimeString()}`;
  }
}

function populatePreview(preview) {
  previewContent.textContent = preview.content;

  if (preview.isTruncated) {
    const truncatedMsg = document.createElement('div');
    truncatedMsg.style.cssText = 'margin-top: 1rem; padding: 0.5rem; background: var(--slate-100); border-radius: var(--radius-sm); color: var(--slate-600); font-style: italic;';
    truncatedMsg.textContent = `Preview truncated (showing first ${preview.previewLineCount} lines)`;
    previewContent.parentElement.appendChild(truncatedMsg);
  }
}

function getFileTypeInfo(extension) {
  const ext = extension.toLowerCase();

  // Use i18n if available for labels
  const getLabel = (key, fallback) => {
    return window.i18n ? window.i18n.t(key) : fallback;
  };

  const types = {
    '.pdf': { label: getLabel('fileTypes.pdfDocument', 'PDF Document'), badgeClass: 'badge-red' },
    '.doc': { label: getLabel('fileTypes.wordDocument', 'Word Document'), badgeClass: 'badge-blue' },
    '.docx': { label: getLabel('fileTypes.wordDocument', 'Word Document'), badgeClass: 'badge-blue' },
    '.xls': { label: getLabel('fileTypes.excelSpreadsheet', 'Excel Spreadsheet'), badgeClass: 'badge-green' },
    '.xlsx': { label: getLabel('fileTypes.excelSpreadsheet', 'Excel Spreadsheet'), badgeClass: 'badge-green' },
    '.csv': { label: getLabel('fileTypes.csvFile', 'CSV File'), badgeClass: 'badge-purple' },
    '.txt': { label: getLabel('fileTypes.textFile', 'Text File'), badgeClass: 'badge-slate' },
  };

  return types[ext] || { label: 'Document', badgeClass: 'badge-slate' };
}

// ====================
// Processing
// ====================

async function processFile() {
  if (!currentFilePath) return;

  console.log('🔄 Processing file...');

  // Show spinner
  showProcessingState('loading');

  try {
    const result = await ipcRenderer.processFile({
      filePath: currentFilePath,
      outputDir: null // Will use same directory as input
    });

    if (!result.success) {
      console.error('Processing error:', result.error);
      showError(`Processing failed: ${result.error}`);
      showProcessingState('initial');
      return;
    }

    console.log('✓ Processing complete:', result.outputPath);

    // Store result
    processingResult = result;

    // The result already contains markdownContent from main process
    const markdownContent = result.markdownContent || '';

    // Read mapping file if available
    let mapping = { entities: {} };
    if (result.mappingPath) {
      try {
        console.log('📖 Reading mapping file:', result.mappingPath);
        mapping = await ipcRenderer.readJsonFile(result.mappingPath);

        if (mapping.error) {
          console.warn('Mapping file error:', mapping.error);
          mapping = { entities: {} };
        } else {
          const entityCount = mapping.entities ? Object.keys(mapping.entities).length : 0;
          console.log('✓ Mapping loaded:', entityCount, 'entities');
        }
      } catch (error) {
        console.error('Error reading mapping:', error);
        mapping = { entities: {} };
      }
    }

    // Show results
    showResults(markdownContent, mapping);
  } catch (error) {
    console.error('Processing error:', error);
    showError('Processing failed: ' + error.message);
    showProcessingState('initial');
  }
}

function showResults(markdown, mapping) {
  // Update PII count
  const piiCount = mapping.entities ? Object.keys(mapping.entities).length : 0;
  piiCountText.textContent = `${piiCount} PII instances detected and sanitized`;

  // Show markdown
  sanitizedMarkdown.textContent = markdown;

  // Show mapping
  populateMappingList(mapping.entities || {});

  // Show download buttons
  downloadButtons.style.display = 'flex';

  // Show success state
  showProcessingState('success');
}

function populateMappingList(entities) {
  changeList.innerHTML = '';

  // entities is an object like { "John Doe": "PER_1", "jane@example.com": "PER_2" }
  const entityEntries = Object.entries(entities);

  if (entityEntries.length === 0) {
    changeList.innerHTML = '<p style="color: var(--slate-500); text-align: center; padding: 2rem;">No PII changes detected</p>';
    return;
  }

  entityEntries.forEach(([original, replacement], index) => {
    const changeItem = document.createElement('div');
    changeItem.className = 'change-item';

    // Determine entity type from replacement (e.g., "PER_1" -> "PER")
    const entityType = replacement.split('_')[0] || 'PII';
    const typeLabels = {
      'PER': 'Person',
      'LOC': 'Location',
      'ORG': 'Organization',
      'MISC': 'Miscellaneous',
      'PHONE': 'Phone',
      'EMAIL': 'Email',
      'IBAN': 'IBAN',
      'AHV': 'AHV Number',
      'PASSPORT': 'Passport',
      'UIDNUMBER': 'UID Number'
    };
    const typeLabel = typeLabels[entityType] || entityType;

    changeItem.innerHTML = `
      <div class="change-header">
        <span class="badge badge-outline">${typeLabel}</span>
        <span class="change-location">Entity ${index + 1}</span>
      </div>
      <div class="change-details">
        <div class="change-row">
          <span class="change-row-label">Original:</span>
          <span class="change-original">${escapeHtml(original)}</span>
        </div>
        <div class="change-row">
          <span class="change-row-label">Replaced:</span>
          <span class="change-replacement">${escapeHtml(replacement)}</span>
        </div>
      </div>
    `;

    changeList.appendChild(changeItem);
  });
}

function showProcessingState(state) {
  // Hide all states
  initialState.classList.add('hidden');
  processingSpinner.classList.add('hidden');
  processingResultDiv.classList.add('hidden');

  // Show requested state
  if (state === 'initial') {
    initialState.classList.remove('hidden');
  } else if (state === 'loading') {
    processingSpinner.classList.remove('hidden');
  } else if (state === 'success') {
    processingResultDiv.classList.remove('hidden');
  }
}

// ====================
// Download Functions
// ====================

function downloadMarkdown() {
  if (!processingResult) return;

  const markdown = sanitizedMarkdown.textContent;
  const filename = currentFile.name.replace(/\.[^/.]+$/, '') + '_sanitized.md';

  downloadFile(markdown, filename, 'text/markdown');
}

function downloadMapping() {
  if (!processingResult) return;

  // Reconstruct mapping from UI
  const entities = {};
  Array.from(changeList.children).forEach(item => {
    const original = item.querySelector('.change-original')?.textContent || '';
    const replacement = item.querySelector('.change-replacement')?.textContent || '';
    if (original && replacement) {
      entities[original] = replacement;
    }
  });

  const mapping = {
    version: '2.0',
    originalFile: currentFile.name,
    timestamp: new Date().toISOString(),
    model: 'Xenova/bert-base-NER',
    detectionMethods: ['ML (transformers)', 'Rule-based (Swiss/EU)'],
    entities
  };

  const filename = currentFile.name.replace(/\.[^/.]+$/, '') + '_mapping.json';
  downloadFile(JSON.stringify(mapping, null, 2), filename, 'application/json');
}

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  console.log('✓ Downloaded:', filename);
}

// ====================
// UI State Management
// ====================

function showProcessingView() {
  uploadZone.classList.add('hidden');
  processingView.classList.remove('hidden');
}

function showUploadZone() {
  processingView.classList.add('hidden');
  uploadZone.classList.remove('hidden');
}

function reset() {
  currentFile = null;
  currentFilePath = null;
  processingResult = null;

  // Reset UI
  showUploadZone();
  showProcessingState('initial');
  if (downloadButtons) downloadButtons.style.display = 'none';
  if (processButton) processButton.disabled = true;

  // Clear file input
  if (fileInput) fileInput.value = '';

  // Clear metadata - re-query to ensure they exist
  const metaFilename = document.getElementById('meta-filename');
  const metaTypeBadge = document.getElementById('meta-type-badge');
  const metaSize = document.getElementById('meta-size');
  const metaModified = document.getElementById('meta-modified');
  const previewContent = document.getElementById('preview-content');

  if (metaFilename) metaFilename.textContent = '-';
  if (metaTypeBadge) {
    metaTypeBadge.textContent = '-';
    metaTypeBadge.className = 'badge badge-slate';
  }
  if (metaSize) metaSize.textContent = '-';
  if (metaModified) metaModified.textContent = '-';
  if (previewContent) previewContent.textContent = 'Select a file to preview...';

  // Clear processing results
  if (sanitizedMarkdown) sanitizedMarkdown.textContent = '';
  if (changeList) changeList.innerHTML = '';
  if (piiCountText) piiCountText.textContent = 'Click "Process File" to begin';

  // Reset tabs
  if (tabs) {
    tabs.forEach((tab, i) => {
      if (i === 0) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });
  }

  if (tabContents) {
    tabContents.forEach((content, i) => {
      if (i === 0) {
        content.classList.add('active');
      } else {
        content.classList.remove('active');
      }
    });
  }

  console.log('↺ Reset complete');
}

function showError(message) {
  console.error('❌ Error:', message);

  // Create error alert
  const alert = document.createElement('div');
  alert.className = 'alert alert-error';
  alert.innerHTML = `
    <i class="fas fa-exclamation-circle"></i>
    <p>${escapeHtml(message)}</p>
  `;

  // Insert at top of processing view or show as browser alert
  if (processingView && !processingView.classList.contains('hidden')) {
    const gridContainer = processingView.querySelector('.grid');
    if (gridContainer && gridContainer.parentElement === processingView) {
      processingView.insertBefore(alert, gridContainer);

      // Auto-remove after 5 seconds
      setTimeout(() => {
        alert.remove();
      }, 5000);
    } else {
      // Fallback to browser alert
      console.warn('Grid container not found or not a child of processing view');
      window.alert(message);
    }
  } else {
    // If processing view isn't visible, use browser alert
    window.alert(message);
  }
}

// ====================
// Utilities
// ====================

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ====================
// Logs from main process
// ====================

ipcRenderer.onLogMessage((msg) => {
  console.log('[Main]', msg);
});

// ====================
// Initialization
// ====================

console.log('✓ Renderer initialized with new UI');
console.log('✓ electronAPI available:', !!window.electronAPI);
