import { ResoniteComponent, ResoniteObject } from '../domain/ResoniteObject';
import { COMPONENT_TYPES } from '../config/ResoniteComponentTypes';

const MATERIAL_REFERENCE_PREFIX = 'material-ref://';

export type SharedMaterialDefinition = {
  key: string;
  name: string;
  componentType: typeof COMPONENT_TYPES.XIEXE_TOON_MATERIAL;
  fields: Record<string, unknown>;
};

function buildMaterialKey(component: ResoniteComponent): string | undefined {
  if (component.type !== COMPONENT_TYPES.XIEXE_TOON_MATERIAL) {
    return;
  }
  if (!component.fields || Object.keys(component.fields).length === 0) {
    return;
  }

  const colorHex = extractColorHexWithAlpha(component.fields) ?? '#FFFFFFFF';
  const blendMode = extractBlendMode(component.fields) ?? 'Unknown';
  const culling = extractCulling(component.fields) ?? 'Default';
  return `xiexe-toon:${colorHex}:${blendMode}:${culling}`;
}

function buildMaterialName(key: string): string {
  const [, colorHex = '#FFFFFFFF', blendMode = 'Unknown', culling = 'Default'] = key.split(':');
  return `XiexeToon_${blendMode}_${culling}_${colorHex.slice(1)}`;
}

function extractBlendMode(fields: Record<string, unknown>): string | undefined {
  const blendModeField = fields.BlendMode as { value?: unknown } | undefined;
  if (typeof blendModeField?.value === 'string' && blendModeField.value.length > 0) {
    return blendModeField.value;
  }
  return;
}

function extractCulling(fields: Record<string, unknown>): string | undefined {
  const cullingField = fields.Culling as { value?: unknown } | undefined;
  if (typeof cullingField?.value === 'string' && cullingField.value.length > 0) {
    return cullingField.value;
  }
  return;
}

function extractColorHexWithAlpha(fields: Record<string, unknown>): string | undefined {
  const colorField = fields.Color as { value?: unknown } | undefined;
  const colorValue = colorField?.value as
    | { r?: unknown; g?: unknown; b?: unknown; a?: unknown }
    | undefined;
  if (!colorValue) {
    return;
  }

  const channels = [colorValue.r, colorValue.g, colorValue.b, colorValue.a].map((channel) =>
    toHexChannel(channel)
  );
  if (channels.some((channel) => channel === undefined)) {
    return;
  }
  return `#${channels.join('')}`;
}

function toHexChannel(value: unknown): string | undefined {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return;
  }

  const normalized = value <= 1 ? value * 255 : value;
  const clamped = Math.min(255, Math.max(0, normalized));
  return Math.round(clamped).toString(16).toUpperCase().padStart(2, '0');
}

function prepareObjectForSharedMaterials(
  obj: ResoniteObject,
  definitions: Map<string, SharedMaterialDefinition>
): void {
  const localMaterialIdToKey = new Map<string, string>();

  for (const component of obj.components) {
    const key = buildMaterialKey(component);
    if (!key || !component.id) {
      continue;
    }

    localMaterialIdToKey.set(component.id, key);
    if (!definitions.has(key)) {
      definitions.set(key, {
        key,
        name: buildMaterialName(key),
        componentType: COMPONENT_TYPES.XIEXE_TOON_MATERIAL,
        fields: component.fields,
      });
    }
  }

  obj.components = obj.components.filter(
    (component) => component.type !== COMPONENT_TYPES.XIEXE_TOON_MATERIAL
  );

  for (const component of obj.components) {
    if (component.type !== COMPONENT_TYPES.MESH_RENDERER) {
      continue;
    }
    const materialsField = component.fields.Materials as
      | { elements?: Array<{ targetId?: string }> }
      | undefined;
    if (!materialsField?.elements) {
      continue;
    }
    const replacedElements = materialsField.elements.map((element) => {
      const materialTargetId = element.targetId;
      if (!materialTargetId) {
        return element;
      }
      const materialKey = localMaterialIdToKey.get(materialTargetId);
      if (!materialKey) {
        return element;
      }
      return {
        ...element,
        targetId: `${MATERIAL_REFERENCE_PREFIX}${materialKey}`,
      };
    });
    component.fields.Materials = {
      ...(materialsField as Record<string, unknown>),
      elements: replacedElements,
    };
  }

  for (const child of obj.children) {
    prepareObjectForSharedMaterials(child, definitions);
  }
}

function replaceMaterialReferencesInValue(
  value: unknown,
  materialReferenceMap: Map<string, string>
): unknown {
  if (typeof value === 'string') {
    if (!value.startsWith(MATERIAL_REFERENCE_PREFIX)) {
      return value;
    }
    const key = value.slice(MATERIAL_REFERENCE_PREFIX.length);
    return materialReferenceMap.get(key) ?? value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => replaceMaterialReferencesInValue(item, materialReferenceMap));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const recordValue = value as Record<string, unknown>;
  const replaced: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(recordValue)) {
    replaced[key] = replaceMaterialReferencesInValue(item, materialReferenceMap);
  }
  return replaced;
}

export function prepareSharedMaterialDefinitions(
  objects: ResoniteObject[]
): SharedMaterialDefinition[] {
  const definitions = new Map<string, SharedMaterialDefinition>();
  for (const obj of objects) {
    prepareObjectForSharedMaterials(obj, definitions);
  }
  return Array.from(definitions.values());
}

export function resolveSharedMaterialReferences(
  objects: ResoniteObject[],
  materialReferenceMap: Map<string, string>
): void {
  for (const obj of objects) {
    for (const component of obj.components) {
      component.fields = replaceMaterialReferencesInValue(
        component.fields,
        materialReferenceMap
      ) as Record<string, unknown>;
    }
    if (obj.children.length > 0) {
      resolveSharedMaterialReferences(obj.children, materialReferenceMap);
    }
  }
}
