# Layout Tool — Vanilla JS Rewrite Design

**Goal:** Rewrite the cabinet layout tool from React + TypeScript + Vite into plain HTML/CSS/vanilla JS, matching the tech and deployment stack of the internal-calculator-clone.

**Architecture:** One state object in `app.js`; every event handler mutates state then calls `render()`. SVG layers rebuilt via `innerHTML`. No build step, no bundler, no framework.

**Tech Stack:** Plain HTML5, CSS3, vanilla JS (ES5-compatible globals), Node.js for tests, Railway static site deployment via `npx http-server`.

---

## File Structure

```
C:/AI/LayoutV2/
├── index.html          Shell: toolbar, palette sidebar, SVG canvas, CSV dialog
├── css/
│   └── styles.css      Calculator design tokens + layout-specific rules
├── js/
│   ├── app.js          State object, event wiring, drag/drop, pan/zoom, render()
│   ├── canvas.js       SVG rendering: drawGrid(), drawWireducts(), drawComponents()
│   ├── csv.js          detectDelimiter(), parseCsv()
│   ├── storage.js      saveJson(), loadJson(), loadCsvFile()
│   └── utils.js        overlaps(), screenToCanvas(), zoomAll()
├── tests/
│   └── test.js         Plain Node.js tests — run with: node tests/test.js
├── favicon.ico         (copied from calculator)
└── railway.json        Railway static site config
```

Scripts loaded in `index.html` in dependency order:
```html
<script src="js/utils.js"></script>
<script src="js/csv.js"></script>
<script src="js/storage.js"></script>
<script src="js/canvas.js"></script>
<script src="js/app.js"></script>
```

---

## State

Single global object in `app.js`. All event handlers read/mutate this object, then call `render()`.

```js
var state = {
  componentDefs:  [],        // [{ id, partNumber, width, height, depth, qty }]
  placed:         [],        // [{ instanceId, defId, x, y }]
  wireducts:      [],        // [{ id, x, y, length, orientation, ductWidth }]
  gridSize:       20,
  gridVisible:    true,
  transform:      { scale: 1, offsetX: 0, offsetY: 0 },
  tool:           'select',  // 'select' | 'wireduct'
  ductWidth:      25,
  selectedId:     null,
  overlappingIds: {},        // plain object used as Set: { id: true }
  wireductStart:  null,      // { x, y } during wireduct draw, else null
  wireductPreview: null,     // wireduct object shown during draw, else null
  drag:           null,      // { instanceId, startScreenX, startScreenY, origX, origY }
  pan:            null,      // { startX, startY, origOffsetX, origOffsetY }
  csvRawText:     null,      // raw string while dialog is open, else null
};
```

---

## SVG Canvas

Static structure in `index.html`:

```html
<svg id="canvas">
  <g id="world">
    <g id="grid-layer"></g>
    <g id="wireduct-layer"></g>
    <g id="component-layer"></g>
    <g id="preview-layer"></g>
  </g>
</svg>
```

All four layers are children of `<g id="world">`. `render()` applies the pan/zoom transform once to `#world` — no per-layer transform needed.

`canvas.js` exports (as globals):
- `drawGrid(layer, state)` — rebuilds grid lines innerHTML
- `drawWireducts(layer, state)` — rebuilds wireduct rects innerHTML
- `drawComponents(layer, state)` — rebuilds component groups innerHTML
- `drawPreview(layer, state)` — draws wireduct preview rect or clears

`render()` in `app.js`:
1. Sets `translate(offsetX, offsetY) scale(scale)` on `#world`
2. Calls all four draw functions

Event listeners attached once at page load (never re-attached on render):
- `canvas` mousedown / mousemove / mouseup → drag, pan, wireduct draw
- `canvas` wheel → pan only (ctrl+wheel passes through to browser)
- `canvas` dragover / drop → palette item placement
- `window` keydown → Delete (remove selected), Escape (cancel active command)

---

## Toolbar (in index.html)

Rendered as static HTML — no JS-driven re-render needed except:
- Zoom slider `<input type="range">` value kept in sync via `render()` setting `.value`
- Zoom % label updated via `render()` setting `.textContent`
- Duct width input shown/hidden via `classList` based on `state.tool`

Controls:
- Load CSV button → `loadCsvFile()` → show dialog
- Save JSON / Load JSON buttons → `saveJson()` / `loadJson()`
- Grid size number input
- Show grid checkbox
- Select / Wireduct tool buttons (bold when active)
- Duct width number input (visible only when tool === 'wireduct')
- Zoom range slider (min 10, max 1000, step 5, value = scale × 100)
- Zoom % label
- Zoom All button

---

## Palette (in index.html)

Static `<div id="palette">` sidebar. `render()` rebuilds its innerHTML:
- One item per `componentDef`
- Shows id, partNumber, placed count / qty
- `draggable="true"` on each item; `dragstart` sets `event.dataTransfer.setData('defId', def.id)`
- Item gets `.fully-placed` class (greyed, `draggable="false"`) when placed count >= qty

---

## CSV Preview Dialog

Static `<div id="csv-dialog" class="dialog-overlay hidden">` in `index.html`.

Contains:
- Delimiter `<select>` (Auto / Tab / Comma / Semicolon)
- Row count + invalid count `<span>`
- `<table>` for preview rows (invalid rows in red)
- Cancel / Apply buttons

Flow:
1. `loadCsvFile()` reads file → stores raw text in `state.csvRawText` → calls `showCsvDialog()`
2. `showCsvDialog()` removes `hidden` class, calls `renderCsvPreview()`
3. Delimiter select `change` event → `renderCsvPreview()`
4. Apply → updates `state.componentDefs` → `hideCsvDialog()` → `render()`
5. Cancel / overlay click → `hideCsvDialog()`

---

## Data Flow

```
Load CSV → file picker → raw text → dialog shown
  → delimiter select → parseCsv() → preview table rebuilt
  → Apply → state.componentDefs updated → palette re-rendered

Drag palette item → dragstart (defId) → drop on SVG
  → screenToCanvas() → state.placed.push() → render()

Draw wireduct → mousedown (set wireductStart) → mousemove (preview)
  → mousedown again (commit) → state.wireducts.push() → render()

Delete key → remove state.placed or state.wireducts entry by selectedId
Escape → clear wireductStart, wireductPreview, drag, pan

Save JSON → saveJson({ componentDefs, placed, wireducts }) → browser download
Load JSON → file picker → parse → overwrite state fields → render() → zoomAll()
```

---

## Pan & Zoom

**Pan:** Middle mouse button drag (or ctrl+drag — not needed, middle is sufficient).
- `mousedown` button===1 → set `state.pan`
- `mousemove` → update `state.transform.offsetX/Y` → `render()`
- `mouseup` → clear `state.pan`

**Zoom slider:** `<input type="range">` in toolbar.
- `input` event → `handleZoomSlider(newScale)` → zooms toward viewport center → `render()`
- Ctrl+wheel passes through to browser (native page zoom)

**Zoom All:** Computes bounding box of all items → fits to SVG viewport with padding.

**Scroll (no ctrl):** Pans the canvas (shift+scroll = horizontal pan).

---

## Design System

Matches calculator exactly:
- Fonts: JetBrains Mono (toolbar labels, data), DM Sans (body)
- CSS custom properties from calculator's `:root` block (colors, spacing)
- Toolbar: same `.tool-toolbar` style as calculator's tool toolbar
- Palette sidebar: `.section` card style
- Dialog: same `.dialog-overlay` / `.dialog-box` pattern

---

## Testing

`tests/test.js` — run with `node tests/test.js`. No framework. Uses Node.js built-in `assert`.

Functions under test (inlined or required as CommonJS):
- `detectDelimiter(line)` — tab / comma / semicolon detection
- `parseCsv(text, delimiter)` — column-positional parsing, whitespace trim, empty line skip
- `overlaps(a, b)` — rectangle overlap detection
- `screenToCanvas(sx, sy, transform)` — coordinate conversion
- `zoomAll(items, viewW, viewH)` — bounding box → transform

Each function file will expose its functions via `if (typeof module !== 'undefined') module.exports = {...}` so they work both as browser globals and as Node.js requires.

---

## Deployment

`railway.json`:
```json
{
  "build": { "builder": "NIXPACKS", "buildCommand": "" },
  "deploy": { "startCommand": "npx http-server -c-1 -p $PORT ." }
}
```

No build step. Railway serves the directory as-is.
Local dev: `npx http-server -c-1` from `C:/AI/LayoutV2/`.
