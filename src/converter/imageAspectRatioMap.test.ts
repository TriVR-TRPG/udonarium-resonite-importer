import { describe, expect, it, vi } from 'vitest';
import sharp from 'sharp';
import { buildImageAspectRatioMap, buildImageBlendModeMap } from './imageAspectRatioMap';
import { UdonariumObject } from '../domain/UdonariumObject';

const SKIP_EXTERNAL_URL_DOWNLOAD_IN_CI = process.env.CI === 'true';

describe('buildImageAspectRatioMap', () => {
  it('maps identifier to height/width ratio', async () => {
    const png = await sharp({
      create: {
        width: 100,
        height: 200,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const result = await buildImageAspectRatioMap([
      { path: 'images/front.png', name: 'front', data: png },
    ]);

    expect(result.get('front')).toBe(2);
    expect(result.get('images/front.png')).toBe(2);
    expect(result.get('./images/front.png')).toBe(2);
    expect(result.get('front.png')).toBe(2);
  });

  it('ignores invalid image data', async () => {
    const result = await buildImageAspectRatioMap([
      { path: 'images/bad.png', name: 'bad', data: Buffer.from('not-image') },
    ]);

    expect(result.get('bad')).toBeUndefined();
  });

  it('seeds known identifier and external url ratios', async () => {
    const objects: UdonariumObject[] = [
      {
        id: 'card-1',
        type: 'card',
        name: 'Card',
        position: { x: 0, y: 0, z: 0 },
        images: [
          { identifier: 'none_icon', name: 'front' },
          { identifier: './assets/images/trump/c01.gif', name: 'back' },
        ],
        isFaceUp: true,
        frontImage: { identifier: 'none_icon', name: 'front' },
        backImage: { identifier: './assets/images/trump/c01.gif', name: 'back' },
      },
    ];

    const result = await buildImageAspectRatioMap([], objects);

    expect(result.get('none_icon')).toBe(1);
    expect(result.get('./assets/images/trump/c01.gif')).toBe(1.5);
    expect(result.get('assets/images/trump/c01.gif')).toBe(1.5);
  });

  it('prefers known ratio for known file path without probing file metadata', async () => {
    const png = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const result = await buildImageAspectRatioMap([
      {
        path: 'assets/images/BG10a_80.jpg',
        name: 'BG10a_80',
        data: png,
      },
    ]);

    expect(result.get('assets/images/BG10a_80.jpg')).toBe(0.75);
  });
});

describe('buildImageBlendModeMap', () => {
  it('seeds known prefix blend mode for dice images as Cutout', async () => {
    const objects: UdonariumObject[] = [
      {
        id: 'dice-1',
        type: 'dice-symbol',
        name: 'D6',
        position: { x: 0, y: 0, z: 0 },
        images: [{ identifier: './assets/images/dice/6_dice/6_dice[1].png', name: '1' }],
        faceImages: [{ identifier: './assets/images/dice/6_dice/6_dice[1].png', name: '1' }],
        size: 1,
      },
    ];

    const result = await buildImageBlendModeMap([], objects);

    expect(result.get('./assets/images/dice/6_dice/6_dice[1].png')).toBe('Cutout');
    expect(result.get('assets/images/dice/6_dice/6_dice[1].png')).toBe('Cutout');
  });

  it.skipIf(SKIP_EXTERNAL_URL_DOWNLOAD_IN_CI)(
    'probes external absolute url metadata and sets blend mode',
    async () => {
      const withAlpha = await sharp({
        create: {
          width: 8,
          height: 8,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 0.5 },
        },
      })
        .png()
        .toBuffer();
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(new Response(new Uint8Array(withAlpha), { status: 200 }));

      const objects: UdonariumObject[] = [
        {
          id: 'char-1',
          type: 'character',
          name: 'Char',
          locationName: 'table',
          position: { x: 0, y: 0, z: 0 },
          images: [{ identifier: 'https://example.com/some-image.png', name: 'main' }],
          size: 1,
          rotate: 0,
          roll: 0,
          resources: [],
        },
      ];

      const result = await buildImageBlendModeMap([], objects);

      expect(result.get('https://example.com/some-image.png')).toBe('Alpha');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      fetchSpy.mockRestore();
    }
  );

  it('maps semi-transparent local image to Cutout when option is set', async () => {
    const withAlpha = await sharp({
      create: {
        width: 8,
        height: 8,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 0.5 },
      },
    })
      .png()
      .toBuffer();

    const result = await buildImageBlendModeMap(
      [{ path: 'images/alpha.png', name: 'alpha', data: withAlpha }],
      [],
      { semiTransparentMode: 'Cutout' }
    );

    expect(result.get('alpha')).toBe('Cutout');
    expect(result.get('images/alpha.png')).toBe('Cutout');
  });
});
