# MontRPGTiles — MonTT Maker

A browser-based battle map maker for tabletop RPGs. Everything lives in one file, [`MonTT.html`](MonTT.html): no build step and no dependencies beyond two Google Fonts.

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

[`Light Screen.html`](Light%20Screen.html) is **Light Screen**, a bilingual (PT/EN) DM screen with auto-rolling tables. Both pages load [`lightscreen-core.js`](lightscreen-core.js), which holds the dice roller, the treasure tables and the dungeon-encounter tables. MonTT Maker's dungeon generator uses it to roll each chamber's contents (monster, hazard, obstacle, trap, trick, treasure) and marks them on the map; those marks only show in the GM view. Light Screen also loads [`encounters-data.js`](encounters-data.js), the random-encounter tables by environment. Keep all four files in the same folder.

## Your own asset libraries

Floors, walls, doors and props can be imported from folders on your computer (each subfolder becomes a category). They're stored in the browser's IndexedDB, so they stay in that browser only. The importers understand the common `Name_2x1.png` convention, 200 px per square:

| Library | Pick a folder like | Keeps |
|---|---|---|
| Floors | `Textures` | every JPG/PNG/WebP, resized to 512 or 1024 px |
| Walls | `Structures/Walls_and_Curbs` | `Straight_A/B/C`, `Ending_A`, `Corner_A`, `Joint_A/B`, `Connector_A` per style |
| Doors | `Structures/Doors` | `Door_…_1x1`, `Door_Large_…_2x1`, `Door_Frame_…` (trapdoors and cellar doors go in as props) |
| Props | `Furniture`, `Flora`, `Decor`… | transparent PNG/WebP, footprint from the name |

## Running it locally

Open `MonTT.html` through any static server, for example:

```
py -m http.server 8765
```

then visit <http://localhost:8765/MonTT.html>.

## Nothic, a mesa online

`py nothic.py` sobe a mesa e mostra três links: o do mestre na mesa, o do mestre no MonTT e o dos jogadores (`nothic.html?p=SeuNome`). `--lan` aceita outros PCs da rede e `--teste` roda o autoteste. Para amigos fora de casa, deixe a mesa rodando e abra um túnel em outro terminal com `cloudflared tunnel --url http://localhost:8765` (instale com `winget install Cloudflare.cloudflared`); ele mostra um endereço `https://….trycloudflare.com` que vale enquanto o túnel estiver aberto, e os jogadores entram em `<endereço>/nothic.html?p=Nome`. No MonTT aberto pelo link do mestre, **Enviar ao Nothic** manda o andar atual: a imagem vai na visão de jogador, os tokens viram peças, e a névoa que você pinta depois chega na hora. Na mesa, o mestre clica com o botão direito num token para escolher quem pode movê-lo ou para escondê-lo. Ao lado do mapa ficam o chat (com `/r`, `/gr`, `/w` e `/em`, e dados rolados no servidor) e a iniciativa. Duplo clique no mapa faz um ping e Shift + arrastar mede distâncias para todos. No topo, o mestre liga a luz dinâmica do mapa (dia ou noite): as paredes do MonTT bloqueiam a visão, cada um vê pelos próprios tokens, o mestre abre e fecha portas e pode "ver como" um jogador. O botão ✨ Magia (ou `/fx` no chat) põe no mapa áreas (esfera, cone, cubo, linha), animações e luzes de magia. No **Diário** ficam as fichas de D&D 5e (com botões de rolar e `@{des_mod}` no chat) e os textos que o mestre mostra aos jogadores; arrastar uma ficha para o mapa cria um token com barra de PV ligada a ela. O estado fica em `campanha.json` (que também guarda o segredo do mestre) e as imagens em `uploads/`. O plano completo está em [`PLANO-VTT.md`](PLANO-VTT.md).

## About `assets/`

The page expects a small set of bundled images in `assets/` (13 brick floors, 6 wall styles, 7 doors, 2 frames). They come from a commercial map-asset pack and **are not included in this repository**. Without them the page still works: those floors show as flat colour and those walls and doors fall back to the drawn style. Put your own copies at the same paths (see the file lists in `MonTT.html`: `TEXTURE_SETS`, `INCLUDED_WALLS`, `DOORSTYLES`) to restore them.
