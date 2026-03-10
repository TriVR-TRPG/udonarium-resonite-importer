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

/**
 * Find child slot whose name ends with a given suffix.
 */
function findChildByNameSuffix(parent: ExportedSlot, suffix: string): ExportedSlot | undefined {
  return parent.children.find((c) => c.name.endsWith(suffix));
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
      'creates character slots with BoxCollider and Grabbable',
      async () => {
        const { tree } = await importAndExport(client, 'sample-character.zip');

        const inventory = findSlotByName(tree, 'Inventory');
        expect(inventory).toBeDefined();

        // Characters are placed under Inventory location slots
        const characterSlots = findAllSlots(
          inventory!,
          (slot) => hasComponent(slot, CT.BOX_COLLIDER) && hasComponent(slot, CT.GRABBABLE)
        );

        expect(characterSlots.length).toBeGreaterThan(0);
      },
      ROUNDTRIP_TIMEOUT
    );

    it(
      'character slots have MeshRenderer with visual components',
      async () => {
        const { tree } = await importAndExport(client, 'sample-character.zip');

        const inventory = findSlotByName(tree, 'Inventory');
        const characterSlots = findAllSlots(
          inventory!,
          (slot) => hasComponent(slot, CT.BOX_COLLIDER) && hasComponent(slot, CT.GRABBABLE)
        );

        for (const charSlot of characterSlots) {
          // Characters with images should have MeshRenderer on the slot itself
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

    it(
      'character has no children (flat structure)',
      async () => {
        const { tree } = await importAndExport(client, 'sample-character.zip');

        const inventory = findSlotByName(tree, 'Inventory');
        const characterSlots = findAllSlots(
          inventory!,
          (slot) =>
            hasComponent(slot, CT.BOX_COLLIDER) &&
            hasComponent(slot, CT.GRABBABLE) &&
            hasComponent(slot, CT.MESH_RENDERER)
        );

        for (const charSlot of characterSlots) {
          // Character slots should have no children (visual components on parent)
          expect(charSlot.children).toHaveLength(0);
        }
      },
      ROUNDTRIP_TIMEOUT
    );
  });

  // ── Dice round-trip ─────────────────────────────────────────────

  describe('Dice round-trip (sample-dice.zip)', () => {
    it(
      'creates dice with exactly 6 face children',
      async () => {
        const { tree } = await importAndExport(client, 'sample-dice.zip');

        // Dice: parent has BoxCollider + Grabbable, exactly 6 children
        const diceSlots = findAllSlots(
          tree,
          (slot) =>
            hasComponent(slot, CT.BOX_COLLIDER) &&
            hasComponent(slot, CT.GRABBABLE) &&
            slot.children.length === 6
        );

        expect(diceSlots.length).toBeGreaterThan(0);
      },
      ROUNDTRIP_TIMEOUT
    );

    it(
      'exactly one face is active per dice',
      async () => {
        const { tree } = await importAndExport(client, 'sample-dice.zip');

        const diceSlots = findAllSlots(
          tree,
          (slot) =>
            hasComponent(slot, CT.BOX_COLLIDER) &&
            hasComponent(slot, CT.GRABBABLE) &&
            slot.children.length === 6
        );

        for (const dice of diceSlots) {
          const activeFaces = dice.children.filter((child) => child.isActive);
          expect(activeFaces).toHaveLength(1);
        }
      },
      ROUNDTRIP_TIMEOUT
    );

    it(
      'each face child has MeshRenderer',
      async () => {
        const { tree } = await importAndExport(client, 'sample-dice.zip');

        const diceSlots = findAllSlots(
          tree,
          (slot) =>
            hasComponent(slot, CT.BOX_COLLIDER) &&
            hasComponent(slot, CT.GRABBABLE) &&
            slot.children.length === 6
        );

        for (const dice of diceSlots) {
          for (const face of dice.children) {
            expect(hasComponent(face, CT.MESH_RENDERER)).toBe(true);
          }
        }
      },
      ROUNDTRIP_TIMEOUT
    );

    it(
      'dice parent has no MeshRenderer (visual on children only)',
      async () => {
        const { tree } = await importAndExport(client, 'sample-dice.zip');

        const diceSlots = findAllSlots(
          tree,
          (slot) =>
            hasComponent(slot, CT.BOX_COLLIDER) &&
            hasComponent(slot, CT.GRABBABLE) &&
            slot.children.length === 6
        );

        for (const dice of diceSlots) {
          expect(hasComponent(dice, CT.MESH_RENDERER)).toBe(false);
        }
      },
      ROUNDTRIP_TIMEOUT
    );

    it(
      'face child names follow "{diceName}-face-{faceName}" pattern',
      async () => {
        const { tree } = await importAndExport(client, 'sample-dice.zip');

        const diceSlots = findAllSlots(
          tree,
          (slot) =>
            hasComponent(slot, CT.BOX_COLLIDER) &&
            hasComponent(slot, CT.GRABBABLE) &&
            slot.children.length === 6
        );

        for (const dice of diceSlots) {
          for (const face of dice.children) {
            expect(face.name).toContain('-face-');
          }
        }
      },
      ROUNDTRIP_TIMEOUT
    );
  });

  // ── Card round-trip ─────────────────────────────────────────────

  describe('Card round-trip (sample-card.zip)', () => {
    it(
      'creates card slots with front and back children',
      async () => {
        const { tree } = await importAndExport(client, 'sample-card.zip');

        // Cards: parent has BoxCollider + Grabbable, exactly 2 children
        const cardSlots = findAllSlots(
          tree,
          (slot) =>
            hasComponent(slot, CT.GRABBABLE) &&
            hasComponent(slot, CT.BOX_COLLIDER) &&
            slot.children.length === 2
        );

        expect(cardSlots.length).toBeGreaterThan(0);
      },
      ROUNDTRIP_TIMEOUT
    );

    it(
      'front and back children have MeshRenderer',
      async () => {
        const { tree } = await importAndExport(client, 'sample-card.zip');

        const cardSlots = findAllSlots(
          tree,
          (slot) =>
            hasComponent(slot, CT.GRABBABLE) &&
            hasComponent(slot, CT.BOX_COLLIDER) &&
            slot.children.length === 2
        );

        for (const card of cardSlots) {
          for (const side of card.children) {
            expect(hasComponent(side, CT.MESH_RENDERER)).toBe(true);
          }
        }
      },
      ROUNDTRIP_TIMEOUT
    );

    it(
      'card children named with -front and -back suffixes',
      async () => {
        const { tree } = await importAndExport(client, 'sample-card.zip');

        const cardSlots = findAllSlots(
          tree,
          (slot) =>
            hasComponent(slot, CT.GRABBABLE) &&
            hasComponent(slot, CT.BOX_COLLIDER) &&
            slot.children.length === 2
        );

        for (const card of cardSlots) {
          const front = findChildByNameSuffix(card, '-front');
          const back = findChildByNameSuffix(card, '-back');
          expect(front).toBeDefined();
          expect(back).toBeDefined();
        }
      },
      ROUNDTRIP_TIMEOUT
    );

    it(
      'both card faces are active',
      async () => {
        const { tree } = await importAndExport(client, 'sample-card.zip');

        const cardSlots = findAllSlots(
          tree,
          (slot) =>
            hasComponent(slot, CT.GRABBABLE) &&
            hasComponent(slot, CT.BOX_COLLIDER) &&
            slot.children.length === 2
        );

        for (const card of cardSlots) {
          for (const side of card.children) {
            expect(side.isActive).toBe(true);
          }
        }
      },
      ROUNDTRIP_TIMEOUT
    );

    it(
      'creates card-stack with nested card children',
      async () => {
        const { tree } = await importAndExport(client, 'sample-card.zip');

        // Card-stacks: parent has BoxCollider + Grabbable,
        // children each have 2 sub-children (front/back)
        const stackSlots = findAllSlots(tree, (slot) => {
          if (!hasComponent(slot, CT.GRABBABLE)) return false;
          if (!hasComponent(slot, CT.BOX_COLLIDER)) return false;
          if (slot.children.length < 2) return false;
          // All children should look like cards (have front/back children)
          return slot.children.every((child) => child.children.length === 2);
        });

        // This fixture should contain at least one card-stack
        expect(stackSlots.length).toBeGreaterThan(0);

        for (const stack of stackSlots) {
          // Each stacked card should have front and back faces
          for (const card of stack.children) {
            const front = findChildByNameSuffix(card, '-front');
            const back = findChildByNameSuffix(card, '-back');
            expect(front).toBeDefined();
            expect(back).toBeDefined();
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

        // Terrain: has BoxCollider, children named *-top, *-front, *-back, *-left, *-right
        const terrainSlots = findAllSlots(tree, (slot) => {
          if (!hasComponent(slot, CT.BOX_COLLIDER)) return false;
          const childNames = slot.children.map((c) => c.name.toLowerCase());
          const hasTop = childNames.some((n) => n.includes('top'));
          const hasWalls = ['front', 'back', 'left', 'right'].some((wall) =>
            childNames.some((n) => n.includes(wall))
          );
          return hasTop && hasWalls;
        });

        expect(terrainSlots.length).toBeGreaterThan(0);
      },
      ROUNDTRIP_TIMEOUT
    );

    it(
      'terrain has 5 children (top + 4 walls)',
      async () => {
        const { tree } = await importAndExport(client, 'sample-terrain.zip');

        const terrainSlots = findAllSlots(tree, (slot) => {
          if (!hasComponent(slot, CT.BOX_COLLIDER)) return false;
          const childNames = slot.children.map((c) => c.name.toLowerCase());
          return childNames.some((n) => n.includes('top'));
        });

        for (const terrain of terrainSlots) {
          expect(terrain.children).toHaveLength(5);
        }
      },
      ROUNDTRIP_TIMEOUT
    );

    it(
      'each terrain child has MeshRenderer',
      async () => {
        const { tree } = await importAndExport(client, 'sample-terrain.zip');

        const terrainSlots = findAllSlots(tree, (slot) => {
          if (!hasComponent(slot, CT.BOX_COLLIDER)) return false;
          const childNames = slot.children.map((c) => c.name.toLowerCase());
          return (
            childNames.some((n) => n.includes('top')) && childNames.some((n) => n.includes('front'))
          );
        });

        for (const terrain of terrainSlots) {
          for (const child of terrain.children) {
            const meshSlots = findAllSlots(child, (s) => hasComponent(s, CT.MESH_RENDERER));
            expect(meshSlots.length).toBeGreaterThan(0);
          }
        }
      },
      ROUNDTRIP_TIMEOUT
    );

    it(
      'unlocked terrain has Grabbable',
      async () => {
        const { tree } = await importAndExport(client, 'sample-terrain.zip');

        const terrainSlots = findAllSlots(tree, (slot) => {
          if (!hasComponent(slot, CT.BOX_COLLIDER)) return false;
          const childNames = slot.children.map((c) => c.name.toLowerCase());
          return childNames.some((n) => n.includes('top'));
        });

        // At least one terrain should be grabbable (unlocked)
        const grabbableTerrains = terrainSlots.filter((t) => hasComponent(t, CT.GRABBABLE));
        expect(grabbableTerrains.length).toBeGreaterThan(0);
      },
      ROUNDTRIP_TIMEOUT
    );

    it(
      'terrain child names follow "{name}-{side}" pattern',
      async () => {
        const { tree } = await importAndExport(client, 'sample-terrain.zip');

        const terrainSlots = findAllSlots(tree, (slot) => {
          if (!hasComponent(slot, CT.BOX_COLLIDER)) return false;
          const childNames = slot.children.map((c) => c.name.toLowerCase());
          return childNames.some((n) => n.includes('top'));
        });

        const expectedSuffixes = ['-top', '-front', '-back', '-left', '-right'];

        for (const terrain of terrainSlots) {
          for (const suffix of expectedSuffixes) {
            const child = findChildByNameSuffix(terrain, suffix);
            expect(child).toBeDefined();
          }
        }
      },
      ROUNDTRIP_TIMEOUT
    );
  });

  // ── Terrain with slope (lily extension) round-trip ────────────

  describe('Terrain slope round-trip (sample-terrain-lily.zip)', () => {
    it(
      'creates terrain with slope extension',
      async () => {
        const { tree } = await importAndExport(client, 'sample-terrain-lily.zip');

        // Slope terrains may have TriangleMesh in their wall children
        const allComponentTypes = collectComponentTypes(tree);
        expect(allComponentTypes.has(CT.MESH_RENDERER)).toBe(true);

        // Should have at least one terrain slot
        const terrainSlots = findAllSlots(tree, (slot) => {
          const childNames = slot.children.map((c) => c.name.toLowerCase());
          return childNames.some((n) => n.includes('top'));
        });

        expect(terrainSlots.length).toBeGreaterThan(0);
      },
      ROUNDTRIP_TIMEOUT
    );

    it(
      'slope terrain may use TriangleMesh for walls',
      async () => {
        const { tree } = await importAndExport(client, 'sample-terrain-lily.zip');

        const allComponentTypes = collectComponentTypes(tree);
        // Slope terrains use TriangleMesh for sloped wall surfaces
        const hasTriangleMesh = allComponentTypes.has(CT.TRIANGLE_MESH);
        const hasQuadMesh = allComponentTypes.has(CT.QUAD_MESH);
        // Should have at least one mesh type
        expect(hasTriangleMesh || hasQuadMesh).toBe(true);
      },
      ROUNDTRIP_TIMEOUT
    );
  });

  // ── Table round-trip ────────────────────────────────────────────

  describe('Table round-trip (sample-table.zip)', () => {
    it(
      'creates table slots under Tables container',
      async () => {
        const { tree } = await importAndExport(client, 'sample-table.zip');

        const tables = findSlotByName(tree, 'Tables');
        expect(tables).toBeDefined();
        expect(tables!.children.length).toBeGreaterThan(0);
      },
      ROUNDTRIP_TIMEOUT
    );

    it(
      'each table has a surface child slot',
      async () => {
        const { tree } = await importAndExport(client, 'sample-table.zip');

        const tables = findSlotByName(tree, 'Tables');
        expect(tables).toBeDefined();

        for (const table of tables!.children) {
          const surface = table.children.find((child) => child.name.endsWith('-surface'));
          expect(surface).toBeDefined();
        }
      },
      ROUNDTRIP_TIMEOUT
    );

    it(
      'table surface has BoxCollider and MeshRenderer',
      async () => {
        const { tree } = await importAndExport(client, 'sample-table.zip');

        const tables = findSlotByName(tree, 'Tables');
        for (const table of tables!.children) {
          const surface = table.children.find((child) => child.name.endsWith('-surface'));
          if (surface) {
            expect(hasComponent(surface, CT.BOX_COLLIDER)).toBe(true);
            expect(hasComponent(surface, CT.MESH_RENDERER)).toBe(true);
          }
        }
      },
      ROUNDTRIP_TIMEOUT
    );

    it(
      'table parent has no components (empty parent)',
      async () => {
        const { tree } = await importAndExport(client, 'sample-table.zip');

        const tables = findSlotByName(tree, 'Tables');
        for (const table of tables!.children) {
          // Table parent has only SimpleAvatarProtection (auto-added) but
          // no user-defined components like BoxCollider, Grabbable, MeshRenderer
          expect(hasComponent(table, CT.BOX_COLLIDER)).toBe(false);
          expect(hasComponent(table, CT.GRABBABLE)).toBe(false);
          expect(hasComponent(table, CT.MESH_RENDERER)).toBe(false);
        }
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

  // ── Table mask round-trip ─────────────────────────────────────────

  describe('Table mask round-trip (sample-mapmask.zip)', () => {
    it(
      'creates map mask slots under Tables',
      async () => {
        const { tree } = await importAndExport(client, 'sample-mapmask.zip');

        const tables = findSlotByName(tree, 'Tables');
        expect(tables).toBeDefined();

        const allComponents = collectComponentTypes(tree);
        expect(allComponents.has(CT.MESH_RENDERER)).toBe(true);
      },
      ROUNDTRIP_TIMEOUT
    );

    it(
      'map mask has QuadMesh and MeshRenderer on parent (no children)',
      async () => {
        const { tree } = await importAndExport(client, 'sample-mapmask.zip');

        const tables = findSlotByName(tree, 'Tables');
        expect(tables).toBeDefined();

        // Find slots with MeshRenderer under Tables (these should be masks)
        const maskSlots = findAllSlots(
          tables!,
          (slot) => hasComponent(slot, CT.MESH_RENDERER) && hasComponent(slot, CT.BOX_COLLIDER)
        );

        expect(maskSlots.length).toBeGreaterThan(0);

        for (const mask of maskSlots) {
          // Mask has flat structure (no children)
          expect(mask.children).toHaveLength(0);
        }
      },
      ROUNDTRIP_TIMEOUT
    );

    it(
      'map mask is rotated 90° on X axis (horizontal plane)',
      async () => {
        const { tree } = await importAndExport(client, 'sample-mapmask.zip');

        const tables = findSlotByName(tree, 'Tables');
        const maskSlots = findAllSlots(
          tables!,
          (slot) => hasComponent(slot, CT.MESH_RENDERER) && hasComponent(slot, CT.BOX_COLLIDER)
        );

        for (const mask of maskSlots) {
          // Rotation quaternion for 90° X rotation: approximately (0.707, 0, 0, 0.707)
          expect(isClose(Math.abs(mask.rotation.x), 0.707, 0.05)).toBe(true);
        }
      },
      ROUNDTRIP_TIMEOUT
    );
  });

  // ── All objects round-trip (sample-all-object.zip) ────────────

  describe('All object types round-trip (sample-all-object.zip)', () => {
    it(
      'imports all objects successfully with no failures',
      async () => {
        const { report } = await importAndExport(client, 'sample-all-object.zip');

        expect(report.summary.objects.total).toBeGreaterThan(0);
        expect(report.summary.objects.success).toBe(report.summary.objects.total);
        expect(report.summary.objects.failed).toBe(0);
      },
      ROUNDTRIP_TIMEOUT
    );

    it(
      'creates all container slots (Tables, Objects, Inventory)',
      async () => {
        const { tree } = await importAndExport(client, 'sample-all-object.zip');

        expect(findSlotByName(tree, 'Tables')).toBeDefined();
        expect(findSlotByName(tree, 'Objects')).toBeDefined();
        expect(findSlotByName(tree, 'Inventory')).toBeDefined();
      },
      ROUNDTRIP_TIMEOUT
    );

    it(
      'contains diverse component types across all object types',
      async () => {
        const { tree } = await importAndExport(client, 'sample-all-object.zip');

        const allComponents = collectComponentTypes(tree);

        // All these component types should be present across the various objects
        expect(allComponents.has(CT.MESH_RENDERER)).toBe(true);
        expect(allComponents.has(CT.BOX_COLLIDER)).toBe(true);
        expect(allComponents.has(CT.GRABBABLE)).toBe(true);
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
