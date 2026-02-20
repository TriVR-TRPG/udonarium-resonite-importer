# Table Mask Conversion Specification

[日本語版](table-mask.ja.md)

## 1. Scope

Defines conversion behavior for Udonarium `table-mask` objects into Resonite slots/components.

## 2. Source Fields (Udonarium)

- `name`
- `position.x` (`location.x`)
- `position.y` (`location.y`)
- `position.z` (`posZ`)
- `width`
- `height`
- `isLock` (attribute, optional) — note: terrain uses `isLocked`, table-mask uses `isLock`
- `image.imageIdentifier` (optional)
- `common.opacity` (`numberResource.currentValue`, optional)

## 3. Parser Behavior

`parseTableMask(...)` stores:

- `isLock` from `isLock` attribute (boolean)
- `images[0]` from `imageIdentifier` when present
- `opacity` from `opacity.currentValue` when present

Defaults:

- `isLock = false` when missing
- `width = 4` when missing
- `height = 4` when missing
- `opacity = 100%` equivalent at conversion time when missing

## 4. Coordinate and Rotation Mapping

Base conversion:

- `resonite.x =  udonarium.x * SCALE_FACTOR`
- `resonite.y =  udonarium.z * SCALE_FACTOR`
- `resonite.z = -udonarium.y * SCALE_FACTOR`

Center offset correction:

- `x += width / 2`
- `z -= height / 2`

Additional placement:

- `rotation = (x: 90, y: 0, z: 0)`
- `y += 0.002` (small offset to avoid overlap artifacts)

## 5. Components

`applyTableMaskConversion(...)` creates:

- `QuadMesh` (`Size = (width, height)`, `DualSided = true`)
- `XiexeToonMaterial`
- `MeshRenderer`
- Optional texture chain from `buildQuadMeshComponents(...)`
  - local texture: `StaticTexture2D` + `MainTexturePropertyBlock`
  - shared texture reference: `MaterialPropertyBlocks` reference only
- `BoxCollider` (`Size = (width, height, 0.01)`)
- `Grabbable` only when `isLock == false`

## 6. Material Rules

- `BlendMode = Alpha`
- `Color.profile = Linear`
- `Color.a = clamp(opacity / 100, 0..1)`
- Color RGB depends on image presence:
  - no image: black (`r=g=b=0`)
  - image present: white (`r=g=b=1`)

## 7. Shared Material Deduplication

Materials are shared by full material field content, not just blend mode.
Therefore image/no-image masks (different color settings) become different shared materials.

## 8. Validation Points

1. `opacity` changes alpha correctly
2. image/no-image switches RGB between white/black
3. slot orientation and center offset are correct
4. collider exists with thickness `0.01`
5. mask materials are not merged when their fields differ
6. unlocked mask has `Grabbable`, locked mask does not
