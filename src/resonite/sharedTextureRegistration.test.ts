/**
 * 全画像パターンが共有テクスチャ（importedTextures）に登録されることを検証するテスト
 *
 * 対象パターン:
 *   1. ZIP内の通常画像ファイル（PNG等）
 *   2. ZIP内のSVGファイル → PNG変換
 *   3. 固定 identifier（KNOWN_IMAGES）
 *   4. Udonarium アセット（./assets/... 始まり）
 *   5. 外部 URL 画像（https://...png 等）
 *   6. 外部 URL の SVG（https://...svg）
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AssetImporter } from './AssetImporter';
import { ResoniteLinkClient } from './ResoniteLinkClient';
import { registerExternalUrls } from './registerExternalUrls';
import { GameCharacter } from '../domain/UdonariumObject';

vi.mock('./ResoniteLinkClient', () => ({
  ResoniteLinkClient: vi.fn().mockImplementation(() => ({
    importTexture: vi.fn(),
  })),
}));

vi.mock('sharp', () => ({
  default: vi.fn(() => ({
    png: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from([0x89, 0x50, 0x4e, 0x47])),
  })),
}));

vi.mock('../config/MappingConfig', async (importOriginal) => {
  const original = await importOriginal<typeof import('../config/MappingConfig')>();
  return {
    ...original,
    KNOWN_IMAGES: new Map([
      [
        'known_icon',
        {
          url: 'https://udonarium.app/assets/images/known_icon.png',
          aspectRatio: 1,
          blendMode: 'Opaque' as const,
        },
      ],
    ]),
  };
});

function makeCharacterWith(identifier: string): GameCharacter {
  return {
    id: 'c1',
    type: 'character',
    name: 'Char',
    position: { x: 0, y: 0, z: 0 },
    images: [{ identifier, name: identifier }],
    locationName: '',
    size: 1,
    rotate: 0,
    roll: 0,
    resources: [],
  };
}

describe('共有テクスチャへの登録 - 全画像パターン', () => {
  let mockClient: { importTexture: ReturnType<typeof vi.fn> };
  let assetImporter: AssetImporter;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = {
      importTexture: vi.fn().mockResolvedValue('resdb:///imported-texture'),
    };
    assetImporter = new AssetImporter(mockClient as unknown as ResoniteLinkClient);
  });

  afterEach(() => {
    assetImporter.cleanup();
  });

  it('ZIP内の通常画像ファイルが importedTextures に登録される', async () => {
    const file = {
      path: 'images/character.png',
      name: 'character',
      data: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    };

    await assetImporter.importImage(file);

    const textures = assetImporter.getImportedTextures();
    expect(textures.has('character')).toBe(true);
    expect(textures.get('character')).toBe('resdb:///imported-texture');
  });

  it('ZIP内のSVGファイルがPNGに変換されて importedTextures に登録される', async () => {
    const file = {
      path: 'images/icon.svg',
      name: 'icon',
      data: Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>'
      ),
    };

    await assetImporter.importImage(file);

    const textures = assetImporter.getImportedTextures();
    expect(textures.has('icon')).toBe(true);
    expect(textures.get('icon')).toBe('resdb:///imported-texture');
    // sharp を使って PNG 変換が行われたことを検証
    const sharp = (await import('sharp')).default;
    expect(sharp).toHaveBeenCalled();
  });

  it('固定 identifier（KNOWN_IMAGES）が importedTextures に登録される', () => {
    registerExternalUrls([makeCharacterWith('known_icon')], assetImporter);

    const textures = assetImporter.getImportedTextures();
    expect(textures.has('known_icon')).toBe(true);
    expect(textures.get('known_icon')).toBe('https://udonarium.app/assets/images/known_icon.png');
  });

  it('Udonarium アセット（./assets/...）が importedTextures に登録される', () => {
    registerExternalUrls([makeCharacterWith('./assets/images/bg.jpg')], assetImporter);

    const textures = assetImporter.getImportedTextures();
    expect(textures.has('./assets/images/bg.jpg')).toBe(true);
    expect(textures.get('./assets/images/bg.jpg')).toBe(
      'https://udonarium.app/assets/images/bg.jpg'
    );
  });

  it('外部 URL 画像（https://...png）が importedTextures に登録される', () => {
    registerExternalUrls(
      [makeCharacterWith('https://example.com/images/character.png')],
      assetImporter
    );

    const textures = assetImporter.getImportedTextures();
    expect(textures.has('https://example.com/images/character.png')).toBe(true);
    expect(textures.get('https://example.com/images/character.png')).toBe(
      'https://example.com/images/character.png'
    );
  });

  it('外部 URL の SVG（https://...svg）が importedTextures に登録される', () => {
    registerExternalUrls([makeCharacterWith('https://example.com/icons/badge.svg')], assetImporter);

    const textures = assetImporter.getImportedTextures();
    expect(textures.has('https://example.com/icons/badge.svg')).toBe(true);
    expect(textures.get('https://example.com/icons/badge.svg')).toBe(
      'https://example.com/icons/badge.svg'
    );
  });

  it('6パターン全てが同時に importedTextures に登録できる', async () => {
    // ZIP ファイルを importImages で登録
    await assetImporter.importImage({
      path: 'images/character.png',
      name: 'character',
      data: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    });
    await assetImporter.importImage({
      path: 'images/icon.svg',
      name: 'icon',
      data: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>'),
    });

    // 外部 URL 系を registerExternalUrls で登録
    registerExternalUrls(
      [
        makeCharacterWith('known_icon'),
        makeCharacterWith('./assets/images/bg.jpg'),
        makeCharacterWith('https://example.com/images/character.png'),
        makeCharacterWith('https://example.com/icons/badge.svg'),
      ],
      assetImporter
    );

    const textures = assetImporter.getImportedTextures();
    expect(textures.size).toBe(6);
    expect(textures.has('character')).toBe(true);
    expect(textures.has('icon')).toBe(true);
    expect(textures.has('known_icon')).toBe(true);
    expect(textures.has('./assets/images/bg.jpg')).toBe(true);
    expect(textures.has('https://example.com/images/character.png')).toBe(true);
    expect(textures.has('https://example.com/icons/badge.svg')).toBe(true);
  });
});
