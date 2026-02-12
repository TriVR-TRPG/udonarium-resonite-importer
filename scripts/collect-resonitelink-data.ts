/**
 * ResoniteLink Data Collection Script
 *
 * This script collects actual response data from ResoniteLink
 * for use in mock tests. Run this when ResoniteLink API changes.
 *
 * Prerequisites:
 * 1. Resonite is running with ResoniteLink enabled
 * 2. Set RESONITELINK_PORT environment variable or create .env file
 *
 * Usage:
 *   npm run collect:resonitelink
 */

import * as dotenv from 'dotenv';
dotenv.config();

import * as fs from 'fs';
import * as path from 'path';
import { ResoniteLinkClient } from '../src/resonite/ResoniteLinkClient';
import { getResoniteLinkPort, getResoniteLinkHost } from '../src/config/MappingConfig';

const FIXTURES_DIR = path.join(__dirname, '../src/__fixtures__/resonitelink');
const COMPONENTS_DIR = path.join(FIXTURES_DIR, 'components');
const DEFAULT_TIMEOUT = 10000;

interface CollectedData {
  collectedAt: string;
  resoniteLinkVersion: string;
  responses: Record<string, unknown>;
}

/**
 * Component types needed for Udonarium object representation in Resonite
 * Format: [Assembly]Namespace.ClassName
 * Reference: reso-decompile sources and resolink-mcp
 */
const REQUIRED_COMPONENTS = {
  // Mesh components (FrooxEngine namespace)
  mesh: [
    '[FrooxEngine]FrooxEngine.QuadMesh',
    '[FrooxEngine]FrooxEngine.BoxMesh',
  ],
  // Rendering components (FrooxEngine namespace)
  rendering: [
    '[FrooxEngine]FrooxEngine.MeshRenderer',
    '[FrooxEngine]FrooxEngine.MainTexturePropertyBlock',
  ],
  // Material components (FrooxEngine namespace)
  materials: [
    '[FrooxEngine]FrooxEngine.XiexeToonMaterial',
    '[FrooxEngine]FrooxEngine.PBS_Metallic',
    '[FrooxEngine]FrooxEngine.UnlitMaterial',
  ],
  // Texture components (FrooxEngine namespace)
  textures: [
    '[FrooxEngine]FrooxEngine.StaticTexture2D',
  ],
  // Interaction components (FrooxEngine namespace)
  interaction: [
    '[FrooxEngine]FrooxEngine.Grabbable',
    '[FrooxEngine]FrooxEngine.BoxCollider',
  ],
  // UIX components (FrooxEngine.UIX namespace)
  uix: [
    '[FrooxEngine]FrooxEngine.UIX.Canvas',
    '[FrooxEngine]FrooxEngine.UIX.Text',
    '[FrooxEngine]FrooxEngine.UIX.VerticalLayout',
    '[FrooxEngine]FrooxEngine.UIX.Image',
  ],
} as const;

async function ensureFixturesDir(): Promise<void> {
  if (!fs.existsSync(FIXTURES_DIR)) {
    fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  }
  if (!fs.existsSync(COMPONENTS_DIR)) {
    fs.mkdirSync(COMPONENTS_DIR, { recursive: true });
  }
}

function saveJson(filename: string, data: unknown): void {
  const filepath = path.join(FIXTURES_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2) + '\n');
  console.log(`  ✓ Saved: ${filename}`);
}

async function withTimeout<T>(promise: Promise<T>, ms: number, operation: string): Promise<T> {
  let timeoutId: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${operation} timed out after ${ms}ms`)), ms);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!);
    throw error;
  }
}

async function collectSlotData(client: ResoniteLinkClient): Promise<void> {
  console.log('\n📦 Collecting Slot Data...');

  const underlyingClient = client.getClient();

  // Create a test slot
  const testSlotId = `test_collect_${Date.now()}`;
  const createResponse = await underlyingClient.send({
    $type: 'addSlot',
    data: {
      id: testSlotId,
      name: { $type: 'string', value: 'DataCollectionTest' },
      position: { $type: 'float3', value: { x: 0, y: 1, z: 0 } },
      scale: { $type: 'float3', value: { x: 0.1, y: 0.1, z: 0.1 } },
      rotation: { $type: 'floatQ', value: { x: 0, y: 0, z: 0, w: 1 } },
      isActive: { $type: 'bool', value: true },
      isPersistent: { $type: 'bool', value: false },
      tag: { $type: 'string', value: '' },
      orderOffset: { $type: 'long', value: 0 },
    },
  });
  saveJson('addSlot-response.json', createResponse);

  // Get the slot
  const getResponse = await underlyingClient.send({
    $type: 'getSlot',
    slotId: testSlotId,
    depth: 0,
    includeComponentData: false,
  });
  saveJson('getSlot-response.json', getResponse);

  // Get slot with depth
  const getDepthResponse = await underlyingClient.send({
    $type: 'getSlot',
    slotId: testSlotId,
    depth: 2,
    includeComponentData: true,
  });
  saveJson('getSlot-depth-response.json', getDepthResponse);

  // Update slot
  const updateResponse = await underlyingClient.send({
    $type: 'updateSlot',
    data: {
      id: testSlotId,
      position: { $type: 'float3', value: { x: 1, y: 2, z: 3 } },
    },
  });
  saveJson('updateSlot-response.json', updateResponse);

  // Remove slot (cleanup)
  const removeResponse = await underlyingClient.send({
    $type: 'removeSlot',
    slotId: testSlotId,
  });
  saveJson('removeSlot-response.json', removeResponse);
}

/**
 * Helper to save component test results
 */
function saveComponentJson(componentType: string, data: unknown): void {
  // Convert component type to filename (e.g., "FrooxEngine.QuadMesh" -> "QuadMesh")
  const filename = componentType.split('.').pop() + '.json';
  const filepath = path.join(COMPONENTS_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2) + '\n');
  console.log(`    ✓ ${componentType} -> ${filename}`);
}

/**
 * Test creating a single component type
 */
async function testComponent(
  client: ResoniteLinkClient,
  slotId: string,
  componentType: string
): Promise<{ success: boolean; response: unknown; error?: string }> {
  const underlyingClient = client.getClient();
  const componentId = `test_${componentType.replace(/\./g, '_')}_${Date.now()}`;

  try {
    // Add component
    const addResponse = await underlyingClient.send({
      $type: 'addComponent',
      containerSlotId: slotId,
      data: {
        id: componentId,
        componentType: componentType,
        members: {},
      },
    });

    // Get component data if creation succeeded
    if (addResponse.success) {
      const getResponse = await underlyingClient.send({
        $type: 'getComponent',
        componentId: componentId,
      });

      // Remove component (cleanup)
      await underlyingClient.send({
        $type: 'removeComponent',
        componentId: componentId,
      });

      return {
        success: true,
        response: {
          componentType,
          addResponse,
          getResponse,
        },
      };
    } else {
      return {
        success: false,
        response: {
          componentType,
          addResponse,
        },
        error: addResponse.errorInfo || 'Unknown error',
      };
    }
  } catch (error) {
    return {
      success: false,
      response: {
        componentType,
        error: error instanceof Error ? error.message : String(error),
      },
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function collectComponentData(client: ResoniteLinkClient): Promise<void> {
  console.log('\n🔧 Collecting Component Data...');

  const underlyingClient = client.getClient();

  // Create a test slot first
  const testSlotId = `test_component_${Date.now()}`;
  await underlyingClient.send({
    $type: 'addSlot',
    data: {
      id: testSlotId,
      name: { $type: 'string', value: 'ComponentTest' },
      position: { $type: 'float3', value: { x: 0, y: 0, z: 0 } },
      scale: { $type: 'float3', value: { x: 1, y: 1, z: 1 } },
      rotation: { $type: 'floatQ', value: { x: 0, y: 0, z: 0, w: 1 } },
      isActive: { $type: 'bool', value: true },
      isPersistent: { $type: 'bool', value: false },
      tag: { $type: 'string', value: '' },
      orderOffset: { $type: 'long', value: 0 },
    },
  });

  const results: Record<string, unknown> = {};
  const allComponents = [
    ...REQUIRED_COMPONENTS.mesh,
    ...REQUIRED_COMPONENTS.rendering,
    ...REQUIRED_COMPONENTS.materials,
    ...REQUIRED_COMPONENTS.textures,
    ...REQUIRED_COMPONENTS.interaction,
    ...REQUIRED_COMPONENTS.uix,
  ];

  console.log(`  Testing ${allComponents.length} component types...`);

  for (const componentType of allComponents) {
    const result = await testComponent(client, testSlotId, componentType);
    results[componentType] = result;
    saveComponentJson(componentType, result.response);

    if (!result.success) {
      console.log(`    ⚠ ${componentType}: ${result.error}`);
    }
  }

  // Save summary
  const summary = {
    testedAt: new Date().toISOString(),
    totalComponents: allComponents.length,
    successful: Object.values(results).filter((r: unknown) => (r as { success: boolean }).success).length,
    failed: Object.values(results).filter((r: unknown) => !(r as { success: boolean }).success).length,
    results: Object.fromEntries(
      Object.entries(results).map(([type, result]) => [
        type,
        {
          success: (result as { success: boolean }).success,
          error: (result as { error?: string }).error,
        },
      ])
    ),
  };
  saveJson('components/_summary.json', summary);

  console.log(`\n  Summary: ${summary.successful}/${summary.totalComponents} components successful`);

  // Cleanup: remove the test slot
  await underlyingClient.send({
    $type: 'removeSlot',
    slotId: testSlotId,
  });
}

async function collectTextureData(client: ResoniteLinkClient): Promise<void> {
  console.log('\n🖼️  Collecting Texture Import Data...');

  const underlyingClient = client.getClient();

  // Create raw RGBA pixel data (not PNG-encoded)
  // importTexture2DRawData expects raw 8-bit RGBA bytes, not encoded image files
  const width = 2;
  const height = 2;
  const rgba = [255, 0, 0, 255]; // Red color

  // Create raw RGBA data: width * height * 4 bytes
  const rawData = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    rawData[i * 4 + 0] = rgba[0]; // R
    rawData[i * 4 + 1] = rgba[1]; // G
    rawData[i * 4 + 2] = rgba[2]; // B
    rawData[i * 4 + 3] = rgba[3]; // A
  }

  const arrayBuffer = rawData.buffer;

  const importResponse = await underlyingClient.send(
    {
      $type: 'importTexture2DRawData',
      width,
      height,
      colorProfile: 'sRGB',
      messageId: '',
    },
    arrayBuffer
  );
  saveJson('importTexture2DRawData-response.json', importResponse);
}

async function collectSessionData(client: ResoniteLinkClient): Promise<void> {
  console.log('\n📋 Collecting Session Data...');

  const underlyingClient = client.getClient();

  const sessionResponse = await underlyingClient.send({
    $type: 'requestSessionData',
  });
  saveJson('requestSessionData-response.json', sessionResponse);
}

async function collectErrorResponses(client: ResoniteLinkClient): Promise<void> {
  console.log('\n❌ Collecting Error Responses...');

  const underlyingClient = client.getClient();

  // Try to get a non-existent slot
  try {
    const notFoundResponse = await underlyingClient.send({
      $type: 'getSlot',
      slotId: 'non_existent_slot_id_12345',
      depth: 0,
      includeComponentData: false,
    });
    saveJson('getSlot-notFound-response.json', notFoundResponse);
  } catch (error) {
    saveJson('getSlot-notFound-error.json', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

function createMinimalPNG(width: number, height: number, rgba: number[]): Uint8Array {
  // This creates a minimal valid PNG with a solid color
  // For simplicity, we just return raw RGBA data encoded in a minimal PNG structure

  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

  // IHDR chunk
  const ihdr = createPNGChunk('IHDR', [
    (width >> 24) & 0xff,
    (width >> 16) & 0xff,
    (width >> 8) & 0xff,
    width & 0xff,
    (height >> 24) & 0xff,
    (height >> 16) & 0xff,
    (height >> 8) & 0xff,
    height & 0xff,
    8, // bit depth
    6, // color type (RGBA)
    0, // compression
    0, // filter
    0, // interlace
  ]);

  // IDAT chunk (uncompressed for simplicity - actually need zlib compression)
  // For a real PNG, we'd need proper zlib compression
  // This is a minimal approach using raw deflate

  const rawData: number[] = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0); // filter byte
    for (let x = 0; x < width; x++) {
      rawData.push(...rgba);
    }
  }

  // Simple zlib wrapper (no compression)
  const zlibData = [
    0x78,
    0x01, // zlib header (no compression)
    ...deflateNoCompression(rawData),
  ];

  const idat = createPNGChunk('IDAT', zlibData);

  // IEND chunk
  const iend = createPNGChunk('IEND', []);

  return new Uint8Array([...signature, ...ihdr, ...idat, ...iend]);
}

function createPNGChunk(type: string, data: number[]): number[] {
  const length = data.length;
  const typeBytes = type.split('').map((c) => c.charCodeAt(0));
  const chunk = [...typeBytes, ...data];

  // CRC32 of type + data
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
  // Deflate with no compression (stored blocks)
  const result: number[] = [];
  const blockSize = 65535;

  for (let i = 0; i < data.length; i += blockSize) {
    const block = data.slice(i, i + blockSize);
    const isLast = i + blockSize >= data.length;
    const len = block.length;
    const nlen = ~len & 0xffff;

    result.push(isLast ? 0x01 : 0x00); // BFINAL + BTYPE
    result.push(len & 0xff, (len >> 8) & 0xff);
    result.push(nlen & 0xff, (nlen >> 8) & 0xff);
    result.push(...block);
  }

  // Adler-32 checksum
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

async function main(): Promise<void> {
  console.log('🚀 ResoniteLink Data Collection Script');
  console.log('=====================================');
  console.log('');

  const port = getResoniteLinkPort();
  const host = getResoniteLinkHost();

  if (!port) {
    console.error('❌ RESONITELINK_PORT is required');
    console.error('');
    console.error('Set via environment variable:');
    console.error('  RESONITELINK_PORT=<port> npm run collect:resonitelink');
    console.error('');
    console.error('Or create a .env file with:');
    console.error('  RESONITELINK_PORT=<port>');
    process.exit(1);
  }

  console.log('Prerequisites:');
  console.log('  - Resonite is running');
  console.log(`  - ResoniteLink is enabled (port ${port})`);
  console.log('');

  await ensureFixturesDir();

  const client = new ResoniteLinkClient({ host, port });

  console.log(`🔌 Connecting to ResoniteLink at ${host}:${port}...`);

  try {
    await withTimeout(client.connect(), DEFAULT_TIMEOUT, 'Connection');
    console.log('  ✓ Connected!');
  } catch (error) {
    console.error('');
    console.error('❌ Failed to connect to ResoniteLink');
    console.error('');
    console.error('Please ensure:');
    console.error('  1. Resonite is running');
    console.error('  2. ResoniteLink is enabled in Resonite settings');
    console.error(`  3. Port ${port} is correct (check ResoniteLink component)`);
    console.error('');
    console.error('Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }

  const collectedData: CollectedData = {
    collectedAt: new Date().toISOString(),
    resoniteLinkVersion: 'unknown', // Will be updated if available
    responses: {},
  };

  try {
    // Collect session data first to get version info
    await collectSessionData(client);

    // Collect various response types
    await collectSlotData(client);
    await collectComponentData(client);
    await collectTextureData(client);
    await collectErrorResponses(client);

    // Save metadata
    collectedData.collectedAt = new Date().toISOString();
    saveJson('_metadata.json', collectedData);

    console.log('');
    console.log('✅ Data collection complete!');
    console.log(`   Files saved to: ${FIXTURES_DIR}`);
  } catch (error) {
    console.error('');
    console.error('❌ Error during data collection:', error);
    process.exit(1);
  } finally {
    client.disconnect();
    console.log('');
    console.log('🔌 Disconnected from ResoniteLink');
  }
}

main().catch(console.error);
