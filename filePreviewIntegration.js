/**
 * File Preview Feature Integration
 *
 * This module integrates the file preview functionality with the existing renderer.
 * Add this script to index.html after renderer.js
 */

// Import the compiled UI module
import { filePreviewUI } from './dist/ui/filePreviewUI.js';

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeFilePreview);
} else {
  initializeFilePreview();
}

function initializeFilePreview() {
  console.log('🔧 Initializing File Preview feature...');

  try {
    // Initialize file preview UI
    filePreviewUI.initialize();

    // Make it globally available for inline handlers
    window.filePreviewUI = filePreviewUI;

    console.log('✅ File Preview feature initialized');

    // Enhance existing file input handler
    enhanceFileInput();

    // Add select button for preview
    addPreviewButton();

  } catch (error) {
    console.error('❌ Failed to initialize File Preview:', error);
  }
}

/**
 * Enhance existing file input to show preview
 *
 * Note: File preview now automatically triggers via renderer.js addFile() function
 * This function is kept for backwards compatibility and manual testing
 */
function enhanceFileInput() {
  console.log('✓ File preview will auto-trigger via addFile() hook in renderer.js');
}

/**
 * Add a "Preview Files" button
 */
function addPreviewButton() {
  // Check if button already exists
  if (document.getElementById('preview-files-btn')) {
    return;
  }

  const folderSelectDiv = document.querySelector('.folder-select');
  if (!folderSelectDiv) {
    console.warn('Folder select div not found');
    return;
  }

  const previewButton = document.createElement('button');
  previewButton.id = 'preview-files-btn';
  previewButton.className = 'button secondary';
  previewButton.innerHTML = '<i class="fas fa-eye"></i> Preview Files';
  previewButton.style.marginLeft = '10px';

  previewButton.addEventListener('click', async () => {
    console.log('🔍 Opening file preview dialog...');

    try {
      const filePaths = await window.electronAPI.selectFiles({
        allowMultiple: true,
        filters: [
          {
            name: 'Supported Files',
            extensions: ['txt', 'docx', 'doc', 'pdf', 'xlsx', 'xls', 'csv'],
          },
        ],
      });

      if (filePaths && filePaths.length > 0) {
        console.log('✓ Selected files:', filePaths.length);
        for (const filePath of filePaths) {
          await addFileToPreview(filePath);
        }
      }
    } catch (error) {
      console.error('❌ Error selecting files:', error);
    }
  });

  folderSelectDiv.appendChild(previewButton);
  console.log('✓ Added preview button');
}

/**
 * Add file to preview queue
 */
async function addFileToPreview(filePath) {
  if (!filePath) {
    console.warn('No file path provided');
    return;
  }

  console.log('📄 Adding file to preview:', filePath);

  const filename = window.pathAPI ? window.pathAPI.basename(filePath) : filePath.split('/').pop();

  // Create queue item
  const item = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    filePath,
    filename,
    status: 'pending',
    addedAt: new Date(),
  };

  // Add to UI
  filePreviewUI.addToQueue(item);

  // Load and display file info immediately for first file
  const queueState = window.filePreviewUI ? window.filePreviewUI.selectedFiles : null;
  if (queueState && queueState.size === 1) {
    // This is the first file, show its preview
    await filePreviewUI.loadFileInfo(filePath);
  }

  // Load metadata asynchronously
  try {
    console.log('  ⏳ Loading metadata...');
    const metadata = await window.electronAPI.getFileMetadata(filePath);

    if ('error' in metadata) {
      console.error('  ❌ Metadata error:', metadata.error);
      return;
    }

    console.log('  ✓ Metadata loaded:', metadata.lineCount, 'lines');

    // Update queue item with metadata
    filePreviewUI.updateQueueItemMetadata(item.id, {
      lineCount: metadata.lineCount,
      wordCount: metadata.wordCount,
    });
  } catch (error) {
    console.error('  ❌ Error loading metadata:', error);
  }
}

// Export for global access
window.addFileToPreview = addFileToPreview;

console.log('📦 File Preview integration script loaded');
