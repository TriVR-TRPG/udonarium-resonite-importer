import { ObjectType } from '../domain/UdonariumObject';
import { ResoniteComponent, ResoniteObject } from '../domain/ResoniteObject';
import { randomUUID } from 'crypto';
import {
  BlendModeValue,
  ColorXValue,
  isGifTexture,
  parseTextureReferenceId,
  toSharedTexturePropertyBlockId,
} from './textureUtils';
import { SLOT_ID_PREFIX } from '../config/MappingConfig';
import { COMPONENT_TYPES } from '../config/ResoniteComponentTypes';
import { buildStaticTexture2DFields, buildMainTexturePropertyBlockFields } from './componentFields';
import { ImageAssetContext } from './imageAssetContext';

// ---- private types ----
type QuadSize = { x: number; y: number };
type BoxSize = { x: number; y: number; z: number };
type TriangleVertex = { x: number; y: number; z: number };

export type NewResoniteObjectSpec = {
  id?: string;
  name: string;
};

type ResoniteObjectIdentity = Required<NewResoniteObjectSpec>;

type BlendModeField = { $type: 'enum'; value: BlendModeValue; enumType: 'BlendMode' };

type XiexeToonMaterialFields = {
  BlendMode: BlendModeField;
  ShadowRamp: { $type: 'reference'; targetId: null };
  ShadowSharpness: { $type: 'float'; value: 0 };
  Culling?: { $type: 'enum'; value: 'Off'; enumType: 'Culling' };
  Color?: { $type: 'colorX'; value: ColorXValue };
};

type QuadMeshOptions = {
  textureIdentifier?: string;
  imageAssetContext?: ImageAssetContext;
  dualSided?: boolean;
  size?: QuadSize;
  color?: ColorXValue;
};

type TriangleMeshOptions = {
  textureIdentifier?: string;
  imageAssetContext?: ImageAssetContext;
  dualSided?: boolean;
  vertices: [TriangleVertex, TriangleVertex, TriangleVertex];
  uv0?: [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }];
  color?: ColorXValue;
};

function roundTo4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function deriveTriangleUv0(
  vertices: [TriangleVertex, TriangleVertex, TriangleVertex]
): [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }] {
  const xs = vertices.map((vertex) => vertex.x);
  const ys = vertices.map((vertex) => vertex.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = maxX - minX || 1;
  const height = maxY - minY || 1;

  return vertices.map((vertex) => ({
    x: roundTo4((vertex.x - minX) / width),
    y: roundTo4((vertex.y - minY) / height),
  })) as [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }];
}

function resolveBlendModeLookupIdentifier(options?: QuadMeshOptions) {
  const identifier = options?.textureIdentifier;
  if (!identifier || identifier.startsWith('texture-ref://')) {
    return;
  }
  return identifier;
}

function resolveBlendMode(options?: QuadMeshOptions): BlendModeValue {
  if (options?.color && options.color.a < 1) {
    return 'Alpha';
  }
  const lookupIdentifier = resolveBlendModeLookupIdentifier(options);
  if (options?.imageAssetContext && lookupIdentifier) {
    return options.imageAssetContext.lookupBlendMode(lookupIdentifier);
  }
  return 'Cutout';
}

// ---- private helpers ----
function createBlendModeField(blendMode: BlendModeValue): BlendModeField {
  return { $type: 'enum', value: blendMode, enumType: 'BlendMode' };
}

function buildXiexeToonMaterialFields(
  blendMode: BlendModeValue = 'Cutout',
  color?: ColorXValue,
  cullingOff = false
): XiexeToonMaterialFields {
  return {
    BlendMode: createBlendModeField(blendMode),
    ShadowRamp: { $type: 'reference', targetId: null },
    ShadowSharpness: { $type: 'float', value: 0 },
    ...(cullingOff ? { Culling: { $type: 'enum', value: 'Off', enumType: 'Culling' } } : {}),
    ...(color != null ? { Color: { $type: 'colorX', value: color } } : {}),
  };
}

function buildQuadMeshComponents(
  slotId: string,
  options: QuadMeshOptions = {}
): ResoniteComponent[] {
  const textureValue = options.imageAssetContext
    ? (options.imageAssetContext.resolveTextureValue(options.textureIdentifier) ??
      options.textureIdentifier)
    : options.textureIdentifier;
  const dualSided = options.dualSided ?? false;
  const sizeInput = options.size ?? { x: 1, y: 1 };
  const size = { x: roundTo4(sizeInput.x), y: roundTo4(sizeInput.y) };
  const meshId = `${slotId}-mesh`;
  const materialId = `${slotId}-mat`;
  const textureBlockId = `${slotId}-texture-block`;
  const textureId = `${slotId}-tex`;
  const sharedTextureId = parseTextureReferenceId(textureValue);
  const texturePropertyBlockTargetId = textureValue
    ? sharedTextureId
      ? toSharedTexturePropertyBlockId(sharedTextureId)
      : textureBlockId
    : null;

  const components: ResoniteComponent[] = [
    {
      id: meshId,
      type: COMPONENT_TYPES.QUAD_MESH,
      fields: {
        Size: { $type: 'float2', value: size },
      },
    },
  ];

  if (textureValue && !sharedTextureId) {
    const usePointFilter = options.imageAssetContext
      ? options.imageAssetContext.resolveUsePointFilter(options.textureIdentifier, textureValue)
      : isGifTexture(textureValue);
    components.push({
      id: textureId,
      type: COMPONENT_TYPES.STATIC_TEXTURE_2D,
      fields: buildStaticTexture2DFields(textureValue, usePointFilter),
    });
  }

  components.push({
    id: materialId,
    type: COMPONENT_TYPES.XIEXE_TOON_MATERIAL,
    fields: buildXiexeToonMaterialFields(resolveBlendMode(options), options.color, dualSided),
  });

  if (textureValue && !sharedTextureId) {
    const textureProviderId = textureId;
    components.push({
      id: textureBlockId,
      type: COMPONENT_TYPES.MAIN_TEXTURE_PROPERTY_BLOCK,
      fields: buildMainTexturePropertyBlockFields(textureProviderId),
    });
  }

  components.push({
    id: `${slotId}-renderer`,
    type: COMPONENT_TYPES.MESH_RENDERER,
    fields: {
      Mesh: { $type: 'reference', targetId: meshId },
      Materials: {
        $type: 'list',
        elements: [{ $type: 'reference', targetId: materialId }],
      },
      ...(texturePropertyBlockTargetId
        ? {
            MaterialPropertyBlocks: {
              $type: 'list',
              elements: [{ $type: 'reference', targetId: texturePropertyBlockTargetId }],
            },
          }
        : {}),
    },
  });

  return components;
}

function buildTriangleMeshComponents(
  slotId: string,
  options: TriangleMeshOptions
): ResoniteComponent[] {
  const textureValue = options.imageAssetContext
    ? (options.imageAssetContext.resolveTextureValue(options.textureIdentifier) ??
      options.textureIdentifier)
    : options.textureIdentifier;
  const dualSided = options.dualSided ?? false;
  const meshId = `${slotId}-mesh`;
  const materialId = `${slotId}-mat`;
  const textureBlockId = `${slotId}-texture-block`;
  const textureId = `${slotId}-tex`;
  const sharedTextureId = parseTextureReferenceId(textureValue);
  const texturePropertyBlockTargetId = textureValue
    ? sharedTextureId
      ? toSharedTexturePropertyBlockId(sharedTextureId)
      : textureBlockId
    : null;
  const uv0 = options.uv0 ?? deriveTriangleUv0(options.vertices);

  const components: ResoniteComponent[] = [
    {
      id: meshId,
      type: COMPONENT_TYPES.TRIANGLE_MESH,
      fields: {
        Vertex0: {
          $type: 'syncObject',
          members: {
            Position: { $type: 'float3', value: options.vertices[0] },
            UV0: { $type: 'float2', value: uv0[0] },
          },
        },
        Vertex1: {
          $type: 'syncObject',
          members: {
            Position: { $type: 'float3', value: options.vertices[1] },
            UV0: { $type: 'float2', value: uv0[1] },
          },
        },
        Vertex2: {
          $type: 'syncObject',
          members: {
            Position: { $type: 'float3', value: options.vertices[2] },
            UV0: { $type: 'float2', value: uv0[2] },
          },
        },
        AutoNormals: { $type: 'bool', value: true },
        AutoTangents: { $type: 'bool', value: false },
        ...(dualSided ? { DualSided: { $type: 'bool', value: true } } : {}),
      },
    },
  ];

  if (textureValue && !sharedTextureId) {
    const usePointFilter = options.imageAssetContext
      ? options.imageAssetContext.resolveUsePointFilter(options.textureIdentifier, textureValue)
      : isGifTexture(textureValue);
    components.push({
      id: textureId,
      type: COMPONENT_TYPES.STATIC_TEXTURE_2D,
      fields: buildStaticTexture2DFields(textureValue, usePointFilter),
    });
  }

  components.push({
    id: materialId,
    type: COMPONENT_TYPES.XIEXE_TOON_MATERIAL,
    fields: buildXiexeToonMaterialFields(resolveBlendMode(options), options.color, dualSided),
  });

  if (textureValue && !sharedTextureId) {
    const textureProviderId = textureId;
    components.push({
      id: textureBlockId,
      type: COMPONENT_TYPES.MAIN_TEXTURE_PROPERTY_BLOCK,
      fields: buildMainTexturePropertyBlockFields(textureProviderId),
    });
  }

  components.push({
    id: `${slotId}-renderer`,
    type: COMPONENT_TYPES.MESH_RENDERER,
    fields: {
      Mesh: { $type: 'reference', targetId: meshId },
      Materials: {
        $type: 'list',
        elements: [{ $type: 'reference', targetId: materialId }],
      },
      ...(texturePropertyBlockTargetId
        ? {
            MaterialPropertyBlocks: {
              $type: 'list',
              elements: [{ $type: 'reference', targetId: texturePropertyBlockTargetId }],
            },
          }
        : {}),
    },
  });

  return components;
}

function buildBoxColliderComponent(
  slotId: string,
  size: BoxSize,
  options?: { characterCollider?: boolean }
): ResoniteComponent {
  return {
    id: `${slotId}-collider`,
    type: COMPONENT_TYPES.BOX_COLLIDER,
    fields: {
      Size: { $type: 'float3', value: size },
      ...(options?.characterCollider ? { CharacterCollider: { $type: 'bool', value: true } } : {}),
    },
  };
}

function buildTriangleColliderComponent(
  slotId: string,
  vertices: [TriangleVertex, TriangleVertex, TriangleVertex],
  options?: { characterCollider?: boolean }
): ResoniteComponent {
  return {
    id: `${slotId}-collider`,
    type: COMPONENT_TYPES.TRIANGLE_COLLIDER,
    fields: {
      A: { $type: 'float3', value: vertices[0] },
      B: { $type: 'float3', value: vertices[1] },
      C: { $type: 'float3', value: vertices[2] },
      ...(options?.characterCollider ? { CharacterCollider: { $type: 'bool', value: true } } : {}),
    },
  };
}

function buildGrabbableComponent(slotId: string): ResoniteComponent {
  return {
    id: `${slotId}-grabbable`,
    type: COMPONENT_TYPES.GRABBABLE,
    fields: {
      Scalable: { $type: 'bool', value: true },
    },
  };
}

/**
 * Fluent builder for ResoniteObject.
 *
 * Component IDs are always derived from the slot's own ID, eliminating the
 * possibility of accidentally passing a mismatched slotId to component builder functions.
 */
export class ResoniteObjectBuilder {
  private readonly obj: {
    id: string;
    name: string;
    position: ResoniteObject['position'];
    rotation: ResoniteObject['rotation'];
    scale?: ResoniteObject['scale'];
    sourceType?: ObjectType;
    locationName?: string;
    isActive: boolean;
    components: ResoniteComponent[];
    children: ResoniteObject[];
  };

  static create(identity: NewResoniteObjectSpec): ResoniteObjectBuilder {
    return new ResoniteObjectBuilder({
      id: identity.id ?? `${SLOT_ID_PREFIX}-${randomUUID()}`,
      name: identity.name,
    });
  }

  private constructor(identity: ResoniteObjectIdentity) {
    this.obj = {
      id: identity.id,
      name: identity.name,
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      isActive: true,
      components: [],
      children: [],
    };
  }

  getId(): string {
    return this.obj.id;
  }

  setPosition(position: ResoniteObject['position']): this {
    this.obj.position = position;
    return this;
  }

  setRotation(rotation: ResoniteObject['rotation']): this {
    this.obj.rotation = rotation;
    return this;
  }

  setScale(scale: ResoniteObject['scale']): this {
    this.obj.scale = scale;
    return this;
  }

  setSourceType(sourceType: ObjectType): this {
    this.obj.sourceType = sourceType;
    if (sourceType !== 'character') {
      delete this.obj.locationName;
    }
    return this;
  }

  setLocationName(locationName?: string): this {
    if (locationName == null) {
      delete this.obj.locationName;
      return this;
    }
    this.obj.locationName = locationName;
    return this;
  }

  setActive(isActive: ResoniteObject['isActive']): this {
    this.obj.isActive = isActive;
    return this;
  }

  addQuadMesh(options?: QuadMeshOptions): this {
    this.obj.components.push(...buildQuadMeshComponents(this.obj.id, options));
    return this;
  }

  addTriangleMesh(options: TriangleMeshOptions): this {
    this.obj.components.push(...buildTriangleMeshComponents(this.obj.id, options));
    return this;
  }

  addBoxCollider(size: BoxSize, options?: { characterCollider?: boolean }): this {
    this.obj.components.push(buildBoxColliderComponent(this.obj.id, size, options));
    return this;
  }

  addTriangleCollider(
    vertices: [TriangleVertex, TriangleVertex, TriangleVertex],
    options?: { characterCollider?: boolean }
  ): this {
    this.obj.components.push(buildTriangleColliderComponent(this.obj.id, vertices, options));
    return this;
  }

  addGrabbable(): this {
    this.obj.components.push(buildGrabbableComponent(this.obj.id));
    return this;
  }

  addTextComponent(content: string, size: number): this {
    this.obj.components.push({
      id: `${this.obj.id}-text`,
      type: COMPONENT_TYPES.UIX_TEXT,
      fields: {
        Content: { $type: 'string', value: content },
        Size: { $type: 'float', value: size },
      },
    });
    return this;
  }

  addChild(child: ResoniteObject): this {
    this.obj.children.push(child);
    return this;
  }

  addChildren(children: ResoniteObject[]): this {
    this.obj.children.push(...children);
    return this;
  }

  build(): ResoniteObject {
    const result = {
      ...this.obj,
      components: [...this.obj.components],
      children: [...this.obj.children],
    };
    if (result.sourceType !== 'character') {
      delete result.locationName;
    }
    return result as ResoniteObject;
  }
}
