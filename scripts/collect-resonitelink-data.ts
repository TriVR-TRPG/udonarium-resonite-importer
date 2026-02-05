/**
 * ResoniteLink Data Collection Script
 *
 * This script collects actual response data from ResoniteLink
 * for use in mock tests. Run this when ResoniteLink API changes.
 *
 * Prerequisites:
 * 1. Resonite is running with ResoniteLink enabled
 * 2. Default port 7869 is used (or modify the script)
 *
 * Usage:
 *   npm run collect:resonitelink
 */

import * as fs from 'fs';
import * as path from 'path';
import { ResoniteLinkClient } from '../src/resonite/ResoniteLinkClient';

const FIXTURES_DIR = path.join(__dirname, '../src/__fixtures__/resonitelink');
const DEFAULT_TIMEOUT = 10000;

interface CollectedData {
  collectedAt: string;
  resoniteLinkVersion: string;
  responses: Record<string, unknown>;
}

async function ensureFixturesDir(): Promise<void> {
  if (!fs.existsSync(FIXTURES_DIR)) {
    fs.mkdirSync(FIXTURES_DIR, { recursive: true });
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

  // Add a component
  const componentId = `test_comp_${Date.now()}`;
  const addComponentResponse = await underlyingClient.send({
    $type: 'addComponent',
    containerSlotId: testSlotId,
    data: {
      id: componentId,
      componentType: 'FrooxEngine.Comment',
      members: {},
    },
  });
  saveJson('addComponent-response.json', addComponentResponse);

  // Get component
  const getComponentResponse = await underlyingClient.send({
    $type: 'getComponent',
    componentId: componentId,
  });
  saveJson('getComponent-response.json', getComponentResponse);

  // Remove component
  const removeComponentResponse = await underlyingClient.send({
    $type: 'removeComponent',
    componentId: componentId,
  });
  saveJson('removeComponent-response.json', removeComponentResponse);

  // Cleanup: remove the test slot
  await underlyingClient.send({
    $type: 'removeSlot',
    slotId: testSlotId,
  });
}

async function collectTextureData(client: ResoniteLinkClient): Promise<void> {
  console.log('\n🖼️  Collecting Texture Import Data...');

  const underlyingClient = client.getClient();

  // Create a simple 2x2 red PNG for testing
  // PNG header + IHDR + IDAT (minimal red image) + IEND
  const pngData = createMinimalPNG(2, 2, [255, 0, 0, 255]);

  const arrayBuffer = new ArrayBuffer(pngData.length);
  const view = new Uint8Array(arrayBuffer);
  view.set(pngData);

  const importResponse = await underlyingClient.send(
    {
      $type: 'importTexture2DRawData',
      width: 2,
      height: 2,
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
  console.log('Prerequisites:');
  console.log('  - Resonite is running');
  console.log('  - ResoniteLink is enabled (default port 7869)');
  console.log('');

  await ensureFixturesDir();

  const client = new ResoniteLinkClient({ host: 'localhost', port: 7869 });

  console.log('🔌 Connecting to ResoniteLink...');

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
    console.error('  3. Port 7869 is not blocked');
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
