/**
 * Renderer Process Script
 */

import {
  AnalyzeResult,
  ImportOptions,
  ImportResult,
  ProgressInfo,
  ElectronAPI,
} from './types';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

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

// Type name translations
const typeNames: Record<string, string> = {
  character: 'キャラクター',
  card: 'カード',
  'card-stack': 'カードの山',
  terrain: '地形',
  table: 'テーブル',
  'table-mask': 'テーブルマスク',
  'text-note': 'テキストノート',
};

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
    analysisErrorsEl.textContent = `エラー: ${result.error ?? 'Unknown error'}`;
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
    badge.innerHTML = `${typeNames[type] ?? type}: <span class="count">${String(count)}</span>`;
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
        <strong>インポート完了!</strong><br>
        画像: ${String(result.importedImages)}/${String(result.totalImages)}<br>
        オブジェクト: ${String(result.importedObjects)}/${String(result.totalObjects)}<br>
        <small>Resoniteで確認してください</small>
      `;
    } else {
      importResult.className = 'error';
      importResult.innerHTML = `
        <strong>エラーが発生しました</strong><br>
        ${result.error ?? 'Unknown error'}<br>
        <small>Resoniteが起動しているか確認してください</small>
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
