# Cabinet Layout App — Design Spec
**Date:** 2026-04-24
**Stack:** Stack 4 — React Widget (Vite + React + TypeScript, SVG canvas)

---

## Overview

A browser-based 2D electrical cabinet layout tool. The user loads a CSV of components, drags them onto an SVG canvas, draws wireducts, and saves/loads the layout as JSON. No backend required.

---

## Data Model

```typescript
// src/types.ts

interface ComponentDef {
  id: string;          // from CSV
  partNumber: string;  // from CSV
  width: number;       // mm
  height: number;      // mm
  depth: number;       // mm (stored, not rendered)
  qty: number;         // from CSV
}

interface PlacedComponent {
  instanceId: string;  // uuid, unique per placement
  defId: string;       // links to ComponentDef.id
  x: number;           // canvas px
  y: number;           // canvas px
}

interface Wireduct {
  id: string;
  x: number;           // top-left px
  y: number;           // top-left px
  length: number;      // px (horizontal: visual width / vertical: visual height)
  orientation: 'horizontal' | 'vertical';
  ductWidth: number;   // mm — the narrow dimension of the duct
}

interface Layout {
  components: PlacedComponent[];
  wireducts: Wireduct[];
}

interface GridSettings {
  size: number;        // px per cell
  visible: boolean;
}

interface ViewTransform {
  scale: number;       // zoom level, e.g. 1.0 = 100%
  offsetX: number;     // pan offset px
  offsetY: number;     // pan offset px
}
```

CSV expected columns: `id, partNumber, width, height, depth, qty`

Placed qty per component = count of `PlacedComponent[]` entries where `defId === def.id`.

---

## File Structure

```
cabinet-layout/
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
├── src/
│   ├── main.tsx
│   ├── App.tsx               # Root state, layout shell
│   ├── types.ts
│   ├── components/
│   │   ├── Toolbar.tsx       # CSV load, JSON save/load, grid controls, tool switcher, wireduct width input
│   │   ├── Palette.tsx       # Left pane — component list with qty/placed qty, drag source
│   │   ├── Canvas.tsx        # SVG canvas — grid, placed components, wireducts
│   │   ├── PlacedComponent.tsx  # Draggable SVG rect+text group
│   │   └── Wireduct.tsx      # SVG rect with "WIREDUCT" label
│   └── utils/
│       ├── csv.ts            # Parse CSV -> ComponentDef[]
│       ├── overlap.ts        # Bounding box overlap detection
│       └── storage.ts        # JSON save (download) / load (file picker)
```

State lives entirely in `App.tsx` via `useState`/`useReducer`. No global state library.

---

## UI Layout

```
+--------------------------------------------------+
|  Toolbar (top bar)                               |
|  [Load CSV] [Save JSON] [Load JSON]              |
|  Grid: [size input] [toggle visibility]          |
|  Tool: [Select] [Wireduct]  Width: [input] mm    |
|  Zoom: [scale display] [Zoom All]                |
+-------------+------------------------------------+
|  Palette    |  Canvas (SVG)                      |
|             |                                    |
|  ID   PN    |  . . . . . . . . . . . . . . .    |
|  qty/placed |  +------+                          |
|             |  | ID   |                          |
|  (dimmed    |  | PN   |                          |
|   if fully  |  +------+                          |
|   placed)   |                                    |
|             |  ============ WIREDUCT ==========  |
+-------------+------------------------------------+
```

---

## Interactions

### Component Palette
- Lists all `ComponentDef` entries from loaded CSV
- Each entry shows: `ID`, `PN`, `placed/qty`
- Fully-placed components (placed === qty) are visually dimmed
- Drag from palette initiates an HTML drag event; drop on SVG canvas creates a `PlacedComponent`

### Canvas — Select Mode
- Click a placed component or wireduct to select it (highlighted border)
- Drag selected component to reposition (mousedown -> mousemove -> mouseup on SVG)
- `Delete` key removes selected item; for components, decrements placed count and restores palette highlight
- Overlap detection runs on every move: overlapping placed components get a red border

### Canvas — Wireduct Mode
- First click sets start point (x1, y1)
- Mouse move shows a preview rect locked to dominant axis (horizontal if |dx| > |dy|, vertical otherwise)
- Second click commits wireduct; orientation and length determined by axis lock
- Wireduct width (ductWidth) set via toolbar input before/after drawing
- Wireducts display "WIREDUCT" text centered inside the rect
- Wireducts are selectable and deletable (same Delete key behavior)

### Grid
- SVG defs pattern tiled across canvas
- Size: number input in toolbar (px per cell), default 20px
- Visibility: checkbox toggle
- Positioning is free-form — no snapping

### Zoom & Pan
The SVG canvas applies a `transform` on an inner `<g>` element using `scale` and `translate` from `ViewTransform`. All content (components, wireducts, grid) lives inside this group.

| Input | Behavior |
|-------|----------|
| `Ctrl + mouse wheel` | Zoom in/out centered on cursor position |
| Mouse wheel (no Ctrl) | Scroll vertically (pan offsetY) |
| Middle mouse button hold + drag | Pan (update offsetX, offsetY) |
| Middle mouse button double-click | Zoom all — fit all content into canvas viewport |
| Toolbar zoom display | Read-only, shows current scale as percentage (e.g. `125%`) |
| Toolbar [Zoom All] button | Same as double middle-click — fit all content |
| Load JSON | Automatically triggers Zoom All after layout is restored |

**Zoom All logic:** compute bounding box of all placed components and wireducts, then set `scale` and `offset` so the bounding box fits centered in the canvas viewport with a small margin (e.g. 40px). If canvas is empty, reset to scale=1, offset=(0,0).

**Zoom step:** each wheel tick scales by a factor of 1.1 (zoom in) or 1/1.1 (zoom out). Scale is clamped between 0.1 and 10.

**Zoom to cursor:** when zooming with Ctrl+wheel, the point under the cursor stays fixed. Formula:
```
newOffsetX = cursorX - (cursorX - offsetX) * (newScale / oldScale)
newOffsetY = cursorY - (cursorY - offsetY) * (newScale / oldScale)
```

### Overlap Warning
- On every drag move, check all other `PlacedComponent` bounding boxes
- If any overlap: apply red stroke to the moving component
- Overlap clears when no longer intersecting

### Save / Load
- **Save:** Serialize `{ componentDefs, layout }` to JSON and trigger browser file download
- **Load layout:** File picker reads JSON, restores `PlacedComponent[]` and `Wireduct[]`, then triggers Zoom All
- **Load CSV:** File picker reads CSV and replaces `ComponentDef[]`; placed components with matching `defId` are preserved

---

## Rendering Details

### PlacedComponent SVG group
- `<g transform="translate(x, y)">`
- `<rect width={def.width} height={def.height} />`
- `<text>` for ID centered top-half
- `<text>` for PN centered bottom-half
- Normal: gray fill, dark stroke
- Selected: blue stroke
- Overlapping: red stroke

### Wireduct SVG
- `<rect width={horizontal ? length : ductWidth} height={horizontal ? ductWidth : length} />`
- `<text>WIREDUCT</text>` centered in rect
- Light fill, dark stroke
- Selected: blue stroke

### Grid SVG Pattern
- `<pattern>` in `<defs>` with lines forming grid cell
- Toggled via opacity on the background rect

---

## CSV Format

```
id,partNumber,width,height,depth,qty
CB1,ABB-S201-C16,45,85,70,3
MCB1,SIE-5SL6,36,85,70,2
```

Units are mm. Width/height map directly to canvas px (1mm = 1px default).

---

## Dependencies

```json
{
  "dependencies": {
    "react": "^18",
    "react-dom": "^18",
    "uuid": "^9"
  },
  "devDependencies": {
    "vite": "^5",
    "@vitejs/plugin-react": "^4",
    "typescript": "^5"
  }
}
```

No CSS framework. Minimal plain CSS.

---

## MegaResistors Deployment

- Deploy as Stack 4 React Widget via Railway
- App listens on `0.0.0.0:8080`
- Cloudflare Tunnel: `internal-cabinet-layout`
- URL: `https://internal-cabinet-layout.megaresistors.com`
- Auth: Cloudflare Access + Google Workspace SSO (no code required)
