/**
 * Shared types for GUI IPC communication
 */

export interface AnalyzeResult {
  success: boolean;
  error?: string;
  xmlCount: number;
  imageCount: number;
  objectCount: number;
  typeCounts: Record<string, number>;
  errors: string[];
}

export interface ImportOptions {
  filePath: string;
  host: string;
  port: number;
  rootScale: number;
  enableCharacterColliderOnLockedTerrain: boolean;
  semiTransparentImageBlendMode: 'Cutout' | 'Alpha';
}

export interface ImportResult {
  success: boolean;
  error?: string;
  importedImages: number;
  totalImages: number;
  importedObjects: number;
  totalObjects: number;
}

export interface ProgressInfo {
  step: string;
  progress: number;
  detail?: string;
}

export interface DefaultConfig {
  importGroupScale: number;
}

export interface ElectronAPI {
  getDefaultConfig: () => Promise<DefaultConfig>;
  selectFile: () => Promise<string | null>;
  analyzeZip: (filePath: string) => Promise<AnalyzeResult>;
  importToResonite: (options: ImportOptions) => Promise<ImportResult>;
  onImportProgress: (callback: (info: ProgressInfo) => void) => void;
}
