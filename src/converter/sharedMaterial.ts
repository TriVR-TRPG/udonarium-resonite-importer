import { ResoniteComponent, ResoniteObject } from './ResoniteObject';

const MATERIAL_REFERENCE_PREFIX = 'material-ref://';

export type SharedMaterialDefinition = {
  key: string;
  name: string;
  componentType: '[FrooxEngine]FrooxEngine.XiexeToonMaterial';
  fields: Record<string, unknown>;
};

function buildMaterialKey(component: ResoniteComponent): string | undefined {
  if (component.type !== '[FrooxEngine]FrooxEngine.XiexeToonMaterial') {
    return undefined;
  }
  const blendMode = (component.fields.BlendMode as { value?: string } | undefined)?.value;
  if (!blendMode) {
    return undefined;
  }
  return `xiexe-toon:${blendMode.toLowerCase()}`;
}

function buildMaterialName(key: string): string {
  const blendMode = key.split(':')[1] ?? 'default';
  return `XiexeToon_${blendMode}`;
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
        componentType: '[FrooxEngine]FrooxEngine.XiexeToonMaterial',
        fields: component.fields,
      });
    }
  }

  obj.components = obj.components.filter(
    (component) => component.type !== '[FrooxEngine]FrooxEngine.XiexeToonMaterial'
  );

  for (const component of obj.components) {
    if (component.type !== '[FrooxEngine]FrooxEngine.MeshRenderer') {
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
