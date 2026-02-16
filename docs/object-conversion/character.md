# Character Conversion Specification

[日本語版](character.ja.md)

## 1. Scope

Defines conversion behavior for Udonarium `character` objects into Resonite slots/components.

## 2. Source Fields (Udonarium)

- `name`
- `position.x` (`location.x`)
- `position.y` (`location.y`)
- `position.z` (`posZ`)
- `location.name` (optional)
- `size`
- `rotate` (optional)
- `roll` (optional)
- `images[0].identifier` (optional)

## 3. Coordinate and Rotation Mapping

Base conversion:

- `resonite.x =  udonarium.x * SCALE_FACTOR`
- `resonite.y =  udonarium.z * SCALE_FACTOR`
- `resonite.z = -udonarium.y * SCALE_FACTOR`

Rotation:

- `rotation = (x: 0, y: rotate ?? 0, z: roll ?? 0)`

Center offset correction:

- `x += width / 2`
- `z -= width / 2`
- `y += visualHeight / 2`

Where:

- `width = size`
- `visualHeight = width * aspectRatio` when image exists
- `visualHeight = size` when image is missing

## 4. Mesh Size and Aspect Ratio Rules

When an image is set:

- Mesh width is fixed to `size`
- Mesh height is computed by image aspect ratio:
  - `height = size * aspectRatio`
- Aspect ratio is resolved via `imageAspectRatioMap`
- Fallback ratio is `1` when unresolved

When no image is set:

- No mesh is generated

## 5. Components

### 5.1 With image

Generated components:

- `QuadMesh` (`Size = (size, size * aspectRatio)`, `DualSided = true`)
- `XiexeToonMaterial`
- `MeshRenderer`
- Optional texture chain from `buildQuadMeshComponents(...)`
- `BoxCollider` (`Size = (size, size * aspectRatio, 0.05)`)

### 5.2 Without image

Generated components:

- `BoxCollider` only (`Size = (size, size, 0.05)`)

## 6. Texture and Material Rules

Image source:

- Uses `images[0]?.identifier`

Texture resolution:

- `resolveTextureValue(...)` with local/shared texture reference support

Blend mode:

- Resolved from image alpha metadata (`lookupImageBlendMode(...)`)
- Fallback `Opaque` when unresolved

## 7. Inventory Placement (SlotBuilder)

During slot build (outside converter), character slots are routed by `location.name`:

- Root container children include `Inventory`
- `Inventory/table` is always created and active
- Other `Inventory/<location.name>` slots are created as needed and inactive by default
- Character slots are parented under their corresponding `Inventory/<location.name>` slot

## 8. Validation Points

1. Character rotation reflects `rotate` (Y) and `roll` (Z)
2. With image, mesh width equals `size`
3. With image, mesh height follows image aspect ratio
4. Without image, no mesh/material/renderer components are created
5. Collider exists in both cases
6. `location.name` routing places character under expected `Inventory` child slot
