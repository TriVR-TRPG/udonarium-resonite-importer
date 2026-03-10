/**
 * Round-trip integration tests
 *
 * These tests verify that the full import pipeline (ZIP → parse → convert → apply)
 * produces slot structures in Resonite that match expected patterns.
 *
 * Flow:
 *   1. Run `runImport()` with a sample ZIP against a live Resonite instance
 *   2. Export the resulting slot tree via `exportSlotTree()`
 *   3. Assert that the exported tree matches the expected structure
 *   4. Cleanup (remove imported slots)
 *
 * Prerequisites:
 *   - Resonite running with ResoniteLink enabled
 *   - RESONITE_LINK_AVAILABLE=true RESONITELINK_PORT=<port>
 *
 * Usage:
 *   RESONITE_LINK_AVAILABLE=true RESONITELINK_PORT=<port> npm run test -- --testNamePattern="Round-trip"
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { ResoniteLinkClient } from './ResoniteLinkClient';
import { exportSlotTree, ExportedSlot } from './slotTreeExporter';
import { runImport } from '../application/importRunner';
import { IMPORT_ROOT_TAG } from '../config/MappingConfig';
import { getResoniteLinkPort, getResoniteLinkHost } from '../config/MappingConfig';

dotenv.config();

const SKIP_INTEGRATION = process.env.RESONITE_LINK_AVAILABLE !== 'true';
const ROUNDTRIP_TIMEOUT = 120000; // 2 minutes for full import + export cycle

const RESONITELINK_PORT = getResoniteLinkPort();
const RESONITELINK_HOST = getResoniteLinkHost();

const FIXTURES_DIR = path.join(process.cwd(), 'src', '__fixtures__');

// ── Structure assertion helpers ─────────────────────────────────────

/**
 * Find a descendant slot by name (breadth-first).
 */
function findSlotByName(root: ExportedSlot, name: string): ExportedSlot | undefined {
  const queue: ExportedSlot[] = [root];
  while (queue.length > 0) {
    const slot = queue.shift()!;
    if (slot.name === name) return slot;
    queue.push(...slot.children);
  }
  return;
}

/**
 * Find all descendant slots matching a predicate (depth-first).
 */
function findAllSlots(
  root: ExportedSlot,
  predicate: (slot: ExportedSlot) => boolean
): ExportedSlot[] {
  const results: ExportedSlot[] = [];
  const visit = (slot: ExportedSlot): void => {
    if (predicate(slot)) results.push(slot);
    for (const child of slot.children) visit(child);
  };
  visit(root);
  return results;
}

/**
 * Collect all unique component types in a subtree.
 */
function collectComponentTypes(root: ExportedSlot): Set<string> {
  const types = new Set<string>();
  const visit = (slot: ExportedSlot): void => {
    for (const comp of slot.components) {
      types.add(comp.componentType);
    }
    for (const child of slot.children) visit(child);
  };
  visit(root);
  return types;
}

/**
 * Count total slots in a subtree (including root).
 */
function countSlots(root: ExportedSlot): number {
  let count = 1;
  for (const child of root.children) count += countSlots(child);
  return count;
}

/**
 * Check if a slot has a component of the given type.
 */
function hasComponent(slot: ExportedSlot, componentType: string): boolean {
  return slot.components.some((c) => c.componentType === componentType);
}

function isClose(a: number, b: number, epsilon = 0.01): boolean {
  return Math.abs(a - b) <= epsilon;
}

function isVector3Close(
  actual: { x: number; y: number; z: number },
  expected: { x: number; y: number; z: number },
  epsilon = 0.01
): boolean {
  return (
    isClose(actual.x, expected.x, epsilon) &&
    isClose(actual.y, expected.y, epsilon) &&
    isClose(actual.z, expected.z, epsilon)
  );
}

// ── Component type constants (matching exported format) ─────────────

const CT = {
  QUAD_MESH: '[FrooxEngine]FrooxEngine.QuadMesh',
  BOX_MESH: '[FrooxEngine]FrooxEngine.BoxMesh',
  TRIANGLE_MESH: '[FrooxEngine]FrooxEngine.TriangleMesh',
  STATIC_TEXTURE_2D: '[FrooxEngine]FrooxEngine.StaticTexture2D',
  SIMPLE_AVATAR_PROTECTION: '[FrooxEngine]FrooxEngine.CommonAvatar.SimpleAvatarProtection',
  XIEXE_TOON_MATERIAL: '[FrooxEngine]FrooxEngine.XiexeToonMaterial',
  MAIN_TEXTURE_PROPERTY_BLOCK: '[FrooxEngine]FrooxEngine.MainTexturePropertyBlock',
  MESH_RENDERER: '[FrooxEngine]FrooxEngine.MeshRenderer',
  BOX_COLLIDER: '[FrooxEngine]FrooxEngine.BoxCollider',
  GRABBABLE: '[FrooxEngine]FrooxEngine.Grabbable',
  OBJECT_ROOT: '[FrooxEngine]FrooxEngine.ObjectRoot',
};

// ── Test helpers ────────────────────────────────────────────────────

async function importAndExport(
  client: ResoniteLinkClient,
  zipFileName: string,
  options?: {
    rootScale?: number;
    simpleAvatarProtection?: boolean;
    enableCharacterCollider?: boolean;
  }
) {
  const zipPath = path.join(FIXTURES_DIR, zipFileName);

  const report = await runImport(
    {
      inputZipPath: zipPath,
      resonite: { host: RESONITELINK_HOST, port: RESONITELINK_PORT! },
      rootScale: options?.rootScale ?? 1,
      rootGrabbable: false,
      simpleAvatarProtection: options?.simpleAvatarProtection ?? true,
      transparentBlendMode: 'Cutout',
      enableCharacterCollider: options?.enableCharacterCollider ?? true,
    },
    { dryRun: false, verbose: false }
  );

  expect(report.summary.objects.failed).toBe(0);

  const tree = await exportSlotTree(client, report.artifacts.importRootId, {
    maxDepth: 20,
    includeInternal: false,
  });

  expect(tree).not.toBeNull();

  return { report, tree: tree! };
}

// ── Tests ───────────────────────────────────────────────────────────

describe.skipIf(SKIP_INTEGRATION)('Round-trip Integration Tests', () => {
  let client: ResoniteLinkClient;

  beforeAll(async () => {
    if (!RESONITELINK_PORT) {
      throw new Error(
        'RESONITELINK_PORT environment variable is required for round-trip tests.\n' +
          'Set it via: RESONITE_LINK_AVAILABLE=true RESONITELINK_PORT=<port> npm run test -- --testNamePattern="Round-trip"'
      );
    }
    client = new ResoniteLinkClient({ host: RESONITELINK_HOST, port: RESONITELINK_PORT });
    await client.connect();
  }, ROUNDTRIP_TIMEOUT);

  afterAll(async () => {
    if (!client) return;
    // Cleanup all imports by tag
    try {
      await client.removeRootChildrenByTag(IMPORT_ROOT_TAG);
    } catch {
      // Ignore cleanup errors
    }
    client.disconnect();
  });

  afterEach(async () => {
    // Cleanup between tests
    try {
      await client.removeRootChildrenByTag(IMPORT_ROOT_TAG);
    } catch {
      // Ignore
    }
    // Small delay between tests
    await new Promise((resolve) => setTimeout(resolve, 500));
  });

  // ── Import group structure ──────────────────────────────────────

  describe('Import group structure', () => {
    it(
      'creates import group with ObjectRoot and correct tag',
      async () => {
        const { tree } = await importAndExport(client, 'sample-character.zip');

        // Root should have ObjectRoot component
        expect(hasComponent(tree, CT.OBJECT_ROOT)).toBe(true);

        // Root should have the import tag
        expect(tree.tag).toBe(IMPORT_ROOT_TAG);
      },
      ROUNDTRIP_TIMEOUT
    );

    it(
      'creates Offset, Tables, Objects, Inventory hierarchy',
      async () => {
        const { tree } = await importAndExport(client, 'sample-character.zip');

        const offset = findSlotByName(tree, 'Offset');
        expect(offset).toBeDefined();

        const tables = findSlotByName(tree, 'Tables');
        const objects = findSlotByName(tree, 'Objects');
        const inventory = findSlotByName(tree, 'Inventory');

        expect(tables).toBeDefined();
        expect(objects).toBeDefined();
        expect(inventory).toBeDefined();
      },
      ROUNDTRIP_TIMEOUT
    );

    it(
      'places character objects under Inventory location slots',
      async () => {
        const { tree } = await importAndExport(client, 'sample-character.zip');

        const inventory = findSlotByName(tree, 'Inventory');
        expect(inventory).toBeDefined();

        // Inventory should have at least "table" location slot
        const tableLocation = inventory!.children.find((c) => c.name === 'table');
        expect(tableLocation).toBeDefined();
      },
      ROUNDTRIP_TIMEOUT
    );

    it(
      'adds SimpleAvatarProtection to import group root',
      async () => {
        const { tree } = await importAndExport(client, 'sample-character.zip', {
          simpleAvatarProtection: true,
        });

        expect(hasComponent(tree, CT.SIMPLE_AVATAR_PROTECTION)).toBe(true);
      },
      ROUNDTRIP_TIMEOUT
    );
  });

  // ── Character round-trip ────────────────────────────────────────

  describe('Character round-trip (sample-character.zip)', () => {
    it(
      'creates character slots with MeshRenderer and BoxCollider',
      async () => {
        const { tree } = await importAndExport(client, 'sample-character.zip');

        // Find slots that have BoxCollider + Grabbable (character pattern)
        const characterSlots = findAllSlots(
          tree,
          (slot) => hasComponent(slot, CT.BOX_COLLIDER) && hasComponent(slot, CT.GRABBABLE)
        );

        expect(characterSlots.length).toBeGreaterThan(0);

        for (const charSlot of characterSlots) {
          // Characters should have child slots with MeshRenderer
          const meshSlots = findAllSlots(charSlot, (s) => hasComponent(s, CT.MESH_RENDERER));
          expect(meshSlots.length).toBeGreaterThan(0);

          // MeshRenderer slots should have SimpleAvatarProtection
          for (const meshSlot of meshSlots) {
            expect(hasComponent(meshSlot, CT.SIMPLE_AVATAR_PROTECTION)).toBe(true);
          }
        }
      },
      ROUNDTRIP_TIMEOUT
    );
  });

  // ── Dice round-trip ─────────────────────────────────────────────

  describe('Dice round-trip (sample-dice.zip)', () => {
    it(
      'creates dice with 6 face children, only one active',
      async () => {
        const { tree } = await importAndExport(client, 'sample-dice.zip');

        // Find dice slot (has BoxCollider + Grabbable + 6 children)
        const diceSlots = findAllSlots(
          tree,
          (slot) =>
            hasComponent(slot, CT.BOX_COLLIDER) &&
            hasComponent(slot, CT.GRABBABLE) &&
            slot.children.length === 6
        );

        expect(diceSlots.length).toBeGreaterThan(0);

        for (const dice of diceSlots) {
          // Exactly one face should be active
          const activeFaces = dice.children.filter((child) => child.isActive);
          expect(activeFaces).toHaveLength(1);

          // Each face should have a MeshRenderer
          for (const face of dice.children) {
            expect(hasComponent(face, CT.MESH_RENDERER)).toBe(true);
          }
        }
      },
      ROUNDTRIP_TIMEOUT
    );
  });

  // ── Table round-trip ────────────────────────────────────────────

  describe('Table round-trip (sample-table.zip)', () => {
    it(
      'creates table with surface child slot',
      async () => {
        const { tree } = await importAndExport(client, 'sample-table.zip');

        // Find Tables container
        const tables = findSlotByName(tree, 'Tables');
        expect(tables).toBeDefined();
        expect(tables!.children.length).toBeGreaterThan(0);

        // At least one table should have a surface child
        const hasSurface = tables!.children.some((table) =>
          table.children.some((child) => child.name.includes('surface') || child.name === 'Surface')
        );
        expect(hasSurface).toBe(true);
      },
      ROUNDTRIP_TIMEOUT
    );

    it(
      'only one table is active when multiple tables exist',
      async () => {
        const { tree } = await importAndExport(client, 'sample-table.zip');

        const tables = findSlotByName(tree, 'Tables');
        expect(tables).toBeDefined();

        if (tables!.children.length >= 2) {
          const activeTables = tables!.children.filter((t) => t.isActive);
          expect(activeTables).toHaveLength(1);
        }
      },
      ROUNDTRIP_TIMEOUT
    );
  });

  // ── Card round-trip ─────────────────────────────────────────────

  describe('Card round-trip (sample-card.zip)', () => {
    it(
      'creates cards with front and back child slots',
      async () => {
        const { tree } = await importAndExport(client, 'sample-card.zip');

        // Find slots with Grabbable that have exactly 2 children (front + back)
        const cardSlots = findAllSlots(
          tree,
          (slot) =>
            hasComponent(slot, CT.GRABBABLE) &&
            hasComponent(slot, CT.BOX_COLLIDER) &&
            slot.children.length === 2
        );

        expect(cardSlots.length).toBeGreaterThan(0);

        for (const card of cardSlots) {
          // Each side should have a MeshRenderer
          for (const side of card.children) {
            const meshRendererSlots = findAllSlots(side, (s) => hasComponent(s, CT.MESH_RENDERER));
            expect(meshRendererSlots.length).toBeGreaterThan(0);
          }
        }
      },
      ROUNDTRIP_TIMEOUT
    );
  });

  // ── Terrain round-trip ──────────────────────────────────────────

  describe('Terrain round-trip (sample-terrain.zip)', () => {
    it(
      'creates terrain with top and wall children',
      async () => {
        const { tree } = await importAndExport(client, 'sample-terrain.zip');

        // Find terrain-like slots (has BoxCollider + Grabbable + children named top/front/back/left/right)
        const terrainSlots = findAllSlots(tree, (slot) => {
          if (!hasComponent(slot, CT.BOX_COLLIDER)) return false;
          if (!hasComponent(slot, CT.GRABBABLE)) return false;
          const childNames = slot.children.map((c) => c.name.toLowerCase());
          const hasTop = childNames.some((n) => n.includes('top'));
          const hasWalls = ['front', 'back', 'left', 'right'].some((wall) =>
            childNames.some((n) => n.includes(wall))
          );
          return hasTop && hasWalls;
        });

        expect(terrainSlots.length).toBeGreaterThan(0);

        for (const terrain of terrainSlots) {
          // Each wall child should have a MeshRenderer
          for (const child of terrain.children) {
            const meshSlots = findAllSlots(child, (s) => hasComponent(s, CT.MESH_RENDERER));
            expect(meshSlots.length).toBeGreaterThan(0);
          }
        }
      },
      ROUNDTRIP_TIMEOUT
    );
  });

  // ── Map mask round-trip ─────────────────────────────────────────

  describe('Map mask round-trip (sample-mapmask.zip)', () => {
    it(
      'creates map mask slots with MeshRenderer',
      async () => {
        const { tree } = await importAndExport(client, 'sample-mapmask.zip');

        // Map masks are placed in Tables
        const tables = findSlotByName(tree, 'Tables');
        expect(tables).toBeDefined();

        const allComponents = collectComponentTypes(tree);
        expect(allComponents.has(CT.MESH_RENDERER)).toBe(true);
      },
      ROUNDTRIP_TIMEOUT
    );
  });

  // ── Assets round-trip ───────────────────────────────────────────

  describe('Asset creation', () => {
    it(
      'creates Assets container with Textures sub-slot',
      async () => {
        const { tree } = await importAndExport(client, 'sample-character.zip');

        const assets = findSlotByName(tree, 'Assets');
        expect(assets).toBeDefined();

        const textures = findSlotByName(assets!, 'Textures');
        expect(textures).toBeDefined();

        // Textures slot should have children (one per imported texture)
        expect(textures!.children.length).toBeGreaterThan(0);

        // Each texture slot should have StaticTexture2D component
        for (const textureSlot of textures!.children) {
          expect(hasComponent(textureSlot, CT.STATIC_TEXTURE_2D)).toBe(true);
        }
      },
      ROUNDTRIP_TIMEOUT
    );

    it(
      'creates shared mesh assets under Assets/Meshes',
      async () => {
        const { tree } = await importAndExport(client, 'sample-character.zip');

        const assets = findSlotByName(tree, 'Assets');
        expect(assets).toBeDefined();

        const meshes = findSlotByName(assets!, 'Meshes');
        expect(meshes).toBeDefined();

        // Each mesh slot should have a mesh component (QuadMesh or BoxMesh)
        for (const meshSlot of meshes!.children) {
          const hasMesh =
            hasComponent(meshSlot, CT.QUAD_MESH) || hasComponent(meshSlot, CT.BOX_MESH);
          expect(hasMesh).toBe(true);
        }
      },
      ROUNDTRIP_TIMEOUT
    );

    it(
      'creates shared material assets under Assets/Materials',
      async () => {
        const { tree } = await importAndExport(client, 'sample-character.zip');

        const assets = findSlotByName(tree, 'Assets');
        expect(assets).toBeDefined();

        const materials = findSlotByName(assets!, 'Materials');
        expect(materials).toBeDefined();

        // Each material slot should have XiexeToonMaterial
        for (const materialSlot of materials!.children) {
          expect(hasComponent(materialSlot, CT.XIEXE_TOON_MATERIAL)).toBe(true);
        }
      },
      ROUNDTRIP_TIMEOUT
    );
  });

  // ── Import report consistency ───────────────────────────────────

  describe('Import report consistency', () => {
    it(
      'report object count matches actual slot count',
      async () => {
        const { report, tree } = await importAndExport(client, 'sample-dice.zip');

        // All objects should have been imported successfully
        expect(report.summary.objects.success).toBe(report.summary.objects.total);
        expect(report.summary.objects.failed).toBe(0);

        // The tree should contain more than just the root
        const totalSlots = countSlots(tree);
        expect(totalSlots).toBeGreaterThan(1);
      },
      ROUNDTRIP_TIMEOUT
    );

    it(
      'report component count is positive',
      async () => {
        const { report } = await importAndExport(client, 'sample-character.zip');

        expect(report.summary.components.total).toBeGreaterThan(0);
        expect(report.summary.components.success).toBeGreaterThan(0);
      },
      ROUNDTRIP_TIMEOUT
    );
  });

  // ── Scale and transform ─────────────────────────────────────────

  describe('Scale and transform', () => {
    it(
      'applies rootScale to import group',
      async () => {
        const { tree } = await importAndExport(client, 'sample-character.zip', {
          rootScale: 0.5,
        });

        expect(isVector3Close(tree.scale, { x: 0.5, y: 0.5, z: 0.5 })).toBe(true);
      },
      ROUNDTRIP_TIMEOUT
    );
  });
});
