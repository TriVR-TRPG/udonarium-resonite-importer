/**
 * Renderer Process Script
 */

import { AnalyzeResult, ImportOptions, ImportResult, ProgressInfo, ElectronAPI } from './types';
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
const analysisSection = document.getElementById('analysis-section') as HTMLElement;
const settingsSection = document.getElementById('settings-section') as HTMLElement;
const importSection = document.getElementById('import-section') as HTMLElement;
const xmlCountEl = document.getElementById('xml-count') as HTMLElement;
const imageCountEl = document.getElementById('image-count') as HTMLElement;
const objectCountEl = document.getElementById('object-count') as HTMLElement;
const typeBreakdownEl = document.getElementById('type-breakdown') as HTMLElement;
const analysisErrorsEl = document.getElementById('analysis-errors') as HTMLElement;
const hostInput = document.getElementById('host') as HTMLInputElement;
const portInput = document.getElementById('port') as HTMLInputElement;
const importBtn = document.getElementById('import-btn') as HTMLButtonElement;
const progressArea = document.getElementById('progress-area') as HTMLElement;
const progressFill = document.getElementById('progress-fill') as HTMLElement;
const progressText = document.getElementById('progress-text') as HTMLElement;
const importResult = document.getElementById('import-result') as HTMLElement;
const importControls = document.getElementById('import-controls') as HTMLElement;

let currentFilePath: string | null = null;

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

  // Section headers
  const headers = document.querySelectorAll('.card h2');
  if (headers[0]) headers[0].textContent = `1. ${t('gui.selectFile')}`;
  if (headers[1]) headers[1].textContent = `2. ${t('gui.analysisResult')}`;
  if (headers[2]) headers[2].textContent = `3. ${t('gui.settings')}`;
  if (headers[3]) headers[3].textContent = `4. ${t('gui.import')}`;

  // Stat labels
  const statLabels = document.querySelectorAll('.stat-label');
  if (statLabels[0]) statLabels[0].textContent = t('gui.xmlFiles');
  if (statLabels[1]) statLabels[1].textContent = t('gui.imageFiles');
  if (statLabels[2]) statLabels[2].textContent = t('gui.objects');

  // Settings labels
  const hostLabel = document.querySelector('label[for="host"]');
  if (hostLabel) hostLabel.textContent = t('gui.host');

  const portLabel = document.querySelector('label[for="port"]');
  if (portLabel) portLabel.textContent = t('gui.port');

  const hint = document.querySelector('.hint');
  if (hint) hint.textContent = t('gui.settingsHint');
}

// Initialize translations on load
applyTranslations();

// File selection
selectFileBtn.addEventListener('click', () => {
  void (async () => {
    const filePath = await window.electronAPI.selectFile();
    if (filePath) {
      currentFilePath = filePath;
      filePathInput.value = filePath;
      await analyzeFile(filePath);
    }
  })();
});

// Analyze file
async function analyzeFile(filePath: string): Promise<void> {
  analysisSection.style.display = 'none';
  settingsSection.style.display = 'none';
  importSection.style.display = 'none';

  const result: AnalyzeResult = await window.electronAPI.analyzeZip(filePath);

  if (!result.success) {
    analysisSection.style.display = 'block';
    analysisErrorsEl.textContent = `${t('gui.error')}: ${result.error ?? 'Unknown error'}`;
    return;
  }

  // Show stats
  xmlCountEl.textContent = String(result.xmlCount);
  imageCountEl.textContent = String(result.imageCount);
  objectCountEl.textContent = String(result.objectCount);

  // Type breakdown
  typeBreakdownEl.innerHTML = '';
  for (const [type, count] of Object.entries(result.typeCounts)) {
    const badge = document.createElement('span');
    badge.className = 'type-badge';
    const typeName = t(`objectTypes.${type}`);
    badge.innerHTML = `${typeName}: <span class="count">${String(count)}</span>`;
    typeBreakdownEl.appendChild(badge);
  }

  // Errors
  if (result.errors.length > 0) {
    analysisErrorsEl.innerHTML = result.errors.map((e: string) => `<div>${e}</div>`).join('');
  } else {
    analysisErrorsEl.innerHTML = '';
  }

  // Show sections
  analysisSection.style.display = 'block';
  settingsSection.style.display = 'block';
  importSection.style.display = 'block';

  // Reset import state
  importControls.style.display = 'block';
  progressArea.style.display = 'none';
  importResult.style.display = 'none';
  importBtn.disabled = false;
}

// Import to Resonite
importBtn.addEventListener('click', () => {
  void (async () => {
    if (!currentFilePath) return;

    importBtn.disabled = true;
    importControls.style.display = 'none';
    progressArea.style.display = 'block';
    importResult.style.display = 'none';

    const options: ImportOptions = {
      filePath: currentFilePath,
      host: hostInput.value || 'localhost',
      port: parseInt(portInput.value, 10) || 7869,
    };

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
      importControls.style.display = 'block';
      importBtn.disabled = false;
    }
  })();
});

// Progress updates
window.electronAPI.onImportProgress((info: ProgressInfo) => {
  progressFill.style.width = `${String(info.progress)}%`;
  progressText.textContent = info.detail ?? `${info.step}: ${String(info.progress)}%`;
});
