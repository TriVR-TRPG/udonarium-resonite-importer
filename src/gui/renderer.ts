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
const xmlCountEl = document.getElementById('xml-count') as HTMLElement;
const imageCountEl = document.getElementById('image-count') as HTMLElement;
const objectCountEl = document.getElementById('object-count') as HTMLElement;
const typeBreakdownEl = document.getElementById('type-breakdown') as HTMLElement;
const analysisErrorsEl = document.getElementById('analysis-errors') as HTMLElement;
const hostInput = document.getElementById('host') as HTMLInputElement;
const portInput = document.getElementById('port') as HTMLInputElement;
const rootScaleInput = document.getElementById('root-scale') as HTMLInputElement;
const importBtn = document.getElementById('import-btn') as HTMLButtonElement;
const progressArea = document.getElementById('progress-area') as HTMLElement;
const progressFill = document.getElementById('progress-fill') as HTMLElement;
const progressText = document.getElementById('progress-text') as HTMLElement;
const importResult = document.getElementById('import-result') as HTMLElement;
const advancedToggle = document.getElementById('advanced-toggle') as HTMLElement;
const advancedContent = document.getElementById('advanced-content') as HTMLElement;
const toggleIcon = document.getElementById('toggle-icon') as HTMLElement;

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

  // Labels via data-i18n attributes
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      el.textContent = t(key);
    }
  });

  // Stat labels
  const statLabels = document.querySelectorAll('.stat-label');
  if (statLabels[0]) statLabels[0].textContent = t('gui.xmlFiles');
  if (statLabels[1]) statLabels[1].textContent = t('gui.imageFiles');
  if (statLabels[2]) statLabels[2].textContent = t('gui.objects');
}

// Initialize translations on load
applyTranslations();

// Load default config and set initial values
void window.electronAPI.getDefaultConfig().then((config) => {
  rootScaleInput.value = String(config.importGroupScale);
});

// Advanced options toggle
advancedToggle.addEventListener('click', () => {
  const isHidden = advancedContent.style.display === 'none';
  advancedContent.style.display = isHidden ? 'block' : 'none';
  toggleIcon.classList.toggle('open', isHidden);
});

// File selection
selectFileBtn.addEventListener('click', () => {
  void (async () => {
    const filePath = await window.electronAPI.selectFile();
    if (filePath) {
      currentFilePath = filePath;
      filePathInput.value = filePath;
      importBtn.disabled = false;
      await analyzeFile(filePath);
    }
  })();
});

// Analyze file
async function analyzeFile(filePath: string): Promise<void> {
  const result: AnalyzeResult = await window.electronAPI.analyzeZip(filePath);

  if (!result.success) {
    analysisSection.style.display = 'block';
    analysisErrorsEl.textContent = `${t('gui.error')}: ${result.error ?? 'Unknown error'}`;
    xmlCountEl.textContent = '0';
    imageCountEl.textContent = '0';
    objectCountEl.textContent = '0';
    typeBreakdownEl.innerHTML = '';
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

  // Show analysis section
  analysisSection.style.display = 'block';
}

// Import to Resonite
importBtn.addEventListener('click', () => {
  void (async () => {
    if (!currentFilePath) return;

    importBtn.disabled = true;
    progressArea.style.display = 'block';
    importResult.style.display = 'none';
    progressFill.style.width = '0%';
    progressText.textContent = t('gui.preparing');

    const options: ImportOptions = {
      filePath: currentFilePath,
      host: hostInput.value || 'localhost',
      port: parseInt(portInput.value, 10) || 7869,
      rootScale: parseFloat(rootScaleInput.value) || 1,
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
    }

    // Always re-enable the import button so the same file can be re-imported
    importBtn.disabled = false;
  })();
});

// Progress updates
window.electronAPI.onImportProgress((info: ProgressInfo) => {
  progressFill.style.width = `${String(info.progress)}%`;
  progressText.textContent = info.detail ?? `${info.step}: ${String(info.progress)}%`;
});
