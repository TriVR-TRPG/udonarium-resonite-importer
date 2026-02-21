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

| Udonarium                 | Resonite Representation                               |
| ------------------------- | ----------------------------------------------------- |
| Character (GameCharacter) | Quad + Texture                                        |
| Dice Symbol (DiceSymbol)  | Quad (face switching)                                 |
| Card                      | Double-sided Quad                                     |
| Card Stack (CardStack)    | Grouped cards                                         |
| Terrain                   | Top + side Quad meshes (walls grouped under one slot) |
| Map Mask (TableMask)      | Quad (semi-transparent support)                       |
| Table (GameTable)         | Quad                                                  |
| Shared Note (TextNote)    | UIX Text                                              |

## Requirements

- Node.js 18 or higher (20.18.2 recommended, managed by [mise](https://mise.jdx.dev/))
- Resonite with ResoniteLink enabled

## Installation

Download the latest package from GitHub Releases:

- https://github.com/TriVR-TRPG/udonarium-resonite-importer/releases/latest

Then choose one package:

- GUI (Windows/macOS): download and extract the GUI ZIP package
- CLI (Windows/macOS/Linux): download the standalone executable for your platform

## Usage

### GUI Version (Recommended)

1. Download and extract the GUI package from Releases
2. Launch `Udonarium Resonite Importer` (`.exe` on Windows / `.app` on macOS)
3. Click "Browse..." to select a Udonarium ZIP file
4. In Resonite, enable ResoniteLink and set the port
5. Click "Import to Resonite"

### CLI Version

```bash
# Run downloaded standalone executable
./udonarium-resonite-importer -i ./save.zip

# Specify port
./udonarium-resonite-importer -i ./save.zip -p 7869

# Dry-run mode (analysis only)
./udonarium-resonite-importer -i ./save.zip --dry-run

# Verbose output
./udonarium-resonite-importer -i ./save.zip --verbose
```

To build a standalone CLI bundle from source (current OS only):

```bash
npm run package:cli
```

Output:

- executable: `dist/udonarium-resonite-importer*`
- bundle zip: `dist/udonarium-resonite-importer-*-bundle.zip` or `dist/udonarium-resonite-importer-win.zip`

### CLI Options

| Option      | Short | Description                   | Default     |
| ----------- | ----- | ----------------------------- | ----------- |
| `--input`   | `-i`  | Input ZIP file path           | (required)  |
| `--port`    | `-p`  | ResoniteLink port             | 7869        |
| `--host`    | `-H`  | ResoniteLink host             | localhost   |
| `--scale`   | `-s`  | Scale factor                  | 1 (m)       |
| `--dry-run` | `-d`  | Analysis only (no connection) | false       |
| `--verbose` | `-v`  | Verbose output                | false       |
| `--lang`    | `-l`  | Language (en, ja)             | Auto-detect |

## Development

See [docs/development.md](docs/development.md) for build commands, testing, packaging, and project structure.

## License

MIT

## Related Links

- [Udonarium](https://github.com/TK11235/udonarium) - Web-based virtual tabletop
- [ResoniteLink](https://github.com/Yellow-Dog-Man/ResoniteLink) - Resonite integration tool

