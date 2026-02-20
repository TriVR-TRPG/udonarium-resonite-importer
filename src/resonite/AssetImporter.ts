/**
 * Asset importer for sending images to Resonite
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import sharp from 'sharp';
import { ResoniteLinkClient } from './ResoniteLinkClient';
import { ExtractedFile } from '../parser/ZipExtractor';
import {
  buildImageAssetContext,
  ImageAssetContext,
  ImageAssetInfo,
  ImageSourceKind,
} from '../converter/imageAssetContext';
import { isGifTexture, toTextureReference } from '../converter/textureUtils';
import { ImageBlendMode } from '../config/MappingConfig';

export interface BuildImporterImageAssetContextOptions {
  imageAspectRatioMap?: Map<string, number>;
  imageBlendModeMap?: Map<string, ImageBlendMode>;
}

export interface AssetImportResult {
  identifier: string;
  textureId: string;
  success: boolean;
  error?: string;
}

export class AssetImporter {
  private client: ResoniteLinkClient;
  private importedImageAssetInfoMap: Map<string, ImageAssetInfo> = new Map();
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
    const existing = this.importedImageAssetInfoMap.get(file.name)?.textureValue;
    if (existing) {
      return {
        identifier: file.name,
        textureId: existing,
        success: true,
      };
    }

    try {
      const tempFile = await this.writeTempFile(file);
      const textureId = await this.client.importTexture(tempFile);

      const ext = path.extname(file.path || file.name).toLowerCase();
      this.setImportedAssetInfo(file.name, textureId, ext === '.svg' ? 'zip-svg' : 'zip-image');

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
  registerExternalUrl(
    identifier: string,
    url: string,
    sourceKind: ImageSourceKind = 'external-url'
  ): void {
    this.setImportedAssetInfo(identifier, url, sourceKind);
  }

  /**
   * Download an SVG from a URL, convert to PNG, and import as texture.
   * Resonite does not support SVG, so conversion is required.
   */
  async importExternalSvgUrl(identifier: string, url: string): Promise<void> {
    if (this.importedImageAssetInfoMap.has(identifier)) return;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch SVG from ${url}: ${response.status}`);
    }
    const svgBuffer = Buffer.from(await response.arrayBuffer());

    const dir = this.getTempDir();
    const baseName = identifier.split('?')[0].split('/').at(-1) ?? 'image.svg';
    const pngName = baseName.replace(/\.svg$/i, '.png');
    const filePath = path.join(dir, pngName);
    const pngBuffer = await sharp(svgBuffer).png().toBuffer();
    fs.writeFileSync(filePath, pngBuffer);

    const textureId = await this.client.importTexture(filePath);
    this.setImportedAssetInfo(identifier, textureId, 'external-svg');
  }

  /**
   * Get texture ID for a previously imported identifier
   */
  getTextureId(identifier: string): string | undefined {
    return this.importedImageAssetInfoMap.get(identifier)?.textureValue;
  }

  /**
   * Get all imported texture mappings
   */
  getImportedTextures(): Map<string, string> {
    const textures = new Map<string, string>();
    for (const [identifier, info] of this.importedImageAssetInfoMap) {
      if (info.textureValue) {
        textures.set(identifier, info.textureValue);
      }
    }
    return textures;
  }

  /**
   * Get source kind mappings for imported textures
   */
  getImportedSourceKinds(): Map<string, ImageSourceKind> {
    const sourceKinds = new Map<string, ImageSourceKind>();
    for (const [identifier, info] of this.importedImageAssetInfoMap) {
      sourceKinds.set(identifier, info.sourceKind ?? 'unknown');
    }
    return sourceKinds;
  }

  /**
   * Get imported image asset info map (identifier -> texture/source metadata)
   */
  getImportedImageAssetInfoMap(): Map<string, ImageAssetInfo> {
    return new Map(this.importedImageAssetInfoMap);
  }

  /**
   * Replace a single texture value with shared texture reference.
   */
  applyTextureReference(identifier: string, componentId: string): void {
    const info = this.importedImageAssetInfoMap.get(identifier);
    if (!info) {
      return;
    }
    this.importedImageAssetInfoMap.set(identifier, {
      ...info,
      textureValue: toTextureReference(componentId),
    });
  }

  /**
   * Replace texture values with shared texture references when components are created.
   * @deprecated Prefer applyTextureReference(identifier, componentId) from updater callback.
   */
  applyTextureReferences(textureReferenceComponentMap: Map<string, string>): void {
    for (const [identifier, componentId] of textureReferenceComponentMap) {
      this.applyTextureReference(identifier, componentId);
    }
  }

  buildImageAssetContext(options: BuildImporterImageAssetContextOptions = {}): ImageAssetContext {
    return buildImageAssetContext({
      imageAssetInfoMap: this.getImportedImageAssetInfoMap(),
      imageAspectRatioMap: options.imageAspectRatioMap,
      imageBlendModeMap: options.imageBlendModeMap,
    });
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

  private setImportedAssetInfo(
    identifier: string,
    textureValue: string,
    sourceKind: ImageSourceKind
  ): void {
    const imageFilterLookupMap = new Map([[identifier, textureValue]]);
    this.importedImageAssetInfoMap.set(identifier, {
      identifier,
      textureValue,
      sourceKind,
      filterMode: isGifTexture(identifier, imageFilterLookupMap) ? 'Point' : 'Default',
    });
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
