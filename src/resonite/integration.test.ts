/**
 * Integration tests for ResoniteLink functionality
 *
 * These tests require a running Resonite instance with ResoniteLink enabled.
 * They are skipped by default and only run when RESONITE_LINK_AVAILABLE=true.
 *
 * To run integration tests:
 *   RESONITE_LINK_AVAILABLE=true RESONITELINK_PORT=<port> npm run test -- --testNamePattern="Integration"
 *
 * Or:
 *   RESONITE_LINK_AVAILABLE=true RESONITELINK_PORT=<port> npm run test:integration
 *
 * You can also set RESONITE_LINK_AVAILABLE and RESONITELINK_PORT in a .env file.
 */

import * as dotenv from 'dotenv';
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { ResoniteLinkClient } from './ResoniteLinkClient';
import { SlotBuilder } from './SlotBuilder';
import { AssetImporter } from './AssetImporter';
import { ResoniteObject } from '../domain/ResoniteObject';
import { ExtractedFile } from '../parser/ZipExtractor';
import { getResoniteLinkPort, getResoniteLinkHost } from '../config/MappingConfig';

dotenv.config();

const SKIP_INTEGRATION = process.env.RESONITE_LINK_AVAILABLE !== 'true';
const TEST_TIMEOUT = 30000; // 30 seconds for integration tests

// Get connection settings from environment variables
const RESONITELINK_PORT = getResoniteLinkPort();
const RESONITELINK_HOST = getResoniteLinkHost();

function isClose(a: number, b: number, epsilon = 1e-3): boolean {
  return Math.abs(a - b) <= epsilon;
}

function isQuaternionClose(
  actual: { x: number; y: number; z: number; w: number },
  expected: { x: number; y: number; z: number; w: number },
  epsilon = 1e-3
): boolean {
  const direct =
    isClose(actual.x, expected.x, epsilon) &&
    isClose(actual.y, expected.y, epsilon) &&
    isClose(actual.z, expected.z, epsilon) &&
    isClose(actual.w, expected.w, epsilon);
  const negated =
    isClose(actual.x, -expected.x, epsilon) &&
    isClose(actual.y, -expected.y, epsilon) &&
    isClose(actual.z, -expected.z, epsilon) &&
    isClose(actual.w, -expected.w, epsilon);
  return direct || negated;
}

// Helper to create test objects
const createTestResoniteObject = (id: string, name: string): ResoniteObject => ({
  id,
  name,
  position: { x: 0, y: 1, z: 0 },
  rotation: { x: 0, y: 0, z: 0 },
  components: [],
  children: [],
  isActive: true,
});

// Helper to create a minimal PNG image
let testImageCounter = 0;
const createTestImage = (): ExtractedFile => {
  // Create a minimal 2x2 red PNG
  const pngData = createMinimalPNG(2, 2, [255, 0, 0, 255]);
  const name = `test-image-${Date.now()}-${testImageCounter++}.png`;
  return {
    path: `images/${name}`,
    name,
    data: Buffer.from(pngData),
  };
};

function createMinimalPNG(width: number, height: number, rgba: number[]): Uint8Array {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

  const ihdr = createPNGChunk('IHDR', [
    (width >> 24) & 0xff,
    (width >> 16) & 0xff,
    (width >> 8) & 0xff,
    width & 0xff,
    (height >> 24) & 0xff,
    (height >> 16) & 0xff,
    (height >> 8) & 0xff,
    height & 0xff,
    8,
    6,
    0,
    0,
    0,
  ]);

  const rawData: number[] = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0);
    for (let x = 0; x < width; x++) {
      rawData.push(...rgba);
    }
  }

  const zlibData = [0x78, 0x01, ...deflateNoCompression(rawData)];
  const idat = createPNGChunk('IDAT', zlibData);
  const iend = createPNGChunk('IEND', []);

  return new Uint8Array([...signature, ...ihdr, ...idat, ...iend]);
}

function createPNGChunk(type: string, data: number[]): number[] {
  const length = data.length;
  const typeBytes = type.split('').map((c) => c.charCodeAt(0));
  const chunk = [...typeBytes, ...data];
  const crc = crc32(chunk);

  return [
    (length >> 24) & 0xff,
    (length >> 16) & 0xff,
    (length >> 8) & 0xff,
    length & 0xff,
    ...chunk,
    (crc >> 24) & 0xff,
    (crc >> 16) & 0xff,
    (crc >> 8) & 0xff,
    crc & 0xff,
  ];
}

function deflateNoCompression(data: number[]): number[] {
  const result: number[] = [];
  const blockSize = 65535;

  for (let i = 0; i < data.length; i += blockSize) {
    const block = data.slice(i, i + blockSize);
    const isLast = i + blockSize >= data.length;
    const len = block.length;
    const nlen = ~len & 0xffff;

    result.push(isLast ? 0x01 : 0x00);
    result.push(len & 0xff, (len >> 8) & 0xff);
    result.push(nlen & 0xff, (nlen >> 8) & 0xff);
    result.push(...block);
  }

  const adler = adler32(data);
  result.push((adler >> 24) & 0xff, (adler >> 16) & 0xff, (adler >> 8) & 0xff, adler & 0xff);

  return result;
}

function crc32(data: number[]): number {
  let crc = 0xffffffff;
  const table = getCRC32Table();

  for (const byte of data) {
    crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

let crc32Table: number[] | null = null;
function getCRC32Table(): number[] {
  if (crc32Table) return crc32Table;

  crc32Table = [];
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    crc32Table.push(c >>> 0);
  }
  return crc32Table;
}

function adler32(data: number[]): number {
  let a = 1;
  let b = 0;
  const MOD = 65521;

  for (const byte of data) {
    a = (a + byte) % MOD;
    b = (b + a) % MOD;
  }

  return ((b << 16) | a) >>> 0;
}

describe.skipIf(SKIP_INTEGRATION)('ResoniteLink Integration Tests', () => {
  let client: ResoniteLinkClient;
  const createdSlotIds: string[] = [];

  beforeAll(async () => {
    if (!RESONITELINK_PORT) {
      throw new Error(
        'RESONITELINK_PORT environment variable is required for integration tests.\n' +
          'Set it via: RESONITE_LINK_AVAILABLE=true RESONITELINK_PORT=<port> npm run test:integration\n' +
          'Or add RESONITELINK_PORT=<port> to your .env file.'
      );
    }
    client = new ResoniteLinkClient({ host: RESONITELINK_HOST, port: RESONITELINK_PORT });
    await client.connect();
  }, TEST_TIMEOUT);

  afterAll(async () => {
    if (!client) {
      return;
    }

    // Cleanup: Remove all created slots
    for (const slotId of createdSlotIds) {
      try {
        await client.removeSlot(slotId);
      } catch {
        // Ignore cleanup errors
      }
    }
    client.disconnect();
  });

  afterEach(() => {
    // Small delay between tests to avoid overwhelming ResoniteLink
    return new Promise((resolve) => setTimeout(resolve, 100));
  });

  describe('ResoniteLinkClient', () => {
    it(
      'should connect to ResoniteLink',
      () => {
        expect(client.isConnected()).toBe(true);
      },
      TEST_TIMEOUT
    );

    it(
      'should get root slot',
      async () => {
        const rootSlot = await client.getRootSlot();
        expect(rootSlot).toBeDefined();
      },
      TEST_TIMEOUT
    );

    it(
      'should create a slot',
      async () => {
        const testId = `integration_test_${Date.now()}`;
        createdSlotIds.push(testId);

        const slotId = await client.addSlot({
          id: testId,
          parentId: 'Root',
          name: 'Integration Test Slot',
          position: { x: 0, y: 1, z: 0 },
          scale: { x: 0.1, y: 0.1, z: 0.1 },
        });

        expect(slotId).toBe(testId);
      },
      TEST_TIMEOUT
    );

    it(
      'should update a slot',
      async () => {
        const testId = `integration_test_update_${Date.now()}`;
        createdSlotIds.push(testId);

        // Create slot first
        await client.addSlot({
          id: testId,
          parentId: 'Root',
          name: 'Update Test Slot',
          position: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
        });

        // Update slot
        await expect(
          client.updateSlot({
            id: testId,
            position: { x: 1, y: 2, z: 3 },
          })
        ).resolves.not.toThrow();
      },
      TEST_TIMEOUT
    );

    it(
      'should apply rotation update and return matching quaternion via ResoniteLink',
      async () => {
        const testId = `integration_test_rotation_${Date.now()}`;
        createdSlotIds.push(testId);

        await client.addSlot({
          id: testId,
          parentId: 'Root',
          name: 'Rotation Test Slot',
          position: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 },
        });

        await client.updateSlot({
          id: testId,
          rotation: { x: 0, y: -30, z: 180 },
        });

        const transform = await client.getSlotTransform(testId);
        expect(transform).toBeDefined();

        // Expected quaternion for Euler (0, -30, 180), matching Resonite floatQ.Euler.
        const expected = { x: -0.258819, y: 0, z: 0.965926, w: 0 };
        expect(
          isQuaternionClose(transform!.rotation, expected),
          `rotation quaternion mismatch: actual=${JSON.stringify(transform!.rotation)}`
        ).toBe(true);
      },
      TEST_TIMEOUT
    );

    it(
      'should import texture from file',
      async () => {
        const testImage = createTestImage();

        // Write to temp file like AssetImporter does
        const fs = await import('fs');
        const os = await import('os');
        const path = await import('path');
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'resonite-test-'));
        const tempFile = path.join(tempDir, testImage.name);
        fs.writeFileSync(tempFile, testImage.data);

        try {
          const textureId = await client.importTexture(tempFile);

          expect(textureId).toBeDefined();
          expect(typeof textureId).toBe('string');
        } finally {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      },
      TEST_TIMEOUT
    );
  });

  describe('SlotBuilder Integration', () => {
    let slotBuilder: SlotBuilder;

    beforeAll(async () => {
      const slotBuilderRootId = `slotbuilder_root_${Date.now()}`;
      await client.addSlot({
        id: slotBuilderRootId,
        parentId: 'Root',
        name: 'SlotBuilder Integration Root',
        position: { x: 0, y: 0, z: 0 },
      });
      createdSlotIds.push(slotBuilderRootId);
      slotBuilder = new SlotBuilder(client, slotBuilderRootId);
    });

    it(
      'should build a single slot',
      async () => {
        const testId = `slotbuilder_test_${Date.now()}`;
        createdSlotIds.push(testId);

        const testObject = createTestResoniteObject(testId, 'SlotBuilder Test');
        const result = await slotBuilder.buildSlot(testObject);

        expect(result.success).toBe(true);
        expect(result.slotId).toBe(testId);
      },
      TEST_TIMEOUT
    );

    it(
      'should build nested slots',
      async () => {
        const parentId = `slotbuilder_parent_${Date.now()}`;
        const childId = `slotbuilder_child_${Date.now()}`;
        createdSlotIds.push(parentId);

        const childObject = createTestResoniteObject(childId, 'Child Slot');
        const parentObject: ResoniteObject = {
          ...createTestResoniteObject(parentId, 'Parent Slot'),
          children: [childObject],
        };

        const result = await slotBuilder.buildSlot(parentObject);

        expect(result.success).toBe(true);
      },
      TEST_TIMEOUT
    );

    it(
      'should build multiple slots with progress callback',
      async () => {
        const objects = [
          createTestResoniteObject(`multi_test_1_${Date.now()}`, 'Multi Test 1'),
          createTestResoniteObject(`multi_test_2_${Date.now()}`, 'Multi Test 2'),
        ];

        objects.forEach((obj) => createdSlotIds.push(obj.id));

        const progressCalls: Array<{ current: number; total: number }> = [];
        const results = await slotBuilder.buildSlots(objects, (current, total) => {
          progressCalls.push({ current, total });
        });

        expect(results).toHaveLength(2);
        expect(results.every((r) => r.success)).toBe(true);
        expect(progressCalls).toHaveLength(2);
        expect(progressCalls[0]).toEqual({ current: 1, total: 2 });
        expect(progressCalls[1]).toEqual({ current: 2, total: 2 });
      },
      TEST_TIMEOUT
    );

    it(
      'should create import group',
      async () => {
        const groupId = await slotBuilder.createImportGroup('Test Import Group');
        createdSlotIds.push(groupId);

        expect(groupId).toMatch(/^udon-imp-[0-9a-f-]{36}$/);
      },
      TEST_TIMEOUT
    );
  });

  describe('AssetImporter Integration', () => {
    let assetImporter: AssetImporter;

    beforeAll(() => {
      assetImporter = new AssetImporter(client);
    });

    it(
      'should import a single image',
      async () => {
        const testImage = createTestImage();
        const result = await assetImporter.importImage(testImage);

        expect(result.success).toBe(true);
        expect(result.identifier).toBe(testImage.name);
        expect(result.textureId).toBeDefined();
        expect(result.textureId.length).toBeGreaterThan(0);
      },
      TEST_TIMEOUT
    );

    it(
      'should cache imported images',
      async () => {
        const testImage = createTestImage();

        // Import twice
        const result1 = await assetImporter.importImage(testImage);
        const result2 = await assetImporter.importImage(testImage);

        expect(result1.success).toBe(true);
        expect(result2.success).toBe(true);
        expect(result1.textureId).toBe(result2.textureId);
      },
      TEST_TIMEOUT
    );

    it(
      'should import multiple images with progress',
      async () => {
        const images = [createTestImage(), createTestImage(), createTestImage()];

        const progressCalls: Array<{ current: number; total: number }> = [];
        const results = await assetImporter.importImages(images, (current, total) => {
          progressCalls.push({ current, total });
        });

        expect(results).toHaveLength(3);
        expect(results.every((r) => r.success)).toBe(true);
        expect(progressCalls).toHaveLength(3);
      },
      TEST_TIMEOUT
    );

    it(
      'should retrieve texture ID from cache',
      async () => {
        const testImage = createTestImage();
        await assetImporter.importImage(testImage);

        const textureId = assetImporter.getTextureId(testImage.name);
        expect(textureId).toBeDefined();
      },
      TEST_TIMEOUT
    );

    it(
      'should return all imported image asset info',
      async () => {
        // Create a fresh importer
        const freshImporter = new AssetImporter(client);
        const image1 = createTestImage();
        const image2 = createTestImage();

        await freshImporter.importImage(image1);
        await freshImporter.importImage(image2);

        const infoMap = freshImporter.getImportedImageAssetInfoMap();
        expect(infoMap.size).toBe(2);
        expect(infoMap.has(image1.name)).toBe(true);
        expect(infoMap.has(image2.name)).toBe(true);
      },
      TEST_TIMEOUT
    );
  });
});

// Also export a simple connection test that can be run independently
describe.skipIf(SKIP_INTEGRATION)('ResoniteLink Connection Test', () => {
  it(
    'can connect and disconnect',
    async () => {
      if (!RESONITELINK_PORT) {
        throw new Error('RESONITELINK_PORT environment variable is required');
      }
      const client = new ResoniteLinkClient({ host: RESONITELINK_HOST, port: RESONITELINK_PORT });

      await client.connect();
      expect(client.isConnected()).toBe(true);

      client.disconnect();
      // Give time for disconnect to complete
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(client.isConnected()).toBe(false);
    },
    TEST_TIMEOUT
  );
});
