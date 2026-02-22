import { describe, expect, it } from 'vitest';
import { buildImageAssetContext } from './imageAssetContext';

describe('imageAssetContext', () => {
  it('context resolves texture value and filter mode via provided maps', () => {
    const context = buildImageAssetContext({
      imageAssetInfoMap: new Map([
        [
          'front.png',
          {
            identifier: 'front.png',
            textureValue: 'texture-ref://shared-front-static-texture',
          },
        ],
        [
          'anim.gif',
          {
            identifier: 'anim.gif',
            textureValue: 'resdb:///anim-gif',
          },
        ],
      ]),
      imageFilterModeMap: new Map([
        ['front.png', 'Default'],
        ['anim.gif', 'Point'],
      ]),
    });

    expect(context.resolveTextureValue('front.png')).toBe(
      'texture-ref://shared-front-static-texture'
    );
    expect(context.resolveUsePointFilter('front.png')).toBe(false);
    expect(context.resolveUsePointFilter('anim.gif')).toBe(true);
  });

  it('stores asset info in byIdentifier and can lookup normalized keys', () => {
    const context = buildImageAssetContext({
      imageAssetInfoMap: new Map([
        [
          'assets/images/trump/c01.gif',
          {
            identifier: 'assets/images/trump/c01.gif',
            textureValue: 'resdb:///gif-id',
          },
        ],
      ]),
      imageAspectRatioMap: new Map([['assets/images/trump/c01.gif', 1.5]]),
      imageBlendModeMap: new Map([['assets/images/trump/c01.gif', 'Opaque']]),
      imageFilterModeMap: new Map([['assets/images/trump/c01.gif', 'Point']]),
    });

    const info = context.getAssetInfo('assets/images/trump/c01.gif');
    expect(info).toBeDefined();
    expect(info?.textureValue).toBe('resdb:///gif-id');
    expect(info?.aspectRatio).toBe(1.5);
    expect(info?.blendMode).toBe('Opaque');
    expect(info?.filterMode).toBe('Point');
    expect(context.byIdentifier.size).toBeGreaterThan(0);
  });

  it('buildImageAssetContext resolves texture/filter from imageAssetInfoMap', () => {
    const context = buildImageAssetContext({
      imageAssetInfoMap: new Map([
        [
          'anim.gif',
          {
            identifier: 'anim.gif',
            textureValue: 'texture-ref://anim',
            filterMode: 'Point',
          },
        ],
      ]),
    });

    expect(context.resolveUsePointFilter('anim.gif')).toBe(true);
    expect(context.resolveTextureValue('anim.gif')).toBe('texture-ref://anim');
  });

  it('prefers explicit source kind from imageAssetInfoMap over inferred source kind', () => {
    const context = buildImageAssetContext({
      imageAssetInfoMap: new Map([
        [
          'known_icon',
          {
            identifier: 'known_icon',
            textureValue: 'https://udonarium.app/assets/images/known_icon.png',
            sourceKind: 'known-id',
          },
        ],
      ]),
    });

    expect(context.getAssetInfo('known_icon')?.sourceKind).toBe('known-id');
  });

  it('infers sourceKind from identifier and texture value', () => {
    const context = buildImageAssetContext({
      imageAssetInfoMap: new Map([
        ['character.png', { identifier: 'character.png', textureValue: 'resdb:///zip-png' }],
        ['board.svg', { identifier: 'board.svg', textureValue: 'resdb:///zip-svg' }],
        [
          './assets/images/trump/c01.gif',
          {
            identifier: './assets/images/trump/c01.gif',
            textureValue: 'https://udonarium.app/assets/images/trump/c01.gif',
          },
        ],
        [
          'https://example.com/sprite.png',
          {
            identifier: 'https://example.com/sprite.png',
            textureValue: 'https://example.com/sprite.png',
          },
        ],
        [
          'https://example.com/logo.svg',
          { identifier: 'https://example.com/logo.svg', textureValue: 'resdb:///external-svg' },
        ],
        [
          'none_icon',
          { identifier: 'none_icon', textureValue: 'https://udonarium.app/image/none_icon.png' },
        ],
      ]),
    });

    expect(context.getAssetInfo('character.png')?.sourceKind).toBe('zip-image');
    expect(context.getAssetInfo('board.svg')?.sourceKind).toBe('zip-svg');
    expect(context.getAssetInfo('./assets/images/trump/c01.gif')?.sourceKind).toBe(
      'udonarium-asset-url'
    );
    expect(context.getAssetInfo('https://example.com/sprite.png')?.sourceKind).toBe('external-url');
    expect(context.getAssetInfo('https://example.com/logo.svg')?.sourceKind).toBe('external-svg');
    expect(context.getAssetInfo('none_icon')?.sourceKind).toBe('external-url');
  });

  it('resolves texture-ref values from imageAssetInfoMap textureValue', () => {
    const context = buildImageAssetContext({
      imageAssetInfoMap: new Map([
        [
          'front.png',
          {
            identifier: 'front.png',
            textureValue: 'texture-ref://shared-front-texture',
            sourceKind: 'zip-image',
          },
        ],
      ]),
    });

    expect(context.resolveTextureValue('front.png')).toBe('texture-ref://shared-front-texture');
  });

  it('resolves only values stored in imageAssetInfoMap', () => {
    const context = buildImageAssetContext({
      imageAssetInfoMap: new Map([
        [
          'known_icon',
          {
            identifier: 'known_icon',
            textureValue: 'texture-ref://shared-known-icon',
            sourceKind: 'known-id',
          },
        ],
      ]),
    });

    expect(context.resolveTextureValue('known_icon')).toBe('texture-ref://shared-known-icon');
    expect(context.resolveTextureValue('legacy_only.png')).toBeNull();
    expect(context.getAssetInfo('legacy_only.png')).toBeNull();
  });
});
