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
const REFLECTION_DIR = path.join(FIXTURES_DIR, 'reflection');
const DEFAULT_TIMEOUT = 10000;

interface CollectedData {
  collectedAt: string;
  resoniteLinkVersion: string;
  responses: Record<string, unknown>;
}

type SavedFileInfo = {
  path: string;
  bytes: number;
};

const savedFiles: SavedFileInfo[] = [];

/**
 * Component types needed for Udonarium object representation in Resonite
 * Format: [Assembly]Namespace.ClassName
 * Reference: reso-decompile sources and resolink-mcp
 */
const REQUIRED_COMPONENTS = {
  // Mesh components (FrooxEngine namespace)
  mesh: ['[FrooxEngine]FrooxEngine.QuadMesh', '[FrooxEngine]FrooxEngine.BoxMesh'],
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
  textures: ['[FrooxEngine]FrooxEngine.StaticTexture2D'],
  // Interaction components (FrooxEngine namespace)
  interaction: ['[FrooxEngine]FrooxEngine.Grabbable', '[FrooxEngine]FrooxEngine.BoxCollider'],
  // UIX components (FrooxEngine.UIX namespace)
  uix: [
    '[FrooxEngine]FrooxEngine.UIX.Canvas',
    '[FrooxEngine]FrooxEngine.UIX.Text',
    '[FrooxEngine]FrooxEngine.UIX.VerticalLayout',
    '[FrooxEngine]FrooxEngine.UIX.Image',
  ],
} as const;

function ensureFixturesDir(): void {
  if (!fs.existsSync(FIXTURES_DIR)) {
    fs.mkdirSync(FIXTURES_DIR, { recursive: true });
  }
  if (!fs.existsSync(COMPONENTS_DIR)) {
    fs.mkdirSync(COMPONENTS_DIR, { recursive: true });
  }
  if (!fs.existsSync(REFLECTION_DIR)) {
    fs.mkdirSync(REFLECTION_DIR, { recursive: true });
  }
}

function saveJson(filename: string, data: unknown): void {
  const filepath = path.join(FIXTURES_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2) + '\n');
  if (filename !== '_metadata.json') {
    savedFiles.push({
      path: filename.replace(/\\/g, '/'),
      bytes: fs.statSync(filepath).size,
    });
  }
  console.log(`  [ok] Saved: ${filename}`);
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

function getConnectedLink(client: ResoniteLinkClient): {
  call: (message: Record<string, unknown>, binaryPayload?: ArrayBuffer) => Promise<unknown>;
} {
  const link = client.getClient();
  if (!link) {
    throw new Error('ResoniteLink client is not connected');
  }

  return {
    call: (message: Record<string, unknown>, binaryPayload?: ArrayBuffer) =>
      (
        link as unknown as {
          call: (m: Record<string, unknown>, p?: ArrayBuffer) => Promise<unknown>;
        }
      ).call(message, binaryPayload),
  };
}

async function collectSlotData(client: ResoniteLinkClient): Promise<void> {
  console.log('\nCollecting Slot Data...');

  const underlyingClient = getConnectedLink(client);

  // Create a test slot
  const testSlotId = `test_collect_${Date.now()}`;
  const createResponse = await underlyingClient.call({
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
  const getResponse = await underlyingClient.call({
    $type: 'getSlot',
    slotId: testSlotId,
    depth: 0,
    includeComponentData: false,
  });
  saveJson('getSlot-response.json', getResponse);

  // Get slot with depth
  const getDepthResponse = await underlyingClient.call({
    $type: 'getSlot',
    slotId: testSlotId,
    depth: 2,
    includeComponentData: true,
  });
  saveJson('getSlot-depth-response.json', getDepthResponse);

  // Update slot
  const updateResponse = await underlyingClient.call({
    $type: 'updateSlot',
    data: {
      id: testSlotId,
      position: { $type: 'float3', value: { x: 1, y: 2, z: 3 } },
    },
  });
  saveJson('updateSlot-response.json', updateResponse);

  // Remove slot (cleanup)
  const removeResponse = await underlyingClient.call({
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
  savedFiles.push({
    path: `components/${filename}`.replace(/\\/g, '/'),
    bytes: fs.statSync(filepath).size,
  });
  console.log(`    [ok] ${componentType} -> ${filename}`);
}

function saveReflectionJson(filename: string, data: unknown): void {
  const filepath = path.join(REFLECTION_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2) + '\n');
  savedFiles.push({
    path: `reflection/${filename}`.replace(/\\/g, '/'),
    bytes: fs.statSync(filepath).size,
  });
  console.log(`    [ok] reflection/${filename}`);
}

function extractResoniteLinkVersion(sessionResponse: unknown): string | undefined {
  if (!sessionResponse || typeof sessionResponse !== 'object') {
    return undefined;
  }
  const version = (sessionResponse as { resoniteLinkVersion?: unknown }).resoniteLinkVersion;
  return typeof version === 'string' && version.length > 0 ? version : undefined;
}

function buildResponseSummary(): Record<string, unknown> {
  const categories = {
    root: savedFiles.filter((f) => !f.path.includes('/')).length,
    components: savedFiles.filter((f) => f.path.startsWith('components/')).length,
    reflection: savedFiles.filter((f) => f.path.startsWith('reflection/')).length,
  };
  return {
    totalFiles: savedFiles.length,
    categories,
    files: savedFiles.map((f) => ({ path: f.path, bytes: f.bytes })),
  };
}

/**
 * Test creating a single component type
 */
async function testComponent(
  client: ResoniteLinkClient,
  slotId: string,
  componentType: string
): Promise<{ success: boolean; response: unknown; error?: string }> {
  const underlyingClient = getConnectedLink(client);
  const componentId = `test_${componentType.replace(/\./g, '_')}_${Date.now()}`;

  try {
    // Add component
    const addResponse = (await underlyingClient.call({
      $type: 'addComponent',
      containerSlotId: slotId,
      data: {
        id: componentId,
        componentType: componentType,
        members: {},
      },
    })) as { success?: boolean; errorInfo?: string };

    // Get component data if creation succeeded
    if (addResponse.success) {
      const getResponse = await underlyingClient.call({
        $type: 'getComponent',
        componentId: componentId,
      });

      // Remove component (cleanup)
      await underlyingClient.call({
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
  console.log('\nCollecting Component Data...');

  const underlyingClient = getConnectedLink(client);

  // Create a test slot first
  const testSlotId = `test_component_${Date.now()}`;
  await underlyingClient.call({
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
      console.log(`    [warn] ${componentType}: ${result.error}`);
    }
  }

  // Save summary
  const summary = {
    testedAt: new Date().toISOString(),
    totalComponents: allComponents.length,
    successful: Object.values(results).filter((r: unknown) => (r as { success: boolean }).success)
      .length,
    failed: Object.values(results).filter((r: unknown) => !(r as { success: boolean }).success)
      .length,
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

  console.log(
    `\n  Summary: ${summary.successful}/${summary.totalComponents} components successful`
  );

  // Cleanup: remove the test slot
  await underlyingClient.call({
    $type: 'removeSlot',
    slotId: testSlotId,
  });
}

async function collectTextureData(client: ResoniteLinkClient): Promise<void> {
  console.log('\nCollecting Texture Import Data...');

  const underlyingClient = getConnectedLink(client);

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

  const importResponse = await underlyingClient.call(
    {
      $type: 'importTexture2DRawData',
      width,
      height,
      colorProfile: 'sRGB',
    },
    arrayBuffer
  );
  saveJson('importTexture2DRawData-response.json', importResponse);
}

async function collectSessionData(client: ResoniteLinkClient): Promise<unknown> {
  console.log('\nCollecting Session Data...');

  const underlyingClient = getConnectedLink(client);

  const sessionResponse = await underlyingClient.call({
    $type: 'requestSessionData',
  });
  saveJson('requestSessionData-response.json', sessionResponse);
  return sessionResponse;
}

async function collectErrorResponses(client: ResoniteLinkClient): Promise<void> {
  console.log('\nCollecting Error Responses...');

  const underlyingClient = getConnectedLink(client);

  // Try to get a non-existent slot
  try {
    const notFoundResponse = await underlyingClient.call({
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

async function collectReflectionData(client: ResoniteLinkClient): Promise<void> {
  console.log('\nCollecting Reflection Data...');

  const underlyingClient = getConnectedLink(client);
  const allComponents = [
    ...REQUIRED_COMPONENTS.mesh,
    ...REQUIRED_COMPONENTS.rendering,
    ...REQUIRED_COMPONENTS.materials,
    ...REQUIRED_COMPONENTS.textures,
    ...REQUIRED_COMPONENTS.interaction,
    ...REQUIRED_COMPONENTS.uix,
  ];

  const captureReflection = async (
    filename: string,
    request: Record<string, unknown>,
    allowFailure = false
  ): Promise<void> => {
    try {
      const response = await underlyingClient.call(request);
      saveReflectionJson(filename, response);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!allowFailure) {
        throw error;
      }

      saveReflectionJson(filename.replace('-response.json', '-error.json'), {
        request,
        error: message,
      });
      console.log(`    [warn] reflection/${filename}: ${message}`);
    }
  };

  await captureReflection('getComponentTypeList-root-response.json', {
    $type: 'getComponentTypeList',
    categoryPath: '',
  });

  await captureReflection('getComponentTypeList-all-response.json', {
    $type: 'getComponentTypeList',
    categoryPath: '*',
  });

  const typeDefinitions = [
    { type: 'float3', filename: 'getTypeDefinition-float3-response.json' },
    {
      type: '[FrooxEngine]FrooxEngine.Slot',
      filename: 'getTypeDefinition-Slot-response.json',
    },
  ] as const;
  for (const typeDefinition of typeDefinitions) {
    await captureReflection(typeDefinition.filename, {
      $type: 'getTypeDefinition',
      type: typeDefinition.type,
    });
  }

  const enumTypes = ['[Renderite.Shared]Renderite.Shared.BillboardAlignment'] as const;
  for (const enumType of enumTypes) {
    const enumName = enumType.split('.').pop() ?? enumType;
    await captureReflection(
      `getEnumDefinition-${enumName}-response.json`,
      {
        $type: 'getEnumDefinition',
        type: enumType,
      },
      true
    );
  }

  for (const componentType of allComponents) {
    const componentName = componentType.split('.').pop();
    if (!componentName) {
      continue;
    }

    await captureReflection(
      `getComponentDefinition-${componentName}-response.json`,
      {
        $type: 'getComponentDefinition',
        componentType,
        flattened: true,
      },
      true
    );
  }
}

async function main(): Promise<void> {
  console.log('ResoniteLink Data Collection Script');
  console.log('=====================================');
  console.log('');

  const port = getResoniteLinkPort();
  const host = getResoniteLinkHost();

  if (!port) {
    console.error('[error] RESONITELINK_PORT is required');
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

  ensureFixturesDir();

  const client = new ResoniteLinkClient({ host, port });

  console.log(`Connecting to ResoniteLink at ${host}:${port}...`);

  try {
    await withTimeout(client.connect(), DEFAULT_TIMEOUT, 'Connection');
    console.log('  [ok] Connected!');
  } catch (error) {
    console.error('');
    console.error('[error] Failed to connect to ResoniteLink');
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
    const sessionResponse = await collectSessionData(client);
    collectedData.resoniteLinkVersion =
      extractResoniteLinkVersion(sessionResponse) ?? collectedData.resoniteLinkVersion;
    await collectReflectionData(client);

    // Collect various response types
    await collectSlotData(client);
    await collectComponentData(client);
    await collectTextureData(client);
    await collectErrorResponses(client);

    // Save metadata
    collectedData.collectedAt = new Date().toISOString();
    collectedData.responses = buildResponseSummary();
    saveJson('_metadata.json', collectedData);

    console.log('');
    console.log('[ok] Data collection complete!');
    console.log(`   Files saved to: ${FIXTURES_DIR}`);
  } catch (error) {
    console.error('');
    console.error('[error] Error during data collection:', error);
    process.exit(1);
  } finally {
    client.disconnect();
    console.log('');
    console.log('Disconnected from ResoniteLink');
  }
}

main().catch(console.error);
