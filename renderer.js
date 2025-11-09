/***** renderer.js *****/
// ✅ SECURITY: Use contextBridge APIs instead of direct Node.js requires
const ipcRenderer = window.electronAPI;
const fs = window.fsAPI;
const path = window.pathAPI;
const os = window.osAPI;

// DOM elements
let selectedFiles = [];
let outputDirectory = null;
let lastDialogTime = 0;

const fileInput = document.getElementById('file-input');
const dropZone = document.getElementById('drop-zone');
const selectFolderBtn = document.getElementById('select-folder');
const fileListDiv = document.getElementById('file-list');
const filesUl = document.getElementById('files-ul');
const clearFilesBtn = document.getElementById('clear-files');
const outputDirInput = document.getElementById('output-dir');
const selectOutputBtn = document.getElementById('select-output');
const processButton = document.getElementById('process-button');
const progress = document.getElementById('progress');
const progressBar = document.querySelector('.progress-bar');
const statusDiv = document.getElementById('status');
const outputLinkDiv = document.getElementById('output-link');
const openOutputFolderLink = document.getElementById('open-output-folder');

// Logs area
const logArea = document.getElementById('log-area');
const logMessages = document.getElementById('log-messages');

// On load: restore output dir
const storedOutput = localStorage.getItem('outputDirectory');
if (storedOutput) {
  outputDirectory = storedOutput;
  outputDirInput.value = storedOutput;
  outputLinkDiv.classList.remove('hidden');
  openOutputFolderLink.onclick = async () => {
    await ipcRenderer.openFolder(outputDirectory);
  };
}

// Event Listeners
dropZone.addEventListener('click', () => {
  const now = Date.now();
  if (now - lastDialogTime < 1000) return;
  lastDialogTime = now;
  fileInput.value = "";
  fileInput.click();
});

fileInput.addEventListener('change', async (e) => {
  await handleInputItems(e.target.files);
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.style.borderColor = 'var(--accent)';
});

dropZone.addEventListener('dragleave', () => {
  dropZone.style.borderColor = 'var(--text-secondary)';
});

dropZone.addEventListener('drop', async (e) => {
  e.preventDefault();
  dropZone.style.borderColor = 'var(--text-secondary)';
  await handleInputItems(e.dataTransfer.files);
});

selectFolderBtn.addEventListener('click', async () => {
  const folderPath = await ipcRenderer.selectInputDirectory();
  if (folderPath) {
    const filesFromFolder = await getFilesFromDirectory(folderPath);
    if (filesFromFolder.length === 0) {
      showStatus('No supported files found in the selected folder.', 'error');
    } else {
      filesFromFolder.forEach((f) => addFile(f));
      updateFileListUI();
      updateProcessButton();
    }
  }
});

clearFilesBtn.addEventListener('click', clearState);

selectOutputBtn.addEventListener('click', async () => {
  outputDirectory = await ipcRenderer.selectOutputDirectory();
  if (outputDirectory) {
    outputDirInput.value = outputDirectory;
    localStorage.setItem('outputDirectory', outputDirectory);
    outputLinkDiv.classList.remove('hidden');
    openOutputFolderLink.onclick = async () => {
      await ipcRenderer.openFolder(outputDirectory);
    };
  }
  updateProcessButton();
});

processButton.addEventListener('click', processFiles);

// Process Files Function (Simplified - No Pro/Limits)
async function processFiles() {
  if (selectedFiles.length === 0) return;

  processButton.disabled = true;
  const oldButtonText = processButton.innerHTML;
  processButton.innerHTML = `<i class="fas fa-cog fa-spin"></i> Converting to Markdown...`;

  progress.classList.remove('hidden');
  let total = selectedFiles.length;
  let processedCount = 0;

  for (let i = 0; i < total; i++) {
    const file = selectedFiles[i];
    const result = await ipcRenderer.processFile({
      filePath: file.path,
      outputDir: outputDirectory
    });

    if (!result.success) {
      showStatus(`Error processing ${file.name}: ${result.error}`, 'error');
    } else {
      console.log(`Converted ${file.name} → ${path.basename(result.outputPath)}`);
    }

    processedCount++;
    let percentage = Math.floor((processedCount / total) * 100);
    progressBar.style.width = `${percentage}%`;
  }

  progressBar.style.width = '100%';
  showStatus(`Successfully converted ${processedCount} file(s) to Markdown!`, 'success');

  processButton.disabled = false;
  processButton.innerHTML = oldButtonText;

  if (outputDirectory) {
    outputLinkDiv.classList.remove('hidden');
    openOutputFolderLink.onclick = async () => {
      await ipcRenderer.openFolder(outputDirectory);
    };
  }

  window.scrollTo(0, document.body.scrollHeight);
  clearState();

  setTimeout(() => {
    progress.classList.add('hidden');
    progressBar.style.width = '0%';
  }, 1500);
}

// File Handling Functions
async function handleInputItems(fileList) {
  for (let i = 0; i < fileList.length; i++) {
    let fileItem = fileList[i];
    if (!fileItem.path) {
      fileItem = await createTempFile(fileItem);
      if (!fileItem) continue;
    }
    try {
      const stats = await fs.lstat(fileItem.path);
      if (stats.isDirectory()) {
        const filesFromFolder = await getFilesFromDirectory(fileItem.path);
        filesFromFolder.forEach((f) => addFile(f));
      } else {
        addFile({ path: fileItem.path, name: fileItem.name });
      }
    } catch (error) {
      console.error(error);
      showStatus(`Error processing ${fileItem.name}: ${error.message}`, 'error');
    }
  }
  updateFileListUI();
  updateProcessButton();
}

function createTempFile(fileItem) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const buffer = Buffer.from(reader.result);
      const tempDir = os.tmpdir();
      const tempPath = path.join(tempDir, fileItem.name);
      fs.writeFile(tempPath, buffer, (err) => {
        if (err) {
          showStatus(`Error writing temporary file: ${err.message}`, 'error');
          resolve(null);
        } else {
          resolve({ path: tempPath, name: fileItem.name });
        }
      });
    };
    reader.onerror = () => {
      showStatus(`Error reading file ${fileItem.name}`, 'error');
      resolve(null);
    };
    reader.readAsArrayBuffer(fileItem);
  });
}

async function getFilesFromDirectory(dirPath) {
  let results = [];
  try {
    const list = await fs.readdir(dirPath);

    // Process files in parallel for better performance
    const filePromises = list.map(async (file) => {
      const filePath = path.join(dirPath, file);
      try {
        const stat = await fs.stat(filePath);
        if (stat && stat.isDirectory()) {
          return await getFilesFromDirectory(filePath);
        } else {
          const ext = path.extname(file).toLowerCase();
          if (['.doc','.docx','.xls','.xlsx','.csv','.pdf','.txt'].includes(ext)) {
            return [{ path: filePath, name: file }];
          }
        }
      } catch (err) {
        console.error(`Error reading ${filePath}: ${err.message}`);
      }
      return [];
    });

    const nestedResults = await Promise.all(filePromises);
    results = nestedResults.flat();
  } catch (err) {
    console.error(`Error reading directory ${dirPath}: ${err.message}`);
  }
  return results;
}

function addFile(fileObj) {
  const ext = path.extname(fileObj.path).toLowerCase();
  if (['.doc','.docx','.xls','.xlsx','.csv','.pdf','.txt'].includes(ext)) {
    if (!selectedFiles.find((f) => f.path === fileObj.path)) {
      selectedFiles.push(fileObj);
    }
  } else {
    showStatus(`Unsupported file type: ${fileObj.name}`, 'error');
  }
}

function updateFileListUI() {
  filesUl.innerHTML = '';
  if (selectedFiles.length === 0) {
    fileListDiv.classList.add('hidden');
    return;
  }
  fileListDiv.classList.remove('hidden');
  selectedFiles.forEach(file => {
    const li = document.createElement('li');
    li.textContent = file.name;
    filesUl.appendChild(li);
  });
}

function updateProcessButton() {
  processButton.disabled = (selectedFiles.length === 0);
}

function clearState() {
  selectedFiles = [];
  fileInput.value = '';
  updateFileListUI();
  updateProcessButton();
}

// Show status in main area
function showStatus(message, type) {
  statusDiv.textContent = message;
  statusDiv.className = `status ${type}`;
  statusDiv.classList.remove('hidden');
}

// Logs from main -> renderer
ipcRenderer.onLogMessage((msg) => {
  logArea.classList.remove('hidden');
  logMessages.textContent = `Status: ${msg}`;
});
