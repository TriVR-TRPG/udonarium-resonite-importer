/**
 * Asset importer for sending images to Resonite
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import sharp from 'sharp';
import { ResoniteLinkClient } from './ResoniteLinkClient';
import { ExtractedFile } from '../parser/ZipExtractor';

export interface AssetImportResult {
  identifier: string;
  textureId: string;
  success: boolean;
  error?: string;
}

export class AssetImporter {
  private client: ResoniteLinkClient;
  private importedTextures: Map<string, string> = new Map();
  private tempDir: string | null = null;

  constructor(client: ResoniteLinkClient) {
    this.client = client;
  }

  /**
   * Import a single image asset
   * Writes image data to a temp file and imports via importTexture2DFile
   */
  async importImage(file: ExtractedFile): Promise<AssetImportResult> {
    // Check if already imported
    if (this.importedTextures.has(file.name)) {
      return {
        identifier: file.name,
        textureId: this.importedTextures.get(file.name)!,
        success: true,
      };
    }

    try {
      const tempFile = await this.writeTempFile(file);
      const textureId = await this.client.importTexture(tempFile);

      this.importedTextures.set(file.name, textureId);

      return {
        identifier: file.name,
        textureId,
        success: true,
      };
    } catch (error) {
      return {
        identifier: file.name,
        textureId: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Import multiple image assets
   */
  async importImages(
    files: ExtractedFile[],
    onProgress?: (current: number, total: number) => void
  ): Promise<AssetImportResult[]> {
    const results: AssetImportResult[] = [];
    const total = files.length;

    for (let i = 0; i < files.length; i++) {
      const result = await this.importImage(files[i]);
      results.push(result);

      if (onProgress) {
        onProgress(i + 1, total);
      }
    }

    return results;
  }

  /**
   * Register an external URL as a texture (no file import needed)
   */
  registerExternalUrl(identifier: string, url: string): void {
    this.importedTextures.set(identifier, url);
  }

  /**
   * Get texture ID for a previously imported identifier
   */
  getTextureId(identifier: string): string | undefined {
    return this.importedTextures.get(identifier);
  }

  /**
   * Get all imported texture mappings
   */
  getImportedTextures(): Map<string, string> {
    return new Map(this.importedTextures);
  }

  /**
   * Clean up temporary files
   */
  cleanup(): void {
    if (this.tempDir && fs.existsSync(this.tempDir)) {
      fs.rmSync(this.tempDir, { recursive: true, force: true });
      this.tempDir = null;
    }
  }

  private getTempDir(): string {
    if (!this.tempDir) {
      this.tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'resonite-import-'));
    }
    return this.tempDir;
  }

  private async writeTempFile(file: ExtractedFile): Promise<string> {
    const dir = this.getTempDir();
    const flatName = file.path.replace(/\//g, '_');
    const ext = path.extname(flatName).toLowerCase();

    if (ext === '.svg') {
      // Convert SVG to PNG since Resonite doesn't support SVG
      const pngName = flatName.replace(/\.svg$/i, '.png');
      const filePath = path.join(dir, pngName);
      const pngBuffer = await sharp(file.data).png().toBuffer();
      fs.writeFileSync(filePath, pngBuffer);
      return filePath;
    }

    const filePath = path.join(dir, flatName);
    fs.writeFileSync(filePath, file.data);
    return filePath;
  }
}
