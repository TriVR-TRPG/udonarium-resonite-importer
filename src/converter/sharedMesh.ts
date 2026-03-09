import { ResoniteComponent, ResoniteObject } from '../domain/ResoniteObject';
import { COMPONENT_TYPES } from '../config/ResoniteComponentTypes';

const MESH_REFERENCE_PREFIX = 'mesh-ref://';

export type SharedMeshDefinition = {
  key: string;
  name: string;
  componentType: typeof COMPONENT_TYPES.BOX_MESH | typeof COMPONENT_TYPES.QUAD_MESH;
  sizeFieldType: 'float2' | 'float3';
  sizeValue: { x: number; y: number } | { x: number; y: number; z: number };
  dualSided?: boolean;
};

function formatSizeNumber(value: number): string {
  return Number.isInteger(value) ? value.toString() : value.toString();
}

function roundTo4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

/**
 * Build a normalized mesh key based on aspect ratio.
 *
 * Meshes with the same proportions but different sizes produce the same key.
 * For example, QuadMesh {x:2, y:3} and {x:4, y:6} both produce "quad-r:1.5".
 */
function buildMeshKey(component: ResoniteComponent): string | null {
  if (!component.id) {
    return null;
  }

  const sizeField = component.fields.Size as {
    $type?: string;
    value?: { x?: number; y?: number; z?: number };
  } | null;
  if (!sizeField?.value) {
    return null;
  }

  if (component.type === COMPONENT_TYPES.QUAD_MESH) {
    const { x, y } = sizeField.value;
    if (typeof x !== 'number' || typeof y !== 'number' || x === 0) {
      return null;
    }
    return `quad-r:${roundTo4(y / x)}`;
  }

  if (component.type === COMPONENT_TYPES.BOX_MESH) {
    const { x, y, z } = sizeField.value;
    if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number' || x === 0) {
      return null;
    }
    return `box-r:${roundTo4(y / x)},${roundTo4(z / x)}`;
  }

  return null;
}

function adjustColliderSizesForScale(components: ResoniteComponent[], scaleFactor: number): void {
  for (const component of components) {
    if (component.type === COMPONENT_TYPES.BOX_COLLIDER) {
      const sizeField = component.fields.Size as {
        $type?: string;
        value?: { x?: number; y?: number; z?: number };
      } | null;
      if (sizeField?.value) {
        const { x, y, z } = sizeField.value;
        if (typeof x === 'number' && typeof y === 'number' && typeof z === 'number') {
          sizeField.value = {
            x: roundTo4(x / scaleFactor),
            y: roundTo4(y / scaleFactor),
            z: roundTo4(z / scaleFactor),
          };
        }
      }
    }

    if (component.type === COMPONENT_TYPES.TRIANGLE_COLLIDER) {
      for (const vertexField of ['A', 'B', 'C']) {
        const field = component.fields[vertexField] as {
          $type?: string;
          value?: { x?: number; y?: number; z?: number };
        } | null;
        if (field?.value) {
          const { x, y, z } = field.value;
          if (typeof x === 'number' && typeof y === 'number' && typeof z === 'number') {
            field.value = {
              x: roundTo4(x / scaleFactor),
              y: roundTo4(y / scaleFactor),
              z: roundTo4(z / scaleFactor),
            };
          }
        }
      }
    }
  }
}

function getMeshSizeX(component: ResoniteComponent): number | null {
  const sizeField = component.fields.Size as {
    value?: { x?: number };
  } | null;
  if (typeof sizeField?.value?.x !== 'number') {
    return null;
  }
  return sizeField.value.x;
}

function buildDefinitionFromComponent(
  key: string,
  component: ResoniteComponent
): SharedMeshDefinition | null {
  const sizeField = component.fields.Size as {
    value?: { x?: number; y?: number; z?: number };
  } | null;
  if (!sizeField?.value) {
    return null;
  }

  if (component.type === COMPONENT_TYPES.QUAD_MESH) {
    const { x, y } = sizeField.value;
    if (typeof x !== 'number' || typeof y !== 'number') {
      return null;
    }
    const dualSided = (component.fields.DualSided as { value?: boolean } | null)?.value === true;
    return {
      key,
      name: `QuadMesh_${formatSizeNumber(x)}x${formatSizeNumber(y)}${dualSided ? '_DualSided' : ''}`,
      componentType: COMPONENT_TYPES.QUAD_MESH,
      sizeFieldType: 'float2',
      sizeValue: { x, y },
      ...(dualSided ? { dualSided: true } : {}),
    };
  }

  if (component.type === COMPONENT_TYPES.BOX_MESH) {
    const { x, y, z } = sizeField.value;
    if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number') {
      return null;
    }
    return {
      key,
      name: `BoxMesh_${formatSizeNumber(x)}x${formatSizeNumber(y)}x${formatSizeNumber(z)}`,
      componentType: COMPONENT_TYPES.BOX_MESH,
      sizeFieldType: 'float3',
      sizeValue: { x, y, z },
    };
  }

  return null;
}

function prepareObjectForSharedMeshes(
  obj: ResoniteObject,
  definitions: Map<string, SharedMeshDefinition>,
  canonicalSizeX: Map<string, number>
): void {
  const localMeshIdToKey = new Map<string, string>();
  let uniformScaleFactor: number | null = null;

  for (const component of obj.components) {
    if (
      component.type !== COMPONENT_TYPES.BOX_MESH &&
      component.type !== COMPONENT_TYPES.QUAD_MESH
    ) {
      continue;
    }

    const key = buildMeshKey(component);
    if (!key || !component.id) {
      continue;
    }

    localMeshIdToKey.set(component.id, key);
    const definition = buildDefinitionFromComponent(key, component);
    if (!definition) {
      continue;
    }

    const existingDefinition = definitions.get(key);
    if (!existingDefinition) {
      definitions.set(key, definition);
      const sizeX = getMeshSizeX(component);
      if (sizeX !== null) {
        canonicalSizeX.set(key, sizeX);
      }
      continue;
    }

    if (definition.componentType === COMPONENT_TYPES.QUAD_MESH && definition.dualSided) {
      existingDefinition.dualSided = true;
      if (!existingDefinition.name.endsWith('_DualSided')) {
        existingDefinition.name = `${existingDefinition.name}_DualSided`;
      }
    }

    // Compute uniform scale factor when size differs from canonical
    const sizeX = getMeshSizeX(component);
    const canonical = canonicalSizeX.get(key);
    if (sizeX !== null && canonical !== undefined && roundTo4(sizeX) !== roundTo4(canonical)) {
      uniformScaleFactor = sizeX / canonical;
    }
  }

  obj.components = obj.components.filter(
    (component) =>
      component.type !== COMPONENT_TYPES.BOX_MESH && component.type !== COMPONENT_TYPES.QUAD_MESH
  );

  // Apply uniform scale to the slot when mesh size differs from canonical
  if (uniformScaleFactor !== null) {
    const existingScale = obj.scale ?? { x: 1, y: 1, z: 1 };
    const s = roundTo4(uniformScaleFactor);
    (obj as { scale: { x: number; y: number; z: number } }).scale = {
      x: roundTo4(existingScale.x * s),
      y: roundTo4(existingScale.y * s),
      z: roundTo4(existingScale.z * s),
    };

    // Compensate collider sizes: divide by scale factor since slot scale will multiply them
    adjustColliderSizesForScale(obj.components, uniformScaleFactor);
  }

  for (const component of obj.components) {
    if (component.type !== COMPONENT_TYPES.MESH_RENDERER) {
      continue;
    }
    const meshField = component.fields.Mesh as { targetId?: string } | null;
    const meshTargetId = meshField?.targetId;
    if (!meshTargetId) {
      continue;
    }
    const meshKey = localMeshIdToKey.get(meshTargetId);
    if (!meshKey) {
      continue;
    }
    component.fields.Mesh = { $type: 'reference', targetId: `${MESH_REFERENCE_PREFIX}${meshKey}` };
  }

  for (const child of obj.children) {
    prepareObjectForSharedMeshes(child, definitions, canonicalSizeX);
  }
}

export function prepareSharedMeshDefinitions(objects: ResoniteObject[]): SharedMeshDefinition[] {
  const definitions = new Map<string, SharedMeshDefinition>();
  const canonicalSizeX = new Map<string, number>();
  for (const obj of objects) {
    prepareObjectForSharedMeshes(obj, definitions, canonicalSizeX);
  }
  return Array.from(definitions.values());
}

function replaceMeshReferencesInValue(
  value: unknown,
  meshReferenceMap: Map<string, string>
): unknown {
  if (typeof value === 'string') {
    if (!value.startsWith(MESH_REFERENCE_PREFIX)) {
      return value;
    }
    const key = value.slice(MESH_REFERENCE_PREFIX.length);
    return meshReferenceMap.get(key) ?? value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => replaceMeshReferencesInValue(item, meshReferenceMap));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const recordValue = value as Record<string, unknown>;
  const replaced: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(recordValue)) {
    replaced[key] = replaceMeshReferencesInValue(item, meshReferenceMap);
  }
  return replaced;
}

export function resolveSharedMeshReferences(
  objects: ResoniteObject[],
  meshReferenceMap: Map<string, string>
): void {
  for (const obj of objects) {
    for (const component of obj.components) {
      component.fields = replaceMeshReferencesInValue(component.fields, meshReferenceMap) as Record<
        string,
        unknown
      >;
    }
    if (obj.children.length > 0) {
      resolveSharedMeshReferences(obj.children, meshReferenceMap);
    }
  }
}
