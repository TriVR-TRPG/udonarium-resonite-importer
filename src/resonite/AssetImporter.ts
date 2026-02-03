/**
 * Asset importer for sending images to Resonite
 */

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

  constructor(client: ResoniteLinkClient) {
    this.client = client;
  }

  /**
   * Import a single image asset
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
      const textureId = await this.client.importTextureFromData(file.data, file.name);

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
}
