# Udonarium Resonite Importer

A tool to import [Udonarium](https://github.com/TK11235/udonarium) save data into [Resonite](https://resonite.com/) via [ResoniteLink](https://github.com/Yellow-Dog-Man/ResoniteLink).

[日本語版 README](README.ja.md)

## Features

- Import with just a ZIP file
- Supports major objects: characters, cards, terrain, tables, etc.
- Automatic image asset import
- Dry-run mode for preview before import
- **GUI version** (Electron) for easy use by beginners

## Supported Objects

| Udonarium | Resonite Representation |
|-----------|-------------------------|
| Character (GameCharacter) | Quad + Texture |
| Card | Double-sided Quad |
| Card Stack (CardStack) | Grouped cards |
| Terrain | Cube + Texture |
| Table (GameTable) | Quad |
| Text Note (TextNote) | UIX Text |

## Requirements

- Node.js 18 or higher (20.18.2 recommended, managed by [Volta](https://volta.sh/))
- Resonite with ResoniteLink enabled

## Installation

```bash
# Clone the repository
git clone https://github.com/blhsrwznrghfzpr/udonarium-resonite-importer.git
cd udonarium-resonite-importer

# Initialize submodules
git submodule update --init --recursive

# Install dependencies
npm install

# Build
npm run build
```

## Usage

### GUI Version (Recommended)

For users unfamiliar with command-line tools, we recommend the GUI version.

```bash
# Build and start the GUI
npm run build:gui
npm run start:gui
```

1. Click "Browse..." to select a Udonarium ZIP file
2. Review the analysis results
3. Configure ResoniteLink settings (default values usually work)
4. Click "Import to Resonite"

### CLI Version

#### Basic Usage

```bash
# Connect to Resonite and import
npm run start -- -i ./save.zip

# Specify port
npm run start -- -i ./save.zip -p 7869

# Specify language
npm run start -- -i ./save.zip -l en
```

### Dry-run Mode (Analysis Only)

```bash
npm run start -- -i ./save.zip --dry-run
```

### Verbose Output

```bash
npm run start -- -i ./save.zip --verbose
```

## CLI Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--input` | `-i` | Input ZIP file path | (required) |
| `--port` | `-p` | ResoniteLink port | 7869 |
| `--host` | `-H` | ResoniteLink host | localhost |
| `--scale` | `-s` | Scale factor | 0.02 |
| `--dry-run` | `-d` | Analysis only (no connection) | false |
| `--verbose` | `-v` | Verbose output | false |
| `--lang` | `-l` | Language (en, ja) | Auto-detect |

## Example Output

```
$ npm run start -- -i session.zip -p 7869

Udonarium Resonite Importer v1.0.0
========================================

[1/4] ZIP extracted - XML: 15, Images: 23
[2/4] Parsed 29 objects
[3/4] Connected to ResoniteLink
[4/4] Import complete - Images: 23/23, Objects: 29/29

Import completed successfully!
Check Resonite to see the imported objects.
```

## Creating Standalone Executables

```bash
# For Windows
npm run package:cli:win

# For macOS
npm run package:cli:mac

# For Linux
npm run package:cli:linux

# All platforms (CLI)
npm run package:cli
```

## Coordinate System Conversion

Converts from Udonarium's 2D coordinate system to Resonite's 3D coordinate system:

```
Udonarium (2D)           Resonite (3D)
  +X → Right               +X → Right
  +Y → Down                +Y → Up
                           +Z → Forward
```

- `resonite.x = udonarium.x * SCALE_FACTOR`
- `resonite.y = 0` (table height)
- `resonite.z = -udonarium.y * SCALE_FACTOR`

The default `SCALE_FACTOR` is 0.02 (50px = 1m).

## Development

### Build Commands

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

# Lint & Format
npm run lint
npm run format

# Type check
npm run typecheck
```

### Testing

This project uses [Vitest](https://vitest.dev/) for testing.

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

#### Test Structure

| Type | Description | Count |
|------|-------------|-------|
| Unit Tests | Fast tests with mocked dependencies | 216 |
| Integration Tests | Tests against live ResoniteLink | 15 |

Integration tests are **skipped by default** and only run when `RESONITE_LINK_AVAILABLE=true` is set. This ensures CI pipelines work without requiring Resonite.

#### Test Coverage

```bash
npm run test:coverage
```

Coverage reports are generated in the `coverage/` directory.

### ResoniteLink Mock Data Collection

When ResoniteLink API changes, you can regenerate mock data for tests:

```bash
# Requires Resonite with ResoniteLink enabled
npm run collect:resonitelink
```

This collects actual API responses and saves them to `src/__fixtures__/resonitelink/` for use in mock tests.

## GUI Packaging

```bash
# For Windows
npm run package:gui:win

# For macOS
npm run package:gui:mac

# For Linux
npm run package:gui:linux

# All platforms
npm run package:gui
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

## License

MIT

## Related Links

- [Udonarium](https://github.com/TK11235/udonarium) - Web-based virtual tabletop
- [ResoniteLink](https://github.com/Yellow-Dog-Man/ResoniteLink) - Resonite integration tool
- [Resonite Wiki - Connecting to Other Applications](https://wiki.resonite.com/Connecting_Resonite_to_Other_Applications)
