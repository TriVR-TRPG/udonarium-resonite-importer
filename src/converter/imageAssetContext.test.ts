import { describe, expect, it, vi } from 'vitest';
import {
  __resetLegacyBuildOptionWarningForTests,
  buildImageFilterModeMap,
  buildImageAssetContext,
  createImageAssetContext,
  ImageFilterMode,
} from './imageAssetContext';

const STRICT_ENV_KEY = 'UDONARIUM_IMPORTER_STRICT_DEPRECATIONS';

describe('imageAssetContext', () => {
  const originalStrictEnv = process.env[STRICT_ENV_KEY];

  function restoreStrictEnv(): void {
    if (originalStrictEnv === undefined) {
      delete process.env[STRICT_ENV_KEY];
      return;
    }
    process.env[STRICT_ENV_KEY] = originalStrictEnv;
  }

  it('warns once when legacy build options are used', () => {
    delete process.env[STRICT_ENV_KEY];
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    __resetLegacyBuildOptionWarningForTests();

    buildImageAssetContext({
      textureValueMap: new Map([['front.png', 'resdb:///front']]),
    });
    buildImageAssetContext({
      textureReferenceComponentMap: new Map([['front.png', 'shared-front']]),
    });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
    restoreStrictEnv();
  });

  it('throws when strict deprecation mode is enabled and legacy options are used', () => {
    process.env[STRICT_ENV_KEY] = '1';
    __resetLegacyBuildOptionWarningForTests();

    expect(() =>
      buildImageAssetContext({
        textureValueMap: new Map([['front.png', 'resdb:///front']]),
      })
    ).toThrow(/deprecated-strict/);
    restoreStrictEnv();
  });

  it('buildImageFilterModeMap marks gif identifiers as Point filter', () => {
    const map = buildImageFilterModeMap(
      new Map([
        ['assets/images/trump/c01.gif', 'resdb:///gif-id'],
        ['front.png', 'resdb:///png-id'],
      ])
    );

    expect(map.get('assets/images/trump/c01.gif')).toBe<ImageFilterMode>('Point');
    expect(map.get('front.png')).toBe<ImageFilterMode>('Default');
  });

  it('context resolves texture value and filter mode via provided maps', () => {
    const context = createImageAssetContext({
      textureMap: new Map([
        ['front.png', 'texture-ref://shared-front-static-texture'],
        ['anim.gif', 'resdb:///anim-gif'],
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
    const context = createImageAssetContext({
      textureMap: new Map([['assets/images/trump/c01.gif', 'resdb:///gif-id']]),
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

  it('buildImageAssetContext composes filter mode map from source texture map', () => {
    delete process.env[STRICT_ENV_KEY];
    const context = buildImageAssetContext({
      textureValueMap: new Map([['anim.gif', 'texture-ref://anim']]),
      filterModeSourceTextureMap: new Map([['anim.gif', 'resdb:///anim.gif']]),
    });

    expect(context.resolveUsePointFilter('anim.gif')).toBe(true);
    expect(context.resolveTextureValue('anim.gif')).toBe('texture-ref://anim');
    restoreStrictEnv();
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
    const context = createImageAssetContext({
      textureMap: new Map([
        ['character.png', 'resdb:///zip-png'],
        ['board.svg', 'resdb:///zip-svg'],
        ['./assets/images/trump/c01.gif', 'https://udonarium.app/assets/images/trump/c01.gif'],
        ['https://example.com/sprite.png', 'https://example.com/sprite.png'],
        ['https://example.com/logo.svg', 'resdb:///external-svg'],
        ['none_icon', 'https://udonarium.app/image/none_icon.png'],
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

  it('prefers importer asset info over texture reference component map', () => {
    const context = buildImageAssetContext({
      imageAssetInfoMap: new Map([
        [
          'known_icon',
          {
            identifier: 'known_icon',
            textureValue: 'https://udonarium.app/image/none_icon.png',
            sourceKind: 'known-id',
          },
        ],
      ]),
      textureReferenceComponentMap: new Map([['known_icon', 'shared-known-icon']]),
    });

    expect(context.getAssetInfo('known_icon')?.sourceKind).toBe('known-id');
    expect(context.resolveTextureValue('known_icon')).toBe(
      'https://udonarium.app/image/none_icon.png'
    );
  });

  it('prefers imageAssetInfoMap and does not fall back to legacy texture map entries', () => {
    const context = createImageAssetContext({
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
      textureMap: new Map([['legacy_only.png', 'resdb:///legacy']]),
    });

    expect(context.resolveTextureValue('known_icon')).toBe('texture-ref://shared-known-icon');
    expect(context.resolveTextureValue('legacy_only.png')).toBeUndefined();
    expect(context.getAssetInfo('legacy_only.png')).toBeUndefined();
  });

  it('ignores imageSourceKindMap when imageAssetInfoMap is provided', () => {
    const context = createImageAssetContext({
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
      imageSourceKindMap: new Map([['known_icon', 'external-url']]),
    });

    expect(context.getAssetInfo('known_icon')?.sourceKind).toBe('known-id');
  });

  it('ignores textureReferenceComponentMap when imageAssetInfoMap is provided', () => {
    const context = createImageAssetContext({
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
      textureReferenceComponentMap: new Map([['known_icon', 'shared-known-icon']]),
    });

    expect(context.resolveTextureValue('known_icon')).toBe(
      'https://udonarium.app/assets/images/known_icon.png'
    );
  });
});
