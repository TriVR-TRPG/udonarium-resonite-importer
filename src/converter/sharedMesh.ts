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

function buildMeshKey(component: ResoniteComponent): string | undefined {
  if (!component.id) {
    return undefined;
  }

  const sizeField = component.fields.Size as
    | { $type?: string; value?: { x?: number; y?: number; z?: number } }
    | undefined;
  if (!sizeField?.value) {
    return undefined;
  }

  if (component.type === COMPONENT_TYPES.QUAD_MESH) {
    const { x, y } = sizeField.value;
    if (typeof x !== 'number' || typeof y !== 'number') {
      return undefined;
    }
    return `quad:${x},${y}`;
  }

  if (component.type === COMPONENT_TYPES.BOX_MESH) {
    const { x, y, z } = sizeField.value;
    if (typeof x !== 'number' || typeof y !== 'number' || typeof z !== 'number') {
      return undefined;
    }
    return `box:${x},${y},${z}`;
  }

  return undefined;
}

function buildDefinitionFromComponent(
  key: string,
  component: ResoniteComponent
): SharedMeshDefinition | undefined {
  const sizeField = component.fields.Size as
    | { value?: { x?: number; y?: number; z?: number } }
    | undefined;
  if (!sizeField?.value) {
    return undefined;
  }

  if (component.type === COMPONENT_TYPES.QUAD_MESH) {
    const { x, y } = sizeField.value;
    if (typeof x !== 'number' || typeof y !== 'number') {
      return undefined;
    }
    const dualSided =
      (component.fields.DualSided as { value?: boolean } | undefined)?.value === true;
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
      return undefined;
    }
    return {
      key,
      name: `BoxMesh_${formatSizeNumber(x)}x${formatSizeNumber(y)}x${formatSizeNumber(z)}`,
      componentType: COMPONENT_TYPES.BOX_MESH,
      sizeFieldType: 'float3',
      sizeValue: { x, y, z },
    };
  }

  return undefined;
}

function prepareObjectForSharedMeshes(
  obj: ResoniteObject,
  definitions: Map<string, SharedMeshDefinition>
): void {
  const localMeshIdToKey = new Map<string, string>();

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
      continue;
    }

    if (definition.componentType === COMPONENT_TYPES.QUAD_MESH && definition.dualSided) {
      existingDefinition.dualSided = true;
      if (!existingDefinition.name.endsWith('_DualSided')) {
        existingDefinition.name = `${existingDefinition.name}_DualSided`;
      }
    }
  }

  obj.components = obj.components.filter(
    (component) =>
      component.type !== COMPONENT_TYPES.BOX_MESH && component.type !== COMPONENT_TYPES.QUAD_MESH
  );

  for (const component of obj.components) {
    if (component.type !== COMPONENT_TYPES.MESH_RENDERER) {
      continue;
    }
    const meshField = component.fields.Mesh as { targetId?: string } | undefined;
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
    prepareObjectForSharedMeshes(child, definitions);
  }
}

export function prepareSharedMeshDefinitions(objects: ResoniteObject[]): SharedMeshDefinition[] {
  const definitions = new Map<string, SharedMeshDefinition>();
  for (const obj of objects) {
    prepareObjectForSharedMeshes(obj, definitions);
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
