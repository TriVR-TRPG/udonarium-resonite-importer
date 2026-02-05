import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { AssetImporter } from './AssetImporter';
import { ResoniteLinkClient } from './ResoniteLinkClient';
import { ExtractedFile } from '../parser/ZipExtractor';

// Mock ResoniteLinkClient
vi.mock('./ResoniteLinkClient', () => {
  return {
    ResoniteLinkClient: vi.fn().mockImplementation(() => ({
      importTextureFromData: vi.fn(),
    })),
  };
});

describe('AssetImporter', () => {
  let mockClient: {
    importTextureFromData: Mock;
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
      importTextureFromData: vi.fn().mockResolvedValue('texture-id-001'),
    };
    assetImporter = new AssetImporter(mockClient as unknown as ResoniteLinkClient);
  });

  describe('importImage', () => {
    it('should import a new image successfully', async () => {
      const file = createExtractedFile({
        name: 'character.png',
        data: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      });

      const result = await assetImporter.importImage(file);

      expect(mockClient.importTextureFromData).toHaveBeenCalledWith(file.data, 'character.png');
      expect(result.success).toBe(true);
      expect(result.identifier).toBe('character.png');
      expect(result.textureId).toBe('texture-id-001');
    });

    it('should return cached texture if already imported', async () => {
      const file = createExtractedFile({ name: 'cached-image.png' });

      // First import
      await assetImporter.importImage(file);
      mockClient.importTextureFromData.mockClear();

      // Second import of same file
      const result = await assetImporter.importImage(file);

      expect(mockClient.importTextureFromData).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.identifier).toBe('cached-image.png');
      expect(result.textureId).toBe('texture-id-001');
    });

    it('should return error result when import fails', async () => {
      mockClient.importTextureFromData.mockRejectedValue(new Error('Upload failed'));
      const file = createExtractedFile({ name: 'failing-image.png' });

      const result = await assetImporter.importImage(file);

      expect(result.success).toBe(false);
      expect(result.identifier).toBe('failing-image.png');
      expect(result.textureId).toBe('');
      expect(result.error).toBe('Upload failed');
    });

    it('should handle non-Error exceptions', async () => {
      mockClient.importTextureFromData.mockRejectedValue('String error');
      const file = createExtractedFile({ name: 'error-image.png' });

      const result = await assetImporter.importImage(file);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Unknown error');
    });

    it('should not cache failed imports', async () => {
      mockClient.importTextureFromData
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
      expect(mockClient.importTextureFromData).toHaveBeenCalledTimes(2);
    });

    it('should handle different file types', async () => {
      const jpegFile = createExtractedFile({
        name: 'photo.jpg',
        data: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      });

      await assetImporter.importImage(jpegFile);

      expect(mockClient.importTextureFromData).toHaveBeenCalledWith(
        expect.any(Buffer),
        'photo.jpg'
      );
    });
  });

  describe('importImages', () => {
    it('should import multiple images', async () => {
      mockClient.importTextureFromData
        .mockResolvedValueOnce('texture-1')
        .mockResolvedValueOnce('texture-2')
        .mockResolvedValueOnce('texture-3');

      const files = [
        createExtractedFile({ name: 'image1.png' }),
        createExtractedFile({ name: 'image2.png' }),
        createExtractedFile({ name: 'image3.png' }),
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
        createExtractedFile({ name: 'a.png' }),
        createExtractedFile({ name: 'b.png' }),
        createExtractedFile({ name: 'c.png' }),
      ];
      const progressCallback = vi.fn();

      await assetImporter.importImages(files, progressCallback);

      expect(progressCallback).toHaveBeenCalledTimes(3);
      expect(progressCallback).toHaveBeenNthCalledWith(1, 1, 3);
      expect(progressCallback).toHaveBeenNthCalledWith(2, 2, 3);
      expect(progressCallback).toHaveBeenNthCalledWith(3, 3, 3);
    });

    it('should continue importing even if one fails', async () => {
      mockClient.importTextureFromData
        .mockResolvedValueOnce('texture-1')
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce('texture-3');

      const files = [
        createExtractedFile({ name: 'good1.png' }),
        createExtractedFile({ name: 'bad.png' }),
        createExtractedFile({ name: 'good2.png' }),
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
      expect(mockClient.importTextureFromData).not.toHaveBeenCalled();
    });

    it('should work without progress callback', async () => {
      const files = [createExtractedFile({ name: 'single.png' })];

      const results = await assetImporter.importImages(files);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
    });

    it('should use cache for duplicate files', async () => {
      const files = [
        createExtractedFile({ name: 'duplicate.png' }),
        createExtractedFile({ name: 'duplicate.png' }),
        createExtractedFile({ name: 'unique.png' }),
      ];

      const results = await assetImporter.importImages(files);

      // Only 2 actual imports (first duplicate + unique)
      expect(mockClient.importTextureFromData).toHaveBeenCalledTimes(2);
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
      mockClient.importTextureFromData.mockRejectedValue(new Error('Failed'));
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
      mockClient.importTextureFromData
        .mockResolvedValueOnce('tex-1')
        .mockResolvedValueOnce('tex-2');

      await assetImporter.importImage(createExtractedFile({ name: 'img1.png' }));
      await assetImporter.importImage(createExtractedFile({ name: 'img2.png' }));

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
      mockClient.importTextureFromData
        .mockResolvedValueOnce('success-tex')
        .mockRejectedValueOnce(new Error('Failed'));

      await assetImporter.importImage(createExtractedFile({ name: 'success.png' }));
      await assetImporter.importImage(createExtractedFile({ name: 'fail.png' }));

      const textures = assetImporter.getImportedTextures();

      expect(textures.size).toBe(1);
      expect(textures.has('success.png')).toBe(true);
      expect(textures.has('fail.png')).toBe(false);
    });
  });
});
