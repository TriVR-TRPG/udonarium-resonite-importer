# Development Guide

[日本語版](development.ja.md)

## Build Commands

```bash
# Build CLI and GUI (parallel)
npm run build

# Build CLI version only
npm run build:cli

# Build GUI version only
npm run build:gui

# Run in development mode
npm run dev -- -i ./save.zip --dry-run

# GUI development mode
npm run dev:gui
```

## Validation & Auto-fix

```bash
# Auto-fix then validate (lint, format, types)
npm run check

# Validate only (no auto-fix)
npm run check:validate

# Auto-fix only
npm run check:fix
```

## Testing

This project uses [Vitest](https://vitest.dev/).

```bash
# Run unit tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run integration tests (requires Resonite with ResoniteLink)
npm run test:integration
```

### Test Structure

| Type | Description | Count |
|------|-------------|-------|
| Unit Tests | Fast tests with mocked dependencies | 217 |
| Integration Tests | Tests against live ResoniteLink | 15 |

Integration tests are **skipped by default** and only run when `RESONITE_LINK_AVAILABLE=true` is set. This ensures CI pipelines work without requiring Resonite.

### ResoniteLink Mock Data Collection

When ResoniteLink API changes, you can regenerate mock data for tests:

```bash
# Requires Resonite with ResoniteLink enabled
npm run collect:resonitelink
```

This collects actual API responses and saves them to `src/__fixtures__/resonitelink/`.

## Packaging

### CLI Standalone Executables

```bash
npm run package:cli:win      # Windows
npm run package:cli:mac      # macOS
npm run package:cli:linux    # Linux
npm run package:cli          # All platforms
```

### GUI Packaging

```bash
npm run package:gui:win      # Windows
npm run package:gui:mac      # macOS
npm run package:gui:linux    # Linux
npm run package:gui          # All platforms
```

## Project Structure

```
udonarium-resonite-importer/
├── src/
│   ├── index.ts                 # CLI entry point
│   ├── config/                  # Configuration
│   ├── parser/                  # ZIP/XML parsing
│   │   └── objects/             # Object-specific parsers
│   ├── converter/               # Udonarium → Resonite conversion
│   ├── resonite/                # ResoniteLink client
│   ├── gui/                     # Electron GUI
│   ├── i18n/                    # Internationalization
│   └── __fixtures__/            # Test fixtures
├── scripts/                     # Utility scripts
├── lib/
│   └── resonitelink.js/         # ResoniteLink library (submodule)
└── .github/
    └── workflows/               # CI/CD pipelines
```

## Coordinate System Conversion

Converts from Udonarium's 2D coordinate system to Resonite's 3D coordinate system:

```
Udonarium (2D)           Resonite (3D, Y-up)
  +X → Right               +X → Right
  +Y → Down                +Y → Up
  posZ → Height            +Z → Forward
```

- `resonite.x =  udonarium.x    * SCALE_FACTOR`
- `resonite.y =  udonarium.posZ * SCALE_FACTOR`
- `resonite.z = -udonarium.y    * SCALE_FACTOR`

The default `SCALE_FACTOR` is 0.02 (50px = 1m).

Udonarium uses `location.x` / `location.y` / `posZ` for coordinates.
Objects use bottom-origin in Udonarium but center-origin in Resonite, so a Y-offset is applied for terrain and character objects.
