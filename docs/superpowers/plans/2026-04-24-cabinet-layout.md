# Cabinet Layout App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a browser-based 2D electrical cabinet layout tool where users load components from CSV, place them on an SVG canvas, draw orthogonal wireducts, and save/load layouts as JSON.

**Architecture:** Single-page Vite + React + TypeScript app, no backend. All state lives in `App.tsx`. The SVG canvas wraps all content in a `<g>` with a `transform` driven by `ViewTransform` (scale + offset). Grid uses SVG `patternTransform` to stay aligned during zoom/pan. Utility functions are pure and unit-tested with Vitest.

**Tech Stack:** Vite 5, React 18, TypeScript 5, SVG (no canvas API), Vitest. No CSS framework.

---

## File Map

| File | Responsibility |
|------|---------------|
| `src/types.ts` | All shared TypeScript interfaces |
| `src/utils/csv.ts` | Parse CSV text → `ComponentDef[]` |
| `src/utils/overlap.ts` | Bounding box overlap detection |
| `src/utils/zoom.ts` | `zoomAtPoint`, `zoomAll`, `screenToCanvas` |
| `src/utils/storage.ts` | Serialize layout → JSON download; read JSON file |
| `src/utils/csv.test.ts` | Unit tests for csv.ts |
| `src/utils/overlap.test.ts` | Unit tests for overlap.ts |
| `src/utils/zoom.test.ts` | Unit tests for zoom.ts |
| `src/App.tsx` | All app state, event wiring, layout shell |
| `src/App.css` | Toolbar / palette / canvas flex layout |
| `src/components/Toolbar.tsx` | Top bar: CSV/JSON buttons, grid controls, tool switcher, wireduct width, zoom display, Zoom All |
| `src/components/Palette.tsx` | Left pane: component list, qty/placed display, drag source |
| `src/components/Canvas.tsx` | SVG canvas: grid, transform group, all mouse/wheel/drag event handlers |
| `src/components/PlacedComponent.tsx` | SVG group: rect + ID + PN labels |
| `src/components/Wireduct.tsx` | SVG group: rect + WIREDUCT label |

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx` (shell)
- Create: `src/App.css` (shell)

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "cabinet-layout",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.1",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.5.3",
    "vite": "^5.4.2",
    "vitest": "^2.0.5"
  }
}
```

- [ ] **Step 2: Create `vite.config.ts`**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
  },
  server: {
    host: '0.0.0.0',
    port: 8080,
  },
  preview: {
    host: '0.0.0.0',
    port: 8080,
  },
});
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Cabinet Layout</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `src/main.tsx`**

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './App.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 6: Create `src/App.tsx` shell**

```tsx
export default function App() {
  return <div className="app">Cabinet Layout</div>;
}
```

- [ ] **Step 7: Create `src/App.css` shell**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html, body, #root {
  height: 100%;
}

.app {
  display: flex;
  flex-direction: column;
  height: 100%;
  font-family: sans-serif;
  font-size: 13px;
}

.toolbar {
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-bottom: 1px solid #ccc;
  background: #f5f5f5;
}

.toolbar-sep {
  width: 1px;
  height: 20px;
  background: #ccc;
}

.main {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.palette {
  width: 220px;
  flex-shrink: 0;
  border-right: 1px solid #ccc;
  overflow-y: auto;
  padding: 8px;
  background: #fafafa;
}

.palette-item {
  padding: 6px 8px;
  margin-bottom: 4px;
  border: 1px solid #bbb;
  border-radius: 3px;
  background: #fff;
  cursor: grab;
  user-select: none;
}

.palette-item.fully-placed {
  opacity: 0.35;
  cursor: default;
}

.palette-item-id {
  font-weight: 600;
}

.palette-item-pn {
  color: #555;
  font-size: 11px;
}

.palette-item-qty {
  font-size: 11px;
  color: #888;
}

.canvas-container {
  flex: 1;
  overflow: hidden;
  position: relative;
  background: #fff;
}

.canvas-container svg {
  display: block;
  width: 100%;
  height: 100%;
}

button {
  padding: 3px 8px;
  cursor: pointer;
}

input[type="number"] {
  width: 60px;
  padding: 2px 4px;
}

label {
  display: flex;
  align-items: center;
  gap: 4px;
}
```

- [ ] **Step 8: Install dependencies**

```bash
cd "C:/AI/Layout" && npm install
```

Expected: packages installed, `node_modules/` created.

- [ ] **Step 9: Verify dev server starts**

```bash
npm run dev
```

Expected: Vite server running at `http://localhost:8080`. Browser shows "Cabinet Layout" text.

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "feat: scaffold Vite + React + TypeScript project"
```

---

## Task 2: Types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Create `src/types.ts`**

```ts
export interface ComponentDef {
  id: string;
  partNumber: string;
  width: number;   // mm → canvas px (1:1)
  height: number;  // mm → canvas px (1:1)
  depth: number;   // mm, stored only
  qty: number;
}

export interface PlacedComponent {
  instanceId: string;  // crypto.randomUUID()
  defId: string;
  x: number;           // canvas px (pre-transform)
  y: number;
}

export interface Wireduct {
  id: string;          // crypto.randomUUID()
  x: number;           // top-left canvas px
  y: number;
  length: number;      // px along the long axis
  orientation: 'horizontal' | 'vertical';
  ductWidth: number;   // px — the short dimension
}

export interface Layout {
  components: PlacedComponent[];
  wireducts: Wireduct[];
}

export interface GridSettings {
  size: number;    // px per cell at scale=1
  visible: boolean;
}

export interface ViewTransform {
  scale: number;   // 1.0 = 100%
  offsetX: number; // px
  offsetY: number;
}

export type Tool = 'select' | 'wireduct';

export interface SaveFile {
  componentDefs: ComponentDef[];
  layout: Layout;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types.ts && git commit -m "feat: define all TypeScript interfaces"
```

---

## Task 3: CSV Utility + Tests

**Files:**
- Create: `src/utils/csv.ts`
- Create: `src/utils/csv.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/utils/csv.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseCsv } from './csv';

const VALID_CSV = `id,partNumber,width,height,depth,qty
CB1,ABB-S201,45,85,70,3
MCB1,SIE-5SL6,36,85,70,2`;

describe('parseCsv', () => {
  it('parses valid CSV into ComponentDef array', () => {
    const defs = parseCsv(VALID_CSV);
    expect(defs).toHaveLength(2);
    expect(defs[0]).toEqual({
      id: 'CB1',
      partNumber: 'ABB-S201',
      width: 45,
      height: 85,
      depth: 70,
      qty: 3,
    });
    expect(defs[1].id).toBe('MCB1');
    expect(defs[1].qty).toBe(2);
  });

  it('skips empty lines', () => {
    const csv = `id,partNumber,width,height,depth,qty\n\nCB1,PN1,10,20,30,1\n`;
    expect(parseCsv(csv)).toHaveLength(1);
  });

  it('trims whitespace from values', () => {
    const csv = `id,partNumber,width,height,depth,qty\n CB1 , PN1 ,10,20,30,1`;
    const defs = parseCsv(csv);
    expect(defs[0].id).toBe('CB1');
    expect(defs[0].partNumber).toBe('PN1');
  });

  it('returns empty array for header-only CSV', () => {
    expect(parseCsv('id,partNumber,width,height,depth,qty')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm test
```

Expected: FAIL — `parseCsv` not found.

- [ ] **Step 3: Implement `src/utils/csv.ts`**

```ts
import type { ComponentDef } from '../types';

export function parseCsv(text: string): ComponentDef[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  return lines.slice(1).map(line => {
    const [id, partNumber, width, height, depth, qty] = line.split(',').map(v => v.trim());
    return {
      id,
      partNumber,
      width: Number(width),
      height: Number(height),
      depth: Number(depth),
      qty: Number(qty),
    };
  });
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test
```

Expected: all 4 csv tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/csv.ts src/utils/csv.test.ts && git commit -m "feat: CSV parser with unit tests"
```

---

## Task 4: Overlap Utility + Tests

**Files:**
- Create: `src/utils/overlap.ts`
- Create: `src/utils/overlap.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/utils/overlap.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { overlaps, type BBox } from './overlap';

describe('overlaps', () => {
  const box = (x: number, y: number, w: number, h: number): BBox => ({ x, y, w, h });

  it('returns true for overlapping boxes', () => {
    expect(overlaps(box(0, 0, 10, 10), box(5, 5, 10, 10))).toBe(true);
  });

  it('returns false when boxes are side by side', () => {
    expect(overlaps(box(0, 0, 10, 10), box(10, 0, 10, 10))).toBe(false);
  });

  it('returns false when boxes are above and below', () => {
    expect(overlaps(box(0, 0, 10, 10), box(0, 10, 10, 10))).toBe(false);
  });

  it('returns true when one box is inside another', () => {
    expect(overlaps(box(0, 0, 100, 100), box(10, 10, 10, 10))).toBe(true);
  });

  it('returns false when boxes are far apart', () => {
    expect(overlaps(box(0, 0, 10, 10), box(100, 100, 10, 10))).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm test
```

Expected: FAIL — `overlaps` not found.

- [ ] **Step 3: Implement `src/utils/overlap.ts`**

```ts
export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function overlaps(a: BBox, b: BBox): boolean {
  return !(
    a.x + a.w <= b.x ||
    b.x + b.w <= a.x ||
    a.y + a.h <= b.y ||
    b.y + b.h <= a.y
  );
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test
```

Expected: all 5 overlap tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/overlap.ts src/utils/overlap.test.ts && git commit -m "feat: bounding box overlap detection with unit tests"
```

---

## Task 5: Zoom Utility + Tests

**Files:**
- Create: `src/utils/zoom.ts`
- Create: `src/utils/zoom.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/utils/zoom.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { zoomAtPoint, zoomAll, screenToCanvas } from './zoom';
import type { ViewTransform } from '../types';

const identity: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };

describe('zoomAtPoint', () => {
  it('zooms in by factor ~1.1', () => {
    const result = zoomAtPoint(identity, 0, 0, 1);
    expect(result.scale).toBeCloseTo(1.1, 5);
  });

  it('zooms out by factor ~1/1.1', () => {
    const result = zoomAtPoint(identity, 0, 0, -1);
    expect(result.scale).toBeCloseTo(1 / 1.1, 5);
  });

  it('keeps cursor point fixed when zooming at cursor', () => {
    const t: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };
    const result = zoomAtPoint(t, 100, 100, 1);
    // point (100,100) in screen space should map to same canvas point before and after
    const beforeCanvas = screenToCanvas(100, 100, t);
    const afterCanvas = screenToCanvas(100, 100, result);
    expect(afterCanvas.x).toBeCloseTo(beforeCanvas.x, 5);
    expect(afterCanvas.y).toBeCloseTo(beforeCanvas.y, 5);
  });

  it('clamps scale at minimum 0.1', () => {
    let t = identity;
    for (let i = 0; i < 100; i++) t = zoomAtPoint(t, 0, 0, -1);
    expect(t.scale).toBeGreaterThanOrEqual(0.1);
  });

  it('clamps scale at maximum 10', () => {
    let t = identity;
    for (let i = 0; i < 100; i++) t = zoomAtPoint(t, 0, 0, 1);
    expect(t.scale).toBeLessThanOrEqual(10);
  });
});

describe('zoomAll', () => {
  it('returns identity-like transform for empty items', () => {
    const result = zoomAll([], 800, 600);
    expect(result.scale).toBe(1);
    expect(result.offsetX).toBe(0);
    expect(result.offsetY).toBe(0);
  });

  it('fits a single item into viewport', () => {
    const result = zoomAll(
      [{ x: 0, y: 0, w: 200, h: 100 }],
      800, 600, 40
    );
    expect(result.scale).toBeGreaterThan(0);
    // content should be centered: item center maps to viewport center
    const cx = result.offsetX + 100 * result.scale;
    const cy = result.offsetY + 50 * result.scale;
    expect(cx).toBeCloseTo(400, 0);
    expect(cy).toBeCloseTo(300, 0);
  });
});

describe('screenToCanvas', () => {
  it('converts screen coords to canvas coords at identity', () => {
    const result = screenToCanvas(100, 200, identity);
    expect(result.x).toBe(100);
    expect(result.y).toBe(200);
  });

  it('accounts for offset and scale', () => {
    const t: ViewTransform = { scale: 2, offsetX: 50, offsetY: 50 };
    const result = screenToCanvas(150, 150, t);
    expect(result.x).toBe(50);  // (150 - 50) / 2
    expect(result.y).toBe(50);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm test
```

Expected: FAIL — functions not found.

- [ ] **Step 3: Implement `src/utils/zoom.ts`**

```ts
import type { ViewTransform } from '../types';

const ZOOM_FACTOR = 1.1;
const MIN_SCALE = 0.1;
const MAX_SCALE = 10;

export function zoomAtPoint(
  t: ViewTransform,
  screenX: number,
  screenY: number,
  delta: number
): ViewTransform {
  const factor = delta > 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
  const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, t.scale * factor));
  const actualFactor = newScale / t.scale;
  return {
    scale: newScale,
    offsetX: screenX - (screenX - t.offsetX) * actualFactor,
    offsetY: screenY - (screenY - t.offsetY) * actualFactor,
  };
}

export interface ZoomItem {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function zoomAll(
  items: ZoomItem[],
  viewportWidth: number,
  viewportHeight: number,
  margin = 40
): ViewTransform {
  if (items.length === 0) return { scale: 1, offsetX: 0, offsetY: 0 };

  const minX = Math.min(...items.map(i => i.x));
  const minY = Math.min(...items.map(i => i.y));
  const maxX = Math.max(...items.map(i => i.x + i.w));
  const maxY = Math.max(...items.map(i => i.y + i.h));

  const contentW = maxX - minX;
  const contentH = maxY - minY;

  const scaleX = (viewportWidth - margin * 2) / contentW;
  const scaleY = (viewportHeight - margin * 2) / contentH;
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.min(scaleX, scaleY)));

  const offsetX = (viewportWidth - contentW * scale) / 2 - minX * scale;
  const offsetY = (viewportHeight - contentH * scale) / 2 - minY * scale;

  return { scale, offsetX, offsetY };
}

export function screenToCanvas(
  screenX: number,
  screenY: number,
  t: ViewTransform
): { x: number; y: number } {
  return {
    x: (screenX - t.offsetX) / t.scale,
    y: (screenY - t.offsetY) / t.scale,
  };
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test
```

Expected: all zoom and screenToCanvas tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/zoom.ts src/utils/zoom.test.ts && git commit -m "feat: zoom/pan utilities with unit tests"
```

---

## Task 6: Storage Utility

**Files:**
- Create: `src/utils/storage.ts`

No unit tests — functions are thin wrappers around browser APIs.

- [ ] **Step 1: Create `src/utils/storage.ts`**

```ts
import type { SaveFile } from '../types';

export function saveLayout(data: SaveFile): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'cabinet-layout.json';
  a.click();
  URL.revokeObjectURL(url);
}

export function loadLayout(): Promise<SaveFile> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return reject(new Error('No file selected'));
      const reader = new FileReader();
      reader.onload = e => {
        try {
          resolve(JSON.parse(e.target!.result as string) as SaveFile);
        } catch {
          reject(new Error('Invalid JSON file'));
        }
      };
      reader.readAsText(file);
    };
    input.click();
  });
}

export function loadCsvFile(): Promise<string> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,text/csv';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return reject(new Error('No file selected'));
      const reader = new FileReader();
      reader.onload = e => resolve(e.target!.result as string);
      reader.readAsText(file);
    };
    input.click();
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/utils/storage.ts && git commit -m "feat: JSON save/load and CSV file utilities"
```

---

## Task 7: App.tsx Shell + Toolbar

**Files:**
- Modify: `src/App.tsx`
- Create: `src/components/Toolbar.tsx`

- [ ] **Step 1: Create `src/components/Toolbar.tsx`**

```tsx
import type { GridSettings, Tool, ViewTransform } from '../types';

interface Props {
  gridSettings: GridSettings;
  onGridSizeChange: (size: number) => void;
  onGridVisibilityToggle: () => void;
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  ductWidth: number;
  onDuctWidthChange: (w: number) => void;
  transform: ViewTransform;
  onZoomAll: () => void;
  onLoadCsv: () => void;
  onSaveJson: () => void;
  onLoadJson: () => void;
}

export default function Toolbar({
  gridSettings, onGridSizeChange, onGridVisibilityToggle,
  tool, onToolChange,
  ductWidth, onDuctWidthChange,
  transform, onZoomAll,
  onLoadCsv, onSaveJson, onLoadJson,
}: Props) {
  return (
    <div className="toolbar">
      <button onClick={onLoadCsv}>Load CSV</button>
      <button onClick={onSaveJson}>Save JSON</button>
      <button onClick={onLoadJson}>Load JSON</button>

      <span className="toolbar-sep" />

      <label>
        Grid:
        <input
          type="number"
          min={5}
          max={200}
          value={gridSettings.size}
          onChange={e => onGridSizeChange(Number(e.target.value))}
        />
        px
      </label>
      <label>
        <input
          type="checkbox"
          checked={gridSettings.visible}
          onChange={onGridVisibilityToggle}
        />
        Show grid
      </label>

      <span className="toolbar-sep" />

      <label>
        Tool:
        <button
          style={{ fontWeight: tool === 'select' ? 'bold' : 'normal' }}
          onClick={() => onToolChange('select')}
        >
          Select
        </button>
        <button
          style={{ fontWeight: tool === 'wireduct' ? 'bold' : 'normal' }}
          onClick={() => onToolChange('wireduct')}
        >
          Wireduct
        </button>
      </label>

      {tool === 'wireduct' && (
        <label>
          Duct width:
          <input
            type="number"
            min={5}
            max={500}
            value={ductWidth}
            onChange={e => onDuctWidthChange(Number(e.target.value))}
          />
          mm
        </label>
      )}

      <span className="toolbar-sep" />

      <span>{Math.round(transform.scale * 100)}%</span>
      <button onClick={onZoomAll}>Zoom All</button>
    </div>
  );
}
```

- [ ] **Step 2: Replace `src/App.tsx` with full shell**

```tsx
import { useState, useCallback } from 'react';
import type { ComponentDef, PlacedComponent, Wireduct, GridSettings, ViewTransform, Tool, Layout } from './types';
import { parseCsv } from './utils/csv';
import { saveLayout, loadLayout, loadCsvFile } from './utils/storage';
import Toolbar from './components/Toolbar';

export default function App() {
  const [componentDefs, setComponentDefs] = useState<ComponentDef[]>([]);
  const [placed, setPlaced] = useState<PlacedComponent[]>([]);
  const [wireducts, setWireducts] = useState<Wireduct[]>([]);
  const [gridSettings, setGridSettings] = useState<GridSettings>({ size: 20, visible: true });
  const [transform, setTransform] = useState<ViewTransform>({ scale: 1, offsetX: 0, offsetY: 0 });
  const [tool, setTool] = useState<Tool>('select');
  const [ductWidth, setDuctWidth] = useState(25);

  const handleLoadCsv = useCallback(async () => {
    try {
      const text = await loadCsvFile();
      setComponentDefs(parseCsv(text));
    } catch { /* user cancelled */ }
  }, []);

  const handleSaveJson = useCallback(() => {
    saveLayout({
      componentDefs,
      layout: { components: placed, wireducts },
    });
  }, [componentDefs, placed, wireducts]);

  const handleLoadJson = useCallback(async () => {
    try {
      const data = await loadLayout();
      setComponentDefs(data.componentDefs);
      setPlaced(data.layout.components);
      setWireducts(data.layout.wireducts);
      // zoom all triggered after state updates via effect — handled in Canvas
    } catch { /* user cancelled or bad file */ }
  }, []);

  const layout: Layout = { components: placed, wireducts };

  return (
    <div className="app">
      <Toolbar
        gridSettings={gridSettings}
        onGridSizeChange={size => setGridSettings(g => ({ ...g, size }))}
        onGridVisibilityToggle={() => setGridSettings(g => ({ ...g, visible: !g.visible }))}
        tool={tool}
        onToolChange={setTool}
        ductWidth={ductWidth}
        onDuctWidthChange={setDuctWidth}
        transform={transform}
        onZoomAll={() => {/* wired in Task 14 */}}
        onLoadCsv={handleLoadCsv}
        onSaveJson={handleSaveJson}
        onLoadJson={handleLoadJson}
      />
      <div className="main">
        <div style={{ padding: 8 }}>Canvas placeholder — {placed.length} components placed</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run dev server and verify toolbar renders**

```bash
npm run dev
```

Open browser at `http://localhost:8080`. Expected: toolbar with buttons and controls visible. Load CSV should open file picker. No errors in console.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/components/Toolbar.tsx && git commit -m "feat: App shell with Toolbar wired to state"
```

---

## Task 8: Palette Component

**Files:**
- Create: `src/components/Palette.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create `src/components/Palette.tsx`**

```tsx
import type { ComponentDef, PlacedComponent } from '../types';

interface Props {
  defs: ComponentDef[];
  placed: PlacedComponent[];
}

function placedCount(defs: ComponentDef, placed: PlacedComponent[]): number {
  return placed.filter(p => p.defId === defs.id).length;
}

export default function Palette({ defs, placed }: Props) {
  function handleDragStart(e: React.DragEvent, defId: string) {
    e.dataTransfer.setData('defId', defId);
    e.dataTransfer.effectAllowed = 'copy';
  }

  return (
    <div className="palette">
      {defs.length === 0 && (
        <div style={{ color: '#999', fontSize: 12 }}>Load a CSV to see components</div>
      )}
      {defs.map(def => {
        const count = placedCount(def, placed);
        const full = count >= def.qty;
        return (
          <div
            key={def.id}
            className={`palette-item${full ? ' fully-placed' : ''}`}
            draggable={!full}
            onDragStart={full ? undefined : e => handleDragStart(e, def.id)}
          >
            <div className="palette-item-id">{def.id}</div>
            <div className="palette-item-pn">{def.partNumber}</div>
            <div className="palette-item-qty">{count}/{def.qty} placed</div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Add Palette to `src/App.tsx`**

Import and add inside `.main`:

```tsx
import Palette from './components/Palette';

// Inside return, replace the main div placeholder:
<div className="main">
  <Palette defs={componentDefs} placed={placed} />
  <div className="canvas-container">
    Canvas placeholder
  </div>
</div>
```

- [ ] **Step 3: Verify palette renders with loaded CSV**

Run dev server, load a CSV, confirm palette items appear with correct ID/PN/qty display.

- [ ] **Step 4: Commit**

```bash
git add src/components/Palette.tsx src/App.tsx && git commit -m "feat: Palette component with drag source and placed qty display"
```

---

## Task 9: Canvas + Grid

**Files:**
- Create: `src/components/PlacedComponent.tsx`
- Create: `src/components/Wireduct.tsx`
- Create: `src/components/Canvas.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create `src/components/PlacedComponent.tsx`**

```tsx
import type { ComponentDef, PlacedComponent as PlacedComp } from '../types';

interface Props {
  item: PlacedComp;
  def: ComponentDef;
  selected: boolean;
  overlapping: boolean;
  onMouseDown: (e: React.MouseEvent, instanceId: string) => void;
  onClick: (e: React.MouseEvent, instanceId: string) => void;
}

export default function PlacedComponent({ item, def, selected, overlapping, onMouseDown, onClick }: Props) {
  const stroke = overlapping ? '#e53e3e' : selected ? '#3182ce' : '#555';
  const strokeWidth = selected || overlapping ? 2 : 1;

  return (
    <g
      transform={`translate(${item.x}, ${item.y})`}
      style={{ cursor: 'move' }}
      onMouseDown={e => onMouseDown(e, item.instanceId)}
      onClick={e => onClick(e, item.instanceId)}
    >
      <rect
        width={def.width}
        height={def.height}
        fill="#e8e8e8"
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      <text
        x={def.width / 2}
        y={def.height / 2 - 6}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={11}
        fill="#222"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {item.instanceId.slice(0, 4)}…{def.id}
      </text>
      <text
        x={def.width / 2}
        y={def.height / 2 + 8}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={10}
        fill="#555"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {def.partNumber}
      </text>
    </g>
  );
}
```

Note: the first text line shows `ID` (defId) and the second shows `partNumber`. The `instanceId.slice` is just for visual uniqueness — display `def.id` as the primary label:

Correct the first text line:
```tsx
      <text ...>{def.id}</text>
```

- [ ] **Step 2: Create `src/components/Wireduct.tsx`**

```tsx
import type { Wireduct as WireductType } from '../types';

interface Props {
  item: WireductType;
  selected: boolean;
  onClick: (e: React.MouseEvent, id: string) => void;
}

export default function Wireduct({ item, selected, onClick }: Props) {
  const w = item.orientation === 'horizontal' ? item.length : item.ductWidth;
  const h = item.orientation === 'horizontal' ? item.ductWidth : item.length;
  const stroke = selected ? '#3182ce' : '#444';

  return (
    <g
      transform={`translate(${item.x}, ${item.y})`}
      style={{ cursor: 'pointer' }}
      onClick={e => onClick(e, item.id)}
    >
      <rect
        width={w}
        height={h}
        fill="#d4e8f5"
        stroke={stroke}
        strokeWidth={selected ? 2 : 1}
      />
      <text
        x={w / 2}
        y={h / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={10}
        fill="#333"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        WIREDUCT
      </text>
    </g>
  );
}
```

- [ ] **Step 3: Create `src/components/Canvas.tsx`**

```tsx
import { useRef, forwardRef, useImperativeHandle } from 'react';
import type {
  ComponentDef, PlacedComponent, Wireduct as WireductType,
  GridSettings, ViewTransform, Tool,
} from '../types';
import PlacedComponentEl from './PlacedComponent';
import WireductEl from './Wireduct';

export interface CanvasHandle {
  getSvgRect: () => DOMRect | undefined;
}

interface Props {
  defs: ComponentDef[];
  placed: PlacedComponent[];
  wireducts: WireductType[];
  gridSettings: GridSettings;
  transform: ViewTransform;
  tool: Tool;
  selectedId: string | null;
  overlappingIds: Set<string>;
  ductWidth: number;
  onTransformChange: (t: ViewTransform) => void;
  onDrop: (defId: string, canvasX: number, canvasY: number) => void;
  onComponentMouseDown: (e: React.MouseEvent, instanceId: string) => void;
  onComponentClick: (e: React.MouseEvent, instanceId: string) => void;
  onWireductClick: (e: React.MouseEvent, id: string) => void;
  onCanvasMouseDown: (e: React.MouseEvent) => void;
  onCanvasMouseMove: (e: React.MouseEvent) => void;
  onCanvasMouseUp: (e: React.MouseEvent) => void;
  onWheel: (e: React.WheelEvent) => void;
  wireductPreview: WireductType | null;
}

const Canvas = forwardRef<CanvasHandle, Props>(({
  defs, placed, wireducts, gridSettings, transform, tool,
  selectedId, overlappingIds, ductWidth,
  onTransformChange, onDrop,
  onComponentMouseDown, onComponentClick, onWireductClick,
  onCanvasMouseDown, onCanvasMouseMove, onCanvasMouseUp, onWheel,
  wireductPreview,
}, ref) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useImperativeHandle(ref, () => ({
    getSvgRect: () => svgRef.current?.getBoundingClientRect(),
  }));

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const defId = e.dataTransfer.getData('defId');
    if (!defId) return;
    const rect = svgRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const cx = (sx - transform.offsetX) / transform.scale;
    const cy = (sy - transform.offsetY) / transform.scale;
    onDrop(defId, cx, cy);
  }

  const { scale, offsetX, offsetY } = transform;
  const patternSize = gridSettings.size;

  return (
    <svg
      ref={svgRef}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onMouseDown={onCanvasMouseDown}
      onMouseMove={onCanvasMouseMove}
      onMouseUp={onCanvasMouseUp}
      onMouseLeave={onCanvasMouseUp}
      onWheel={onWheel}
      onContextMenu={e => e.preventDefault()}
      style={{ display: 'block', width: '100%', height: '100%', cursor: tool === 'wireduct' ? 'crosshair' : 'default' }}
    >
      <defs>
        <pattern
          id="grid"
          width={patternSize}
          height={patternSize}
          patternUnits="userSpaceOnUse"
          patternTransform={`translate(${offsetX % (patternSize * scale)}, ${offsetY % (patternSize * scale)}) scale(${scale})`}
        >
          <path
            d={`M ${patternSize} 0 L 0 0 0 ${patternSize}`}
            fill="none"
            stroke="#ddd"
            strokeWidth={0.5}
          />
        </pattern>
      </defs>

      {/* Grid background — outside transform group, fills SVG */}
      <rect
        width="100%"
        height="100%"
        fill="url(#grid)"
        opacity={gridSettings.visible ? 1 : 0}
      />

      {/* All content inside transform group */}
      <g transform={`translate(${offsetX}, ${offsetY}) scale(${scale})`}>
        {wireducts.map(w => (
          <WireductEl
            key={w.id}
            item={w}
            selected={selectedId === w.id}
            onClick={onWireductClick}
          />
        ))}

        {wireductPreview && (
          <WireductEl
            item={wireductPreview}
            selected={false}
            onClick={() => {}}
          />
        )}

        {placed.map(p => {
          const def = defs.find(d => d.id === p.defId);
          if (!def) return null;
          return (
            <PlacedComponentEl
              key={p.instanceId}
              item={p}
              def={def}
              selected={selectedId === p.instanceId}
              overlapping={overlappingIds.has(p.instanceId)}
              onMouseDown={onComponentMouseDown}
              onClick={onComponentClick}
            />
          );
        })}
      </g>
    </svg>
  );
});

Canvas.displayName = 'Canvas';
export default Canvas;
```

- [ ] **Step 4: Wire Canvas into `src/App.tsx`**

Add imports and stub handlers, replace canvas placeholder:

```tsx
import { useState, useCallback, useRef, useEffect } from 'react';
import Canvas, { type CanvasHandle } from './components/Canvas';
import type { Wireduct as WireductType } from './types';

// Add inside App():
const canvasRef = useRef<CanvasHandle>(null);
const [selectedId, setSelectedId] = useState<string | null>(null);
const [overlappingIds] = useState<Set<string>>(new Set());
const [wireductPreview] = useState<WireductType | null>(null);

// Replace canvas placeholder div:
<div className="canvas-container">
  <Canvas
    ref={canvasRef}
    defs={componentDefs}
    placed={placed}
    wireducts={wireducts}
    gridSettings={gridSettings}
    transform={transform}
    tool={tool}
    selectedId={selectedId}
    overlappingIds={overlappingIds}
    ductWidth={ductWidth}
    onTransformChange={setTransform}
    onDrop={() => {}}
    onComponentMouseDown={() => {}}
    onComponentClick={() => {}}
    onWireductClick={() => {}}
    onCanvasMouseDown={() => {}}
    onCanvasMouseMove={() => {}}
    onCanvasMouseUp={() => {}}
    onWheel={() => {}}
    wireductPreview={wireductPreview}
  />
</div>
```

- [ ] **Step 5: Run dev server — verify SVG canvas with grid renders**

Expected: grid pattern visible, palette on left, canvas fills remaining space. No console errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/PlacedComponent.tsx src/components/Wireduct.tsx src/components/Canvas.tsx src/App.tsx && git commit -m "feat: Canvas SVG with grid, PlacedComponent and Wireduct renderers"
```

---

## Task 10: Drop to Place Components

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Implement `handleDrop` in `src/App.tsx`**

Replace the stub `onDrop={() => {}}` with a real handler. Add the handler function inside `App()`:

```tsx
const handleDrop = useCallback((defId: string, canvasX: number, canvasY: number) => {
  const def = componentDefs.find(d => d.id === defId);
  if (!def) return;
  const alreadyPlaced = placed.filter(p => p.defId === defId).length;
  if (alreadyPlaced >= def.qty) return;
  setPlaced(prev => [...prev, {
    instanceId: crypto.randomUUID(),
    defId,
    x: canvasX,
    y: canvasY,
  }]);
}, [componentDefs, placed]);
```

Pass `onDrop={handleDrop}` to Canvas.

- [ ] **Step 2: Verify drag and drop**

Run dev server. Load a CSV. Drag a component from palette to canvas. Expected: component rectangle appears at drop position with ID and PN text. Palette shows updated placed count.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx && git commit -m "feat: drag component from palette to canvas"
```

---

## Task 11: Select + Delete Key

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Implement click-to-select and Delete key in `src/App.tsx`**

Add a `useEffect` for the keyboard listener and click handlers:

```tsx
// Keyboard handler
useEffect(() => {
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key !== 'Delete' || !selectedId) return;
    // Is it a placed component?
    setPlaced(prev => prev.filter(p => p.instanceId !== selectedId));
    // Is it a wireduct?
    setWireducts(prev => prev.filter(w => w.id !== selectedId));
    setSelectedId(null);
  }
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [selectedId]);
```

Replace stub handlers:

```tsx
const handleComponentClick = useCallback((e: React.MouseEvent, instanceId: string) => {
  e.stopPropagation();
  setSelectedId(instanceId);
}, []);

const handleWireductClick = useCallback((e: React.MouseEvent, id: string) => {
  e.stopPropagation();
  setSelectedId(id);
}, []);

// Clicking empty canvas deselects
const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
  if (e.target === e.currentTarget) setSelectedId(null);
}, []);
```

Pass updated handlers to Canvas. Also update `onZoomAll` in Toolbar to a real handler (implement in Task 14).

- [ ] **Step 2: Verify select and delete**

Run dev server. Place a component. Click it — blue border. Press Delete — component removed. Click wireduct (add one manually via state temporarily if needed — or wait for Task 13). Click canvas background — deselects.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx && git commit -m "feat: click to select, Delete key removes selected item"
```

---

## Task 12: Move Components on Canvas + Overlap Detection

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add drag-move state refs to `src/App.tsx`**

```tsx
const dragState = useRef<{
  instanceId: string;
  startScreenX: number;
  startScreenY: number;
  origX: number;
  origY: number;
} | null>(null);
```

- [ ] **Step 2: Implement component mousedown**

```tsx
const handleComponentMouseDown = useCallback((e: React.MouseEvent, instanceId: string) => {
  e.stopPropagation();
  if (tool !== 'select') return;
  const item = placed.find(p => p.instanceId === instanceId);
  if (!item) return;
  dragState.current = {
    instanceId,
    startScreenX: e.clientX,
    startScreenY: e.clientY,
    origX: item.x,
    origY: item.y,
  };
  setSelectedId(instanceId);
}, [tool, placed]);
```

- [ ] **Step 3: Implement mousemove with overlap detection**

```tsx
import { overlaps } from './utils/overlap';

const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
  const ds = dragState.current;
  if (!ds) return;

  const dx = (e.clientX - ds.startScreenX) / transform.scale;
  const dy = (e.clientY - ds.startScreenY) / transform.scale;
  const newX = ds.origX + dx;
  const newY = ds.origY + dy;

  setPlaced(prev => prev.map(p =>
    p.instanceId === ds.instanceId ? { ...p, x: newX, y: newY } : p
  ));

  // Recompute overlapping set
  setPlaced(prev => {
    const movingDef = componentDefs.find(d => d.id === prev.find(p => p.instanceId === ds.instanceId)?.defId);
    if (!movingDef) return prev;
    const movingItem = prev.find(p => p.instanceId === ds.instanceId)!;
    const movingBox = { x: movingItem.x, y: movingItem.y, w: movingDef.width, h: movingDef.height };

    const newOverlapping = new Set<string>();
    for (const other of prev) {
      if (other.instanceId === ds.instanceId) continue;
      const otherDef = componentDefs.find(d => d.id === other.defId);
      if (!otherDef) continue;
      const otherBox = { x: other.x, y: other.y, w: otherDef.width, h: otherDef.height };
      if (overlaps(movingBox, otherBox)) {
        newOverlapping.add(ds.instanceId);
        newOverlapping.add(other.instanceId);
      }
    }
    setOverlappingIds(newOverlapping);
    return prev;
  });
}, [transform.scale, componentDefs]);

const handleCanvasMouseUp = useCallback(() => {
  dragState.current = null;
  setOverlappingIds(new Set());
}, []);
```

- [ ] **Step 4: Change `overlappingIds` from const to state**

```tsx
const [overlappingIds, setOverlappingIds] = useState<Set<string>>(new Set());
```

- [ ] **Step 5: Verify drag to reposition + overlap highlight**

Run dev server. Place two components. Drag one onto the other — both get red borders. Move apart — borders clear.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx && git commit -m "feat: drag to move placed components with overlap highlight"
```

---

## Task 13: Wireduct Drawing Mode

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add wireduct drawing state**

```tsx
const wireductStart = useRef<{ x: number; y: number } | null>(null);
const [wireductPreview, setWireductPreview] = useState<WireductType | null>(null);
```

- [ ] **Step 2: Add wireduct helpers in App.tsx**

```tsx
function buildWireduct(
  x1: number, y1: number,
  x2: number, y2: number,
  ductWidth: number,
  id = crypto.randomUUID()
): WireductType {
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  const orientation = dx >= dy ? 'horizontal' : 'vertical';
  if (orientation === 'horizontal') {
    return {
      id,
      x: Math.min(x1, x2),
      y: y1 - ductWidth / 2,
      length: Math.max(dx, 1),
      orientation,
      ductWidth,
    };
  } else {
    return {
      id,
      x: x1 - ductWidth / 2,
      y: Math.min(y1, y2),
      length: Math.max(dy, 1),
      orientation,
      ductWidth,
    };
  }
}
```

- [ ] **Step 3: Update canvas mouse handlers for wireduct mode**

Update `handleCanvasMouseDown`:

```tsx
const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
  if (e.button !== 0) return;
  if (tool === 'wireduct') {
    const rect = canvasRef.current?.getSvgRect();
    if (!rect) return;
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const { x, y } = screenToCanvas(sx, sy, transform); // import from zoom utils
    if (!wireductStart.current) {
      wireductStart.current = { x, y };
    } else {
      const start = wireductStart.current;
      const wd = buildWireduct(start.x, start.y, x, y, ductWidth);
      setWireducts(prev => [...prev, wd]);
      wireductStart.current = null;
      setWireductPreview(null);
    }
    return;
  }
  if ((e.target as SVGElement).closest('g') === null) setSelectedId(null);
}, [tool, transform, ductWidth]);
```

Update `handleCanvasMouseMove` to add preview logic:

```tsx
// At the top of handleCanvasMouseMove, before drag logic:
if (tool === 'wireduct' && wireductStart.current) {
  const rect = canvasRef.current?.getSvgRect();
  if (rect) {
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const { x, y } = screenToCanvas(sx, sy, transform);
    setWireductPreview(buildWireduct(
      wireductStart.current.x, wireductStart.current.y,
      x, y, ductWidth, 'preview'
    ));
  }
  return;
}
```

Also import `screenToCanvas`:
```tsx
import { screenToCanvas } from './utils/zoom';
```

Pass `wireductPreview` to Canvas.

- [ ] **Step 4: Verify wireduct drawing**

Run dev server. Switch to Wireduct tool. Click start point. Move mouse — preview rect updates, locks to dominant axis. Click end point — wireduct committed. Click it in Select mode — blue border. Delete — removed.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx && git commit -m "feat: wireduct drawing mode with orthogonal axis lock and preview"
```

---

## Task 14: Zoom & Pan

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/Toolbar.tsx` (no changes needed — already wired)

- [ ] **Step 1: Implement `handleWheel` in `src/App.tsx`**

```tsx
import { zoomAtPoint, zoomAll } from './utils/zoom';
import type { ZoomItem } from './utils/zoom';

const handleWheel = useCallback((e: React.WheelEvent) => {
  e.preventDefault();
  const rect = canvasRef.current?.getSvgRect();
  if (!rect) return;
  const sx = e.clientX - rect.left;
  const sy = e.clientY - rect.top;

  if (e.ctrlKey) {
    // Zoom: ctrl + wheel
    const delta = e.deltaY < 0 ? 1 : -1;
    setTransform(prev => zoomAtPoint(prev, sx, sy, delta));
  } else {
    // Scroll: pan vertically (and horizontally with shift)
    setTransform(prev => ({
      ...prev,
      offsetX: prev.offsetX - (e.shiftKey ? e.deltaY : e.deltaX),
      offsetY: prev.offsetY - (e.shiftKey ? 0 : e.deltaY),
    }));
  }
}, []);
```

- [ ] **Step 2: Implement middle-mouse pan**

Add pan ref:

```tsx
const panState = useRef<{ startX: number; startY: number; origOffsetX: number; origOffsetY: number } | null>(null);
```

Update `handleCanvasMouseDown`:

```tsx
// Add at top of handler, before wireduct/select logic:
if (e.button === 1) {
  e.preventDefault();
  panState.current = {
    startX: e.clientX,
    startY: e.clientY,
    origOffsetX: transform.offsetX,
    origOffsetY: transform.offsetY,
  };
  return;
}
```

Update `handleCanvasMouseMove`:

```tsx
// Add at top:
if (panState.current) {
  const ps = panState.current;
  setTransform(prev => ({
    ...prev,
    offsetX: ps.origOffsetX + (e.clientX - ps.startX),
    offsetY: ps.origOffsetY + (e.clientY - ps.startY),
  }));
  return;
}
```

Update `handleCanvasMouseUp`:

```tsx
panState.current = null;
// existing: dragState.current = null; setOverlappingIds(new Set());
```

- [ ] **Step 3: Implement middle-mouse double-click for zoom all**

Add last-middle-click time ref:

```tsx
const lastMiddleClick = useRef<number>(0);
```

In `handleCanvasMouseDown`, after the `e.button === 1` check:

```tsx
if (e.button === 1) {
  e.preventDefault();
  const now = Date.now();
  if (now - lastMiddleClick.current < 400) {
    // double middle-click
    handleZoomAll();
    lastMiddleClick.current = 0;
    return;
  }
  lastMiddleClick.current = now;
  panState.current = { ... };
  return;
}
```

- [ ] **Step 4: Implement `handleZoomAll` and wire to toolbar**

```tsx
const handleZoomAll = useCallback(() => {
  const rect = canvasRef.current?.getSvgRect();
  if (!rect) return;

  const items: ZoomItem[] = [
    ...placed.map(p => {
      const def = componentDefs.find(d => d.id === p.defId)!;
      return { x: p.x, y: p.y, w: def?.width ?? 50, h: def?.height ?? 50 };
    }),
    ...wireducts.map(w => ({
      x: w.x,
      y: w.y,
      w: w.orientation === 'horizontal' ? w.length : w.ductWidth,
      h: w.orientation === 'horizontal' ? w.ductWidth : w.length,
    })),
  ];

  setTransform(zoomAll(items, rect.width, rect.height));
}, [placed, wireducts, componentDefs]);
```

Pass `onZoomAll={handleZoomAll}` to Toolbar.

- [ ] **Step 5: Trigger zoom all after JSON load**

In `handleLoadJson`, after setting state, trigger zoom all. Use a `useEffect` with a flag since state updates are async:

```tsx
const [triggerZoomAll, setTriggerZoomAll] = useState(false);

const handleLoadJson = useCallback(async () => {
  try {
    const data = await loadLayout();
    setComponentDefs(data.componentDefs);
    setPlaced(data.layout.components);
    setWireducts(data.layout.wireducts);
    setTriggerZoomAll(true);
  } catch { /* user cancelled */ }
}, []);

useEffect(() => {
  if (!triggerZoomAll) return;
  setTriggerZoomAll(false);
  handleZoomAll();
}, [triggerZoomAll, handleZoomAll]);
```

- [ ] **Step 6: Verify all zoom/pan interactions**

Run dev server. Place components. Verify:
- Ctrl+wheel zooms in/out centered on cursor
- Scroll wheel pans vertically
- Middle-click drag pans canvas
- Middle double-click triggers zoom all
- Toolbar Zoom All button triggers zoom all
- Toolbar shows percentage (e.g. `125%`)
- Load JSON auto-zooms to fit content

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx && git commit -m "feat: zoom/pan — ctrl+wheel, scroll, middle-drag, zoom all"
```

---

## Task 15: Build Verification

- [ ] **Step 1: Run all unit tests**

```bash
npm test
```

Expected: all tests PASS (csv, overlap, zoom).

- [ ] **Step 2: Run TypeScript check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Production build**

```bash
npm run build
```

Expected: `dist/` folder created, no build errors.

- [ ] **Step 4: Preview production build**

```bash
npm run preview
```

Open `http://localhost:8080`. Verify full app works in production build.

- [ ] **Step 5: Final commit**

```bash
git add -A && git commit -m "feat: complete cabinet layout app — all features verified"
```

---

## Spec Coverage Checklist

| Requirement | Task |
|-------------|------|
| CSV load with id/partNumber/width/height/depth/qty | Task 3, 7 |
| Component palette with drag source | Task 8 |
| qty / placed qty display in palette | Task 8 |
| Dimmed fully-placed components in palette | Task 8 |
| SVG canvas with free-form positioning | Task 9 |
| Grid with configurable size | Task 9 |
| Grid visibility toggle | Task 7, 9 |
| Drag component from palette to canvas | Task 10 |
| Show ID and PN on placed component | Task 9 |
| Move placed components (canvas drag) | Task 12 |
| Overlap visual warning (red border) | Task 12 |
| Select + Delete key | Task 11 |
| Remove component returns to palette | Task 11 (delete decrements placed count) |
| Wireduct drawing (click start, click end) | Task 13 |
| Wireduct orthogonal only (H or V) | Task 13 |
| Wireduct axis auto-lock to dominant delta | Task 13 |
| Wireduct preview while drawing | Task 13 |
| Wireduct adjustable width (ductWidth) | Task 7, 13 |
| "WIREDUCT" text centered in rect | Task 9 |
| Wireduct selectable + deletable | Task 11 |
| Save layout as JSON download | Task 6, 7 |
| Load layout from JSON | Task 6, 7 |
| Load CSV replaces defs, preserves matching placed | Task 7 |
| Ctrl+wheel zoom to cursor | Task 14 |
| Mouse scroll = pan vertical | Task 14 |
| Middle-click drag = pan | Task 14 |
| Middle double-click = zoom all | Task 14 |
| Toolbar Zoom All button | Task 7, 14 |
| Toolbar zoom % display | Task 7 |
| JSON load triggers zoom all | Task 14 |
| Scale clamped 0.1–10 | Task 5 |
