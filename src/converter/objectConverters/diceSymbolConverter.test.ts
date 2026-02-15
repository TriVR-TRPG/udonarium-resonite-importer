import * as path from 'path';
import { beforeAll, describe, expect, it } from 'vitest';
import { DiceSymbol } from '../../domain/UdonariumObject';
import { ResoniteObject } from '../../domain/ResoniteObject';
import { extractZip } from '../../parser/ZipExtractor';
import { parseXmlFiles } from '../../parser/XmlParser';
import { applyDiceSymbolConversion } from './diceSymbolConverter';

const SAMPLE_DICE_ZIP_PATH = path.join(process.cwd(), 'src', '__fixtures__', 'sample-dice.zip');

function createBaseResonite(name: string): ResoniteObject {
  return {
    id: 'slot-dice-1',
    name,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    textures: [],
    components: [],
    children: [],
  };
}

describe('applyDiceSymbolConversion', () => {
  let sampleDice: DiceSymbol;

  beforeAll(() => {
    const extracted = extractZip(SAMPLE_DICE_ZIP_PATH);
    const parsed = parseXmlFiles(extracted.xmlFiles.map((f) => ({ name: f.name, data: f.data })));
    const dice = parsed.objects.find((obj): obj is DiceSymbol => obj.type === 'dice-symbol');
    expect(dice).toBeDefined();
    sampleDice = dice as DiceSymbol;
  });

  it('converts dice from sample fixture and keeps only active face renderer', () => {
    const resoniteObj = createBaseResonite(sampleDice.name);

    applyDiceSymbolConversion(sampleDice, resoniteObj, (size) => ({ x: size, y: size, z: size }));

    expect(resoniteObj.components.map((c) => c.type)).toEqual([
      '[FrooxEngine]FrooxEngine.BoxCollider',
      '[FrooxEngine]FrooxEngine.Grabbable',
    ]);
    expect(resoniteObj.components[0].fields).toEqual({
      Size: { $type: 'float3', value: { x: sampleDice.size, y: sampleDice.size, z: 0.05 } },
    });
    expect(resoniteObj.children).toHaveLength(sampleDice.faceImages.length);

    const activeChildren = resoniteObj.children.filter((child) => child.isActive);
    expect(activeChildren).toHaveLength(1);
    expect(activeChildren[0].name).toBe(`${resoniteObj.name}-face-${sampleDice.face}`);

    for (const child of resoniteObj.children) {
      const quad = child.components.find((c) => c.type === '[FrooxEngine]FrooxEngine.QuadMesh');
      expect(quad?.fields.Size).toEqual({
        $type: 'float2',
        value: { x: sampleDice.size, y: sampleDice.size },
      });
    }
  });

  it('sizes each face by ratio and bottom-aligns to the largest face', () => {
    const resoniteObj = createBaseResonite(sampleDice.name);
    const firstFace = sampleDice.faceImages[0];
    const secondFace = sampleDice.faceImages[1] ?? sampleDice.faceImages[0];
    const imageAspectRatioMap = new Map<string, number>([
      [firstFace.identifier, 1],
      [secondFace.identifier, 2],
    ]);

    applyDiceSymbolConversion(
      sampleDice,
      resoniteObj,
      (size) => ({ x: size, y: size, z: size }),
      undefined,
      imageAspectRatioMap
    );

    const faceWidth = sampleDice.size;
    const firstHeight = faceWidth * 1;
    const secondHeight = faceWidth * 2;
    const maxHeight = secondHeight;

    expect(resoniteObj.components[0].fields).toEqual({
      Size: { $type: 'float3', value: { x: faceWidth, y: maxHeight, z: 0.05 } },
    });

    const firstChild = resoniteObj.children[0];
    const secondChild = resoniteObj.children[1];
    const firstQuad = firstChild.components.find(
      (c) => c.type === '[FrooxEngine]FrooxEngine.QuadMesh'
    );
    const secondQuad = secondChild.components.find(
      (c) => c.type === '[FrooxEngine]FrooxEngine.QuadMesh'
    );

    expect(firstQuad?.fields.Size).toEqual({
      $type: 'float2',
      value: { x: faceWidth, y: firstHeight },
    });
    expect(secondQuad?.fields.Size).toEqual({
      $type: 'float2',
      value: { x: faceWidth, y: secondHeight },
    });

    const firstBottom = firstChild.position.y - firstHeight / 2;
    const secondBottom = secondChild.position.y - secondHeight / 2;
    expect(firstBottom).toBeCloseTo(-maxHeight / 2);
    expect(secondBottom).toBeCloseTo(-maxHeight / 2);
  });
});
