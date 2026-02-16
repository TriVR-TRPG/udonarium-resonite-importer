# Object Conversion Specifications

This directory contains per-object conversion specifications from Udonarium to Resonite.

[Japanese](README.ja.md)

## Current Specs

- [Terrain](terrain.md): Terrain conversion rules and component structure
- [Character](character.md): Character conversion rules, aspect-ratio mesh behavior, and inventory routing
- [Card](card.md): Card conversion rules including per-face aspect ratio behavior
- [Card Stack](card-stack.md): Card-stack conversion rules and child stacking behavior
- [Dice Symbol](dice-symbol.md): Dice-symbol conversion rules, face sizing, and activation behavior
- [Table](table.md): Table conversion rules, child structure, and selected-table visibility
- [Table Mask](table-mask.md): Table-mask conversion rules and component/material behavior
- [Texture Placeholders](texture-placeholders.ja.md): `texture://` / `texture-ref://` usage and rationale

## Planned Specs

- `text-note.md`

Each spec should document:

1. Source properties (Udonarium)
2. Target representation (Resonite slots/components)
3. Coordinate and rotation rules
4. Texture/material rules
5. Collider rules
6. Conditional behavior
7. Known constraints and test points
