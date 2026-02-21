/**
 * FrooxEngine component type identifiers used in Resonite slot construction.
 */
export const COMPONENT_TYPES = {
  QUAD_MESH: '[FrooxEngine]FrooxEngine.QuadMesh',
  BOX_MESH: '[FrooxEngine]FrooxEngine.BoxMesh',
  TRIANGLE_MESH: '[FrooxEngine]FrooxEngine.TriangleMesh',
  STATIC_TEXTURE_2D: '[FrooxEngine]FrooxEngine.StaticTexture2D',
  SIMPLE_AVATAR_PROTECTION: '[FrooxEngine]FrooxEngine.CommonAvatar.SimpleAvatarProtection',
  XIEXE_TOON_MATERIAL: '[FrooxEngine]FrooxEngine.XiexeToonMaterial',
  MAIN_TEXTURE_PROPERTY_BLOCK: '[FrooxEngine]FrooxEngine.MainTexturePropertyBlock',
  MESH_RENDERER: '[FrooxEngine]FrooxEngine.MeshRenderer',
  BOX_COLLIDER: '[FrooxEngine]FrooxEngine.BoxCollider',
  TRIANGLE_COLLIDER: '[FrooxEngine]FrooxEngine.TriangleCollider',
  GRABBABLE: '[FrooxEngine]FrooxEngine.Grabbable',
  UIX_TEXT: '[FrooxEngine]FrooxEngine.UIX.Text',
  OBJECT_ROOT: '[FrooxEngine]FrooxEngine.ObjectRoot',
} as const;
