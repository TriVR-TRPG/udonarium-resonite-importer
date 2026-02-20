import { describe, it, expect, vi } from 'vitest';
import { registerExternalUrls } from './registerExternalUrls';
import { AssetImporter } from './AssetImporter';
import { GameCharacter, Terrain, Card, CardStack } from '../domain/UdonariumObject';

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

function makeAssetImporter(): {
  registerExternalUrl: ReturnType<typeof vi.fn>;
  importExternalSvgUrl: ReturnType<typeof vi.fn>;
} {
  return {
    registerExternalUrl: vi.fn(),
    importExternalSvgUrl: vi.fn().mockResolvedValue(undefined),
  } as unknown as AssetImporter & {
    registerExternalUrl: ReturnType<typeof vi.fn>;
    importExternalSvgUrl: ReturnType<typeof vi.fn>;
  };
}

const baseCharacter = (): GameCharacter => ({
  id: 'c1',
  type: 'character',
  name: 'Char',
  position: { x: 0, y: 0, z: 0 },
  images: [],
  locationName: '',
  size: 1,
  rotate: 0,
  roll: 0,
});

describe('registerExternalUrls', () => {
  describe('relative path identifiers (./ prefix)', () => {
    it('registers relative path as udonarium.app URL', async () => {
      const assetImporter = makeAssetImporter();
      const obj: GameCharacter = {
        ...baseCharacter(),
        images: [{ identifier: './assets/images/bg.jpg', name: 'bg' }],
      };

      await registerExternalUrls([obj], assetImporter as unknown as AssetImporter);

      expect(assetImporter.registerExternalUrl).toHaveBeenCalledWith(
        './assets/images/bg.jpg',
        'https://udonarium.app/assets/images/bg.jpg'
      );
    });
  });

  describe('KNOWN_IMAGES identifiers', () => {
    it('registers known identifier as its mapped URL', async () => {
      const assetImporter = makeAssetImporter();
      const obj: GameCharacter = {
        ...baseCharacter(),
        images: [{ identifier: 'known_icon', name: 'known_icon' }],
      };

      await registerExternalUrls([obj], assetImporter as unknown as AssetImporter);

      expect(assetImporter.registerExternalUrl).toHaveBeenCalledWith(
        'known_icon',
        'https://udonarium.app/assets/images/known_icon.png'
      );
    });
  });

  describe('absolute URL identifiers', () => {
    it('registers https:// identifier as itself', async () => {
      const assetImporter = makeAssetImporter();
      const obj: GameCharacter = {
        ...baseCharacter(),
        images: [{ identifier: 'https://example.com/images/character.png', name: 'character' }],
      };

      await registerExternalUrls([obj], assetImporter as unknown as AssetImporter);

      expect(assetImporter.registerExternalUrl).toHaveBeenCalledWith(
        'https://example.com/images/character.png',
        'https://example.com/images/character.png'
      );
    });

    it('registers http:// identifier as itself', async () => {
      const assetImporter = makeAssetImporter();
      const obj: GameCharacter = {
        ...baseCharacter(),
        images: [{ identifier: 'http://example.com/img.png', name: 'img' }],
      };

      await registerExternalUrls([obj], assetImporter as unknown as AssetImporter);

      expect(assetImporter.registerExternalUrl).toHaveBeenCalledWith(
        'http://example.com/img.png',
        'http://example.com/img.png'
      );
    });

    it('imports external SVG URL via importExternalSvgUrl instead of registerExternalUrl', async () => {
      const assetImporter = makeAssetImporter();
      const obj: GameCharacter = {
        ...baseCharacter(),
        images: [{ identifier: 'https://example.com/icons/badge.svg', name: 'badge' }],
      };

      await registerExternalUrls([obj], assetImporter as unknown as AssetImporter);

      expect(assetImporter.importExternalSvgUrl).toHaveBeenCalledWith(
        'https://example.com/icons/badge.svg',
        'https://example.com/icons/badge.svg'
      );
      expect(assetImporter.registerExternalUrl).not.toHaveBeenCalled();
    });

    it('registers absolute URL on terrain wallImage', async () => {
      const assetImporter = makeAssetImporter();
      const obj: Terrain = {
        id: 't1',
        type: 'terrain',
        name: 'Terrain',
        position: { x: 0, y: 0, z: 0 },
        images: [],
        isLocked: false,
        mode: 0,
        rotate: 0,
        width: 1,
        height: 1,
        depth: 1,
        wallImage: { identifier: 'https://example.com/wall.png', name: 'wall' },
        floorImage: null,
      };

      await registerExternalUrls([obj], assetImporter as unknown as AssetImporter);

      expect(assetImporter.registerExternalUrl).toHaveBeenCalledWith(
        'https://example.com/wall.png',
        'https://example.com/wall.png'
      );
    });

    it('registers absolute URL on terrain floorImage', async () => {
      const assetImporter = makeAssetImporter();
      const obj: Terrain = {
        id: 't1',
        type: 'terrain',
        name: 'Terrain',
        position: { x: 0, y: 0, z: 0 },
        images: [],
        isLocked: false,
        mode: 0,
        rotate: 0,
        width: 1,
        height: 1,
        depth: 1,
        wallImage: null,
        floorImage: { identifier: 'https://example.com/floor.jpg', name: 'floor' },
      };

      await registerExternalUrls([obj], assetImporter as unknown as AssetImporter);

      expect(assetImporter.registerExternalUrl).toHaveBeenCalledWith(
        'https://example.com/floor.jpg',
        'https://example.com/floor.jpg'
      );
    });

    it('registers absolute URL on card frontImage and backImage', async () => {
      const assetImporter = makeAssetImporter();
      const obj: Card = {
        id: 'card1',
        type: 'card',
        name: 'Card',
        position: { x: 0, y: 0, z: 0 },
        images: [],
        size: 1,
        rotate: 0,
        isFaceUp: true,
        frontImage: { identifier: 'https://example.com/front.png', name: 'front' },
        backImage: { identifier: 'https://example.com/back.png', name: 'back' },
      };

      await registerExternalUrls([obj], assetImporter as unknown as AssetImporter);

      expect(assetImporter.registerExternalUrl).toHaveBeenCalledWith(
        'https://example.com/front.png',
        'https://example.com/front.png'
      );
      expect(assetImporter.registerExternalUrl).toHaveBeenCalledWith(
        'https://example.com/back.png',
        'https://example.com/back.png'
      );
    });

    it('registers absolute URL on cards in card-stack', async () => {
      const assetImporter = makeAssetImporter();
      const obj: CardStack = {
        id: 'cs1',
        type: 'card-stack',
        name: 'Stack',
        position: { x: 0, y: 0, z: 0 },
        images: [],
        rotate: 0,
        cards: [
          {
            id: 'card1',
            type: 'card',
            name: 'Card',
            position: { x: 0, y: 0, z: 0 },
            images: [],
            size: 1,
            rotate: 0,
            isFaceUp: true,
            frontImage: { identifier: 'https://example.com/card.png', name: 'card' },
            backImage: null,
          },
        ],
      };

      await registerExternalUrls([obj], assetImporter as unknown as AssetImporter);

      expect(assetImporter.registerExternalUrl).toHaveBeenCalledWith(
        'https://example.com/card.png',
        'https://example.com/card.png'
      );
    });
  });

  describe('unrecognized identifiers', () => {
    it('does not register bare filename identifiers', async () => {
      const assetImporter = makeAssetImporter();
      const obj: GameCharacter = {
        ...baseCharacter(),
        images: [{ identifier: 'front', name: 'front' }],
      };

      await registerExternalUrls([obj], assetImporter as unknown as AssetImporter);

      expect(assetImporter.registerExternalUrl).not.toHaveBeenCalled();
    });
  });
});
