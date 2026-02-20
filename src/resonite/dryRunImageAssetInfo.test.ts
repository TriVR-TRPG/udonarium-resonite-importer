import { describe, expect, it, vi } from 'vitest';
import { ExtractedFile } from '../parser/ZipExtractor';
import { GameCharacter } from '../domain/UdonariumObject';
import { buildDryRunImageAssetInfoMap } from './dryRunImageAssetInfo';

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
          blendMode: 'Opaque',
        },
      ],
    ]),
  };
});

const makeCharacter = (identifier: string): GameCharacter => ({
  id: 'char-1',
  type: 'character',
  name: 'Character',
  position: { x: 0, y: 0, z: 0 },
  images: [{ identifier, name: identifier }],
  locationName: '',
  size: 1,
  rotate: 0,
  roll: 0,
});

const createExtractedFile = (overrides: Partial<ExtractedFile>): ExtractedFile => ({
  path: 'images/front.png',
  name: 'front.png',
  data: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
  ...overrides,
});

describe('buildDryRunImageAssetInfoMap', () => {
  it('builds zip and external source entries as image asset info', () => {
    const imageFiles = [
      createExtractedFile({ path: 'images/front.png', name: 'front.png' }),
      createExtractedFile({ path: 'images/icon.svg', name: 'icon.svg' }),
    ];
    const objects = [
      makeCharacter('./assets/images/bg.jpg'),
      makeCharacter('https://example.com/marker.png'),
      makeCharacter('known_icon'),
    ];

    const infoMap = buildDryRunImageAssetInfoMap(imageFiles, objects);

    expect(infoMap.get('front.png')).toMatchObject({
      identifier: 'front.png',
      textureValue: 'front.png',
      sourceKind: 'zip-image',
    });
    expect(infoMap.get('icon.svg')).toMatchObject({
      identifier: 'icon.svg',
      textureValue: 'icon.svg',
      sourceKind: 'zip-svg',
    });
    expect(infoMap.get('./assets/images/bg.jpg')).toMatchObject({
      identifier: './assets/images/bg.jpg',
      textureValue: 'https://udonarium.app/assets/images/bg.jpg',
      sourceKind: 'udonarium-asset-url',
    });
    expect(infoMap.get('https://example.com/marker.png')).toMatchObject({
      identifier: 'https://example.com/marker.png',
      textureValue: 'https://example.com/marker.png',
      sourceKind: 'external-url',
    });
    expect(infoMap.get('known_icon')).toMatchObject({
      identifier: 'known_icon',
      textureValue: 'https://udonarium.app/assets/images/known_icon.png',
      sourceKind: 'known-id',
    });
  });
});
