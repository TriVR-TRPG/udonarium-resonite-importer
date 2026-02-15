import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { extractZip } from '../parser/ZipExtractor';
import { parseXmlFiles } from '../parser/XmlParser';
import { buildImageAspectRatioMap, buildImageBlendModeMap } from './imageAspectRatioMap';
import { convertObjectsWithTextureMap } from './ObjectConverter';

const SAMPLE_DICE_ZIP_PATH = path.join(process.cwd(), 'src', '__fixtures__', 'sample-dice.zip');

describe('Converter integration (sample-dice.zip)', () => {
  it('converts parsed dice objects with image maps', async () => {
    const extracted = extractZip(SAMPLE_DICE_ZIP_PATH);
    const parsed = parseXmlFiles(extracted.xmlFiles.map((f) => ({ name: f.name, data: f.data })));
    const imageAspectRatioMap = await buildImageAspectRatioMap(
      extracted.imageFiles,
      parsed.objects
    );
    const imageBlendModeMap = await buildImageBlendModeMap(extracted.imageFiles, parsed.objects);

    const converted = convertObjectsWithTextureMap(
      parsed.objects,
      new Map(),
      imageAspectRatioMap,
      imageBlendModeMap
    );
    const convertedDice = converted.filter((obj) => obj.name === 'D6');

    expect(convertedDice.length).toBeGreaterThan(0);
    const dice = convertedDice[0];
    expect(dice.components.map((c) => c.type)).toEqual([
      '[FrooxEngine]FrooxEngine.BoxCollider',
      '[FrooxEngine]FrooxEngine.Grabbable',
    ]);
    expect(dice.children.length).toBe(6);
    expect(dice.children.filter((child) => child.isActive)).toHaveLength(1);

    const material = dice.children[0].components.find(
      (c) => c.type === '[FrooxEngine]FrooxEngine.XiexeToonMaterial'
    );
    expect(material?.fields.BlendMode).toEqual({
      $type: 'enum',
      value: 'Cutout',
      enumType: 'BlendMode',
    });
  });
});
