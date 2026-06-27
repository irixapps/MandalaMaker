# Mandala Maker

A browser-based mandala drawing and compositing tool. Draw symmetrical art, stamp images, and compose layered mandalas with full radial symmetry control.

---

## Getting Started

Open `index.html` in a browser, or serve it locally (e.g. `npx serve .`).

---

## Interface Overview

### Toolbar (top)

| Control | Description |
|---|---|
| **New / Save / Load** | Start fresh, save project as JSON, or load a saved project |
| **Export PNG** | Download the canvas as a PNG image |
| **Axes −/+** | Set the number of symmetry axes (0 = free draw, no symmetry) |
| **Rotate ↺ ↻** | Step the axis rotation CCW or CW by `45°/n` per click |
| **Mirror** | Toggle between kaleidoscope (mirrored, 2n copies) and pinwheel (rotational, 2n pure rotations) |
| **Guides** | Show/hide the dashed symmetry guide lines |

### Sidebar (left)

| Tool | Key | Description |
|---|---|---|
| Brush | `B` | Freehand drawing with symmetry |
| Line | `L` | Straight line tool |
| Rectangle | — | Rectangle shape |
| Select | `S` | Select, move, scale, and rotate stamped sprites |
| Stamp | `P` | Place a palette image onto the canvas |
| Eyedropper | `I` | Pick a colour from the canvas |

### Mandalas Panel (bottom-left)

Each project can contain multiple mandalas stacked on the same canvas. Use **+** to add and the **trash** button to delete the active one (requires confirmation; the last mandala cannot be deleted).

### Palette (right)

Drag images or GIFs into the palette, or click **+ Import**. Select an image then switch to the Stamp tool to place it. Animated GIFs animate on the canvas.

---

## Symmetry System

Mandala Maker uses **dihedral symmetry**: `n` axes produce `2n` cells.

| Axes | Mirror ON | Mirror OFF |
|---|---|---|
| 1 | 2 copies (reflected across horizontal) | 2 rotational copies |
| 4 | 8 kaleidoscope copies | 8 pinwheel copies |
| 8 | 16 kaleidoscope copies | 16 pinwheel copies |

- **Mirror ON**: alternate copies are flipped — classic kaleidoscope look.
- **Mirror OFF**: all copies are pure rotations of the original — pinwheel look.

Guide lines always show `n` full lines through the centre (creating `2n` visual cells).

### Axis Rotation

The ↺ ↻ buttons rotate all axes by `45°/n` per click — one quarter of a cell width — so you can fine-tune the orientation with multiple presses. You can also type a precise degree value in the number field.

---

## Stamp Tool

1. Select an image from the palette.
2. Press `P` or click the stamp icon.
3. Hover over the canvas to see a semi-transparent preview of all symmetry copies.
4. Click to place.
5. Press **Escape** to exit stamp mode, auto-switch to Select, and auto-select the last placed sprite for immediate adjustment.

### Warp Mode (per sprite)

When a sprite is selected, enabling **Warp** bends the image to follow the circular arc at its radial position — useful for creating ring-shaped platform or decoration elements.

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `B` | Brush tool |
| `L` | Line tool |
| `S` | Select tool |
| `P` | Stamp/Place tool |
| `I` | Eyedropper |
| `Escape` | Exit stamp mode → Select + select last stamp |
| `[` / `]` | Decrease / increase brush size |
| `Ctrl/⌘ Z` | Undo |
| `Ctrl/⌘ Y` | Redo |
| `Ctrl/⌘ S` | Save project |
| `Delete` / `Backspace` | Delete selected sprite |

---

## File Format

Projects save as `.json` containing all mandala state including strokes, sprites, palette references, and settings. Images/GIFs in the palette are embedded as base64 so the file is self-contained.
