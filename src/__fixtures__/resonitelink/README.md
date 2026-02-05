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
| `addComponent-response.json` | Response from adding a component |
| `getComponent-response.json` | Response from getting a component |
| `removeComponent-response.json` | Response from removing a component |
| `importTexture2DRawData-response.json` | Response from importing a texture |
| `requestSessionData-response.json` | Response from getting session data |
| `getSlot-notFound-response.json` | Response when slot not found |
