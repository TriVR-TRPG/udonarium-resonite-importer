/**
 * Renderer Process Script
 */

import { ImportOptions, ImportResult, ProgressInfo, ElectronAPI } from './types';
import { t, initI18n } from './i18n';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

// Initialize i18n
initI18n();

// Elements
const filePathInput = document.getElementById('file-path') as HTMLInputElement;
const selectFileBtn = document.getElementById('select-file-btn') as HTMLButtonElement;
const fileDropArea = document.getElementById('file-drop-area') as HTMLElement;
const portHelpBtn = document.getElementById('port-help-btn') as HTMLButtonElement;
const portHelpPanel = document.getElementById('port-help-panel') as HTMLElement;
const hostInput = document.getElementById('host') as HTMLInputElement;
const portInput = document.getElementById('port') as HTMLInputElement;
const rootScaleInput = document.getElementById('root-scale') as HTMLInputElement;
const importBtn = document.getElementById('import-btn') as HTMLButtonElement;
const importLog = document.getElementById('import-log') as HTMLElement;
const progressArea = document.getElementById('progress-area') as HTMLElement;
const progressFill = document.getElementById('progress-fill') as HTMLElement;
const progressText = document.getElementById('progress-text') as HTMLElement;
const importResult = document.getElementById('import-result') as HTMLElement;
const advancedSection = document.getElementById('advanced-section') as HTMLElement;
const advancedOpenBtn = document.getElementById('advanced-open-btn') as HTMLButtonElement;

const LAST_PORT_STORAGE_KEY = 'udonarium_resonite_importer_last_port';
const DEFAULT_PORT = 7869;

let currentFilePath: string | null = null;
let isImporting = false;

function parsePortOrNull(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 65535) {
    return null;
  }
  return parsed;
}

function loadLastPort(): number | null {
  try {
    return parsePortOrNull(localStorage.getItem(LAST_PORT_STORAGE_KEY) ?? '');
  } catch {
    return null;
  }
}

function saveLastPort(port: number): void {
  try {
    localStorage.setItem(LAST_PORT_STORAGE_KEY, String(port));
  } catch {
    // Ignore storage failures and continue import flow.
  }
}

function canImport(): boolean {
  return !isImporting && !!currentFilePath && parsePortOrNull(portInput.value) !== null;
}

function updateImportButtonState(): void {
  importBtn.disabled = !canImport();
}

function setSelectedFilePath(filePath: string): void {
  currentFilePath = filePath;
  filePathInput.value = filePath;
  updateImportButtonState();
}

function setPortHelpPanelVisible(visible: boolean): void {
  portHelpPanel.style.display = visible ? 'block' : 'none';
  portHelpBtn.setAttribute('aria-expanded', visible ? 'true' : 'false');
}

// Apply translations to UI
function applyTranslations(): void {
  // Update static text elements
  const titleEl = document.querySelector('h1');
  if (titleEl) titleEl.textContent = t('gui.title');

  const subtitleEl = document.querySelector('.subtitle');
  if (subtitleEl) subtitleEl.textContent = t('gui.subtitle');

  filePathInput.placeholder = t('gui.selectFilePlaceholder');
  selectFileBtn.textContent = t('gui.browse');
  importBtn.textContent = t('gui.importToResonite');
  portHelpBtn.title = t('gui.portHelpTooltip');
  portHelpBtn.setAttribute('aria-label', t('gui.portHelpAriaLabel'));

  // Labels via data-i18n attributes
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      el.textContent = t(key);
    }
  });
}

// Initialize translations on load
applyTranslations();

const lastPort = loadLastPort();
portInput.value = lastPort ? String(lastPort) : '';
updateImportButtonState();

portInput.addEventListener('input', () => {
  updateImportButtonState();
});

// Load default config and set initial values
void window.electronAPI.getDefaultConfig().then((config) => {
  rootScaleInput.value = String(config.importGroupScale);
});

// Advanced options toggle
advancedOpenBtn.addEventListener('click', () => {
  const isHidden = advancedSection.style.display === 'none';
  advancedSection.style.display = isHidden ? 'block' : 'none';
  advancedOpenBtn.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
});

// File selection
selectFileBtn.addEventListener('click', () => {
  void (async () => {
    const filePath = await window.electronAPI.selectFile();
    if (filePath) {
      setSelectedFilePath(filePath);
    }
  })();
});

for (const eventName of ['dragenter', 'dragover']) {
  fileDropArea.addEventListener(eventName, (event) => {
    event.preventDefault();
    fileDropArea.classList.add('drag-over');
  });
}

for (const eventName of ['dragleave', 'drop']) {
  fileDropArea.addEventListener(eventName, (event) => {
    event.preventDefault();
    fileDropArea.classList.remove('drag-over');
  });
}

fileDropArea.addEventListener('drop', (event) => {
  const droppedFiles = event.dataTransfer?.files;
  if (!droppedFiles || droppedFiles.length === 0) {
    return;
  }

  const droppedFile = droppedFiles[0] as File & { path?: string };
  const droppedPath = droppedFile.path;
  if (!droppedPath || !droppedPath.toLowerCase().endsWith('.zip')) {
    importLog.style.display = 'block';
    importResult.style.display = 'block';
    importResult.className = 'error';
    importResult.innerHTML = `<strong>${t('gui.errorOccurred')}</strong><br>${t('gui.dropZipOnly')}`;
    return;
  }

  setSelectedFilePath(droppedPath);
});

portHelpBtn.addEventListener('click', () => {
  const isOpen = portHelpPanel.style.display === 'block';
  setPortHelpPanelVisible(!isOpen);
});

document.addEventListener('click', (event) => {
  const target = event.target as Node | null;
  if (!target) {
    return;
  }

  if (!portHelpPanel.contains(target) && !portHelpBtn.contains(target)) {
    setPortHelpPanelVisible(false);
  }
});

// Import to Resonite
importBtn.addEventListener('click', () => {
  void (async () => {
    if (!currentFilePath) return;

    isImporting = true;
    updateImportButtonState();
    importLog.style.display = 'block';
    progressArea.style.display = 'block';
    importResult.style.display = 'none';
    progressFill.style.width = '0%';
    progressText.textContent = t('gui.preparing');

    const options: ImportOptions = {
      filePath: currentFilePath,
      host: hostInput.value || 'localhost',
      port: parsePortOrNull(portInput.value) ?? DEFAULT_PORT,
      rootScale: parseFloat(rootScaleInput.value) || 1,
    };
    saveLastPort(options.port);

    try {
      const result: ImportResult = await window.electronAPI.importToResonite(options);

      progressArea.style.display = 'none';
      importResult.style.display = 'block';

      if (result.success) {
        importResult.className = 'success';
        importResult.innerHTML = `
          <strong>${t('gui.importComplete')}</strong><br>
          ${t('gui.images', { imported: result.importedImages, total: result.totalImages })}<br>
          ${t('gui.objectsResult', { imported: result.importedObjects, total: result.totalObjects })}<br>
          <small>${t('gui.checkResonite')}</small>
        `;
      } else {
        importResult.className = 'error';
        importResult.innerHTML = `
          <strong>${t('gui.errorOccurred')}</strong><br>
          ${result.error ?? 'Unknown error'}<br>
          <small>${t('gui.ensureResonite')}</small>
        `;
      }
    } finally {
      isImporting = false;
      updateImportButtonState();
    }
  })();
});

// Progress updates
window.electronAPI.onImportProgress((info: ProgressInfo) => {
  progressFill.style.width = `${String(info.progress)}%`;
  progressText.textContent = info.detail ?? `${info.step}: ${String(info.progress)}%`;
});
