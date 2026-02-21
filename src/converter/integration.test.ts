import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { ResoniteObject } from '../domain/ResoniteObject';
import { extractZip } from '../parser/ZipExtractor';
import { parseXmlFiles } from '../parser/XmlParser';
import { buildImageAspectRatioMap, buildImageBlendModeMap } from './imageAspectRatioMap';
import { convertObjectsWithImageAssetContext } from './ObjectConverter';
import { COMPONENT_TYPES } from '../config/ResoniteComponentTypes';
import { buildImageAssetContext } from './imageAssetContext';

const SKIP_EXTERNAL_URL_DOWNLOAD_IN_CI = process.env.CI === 'true';
const SAMPLE_DICE_ZIP_PATH = path.join(process.cwd(), 'src', '__fixtures__', 'sample-dice.zip');
const SAMPLE_CARD_ZIP_PATH = path.join(process.cwd(), 'src', '__fixtures__', 'sample-card.zip');
const SAMPLE_MAPMASK_ZIP_PATH = path.join(
  process.cwd(),
  'src',
  '__fixtures__',
  'sample-mapmask.zip'
);
const SAMPLE_TERRAIN_ZIP_PATH = path.join(
  process.cwd(),
  'src',
  '__fixtures__',
  'sample-terrain.zip'
);
const SAMPLE_TERRAIN_LILY_ZIP_PATH = path.join(
  process.cwd(),
  'src',
  '__fixtures__',
  'sample-terrain-lily.zip'
);
const SAMPLE_TABLE_ZIP_PATH = path.join(process.cwd(), 'src', '__fixtures__', 'sample-table.zip');
const SAMPLE_CHARACTER_ZIP_PATH = path.join(
  process.cwd(),
  'src',
  '__fixtures__',
  'sample-character.zip'
);
const CONVERTER_INTEGRATION_TIMEOUT = 30000;

async function loadConvertedFromZip(zipPath: string): Promise<ResoniteObject[]> {
  const extracted = extractZip(zipPath);
  const parsed = parseXmlFiles(extracted.xmlFiles.map((f) => ({ name: f.name, data: f.data })));
  const imageAspectRatioMap = await buildImageAspectRatioMap(extracted.imageFiles, parsed.objects);
  const imageBlendModeMap = await buildImageBlendModeMap(extracted.imageFiles, parsed.objects);
  const imageAssetContext = buildImageAssetContext({
    imageAspectRatioMap,
    imageBlendModeMap,
  });
  return convertObjectsWithImageAssetContext(
    parsed.objects,
    imageAssetContext,
    undefined,
    parsed.extensions
  );
}

function flattenObjects(objects: ResoniteObject[]): ResoniteObject[] {
  const result: ResoniteObject[] = [];
  const visit = (obj: ResoniteObject): void => {
    result.push(obj);
    for (const child of obj.children) {
      visit(child);
    }
  };
  for (const obj of objects) {
    visit(obj);
  }
  return result;
}

describe.skipIf(SKIP_EXTERNAL_URL_DOWNLOAD_IN_CI)('Converter integration (sample-dice.zip)', () => {
  it(
    'converts parsed dice objects with image maps',
    async () => {
      const converted = await loadConvertedFromZip(SAMPLE_DICE_ZIP_PATH);
      const convertedDice = converted.filter((obj) => obj.name === 'D6');

      expect(convertedDice.length).toBeGreaterThan(0);
      const dice = convertedDice[0];
      expect(dice.components.map((c) => c.type)).toEqual([
        COMPONENT_TYPES.BOX_COLLIDER,
        COMPONENT_TYPES.GRABBABLE,
      ]);
      expect(dice.children.length).toBe(6);
      expect(dice.children.filter((child) => child.isActive)).toHaveLength(1);

      const material = dice.children[0].components.find(
        (c) => c.type === COMPONENT_TYPES.XIEXE_TOON_MATERIAL
      );
      expect(material?.fields.BlendMode).toEqual({
        $type: 'enum',
        value: 'Cutout',
        enumType: 'BlendMode',
      });
    },
    CONVERTER_INTEGRATION_TIMEOUT
  );
});

describe.skipIf(SKIP_EXTERNAL_URL_DOWNLOAD_IN_CI)('Converter integration (sample-card.zip)', () => {
  it(
    'converts card and card-stack objects',
    async () => {
      const converted = await loadConvertedFromZip(SAMPLE_CARD_ZIP_PATH);
      const flattened = flattenObjects(converted);

      const cards = flattened.filter((obj) => {
        const hasGrabbable = obj.components.some((c) => c.type === COMPONENT_TYPES.GRABBABLE);
        const hasCardCollider = obj.components.some(
          (c) =>
            c.type === COMPONENT_TYPES.BOX_COLLIDER &&
            (c.fields.Size as { value?: { y?: number } }).value?.y === 0.01
        );
        const front = obj.children.find((c) => c.id.endsWith('-front'));
        const back = obj.children.find((c) => c.id.endsWith('-back'));
        return hasGrabbable && hasCardCollider && !!front && !!back;
      });
      const stacks = flattened.filter((obj) =>
        obj.components.some(
          (c) =>
            c.type === COMPONENT_TYPES.BOX_COLLIDER &&
            (c.fields.Size as { value?: { y?: number } }).value?.y === 0.05
        )
      );

      expect(cards.length).toBeGreaterThan(0);
      expect(stacks.length).toBeGreaterThan(0);
    },
    CONVERTER_INTEGRATION_TIMEOUT
  );
});

describe.skipIf(SKIP_EXTERNAL_URL_DOWNLOAD_IN_CI)(
  'Converter integration (sample-mapmask.zip)',
  () => {
    it(
      'converts table-mask objects with alpha blend and thin collider',
      async () => {
        const converted = await loadConvertedFromZip(SAMPLE_MAPMASK_ZIP_PATH);
        const flattened = flattenObjects(converted);

        const masks = flattened.filter((obj) => {
          const material = obj.components.find(
            (c) => c.type === COMPONENT_TYPES.XIEXE_TOON_MATERIAL
          );
          const collider = obj.components.find((c) => c.type === COMPONENT_TYPES.BOX_COLLIDER);
          const blendMode = (material?.fields.BlendMode as { value?: string } | undefined)?.value;
          const colliderZ = (collider?.fields.Size as { value?: { z?: number } } | undefined)?.value
            ?.z;
          return obj.rotation.x === 90 && blendMode === 'Alpha' && colliderZ === 0.01;
        });

        expect(masks.length).toBeGreaterThan(0);
      },
      CONVERTER_INTEGRATION_TIMEOUT
    );
  }
);

describe.skipIf(SKIP_EXTERNAL_URL_DOWNLOAD_IN_CI)(
  'Converter integration (sample-terrain.zip)',
  () => {
    it(
      'converts terrain objects with top and individual wall child slots',
      async () => {
        const converted = await loadConvertedFromZip(SAMPLE_TERRAIN_ZIP_PATH);
        const flattened = flattenObjects(converted);

        const terrains = flattened.filter((obj) => {
          const top = obj.children.find((c) => c.id.endsWith('-top'));
          const hasAllWalls = ['-front', '-back', '-left', '-right'].every((suffix) =>
            obj.children.some((c) => c.id.endsWith(suffix))
          );
          const hasCollider = obj.components.some((c) => c.type === COMPONENT_TYPES.BOX_COLLIDER);
          return !!top && hasAllWalls && hasCollider;
        });

        expect(terrains.length).toBeGreaterThan(0);
        expect(
          terrains.some((terrain) =>
            terrain.components.some((c) => c.type === COMPONENT_TYPES.GRABBABLE)
          )
        ).toBe(true);
      },
      CONVERTER_INTEGRATION_TIMEOUT
    );
  }
);

describe.skipIf(SKIP_EXTERNAL_URL_DOWNLOAD_IN_CI)(
  'Converter integration (sample-terrain-lily.zip)',
  () => {
    it(
      'applies lily altitude extension to converted terrain root position',
      async () => {
        const converted = await loadConvertedFromZip(SAMPLE_TERRAIN_LILY_ZIP_PATH);
        const flattened = flattenObjects(converted);

        const altitudeTerrain = flattened.find(
          (obj) =>
            obj.sourceType === 'terrain' &&
            obj.position.x === 16 &&
            obj.position.y === 0.5 &&
            obj.position.z === -8
        );

        expect(altitudeTerrain).toBeDefined();
      },
      CONVERTER_INTEGRATION_TIMEOUT
    );

    it(
      'creates slope terrains with tilted top and one omitted wall',
      async () => {
        const converted = await loadConvertedFromZip(SAMPLE_TERRAIN_LILY_ZIP_PATH);
        const flattened = flattenObjects(converted);

        const slopeTerrains = flattened.filter((obj) => {
          if (obj.sourceType !== 'terrain') return false;
          const top = obj.children.find((c) => c.id.endsWith('-top'));
          if (!top) return false;
          const topMesh = top.children.find((c) => c.id.endsWith('-top-mesh'));
          if (!topMesh) return false;
          const wallCount = ['-front', '-back', '-left', '-right'].filter((suffix) =>
            obj.children.some((c) => c.id.endsWith(suffix))
          ).length;
          const triangleWallCount = obj.children.filter((wall) =>
            wall.components.some((component) => component.type === COMPONENT_TYPES.TRIANGLE_MESH)
          ).length;
          return (
            wallCount === 3 &&
            triangleWallCount === 2 &&
            (topMesh.rotation.x !== 0 || topMesh.rotation.y !== 0 || topMesh.rotation.z !== 0)
          );
        });

        expect(slopeTerrains.length).toBeGreaterThanOrEqual(4);
      },
      CONVERTER_INTEGRATION_TIMEOUT
    );
  }
);

describe.skipIf(SKIP_EXTERNAL_URL_DOWNLOAD_IN_CI)(
  'Converter integration (sample-table.zip)',
  () => {
    it(
      'shows only selected table when multiple tables are present',
      async () => {
        const converted = await loadConvertedFromZip(SAMPLE_TABLE_ZIP_PATH);
        const tables = converted.filter((obj) =>
          obj.children.some((child) => child.id.endsWith('-surface'))
        );

        expect(tables).toHaveLength(2);
        expect(tables.filter((table) => table.isActive === true)).toHaveLength(1);
        expect(tables.filter((table) => table.isActive === false)).toHaveLength(1);
        expect(tables.find((table) => table.name === '最初のテーブル')?.isActive).toBe(true);
        expect(tables.find((table) => table.name === '白紙のテーブル')?.isActive).toBe(false);
      },
      CONVERTER_INTEGRATION_TIMEOUT
    );
  }
);

describe.skipIf(SKIP_EXTERNAL_URL_DOWNLOAD_IN_CI)(
  'Converter integration (sample-character.zip)',
  () => {
    it(
      'applies character rotate/roll to slot rotation',
      async () => {
        const converted = await loadConvertedFromZip(SAMPLE_CHARACTER_ZIP_PATH);

        const rotated = converted.find((obj) => obj.rotation.y === 30);
        const rolled = converted.find((obj) => obj.rotation.z === 60);

        expect(rotated).toBeDefined();
        expect(rolled).toBeDefined();
      },
      CONVERTER_INTEGRATION_TIMEOUT
    );
  }
);
