# ResoniteLink Test Fixtures

This directory contains actual response data from ResoniteLink for use in mock tests.

## Collecting Data

When ResoniteLink API changes, regenerate these fixtures:

1. Start Resonite with ResoniteLink enabled
2. Run: `npm run collect:resonitelink`

## Files

| File | Description |
|------|-------------|
| `_metadata.json` | Collection timestamp and metadata |
| `addSlot-response.json` | Response from creating a slot |
| `getSlot-response.json` | Response from getting a slot |
| `getSlot-depth-response.json` | Response from getting a slot with depth |
| `updateSlot-response.json` | Response from updating a slot |
| `removeSlot-response.json` | Response from removing a slot |
| `importTexture2DRawData-response.json` | Response from importing a texture |
| `requestSessionData-response.json` | Response from getting session data |
| `getSlot-notFound-response.json` | Response when slot not found |

## Component Fixtures

The `components/` directory contains fixture data for each component type required for Udonarium object representation:

| File | Component Type |
|------|----------------|
| `_summary.json` | Test summary with success/failure status |
| `QuadMesh.json` | `[FrooxEngine]FrooxEngine.QuadMesh` |
| `BoxMesh.json` | `[FrooxEngine]FrooxEngine.BoxMesh` |
| `MeshRenderer.json` | `[FrooxEngine]FrooxEngine.MeshRenderer` |
| `PBS_Metallic.json` | `[FrooxEngine]FrooxEngine.PBS_Metallic` |
| `UnlitMaterial.json` | `[FrooxEngine]FrooxEngine.UnlitMaterial` |
| `StaticTexture2D.json` | `[FrooxEngine]FrooxEngine.StaticTexture2D` |
| `Grabbable.json` | `[FrooxEngine]FrooxEngine.Grabbable` |
| `BoxCollider.json` | `[FrooxEngine]FrooxEngine.BoxCollider` |
| `Canvas.json` | `[FrooxEngine]FrooxEngine.UIX.Canvas` |
| `Text.json` | `[FrooxEngine]FrooxEngine.UIX.Text` |
| `VerticalLayout.json` | `[FrooxEngine]FrooxEngine.UIX.VerticalLayout` |
| `Image.json` | `[FrooxEngine]FrooxEngine.UIX.Image` |

Each component fixture contains:
- `componentType`: The full FrooxEngine component type string
- `addResponse`: Response from adding the component
- `getResponse`: Response from getting the component data (includes all member properties)
