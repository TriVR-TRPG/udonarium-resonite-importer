# Terrain Conversion Specification

[日本語版](terrain.ja.md)

## 1. Scope

Defines conversion behavior for Udonarium `terrain` objects into Resonite slots/components.

## 2. Source Fields (Udonarium)

- `name`
- `position.x` (`location.x`)
- `position.y` (`location.y`)
- `position.z` (`posZ`)
- `width`
- `height`
- `depth`
- `rotate`
- `mode`
- `isLocked`
- `wallImage`
- `floorImage`

## 3. Coordinate and Axis Mapping

Base conversion:

- `resonite.x =  udonarium.x * SCALE_FACTOR`
- `resonite.y =  udonarium.z * SCALE_FACTOR`
- `resonite.z = -udonarium.y * SCALE_FACTOR`

Axis mapping for terrain size:

- `width  -> X`
- `height -> Y`
- `depth  -> Z`

Center offset correction (Udonarium edge-origin to Resonite center-origin):

- `x += width / 2`
- `y += height / 2` (when `mode !== 1`)
- `y += height` (when `mode === 1`, to place the top surface at ground level)
- `z -= depth / 2`

## 4. Rotation Mapping

- Udonarium `rotate` is treated as clockwise ground-plane rotation.
- Resonite applies this as Y-axis rotation:
  - `rotation = (x: 0, y: rotate, z: 0)`

## 5. Slot Structure

Terrain root slot:

- Contains collider and optional `Grabbable`
- Holds child visual slots

Child slots differ by `mode`:

When `mode !== 1` (walls visible):

1. `-top`
   - Position: `(0, height/2, 0)`
   - Rotation: `(90, 0, 0)`
   - Size: `(width, depth)` QuadMesh (floor texture priority)

2. `-bottom`
   - Position: `(0, -height/2, 0)`
   - Rotation: `(-90, 0, 0)`
   - Size: `(width, depth)` QuadMesh (same texture as `-top`)

3. `-walls` (active container)
   - `-front`: pos `(0, 0, -depth/2)`, rot `(0, 0, 0)`, size `(width, height)`
   - `-back`:  pos `(0, 0,  depth/2)`, rot `(0, 180, 0)`, size `(width, height)`
   - `-left`:  pos `(-width/2, 0, 0)`, rot `(0, 90, 0)`, size `(depth, height)`
   - `-right`: pos `( width/2, 0, 0)`, rot `(0, -90, 0)`, size `(depth, height)`

When `mode === 1` (no walls):

1. `-top`
   - Position: `(0, 0, 0)`
   - Rotation: `(90, 0, 0)`
   - Size: `(width, depth)` QuadMesh (floor texture priority)

2. `-top-back`
   - Position: `(0, 0, 0)`
   - Rotation: `(-90, 0, 0)`
   - Size: `(width, depth)` QuadMesh (same texture as `-top`)

3. `-walls`: **not generated**

## 6. Components

Terrain root:

- `BoxCollider`
  - `mode !== 1`: size `(width, height, depth)`
  - `mode === 1`: size `(width, 0, depth)` (flat plane collider)
- `CharacterCollider = true` on `BoxCollider` when `isLocked == true`
- `Grabbable` only when `isLocked == false`

Visual slots:

- Each face uses `buildQuadMeshComponents(...)`, which creates:
  - `QuadMesh`
  - `XiexeToonMaterial`
  - `MeshRenderer`
  - Optional `StaticTexture2D` and `MainTexturePropertyBlock` when a local texture is used
- Shared texture/material asset references are resolved later in the shared-asset phase.

Texture selection order:

- Top face (`-top`):
  1. `floorImage.identifier`
  2. `wallImage.identifier`
  3. `images[0].identifier`
- Wall faces (`-front/-back/-left/-right`):
  1. `wallImage.identifier`
  2. `floorImage.identifier`
  3. `images[0].identifier`

## 7. Mode Behavior

- `mode = 1`: `-walls` container is not generated; only `-top` and `-top-back` are created; `BoxCollider` height is `0`; Y position offset uses `height` instead of `height / 2`
- Other modes: `-walls` is generated and active; `-top` and `-bottom` are created; `BoxCollider` size is `(width, height, depth)`

## 8. Validation Points

Recommended checks:

1. Size axis consistency (`width/x`, `height/y`, `depth/z`)
2. `mode !== 1`: Y center offset is `height / 2`
3. `mode === 1`: Y center offset is `height`
4. `rotate` reflected on Y-axis
5. `mode !== 1`: `-top`, `-bottom`, and `-walls` (with 4 wall faces) are generated
6. `mode === 1`: only `-top` and `-top-back` are generated; `-walls` is absent
7. `mode === 1`: `BoxCollider` height is `0`
8. `isLocked=true` enables `CharacterCollider` on `BoxCollider`
9. `isLocked=false` adds `Grabbable`
10. Top/wall texture fallback order works as expected
