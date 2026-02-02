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

export interface ElectronAPI {
  selectFile: () => Promise<string | null>;
  analyzeZip: (filePath: string) => Promise<AnalyzeResult>;
  importToResonite: (options: ImportOptions) => Promise<ImportResult>;
  onImportProgress: (callback: (info: ProgressInfo) => void) => void;
}
