# Terrain Conversion Specification

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
- `y += height / 2`
- `z -= depth / 2`

## 4. Rotation Mapping

- Udonarium `rotate` is treated as clockwise ground-plane rotation.
- Resonite applies this as Y-axis rotation:
  - `rotation = (x: 0, y: rotate, z: 0)`

## 5. Slot Structure

Terrain root slot:

- Contains collider and optional `Grabbable`
- Holds child visual slots

Child slots:

1. `-top`
- QuadMesh
- Position: `(0, height/2, 0)`
- Rotation: `(90, 0, 0)`
- Size: `(width, depth)`
- Texture: floor image preferred, fallback to wall/first image

2. `-walls` (single container slot)
- Holds side wall slots
- `isActive = (mode !== 1)`

`-walls` children:

- `-front`: pos `(0, 0, -depth/2)`, rot `(0, 0, 0)`, size `(width, height)`
- `-back`:  pos `(0, 0,  depth/2)`, rot `(0, 180, 0)`, size `(width, height)`
- `-left`:  pos `(-width/2, 0, 0)`, rot `(0, 90, 0)`, size `(depth, height)`
- `-right`: pos `( width/2, 0, 0)`, rot `(0, -90, 0)`, size `(depth, height)`

Wall texture:

- Wall image preferred, fallback to floor/first image

## 6. Components

Terrain root:

- `BoxCollider` with size `(width, height, depth)`
- `Grabbable` only when `isLocked == false`

Visual slots:

- QuadMesh-based rendering components (with texture/material setup from shared builders)

## 7. Mode Behavior

- `mode = 1`: walls are generated but hidden via `-walls.isActive = false`
- Other modes: walls visible (`-walls.isActive = true`)

## 8. Validation Points

Recommended checks:

1. Size axis consistency (`width/x`, `height/y`, `depth/z`)
2. Correct center offset placement
3. `rotate` reflected on Y-axis
4. Wall visibility toggle by `mode`
5. `isLocked=false` adds `Grabbable`
