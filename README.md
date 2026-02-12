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
| Terrain | Top + side Quad meshes (walls grouped under one slot) |
| Table (GameTable) | Quad |
| Text Note (TextNote) | UIX Text |

## Requirements

- Node.js 18 or higher (20.18.2 recommended, managed by [mise](https://mise.jdx.dev/))
- Resonite with ResoniteLink enabled

## Installation

```bash
git clone https://github.com/blhsrwznrghfzpr/udonarium-resonite-importer.git
cd udonarium-resonite-importer
git submodule update --init --recursive
npm install
npm run setup:resonitelink
npm run build
```

## Usage

### GUI Version (Recommended)

```bash
npm run build:gui
npm run start:gui
```

1. Click "Browse..." to select a Udonarium ZIP file
2. Review the analysis results
3. Configure ResoniteLink settings (default values usually work)
4. Click "Import to Resonite"

### CLI Version

```bash
# Connect to Resonite and import
npm run start -- -i ./save.zip

# Specify port
npm run start -- -i ./save.zip -p 7869

# Dry-run mode (analysis only)
npm run start -- -i ./save.zip --dry-run

# Verbose output
npm run start -- -i ./save.zip --verbose
```

### CLI Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--input` | `-i` | Input ZIP file path | (required) |
| `--port` | `-p` | ResoniteLink port | 7869 |
| `--host` | `-H` | ResoniteLink host | localhost |
| `--scale` | `-s` | Scale factor | 0.02 |
| `--dry-run` | `-d` | Analysis only (no connection) | false |
| `--verbose` | `-v` | Verbose output | false |
| `--lang` | `-l` | Language (en, ja) | Auto-detect |

## Development

See [docs/development.md](docs/development.md) for build commands, testing, packaging, and project structure.

## License

MIT

## Related Links

- [Udonarium](https://github.com/TK11235/udonarium) - Web-based virtual tabletop
- [ResoniteLink](https://github.com/Yellow-Dog-Man/ResoniteLink) - Resonite integration tool
- [Resonite Wiki - Connecting to Other Applications](https://wiki.resonite.com/Connecting_Resonite_to_Other_Applications)
