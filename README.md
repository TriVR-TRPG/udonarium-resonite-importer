# Udonarium Resonite Importer

A tool to import [Udonarium](https://github.com/TK11235/udonarium) save data into [Resonite](https://resonite.com/) via [ResoniteLink](https://github.com/Yellow-Dog-Man/ResoniteLink).

[日本語版 README](README.ja.md)

## Features

- Import by specifying a ZIP file and the ResoniteLink port
- Supports major objects: characters, cards, terrain, tables, etc.
- Automatic image asset import
- For detailed usage, see the [English guide](docs/tool-overview.md).

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

## Requirements

- Resonite with ResoniteLink enabled

## Installation (Package Selection)

Download the latest package from [GitHub Releases](https://github.com/TriVR-TRPG/udonarium-resonite-importer/releases/latest).

- Choose **GUI** for desktop app usage, or **CLI** for command-line/automation usage
- CLI filename pattern: `udonarium-resonite-importer-cli-<platform>-bundle.zip` (`<platform>` = `win` / `macos` / `linux`)
- GUI filename pattern: `udonarium-resonite-importer-gui-<version>-<os>-<arch>.<ext>` (usually `.zip` on Windows/macOS, sometimes `.AppImage` on Linux)
- OS quick guide
  - Windows: `...-cli-win-bundle.zip` or `...-gui-...-win-...zip`
  - macOS: `...-cli-macos-bundle.zip` or `...-gui-...-mac-...zip`
  - Linux: `...-cli-linux-bundle.zip` (GUI only when a Linux GUI asset is published)

## Usage

### GUI Version (Recommended)

1. Download and extract the GUI package from Releases
2. Launch `Udonarium Resonite Importer` (`.exe` on Windows / `.app` on macOS)
3. Click "Browse..." to select a Udonarium ZIP file
4. In Resonite, enable ResoniteLink and set the port
5. Click "Import to Resonite"

![GUI usage image](docs/images/gui.en.png)

### CLI Version

Use the executable inside the extracted CLI ZIP package.

```bash
# Windows
.\udonarium-resonite-importer.exe -i .\save.zip -p 7869

# macOS
./udonarium-resonite-importer-macos -i ./save.zip -p 7869

# Linux
./udonarium-resonite-importer-linux -i ./save.zip -p 7869
```

### CLI Options

| Option      | Short | Description                   | Default     |
| ----------- | ----- | ----------------------------- | ----------- |
| `--input`   | `-i`  | Input ZIP file path           | (required)  |
| `--port`    | `-p`  | ResoniteLink port (or `RESONITELINK_PORT`) | (required, not needed in `--dry-run`) |
| `--host`    | `-H`  | ResoniteLink host (or `RESONITELINK_HOST`) | `localhost` |
| `--root-scale` | - | Root Scale | `1` |
| `--root-grabbable` | - | Add Grabbable to Root | `false` |
| `--simple-avatar-protection` / `--no-simple-avatar-protection` | - | Add SimpleAvatarProtection (toggle with `--no-simple-avatar-protection`) | `true` |
| `--transparent-blend-mode` | - | Transparent image render mode (`Cutout` or `Alpha`) | `Cutout` |
| `--enable-character-collider` / `--disable-character-collider` | - | Add colliders to table and fixed terrain / disable them | `true` |
| `--dry-run` | `-d`  | Analysis only (no connection) | false       |
| `--verbose` | `-v`  | Verbose output                | false       |
| `--lang`    | `-l`  | Language (en, ja)             | Auto-detect |
| `--help`    | `-h`  | Display help                  | -           |
| `--version` | `-V`  | Display version               | -           |

## License

MIT

## Related Links

- [Udonarium](https://github.com/TK11235/udonarium) - Web-based virtual tabletop
- [ResoniteLink](https://github.com/Yellow-Dog-Man/ResoniteLink) - Resonite integration tool
- [tsrl](https://www.npmjs.com/package/@eth0fox/tsrl) - TypeScript library used for ResoniteLink connectivity

## MMC26 Entry

This tool was submitted to Metaverse Maker Competition 2026.
Version at the time of entry: [v1.0.0-beta.4](https://github.com/TriVR-TRPG/udonarium-resonite-importer/releases/tag/v1.0.0-beta.4)

- Event: [Metaverse Maker Competition 2026](https://youtu.be/MHxobH-TkKc)
- Category: other tau
- World: [[MMC26] Udonarium Resonite Importer - Resonite](https://go.resonite.com/world/G-1Nc5BgekFJQ/R-b0e1dc28-fec9-48cb-8fee-58459f3f637a)
