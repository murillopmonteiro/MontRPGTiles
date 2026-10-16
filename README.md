# MontRPGTiles — Flagstone

A browser-based battle map maker for tabletop RPGs. Everything lives in one file, [`flagstone.html`](flagstone.html): no build step and no dependencies beyond two Google Fonts.

## What it does

- **Grid maps in 5-ft squares** with column/row coordinates (A1, B7…) and a map size readout in feet.
- **Floors**: 11 drawn ground types, plus image textures laid seamlessly across the grid with a per-texture scale.
- **Walls** along grid lines, built from modular wall kits (straights, corners, T-joints, crossings, end caps chosen automatically).
- **Doors and frames**: single and double doors, flip hinge/swing side, optional frames.
- **Props** placed anywhere, off the grid if you like: any rotation, 10–1000% scale, flip, draw order, duplicate, snap-to-grid toggle.
- **Tokens** with sides (hero / foe / ally), creature sizes Tiny→Gargantuan, auto-numbering, and move distance while dragging.
- **Measure** with three diagonal rules (every 5 ft, 5/10 alternating, true distance).
- **Fog of war** with GM and player views.
- **Maps tab**: new map, save in the browser (with previews), open, delete, save/open `.json` files, export PNG.
- Undo/redo, zoom/pan, touch pinch.

## Light Screen and shared tables

[`dmscreen.html`](dmscreen.html) is **Light Screen**, a bilingual (PT/EN) DM screen with auto-rolling tables. Both pages load [`lightscreen-core.js`](lightscreen-core.js), which holds the dice roller, the treasure tables and the dungeon-encounter tables. Flagstone's dungeon generator uses it to roll each chamber's contents (monster, hazard, obstacle, trap, trick, treasure) and marks them on the map; those marks only show in the GM view. Keep the three files in the same folder.

## Your own asset libraries

Floors, walls, doors and props can be imported from folders on your computer (each subfolder becomes a category). They're stored in the browser's IndexedDB, so they stay in that browser only. The importers understand the common `Name_2x1.png` convention, 200 px per square:

| Library | Pick a folder like | Keeps |
|---|---|---|
| Floors | `Textures` | every JPG/PNG/WebP, resized to 512 or 1024 px |
| Walls | `Structures/Walls_and_Curbs` | `Straight_A/B/C`, `Ending_A`, `Corner_A`, `Joint_A/B`, `Connector_A` per style |
| Doors | `Structures/Doors` | `Door_…_1x1`, `Door_Large_…_2x1`, `Door_Frame_…` (trapdoors and cellar doors go in as props) |
| Props | `Furniture`, `Flora`, `Decor`… | transparent PNG/WebP, footprint from the name |

## Running it locally

Open `flagstone.html` through any static server, for example:

```
py -m http.server 8765
```

then visit <http://localhost:8765/flagstone.html>.

## About `assets/`

The page expects a small set of bundled images in `assets/` (13 brick floors, 6 wall styles, 7 doors, 2 frames). They come from a commercial map-asset pack and **are not included in this repository**. Without them the page still works: those floors show as flat colour and those walls and doors fall back to the drawn style. Put your own copies at the same paths (see the file lists in `flagstone.html`: `TEXTURE_SETS`, `INCLUDED_WALLS`, `DOORSTYLES`) to restore them.
