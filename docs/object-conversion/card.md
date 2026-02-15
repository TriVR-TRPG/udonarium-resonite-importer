# Card Conversion Specification

## 1. Scope

Defines conversion behavior for Udonarium `card` objects into a Resonite parent slot with front/back child slots.

## 2. Source Fields (Udonarium)

- `name`
- `position.x` / `position.y` / `position.z`
- `size` (card width, default `1` when missing)
- `rotate`
- `isFaceUp`
- `frontImage.identifier`
- `backImage.identifier`
- `images[]`

## 3. Coordinate and Rotation Mapping

Base coordinate conversion:

- `resonite.x = udonarium.x * SCALE_FACTOR`
- `resonite.y = udonarium.z * SCALE_FACTOR`
- `resonite.z = -udonarium.y * SCALE_FACTOR`

Parent slot offset:

- `x += cardWidth / 2`
- `z -= parentHeight / 2`
- `y += 0.001`

Parent slot rotation:

- `rotation = (x: 0, y: rotate, z: isFaceUp ? 0 : 180)`

## 4. Aspect Ratio Rules

### 4.1 Per-face mesh size

- Front height: `frontHeight = cardWidth * frontAspect`
- Back height: `backHeight = cardWidth * backAspect`

### 4.2 Fallback

- If aspect ratio cannot be resolved, fallback ratio is `1`

### 4.3 Parent size

- Parent height uses `parentHeight = max(frontHeight, backHeight)`
- Parent position correction and `BoxCollider` use `parentHeight`

### 4.4 Different front/back heights

- The smaller face is aligned to the card top edge
- Child slot `position.z` is adjusted by:
  - `frontZOffset = (parentHeight - frontHeight) / 2`
  - `backZOffset = (parentHeight - backHeight) / 2`

## 5. Slot Structure

### 5.1 Parent slot

- `BoxCollider` size: `(x: cardWidth, y: 0.01, z: parentHeight)`
- `Grabbable`

### 5.2 Front child slot

- id: `${parentId}-front`
- position: `(0, +0.0001, frontZOffset)`
- rotation: `(90, 0, 0)`
- `QuadMesh` size: `(cardWidth, frontHeight)`

### 5.3 Back child slot

- id: `${parentId}-back`
- position: `(0, -0.0001, backZOffset)`
- rotation: `(-90, 180, 0)`
- `QuadMesh` size: `(cardWidth, backHeight)`

## 6. Texture Selection

Front:

1. `frontImage`
2. `backImage`
3. `images[0]`

Back:

1. `backImage`
2. `frontImage`
3. `images[1]`
4. `images[0]`

## 7. Validation Points

1. Front/back `QuadMesh` sizes follow their own aspect ratios
2. Parent position and collider match the larger face height
3. Smaller face is top-aligned when front/back heights differ
4. `isFaceUp=false` results in parent `rotation.z=180`
