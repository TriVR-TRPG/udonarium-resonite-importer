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

- Node.js 18 or higher
- Resonite with ResoniteLink enabled

## Installation

```bash
# Clone the repository
git clone https://github.com/blhsrwznrghfzpr/udonarium-resonite-importer.git
cd udonarium-resonite-importer

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
npm run package:win

# For macOS
npm run package:mac

# For Linux
npm run package:linux

# All platforms
npm run package:all
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

```bash
# Build CLI version
npm run build

# Build GUI version
npm run build:gui

# Build both
npm run build:all

# Run in development mode
npm run dev -- -i ./save.zip --dry-run

# GUI development mode
npm run dev:gui

# Lint & Format
npm run lint
npm run format
```

## GUI Packaging

```bash
# For Windows
npm run package:gui:win

# For macOS
npm run package:gui:mac

# For Linux
npm run package:gui:linux

# All platforms
npm run package:gui:all
```

## License

MIT

## Related Links

- [Udonarium](https://github.com/TK11235/udonarium) - Web-based virtual tabletop
- [ResoniteLink](https://github.com/Yellow-Dog-Man/ResoniteLink) - Resonite integration tool
- [Resonite Wiki - Connecting to Other Applications](https://wiki.resonite.com/Connecting_Resonite_to_Other_Applications)
