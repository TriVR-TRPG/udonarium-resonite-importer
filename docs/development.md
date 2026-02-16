# Development Guide

[日本語版](development.ja.md)

## Note: Why `dynamic import()` is used for tsrl

`src/resonite/ResoniteLinkClient.ts` loads `@eth0fox/tsrl` via `await import('@eth0fox/tsrl')` at connection time.

Reason:
- this project currently compiles CLI code as **CommonJS** (`tsconfig.cli.json` uses `"module": "commonjs"`)
- `@eth0fox/tsrl` is published as an **ESM package** (`type: "module"`)

Using `dynamic import()` avoids CJS/ESM interop issues from static `require`-style loading and keeps runtime compatibility stable.

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

| Scope | Location | Description |
|------|----------|-------------|
| Unit | `src/**/?(*.)test.ts` | Fast tests with explicit input data and mocked dependencies |
| Integration (fixture-based) | `src/parser/integration.test.ts`, `src/converter/integration.test.ts` | End-to-end flow using fixture ZIP files (`extract -> parse -> convert`) |
| Integration (live ResoniteLink) | `src/resonite/integration.test.ts` | Tests against a running Resonite + ResoniteLink environment |

Only live ResoniteLink integration tests are **skipped by default** and run when `RESONITE_LINK_AVAILABLE=true` is set. Fixture-based integration tests run in normal `npm run test`.

`npm run test` also includes bootstrap smoke tests that guard GUI and ResoniteLink startup wiring:

- `src/gui/bootstrap.smoke.test.ts`
- `src/resonite/bootstrap.smoke.test.ts`

Fixture-based converter integration currently covers:
- `sample-dice.zip` (`dice-symbol`)
- `sample-card.zip` (`card`, `card-stack`)
- `sample-mapmask.zip` (`table-mask`)
- `sample-terrain.zip` (`terrain`)

### ResoniteLink Mock Data Collection

When ResoniteLink API changes, you can regenerate mock data for tests:

```bash
# Requires Resonite with ResoniteLink enabled
npm run collect:resonitelink
```

This collects actual API responses and saves them to `src/__fixtures__/resonitelink/`.

### Known Image Aspect Ratio Measurement

To update or validate aspect ratios for `KNOWN_IMAGES` entries:

```bash
npm run measure:known-image-ratios
```

This script downloads each known image URL, measures width/height, and prints:

- ratio (`height / width`)
- `hasAlpha` (whether the image contains an alpha channel)

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
└── .github/
    └── workflows/               # CI/CD pipelines
```

## Conversion Specifications

Per-object conversion specs are documented here:

- [docs/object-conversion/README.md](object-conversion/README.md)

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
Udonarium stores object positions at an edge/corner origin, while Resonite uses center-origin transforms, so each converter applies a per-object center offset.
Examples:
- terrain: `x += width/2`, `y += height/2`, `z -= depth/2`
- character: `x += size/2`, `y += size/2`, `z -= size/2`
- card/card-stack/text-note: `x += width/2`, `z -= height/2`
