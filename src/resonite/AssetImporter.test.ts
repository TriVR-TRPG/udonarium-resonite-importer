import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { AssetImporter } from './AssetImporter';
import { ResoniteLinkClient } from './ResoniteLinkClient';
import { ExtractedFile } from '../parser/ZipExtractor';

// Mock ResoniteLinkClient
vi.mock('./ResoniteLinkClient', () => {
  return {
    ResoniteLinkClient: vi.fn().mockImplementation(() => ({
      importTexture: vi.fn(),
    })),
  };
});

describe('AssetImporter', () => {
  let mockClient: {
    importTexture: Mock;
  };
  let assetImporter: AssetImporter;

  const createExtractedFile = (overrides: Partial<ExtractedFile> = {}): ExtractedFile => ({
    path: 'images/test-image.png',
    name: 'test-image.png',
    data: Buffer.from([0x89, 0x50, 0x4e, 0x47]), // PNG signature
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      importTexture: vi.fn().mockResolvedValue('texture-id-001'),
    };
    assetImporter = new AssetImporter(mockClient as unknown as ResoniteLinkClient);
  });

  afterEach(() => {
    assetImporter.cleanup();
  });

  describe('importImage', () => {
    it('should import a new image successfully', async () => {
      const file = createExtractedFile({
        path: 'images/character.png',
        name: 'character.png',
        data: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      });

      const result = await assetImporter.importImage(file);

      expect(mockClient.importTexture).toHaveBeenCalledWith(
        expect.stringContaining('character.png')
      );
      expect(result.success).toBe(true);
      expect(result.identifier).toBe('character.png');
      expect(result.textureId).toBe('texture-id-001');
    });

    it('should write image data to a temp file', async () => {
      const imageData = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      const file = createExtractedFile({
        path: 'images/written.png',
        name: 'written.png',
        data: imageData,
      });

      await assetImporter.importImage(file);

      // Verify the temp file path was passed to importTexture
      const calledPath = mockClient.importTexture.mock.calls[0][0] as string;
      expect(fs.existsSync(calledPath)).toBe(true);
      expect(fs.readFileSync(calledPath)).toEqual(imageData);
    });

    it('should return cached texture if already imported', async () => {
      const file = createExtractedFile({ name: 'cached-image.png' });

      // First import
      await assetImporter.importImage(file);
      mockClient.importTexture.mockClear();

      // Second import of same file
      const result = await assetImporter.importImage(file);

      expect(mockClient.importTexture).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.identifier).toBe('cached-image.png');
      expect(result.textureId).toBe('texture-id-001');
    });

    it('should return error result when import fails', async () => {
      mockClient.importTexture.mockRejectedValue(new Error('Upload failed'));
      const file = createExtractedFile({ name: 'failing-image.png' });

      const result = await assetImporter.importImage(file);

      expect(result.success).toBe(false);
      expect(result.identifier).toBe('failing-image.png');
      expect(result.textureId).toBe('');
      expect(result.error).toBe('Upload failed');
    });

    it('should handle non-Error exceptions', async () => {
      mockClient.importTexture.mockRejectedValue('String error');
      const file = createExtractedFile({ name: 'error-image.png' });

      const result = await assetImporter.importImage(file);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
    });

    it('should not cache failed imports', async () => {
      mockClient.importTexture
        .mockRejectedValueOnce(new Error('First attempt failed'))
        .mockResolvedValueOnce('texture-success');

      const file = createExtractedFile({ name: 'retry-image.png' });

      // First attempt fails
      const result1 = await assetImporter.importImage(file);
      expect(result1.success).toBe(false);

      // Second attempt should try again (not use cache)
      const result2 = await assetImporter.importImage(file);
      expect(result2.success).toBe(true);
      expect(result2.textureId).toBe('texture-success');
      expect(mockClient.importTexture).toHaveBeenCalledTimes(2);
    });

    it('should handle different file types', async () => {
      const jpegFile = createExtractedFile({
        path: 'images/photo.jpg',
        name: 'photo.jpg',
        data: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      });

      await assetImporter.importImage(jpegFile);

      expect(mockClient.importTexture).toHaveBeenCalledWith(expect.stringContaining('photo.jpg'));
    });
  });

  describe('importImages', () => {
    it('should import multiple images', async () => {
      mockClient.importTexture
        .mockResolvedValueOnce('texture-1')
        .mockResolvedValueOnce('texture-2')
        .mockResolvedValueOnce('texture-3');

      const files = [
        createExtractedFile({ path: 'images/image1.png', name: 'image1.png' }),
        createExtractedFile({ path: 'images/image2.png', name: 'image2.png' }),
        createExtractedFile({ path: 'images/image3.png', name: 'image3.png' }),
      ];

      const results = await assetImporter.importImages(files);

      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);
      expect(results[0].textureId).toBe('texture-1');
      expect(results[1].textureId).toBe('texture-2');
      expect(results[2].textureId).toBe('texture-3');
    });

    it('should call progress callback for each file', async () => {
      const files = [
        createExtractedFile({ path: 'images/a.png', name: 'a.png' }),
        createExtractedFile({ path: 'images/b.png', name: 'b.png' }),
        createExtractedFile({ path: 'images/c.png', name: 'c.png' }),
      ];
      const progressCallback = vi.fn();

      await assetImporter.importImages(files, progressCallback);

      expect(progressCallback).toHaveBeenCalledTimes(3);
      expect(progressCallback).toHaveBeenNthCalledWith(1, 1, 3);
      expect(progressCallback).toHaveBeenNthCalledWith(2, 2, 3);
      expect(progressCallback).toHaveBeenNthCalledWith(3, 3, 3);
    });

    it('should continue importing even if one fails', async () => {
      mockClient.importTexture
        .mockResolvedValueOnce('texture-1')
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce('texture-3');

      const files = [
        createExtractedFile({ path: 'images/good1.png', name: 'good1.png' }),
        createExtractedFile({ path: 'images/bad.png', name: 'bad.png' }),
        createExtractedFile({ path: 'images/good2.png', name: 'good2.png' }),
      ];

      const results = await assetImporter.importImages(files);

      expect(results).toHaveLength(3);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);
    });

    it('should return empty array for empty input', async () => {
      const results = await assetImporter.importImages([]);

      expect(results).toHaveLength(0);
      expect(mockClient.importTexture).not.toHaveBeenCalled();
    });

    it('should work without progress callback', async () => {
      const files = [createExtractedFile({ path: 'images/single.png', name: 'single.png' })];

      const results = await assetImporter.importImages(files);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
    });

    it('should use cache for duplicate files', async () => {
      const files = [
        createExtractedFile({ path: 'images/duplicate.png', name: 'duplicate.png' }),
        createExtractedFile({ path: 'images/duplicate.png', name: 'duplicate.png' }),
        createExtractedFile({ path: 'images/unique.png', name: 'unique.png' }),
      ];

      const results = await assetImporter.importImages(files);

      // Only 2 actual imports (first duplicate + unique)
      expect(mockClient.importTexture).toHaveBeenCalledTimes(2);
      expect(results).toHaveLength(3);
      expect(results.every((r) => r.success)).toBe(true);
    });
  });

  describe('getTextureId', () => {
    it('should return texture ID for imported file', async () => {
      await assetImporter.importImage(createExtractedFile({ name: 'stored.png' }));

      const textureId = assetImporter.getTextureId('stored.png');

      expect(textureId).toBe('texture-id-001');
    });

    it('should return undefined for non-imported file', () => {
      const textureId = assetImporter.getTextureId('unknown.png');

      expect(textureId).toBeUndefined();
    });

    it('should return undefined for failed import', async () => {
      mockClient.importTexture.mockRejectedValue(new Error('Failed'));
      await assetImporter.importImage(createExtractedFile({ name: 'failed.png' }));

      const textureId = assetImporter.getTextureId('failed.png');

      expect(textureId).toBeUndefined();
    });
  });

  describe('getImportedTextures', () => {
    it('should return empty map initially', () => {
      const textures = assetImporter.getImportedTextures();

      expect(textures.size).toBe(0);
    });

    it('should return all imported textures', async () => {
      mockClient.importTexture.mockResolvedValueOnce('tex-1').mockResolvedValueOnce('tex-2');

      await assetImporter.importImage(
        createExtractedFile({ path: 'images/img1.png', name: 'img1.png' })
      );
      await assetImporter.importImage(
        createExtractedFile({ path: 'images/img2.png', name: 'img2.png' })
      );

      const textures = assetImporter.getImportedTextures();

      expect(textures.size).toBe(2);
      expect(textures.get('img1.png')).toBe('tex-1');
      expect(textures.get('img2.png')).toBe('tex-2');
    });

    it('should return a copy of the map (not the original)', async () => {
      await assetImporter.importImage(createExtractedFile({ name: 'original.png' }));

      const textures = assetImporter.getImportedTextures();
      textures.set('modified.png', 'fake-texture');

      // Original should not be affected
      expect(assetImporter.getTextureId('modified.png')).toBeUndefined();
    });

    it('should not include failed imports', async () => {
      mockClient.importTexture
        .mockResolvedValueOnce('success-tex')
        .mockRejectedValueOnce(new Error('Failed'));

      await assetImporter.importImage(
        createExtractedFile({ path: 'images/success.png', name: 'success.png' })
      );
      await assetImporter.importImage(
        createExtractedFile({ path: 'images/fail.png', name: 'fail.png' })
      );

      const textures = assetImporter.getImportedTextures();

      expect(textures.size).toBe(1);
      expect(textures.has('success.png')).toBe(true);
      expect(textures.has('fail.png')).toBe(false);
    });
  });

  describe('getImportedSourceKinds', () => {
    it('tracks source kind for imported zip images', async () => {
      await assetImporter.importImage(
        createExtractedFile({ path: 'images/sample.png', name: 'sample.png' })
      );

      const sourceKinds = assetImporter.getImportedSourceKinds();
      expect(sourceKinds.get('sample.png')).toBe('zip-image');
    });

    it('tracks source kind for registered external URLs', () => {
      assetImporter.registerExternalUrl(
        'https://example.com/a.png',
        'https://example.com/a.png',
        'external-url'
      );

      const sourceKinds = assetImporter.getImportedSourceKinds();
      expect(sourceKinds.get('https://example.com/a.png')).toBe('external-url');
    });
  });

  describe('getImportedImageAssetInfoMap', () => {
    it('returns texture/source metadata per identifier', async () => {
      await assetImporter.importImage(
        createExtractedFile({ path: 'images/info.png', name: 'info.png' })
      );

      const infoMap = assetImporter.getImportedImageAssetInfoMap();
      expect(infoMap.get('info.png')).toMatchObject({
        identifier: 'info.png',
        textureValue: 'texture-id-001',
        sourceKind: 'zip-image',
      });
    });

    it('stores filterMode as Point for gif textures', async () => {
      await assetImporter.importImage(
        createExtractedFile({ path: 'images/anim.gif', name: 'anim.gif' })
      );

      const infoMap = assetImporter.getImportedImageAssetInfoMap();
      expect(infoMap.get('anim.gif')?.filterMode).toBe('Point');
    });
  });

  describe('applyTextureReference', () => {
    it('updates a single identifier via applyTextureReference', async () => {
      await assetImporter.importImage(
        createExtractedFile({ path: 'images/single-ref.png', name: 'single-ref.png' })
      );

      assetImporter.applyTextureReference('single-ref.png', 'shared-single-ref-component');

      expect(assetImporter.getTextureId('single-ref.png')).toBe(
        'texture-ref://shared-single-ref-component'
      );
    });
  });

  describe('buildImageAssetContext', () => {
    it('builds context from importer state', async () => {
      await assetImporter.importImage(
        createExtractedFile({ path: 'images/context.png', name: 'context.png' })
      );
      assetImporter.applyTextureReference('context.png', 'shared-context-component');

      const context = assetImporter.buildImageAssetContext({
        imageAspectRatioMap: new Map([['context.png', 1.25]]),
        imageBlendModeMap: new Map([['context.png', 'Opaque']]),
      });

      expect(context.resolveTextureValue('context.png')).toBe(
        'texture-ref://shared-context-component'
      );
      expect(context.lookupAspectRatio('context.png')).toBe(1.25);
      expect(context.lookupBlendMode('context.png')).toBe('Opaque');
    });

    it('does not trigger legacy option warning for importer context path', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      await assetImporter.importImage(
        createExtractedFile({ path: 'images/context2.png', name: 'context2.png' })
      );

      assetImporter.buildImageAssetContext({
        imageAspectRatioMap: new Map([['context2.png', 1.0]]),
      });

      expect(warnSpy).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('cleanup', () => {
    it('should remove temp directory after cleanup', async () => {
      await assetImporter.importImage(createExtractedFile());

      // Temp file should exist before cleanup
      const calledPath = mockClient.importTexture.mock.calls[0][0] as string;
      const tempDir = path.dirname(calledPath);
      expect(fs.existsSync(tempDir)).toBe(true);

      assetImporter.cleanup();

      expect(fs.existsSync(tempDir)).toBe(false);
    });

    it('should be safe to call cleanup multiple times', () => {
      expect(() => {
        assetImporter.cleanup();
        assetImporter.cleanup();
      }).not.toThrow();
    });

    it('should be safe to call cleanup without any imports', () => {
      expect(() => {
        assetImporter.cleanup();
      }).not.toThrow();
    });
  });
});
