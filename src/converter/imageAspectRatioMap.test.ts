import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { buildImageAlphaMap, buildImageAspectRatioMap } from './imageAspectRatioMap';
import { UdonariumObject } from '../domain/UdonariumObject';

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
        properties: new Map(),
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

describe('buildImageAlphaMap', () => {
  it('maps identifier to alpha flag', async () => {
    const withAlpha = await sharp({
      create: {
        width: 100,
        height: 200,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 0.5 },
      },
    })
      .png()
      .toBuffer();

    const result = await buildImageAlphaMap([
      { path: 'images/front.png', name: 'front', data: withAlpha },
    ]);

    expect(result.get('front')).toBe(true);
    expect(result.get('images/front.png')).toBe(true);
    expect(result.get('./images/front.png')).toBe(true);
    expect(result.get('front.png')).toBe(true);
  });

  it('seeds known identifier and external url alpha flags', async () => {
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
        properties: new Map(),
        isFaceUp: true,
        frontImage: { identifier: 'none_icon', name: 'front' },
        backImage: { identifier: './assets/images/trump/c01.gif', name: 'back' },
      },
    ];

    const result = await buildImageAlphaMap([], objects);

    expect(result.get('none_icon')).toBe(true);
    expect(result.get('./assets/images/trump/c01.gif')).toBe(false);
    expect(result.get('assets/images/trump/c01.gif')).toBe(false);
  });
});
