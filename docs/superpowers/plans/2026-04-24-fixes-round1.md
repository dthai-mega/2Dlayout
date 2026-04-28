# Fixes Round 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix five issues: ctrl+wheel browser zoom bleed, Esc/tool-switch command cancellation, unit label wording, CSV positional parsing with delimiter auto-detect, and a CSV preview dialog.

**Architecture:** All changes are in existing files except one new component (`CsvPreviewDialog.tsx`). App.tsx owns all cancellation logic via a `cancelActiveCommand()` helper called from both the Esc key handler and the new `handleToolChange`. The CSV preview dialog is a controlled modal: App.tsx holds `csvRawText` state; when non-null the dialog renders and handles delimiter selection internally, calling `parseCsv(text, delimiter)` for live preview.

**Tech Stack:** Vite 5, React 18, TypeScript 5, SVG canvas, Vitest.

---

## File Map

| File | Change |
|------|--------|
| `src/App.tsx` | Add global ctrl+wheel prevention; add `cancelActiveCommand()`; add `handleToolChange`; extend Esc key handler; add `csvRawText` state; wire `CsvPreviewDialog` |
| `src/components/Toolbar.tsx` | Replace `px` → `unit`, `mm` → `unit` |
| `src/components/CsvPreviewDialog.tsx` | **New** — modal with delimiter selector, preview table, confirm/cancel |
| `src/App.css` | Add `.dialog-overlay`, `.dialog-box`, `.csv-preview-table` styles |
| `src/utils/csv.ts` | Add optional `delimiter` param; add `detectDelimiter()` helper |
| `src/utils/csv.test.ts` | Add tests for delimiter param and auto-detect |

---

## Task 1: Fix ctrl+wheel Browser Zoom Bleed

**Problem:** ctrl+wheel over the toolbar triggers the browser's native page zoom because the SVG's `onWheel` handler only fires when the cursor is over the SVG. The fix is a global non-passive `wheel` listener that always calls `preventDefault()` for ctrl+wheel, blocking the browser from zooming. The canvas's own `onWheel` handler continues to do the actual zoom logic — it only fires when the cursor is over the SVG.

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add global ctrl+wheel prevention useEffect in App.tsx**

Inside `App()`, add a new `useEffect` after the existing keyboard handler `useEffect`:

```tsx
useEffect(() => {
  function preventBrowserZoom(e: WheelEvent) {
    if (e.ctrlKey) e.preventDefault();
  }
  window.addEventListener('wheel', preventBrowserZoom, { passive: false });
  return () => window.removeEventListener('wheel', preventBrowserZoom);
}, []);
```

This is a separate, standalone effect — do not merge it with the keyboard handler effect.

- [ ] **Step 2: Verify behaviour**

Run `npm run dev`. Hold ctrl and scroll over the toolbar — the page should not zoom. Ctrl+scroll over the canvas should still zoom the canvas content. No TypeScript errors (`npx tsc --noEmit`).

- [ ] **Step 3: Commit**

```bash
cd "C:/AI/Layout" && git add src/App.tsx && git commit -m "fix: prevent ctrl+wheel browser zoom outside canvas"
```

---

## Task 2: Esc Key and Tool-Switch Cancel In-Progress Command

**Problem:** Pressing Esc or clicking a tool button while mid-wireduct (or mid-drag) leaves the command in a broken half-done state. Fix: extract `cancelActiveCommand()` as a function that resets all in-progress state, then call it from both the Esc handler and a new `handleToolChange`.

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Read the current keyboard useEffect and handleCanvasMouseDown in App.tsx**

Understand what refs (`wireductStart`, `dragState`, `panState`) and state (`wireductPreview`, `overlappingIds`, `placed`) need resetting.

- [ ] **Step 2: Add `cancelActiveCommand` function inside App()**

Add this before the existing `useEffect` keyboard handler:

```tsx
const cancelActiveCommand = useCallback(() => {
  // Cancel wireduct in progress
  if (wireductStart.current) {
    wireductStart.current = null;
    setWireductPreview(null);
  }
  // Cancel component drag — restore original position
  if (dragState.current) {
    const ds = dragState.current;
    setPlaced(prev => prev.map(p =>
      p.instanceId === ds.instanceId ? { ...p, x: ds.origX, y: ds.origY } : p
    ));
    dragState.current = null;
    setOverlappingIds(new Set());
  }
  // Cancel pan
  panState.current = null;
}, []);
```

- [ ] **Step 3: Extend the keyboard useEffect to handle Escape**

Replace the existing keyboard `useEffect`:

```tsx
useEffect(() => {
  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      cancelActiveCommand();
      return;
    }
    if (e.key !== 'Delete' || !selectedId) return;
    setPlaced(prev => prev.filter(p => p.instanceId !== selectedId));
    setWireducts(prev => prev.filter(w => w.id !== selectedId));
    setSelectedId(null);
  }
  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, [selectedId, cancelActiveCommand]);
```

- [ ] **Step 4: Add handleToolChange and replace onToolChange prop**

Add inside App():

```tsx
const handleToolChange = useCallback((newTool: Tool) => {
  cancelActiveCommand();
  setTool(newTool);
}, [cancelActiveCommand]);
```

In the JSX, change:
```tsx
onToolChange={setTool}
```
to:
```tsx
onToolChange={handleToolChange}
```

- [ ] **Step 5: TypeScript check**

```bash
cd "C:/AI/Layout" && npx tsc --noEmit
```

Fix any errors (e.g. `cancelActiveCommand` deps referencing refs is fine — refs are stable).

- [ ] **Step 6: Verify behaviour**

Run `npm run dev`.
- Switch to Wireduct tool, click once to start drawing, press Esc — preview should disappear, no wireduct placed.
- Switch to Wireduct tool, click once, then click Select tool button — wireduct drawing should cancel, tool switches to Select.
- Drag a component, press Esc — component should snap back to original position.

- [ ] **Step 7: Commit**

```bash
cd "C:/AI/Layout" && git add src/App.tsx && git commit -m "feat: Esc cancels in-progress command; tool switch cancels too"
```

---

## Task 3: Unit Labels

**Problem:** Toolbar shows `px` for grid size and `mm` for duct width. Both should say `unit`.

**Files:**
- Modify: `src/components/Toolbar.tsx`

- [ ] **Step 1: Replace unit labels in Toolbar.tsx**

In `src/components/Toolbar.tsx`:

Change line with `px` (after the grid size input):
```tsx
        px
```
to:
```tsx
        unit
```

Change line with `mm` (after the duct width input):
```tsx
          mm
```
to:
```tsx
          unit
```

- [ ] **Step 2: Commit**

```bash
cd "C:/AI/Layout" && git add src/components/Toolbar.tsx && git commit -m "fix: use 'unit' label for grid size and duct width"
```

---

## Task 4: CSV Parser — Delimiter Param + Auto-Detect

**Problem:** The parser currently uses a combined regex `/[,\t]/` which can misfire. Add an explicit `delimiter` parameter and a `detectDelimiter` helper. Column order is fixed: col 0=ID, col 1=PN, col 2=W (width), col 3=H (height), col 4=D (depth), col 5=QTY — header row is always skipped.

**Files:**
- Modify: `src/utils/csv.ts`
- Modify: `src/utils/csv.test.ts`

- [ ] **Step 1: Write failing tests first**

Replace the contents of `src/utils/csv.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseCsv, detectDelimiter } from './csv';

describe('detectDelimiter', () => {
  it('detects tab', () => {
    expect(detectDelimiter('id\tpn\tw\th\td\tqty')).toBe('\t');
  });

  it('detects comma', () => {
    expect(detectDelimiter('id,pn,w,h,d,qty')).toBe(',');
  });

  it('detects semicolon', () => {
    expect(detectDelimiter('id;pn;w;h;d;qty')).toBe(';');
  });

  it('prefers tab over comma when both present', () => {
    // tab wins if count is higher
    expect(detectDelimiter('a\tb\tc,d')).toBe('\t');
  });
});

describe('parseCsv', () => {
  it('parses tab-delimited by auto-detect', () => {
    const csv = 'ID\tPN\tW\tH\tD\tQTY\nCB1\tABB-S201\t45\t85\t70\t3';
    const defs = parseCsv(csv);
    expect(defs).toHaveLength(1);
    expect(defs[0]).toEqual({
      id: 'CB1',
      partNumber: 'ABB-S201',
      width: 45,
      height: 85,
      depth: 70,
      qty: 3,
    });
  });

  it('parses comma-delimited by auto-detect', () => {
    const csv = 'ID,PN,W,H,D,QTY\nCB1,PN1,10,20,30,1';
    const defs = parseCsv(csv);
    expect(defs[0].id).toBe('CB1');
    expect(defs[0].width).toBe(10);
    expect(defs[0].height).toBe(20);
  });

  it('uses explicit delimiter when provided', () => {
    const csv = 'ID;PN;W;H;D;QTY\nCB1;PN1;10;20;30;1';
    const defs = parseCsv(csv, ';');
    expect(defs[0].id).toBe('CB1');
    expect(defs[0].qty).toBe(1);
  });

  it('skips empty lines', () => {
    const csv = 'ID\tPN\tW\tH\tD\tQTY\n\nCB1\tPN1\t10\t20\t30\t1\n';
    expect(parseCsv(csv)).toHaveLength(1);
  });

  it('trims whitespace from values', () => {
    const csv = 'ID\tPN\tW\tH\tD\tQTY\n CB1 \t PN1 \t10\t20\t30\t1';
    const defs = parseCsv(csv);
    expect(defs[0].id).toBe('CB1');
    expect(defs[0].partNumber).toBe('PN1');
  });

  it('returns empty array for header-only input', () => {
    expect(parseCsv('ID\tPN\tW\tH\tD\tQTY')).toHaveLength(0);
  });

  it('uses column position not header names (col 3 = height)', () => {
    // header says W,D,H but we treat col3 as height regardless
    const csv = 'ID\tPN\tW\tD\tH\tQTY\nX\tY\t10\t20\t30\t1';
    const defs = parseCsv(csv);
    // col3=20 → height, col4=30 → depth
    expect(defs[0].height).toBe(20);
    expect(defs[0].depth).toBe(30);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd "C:/AI/Layout" && npm test
```

Expected: FAIL on `detectDelimiter` (not exported) and several `parseCsv` tests.

- [ ] **Step 3: Implement updated csv.ts**

Replace `src/utils/csv.ts`:

```ts
import type { ComponentDef } from '../types';

export function detectDelimiter(headerLine: string): string {
  const candidates = ['\t', ',', ';'];
  let best = ',';
  let bestCount = 0;
  for (const delim of candidates) {
    const count = headerLine.split(delim).length - 1;
    if (count > bestCount) {
      bestCount = count;
      best = delim;
    }
  }
  return best;
}

export function parseCsv(text: string, delimiter?: string): ComponentDef[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const delim = delimiter ?? detectDelimiter(lines[0]);
  return lines.slice(1).map(line => {
    const cols = line.split(delim).map(v => v.trim());
    return {
      id: cols[0],
      partNumber: cols[1],
      width: Number(cols[2]),
      height: Number(cols[3]),
      depth: Number(cols[4]),
      qty: Number(cols[5]),
    };
  });
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd "C:/AI/Layout" && npm test
```

Expected: all tests PASS (including the 9 zoom and 5 overlap tests that still run).

- [ ] **Step 5: Commit**

```bash
cd "C:/AI/Layout" && git add src/utils/csv.ts src/utils/csv.test.ts && git commit -m "feat: CSV parser with delimiter param and auto-detect"
```

---

## Task 5: CSV Preview Dialog

**Goal:** When the user clicks "Load CSV", read the file but show a modal dialog before applying. The dialog shows a delimiter selector (Auto, Tab, Comma, Semicolon) and a preview table of all parsed rows. Confirm applies; Cancel discards.

**Files:**
- Create: `src/components/CsvPreviewDialog.tsx`
- Modify: `src/App.css`
- Modify: `src/App.tsx`

- [ ] **Step 1: Add dialog styles to src/App.css**

Append to the end of `src/App.css`:

```css
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.dialog-box {
  background: #fff;
  border-radius: 4px;
  padding: 16px 20px;
  min-width: 480px;
  max-width: 90vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.2);
}

.dialog-box h2 {
  margin: 0;
  font-size: 15px;
}

.dialog-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.csv-preview-table-wrap {
  overflow: auto;
  max-height: 380px;
  border: 1px solid #ccc;
}

.csv-preview-table {
  border-collapse: collapse;
  font-size: 12px;
  width: 100%;
}

.csv-preview-table th,
.csv-preview-table td {
  border: 1px solid #ddd;
  padding: 3px 6px;
  white-space: nowrap;
}

.csv-preview-table th {
  background: #f5f5f5;
  font-weight: 600;
}

.csv-preview-table tr.invalid td {
  color: #c00;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
```

- [ ] **Step 2: Create src/components/CsvPreviewDialog.tsx**

```tsx
import { useState } from 'react';
import type { ComponentDef } from '../types';
import { parseCsv, detectDelimiter } from '../utils/csv';

interface Props {
  rawText: string;
  onConfirm: (defs: ComponentDef[]) => void;
  onCancel: () => void;
}

const DELIMITERS: { label: string; value: string }[] = [
  { label: 'Auto-detect', value: 'auto' },
  { label: 'Tab', value: '\t' },
  { label: 'Comma', value: ',' },
  { label: 'Semicolon', value: ';' },
];

const COLUMNS = ['ID', 'Part Number', 'Width', 'Height', 'Depth', 'Qty'];

function isRowValid(def: ComponentDef): boolean {
  return (
    !!def.id &&
    !!def.partNumber &&
    !isNaN(def.width) &&
    !isNaN(def.height) &&
    !isNaN(def.depth) &&
    !isNaN(def.qty)
  );
}

export default function CsvPreviewDialog({ rawText, onConfirm, onCancel }: Props) {
  const firstLine = rawText.split('\n')[0] ?? '';
  const [delimiter, setDelimiter] = useState('auto');

  const effectiveDelimiter = delimiter === 'auto' ? detectDelimiter(firstLine) : delimiter;
  const defs = parseCsv(rawText, effectiveDelimiter);
  const validCount = defs.filter(isRowValid).length;

  function handleConfirm() {
    onConfirm(defs.filter(isRowValid));
  }

  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog-box" onClick={e => e.stopPropagation()}>
        <h2>CSV Preview</h2>

        <div className="dialog-controls">
          <label>
            Delimiter:
            <select value={delimiter} onChange={e => setDelimiter(e.target.value)}>
              {DELIMITERS.map(d => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </label>
          <span style={{ color: '#666', fontSize: 12 }}>
            {defs.length} row{defs.length !== 1 ? 's' : ''} found
            {validCount < defs.length ? ` (${defs.length - validCount} invalid, shown in red)` : ''}
          </span>
        </div>

        <div className="csv-preview-table-wrap">
          <table className="csv-preview-table">
            <thead>
              <tr>
                {COLUMNS.map(col => <th key={col}>{col}</th>)}
              </tr>
            </thead>
            <tbody>
              {defs.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: '#999' }}>No data rows</td></tr>
              )}
              {defs.map((def, i) => (
                <tr key={i} className={isRowValid(def) ? '' : 'invalid'}>
                  <td>{def.id || '—'}</td>
                  <td>{def.partNumber || '—'}</td>
                  <td>{isNaN(def.width) ? '?' : def.width}</td>
                  <td>{isNaN(def.height) ? '?' : def.height}</td>
                  <td>{isNaN(def.depth) ? '?' : def.depth}</td>
                  <td>{isNaN(def.qty) ? '?' : def.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="dialog-actions">
          <button onClick={onCancel}>Cancel</button>
          <button onClick={handleConfirm} disabled={validCount === 0}>
            Apply ({validCount} component{validCount !== 1 ? 's' : ''})
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Modify App.tsx to use CsvPreviewDialog**

3a. Add import at the top:
```tsx
import CsvPreviewDialog from './components/CsvPreviewDialog';
```

3b. Add state inside App():
```tsx
const [csvRawText, setCsvRawText] = useState<string | null>(null);
```

3c. Replace `handleLoadCsv`:
```tsx
const handleLoadCsv = useCallback(async () => {
  try {
    const text = await loadCsvFile();
    setCsvRawText(text);
  } catch { /* user cancelled */ }
}, []);
```

3d. In the JSX return, add the dialog just before the closing `</div>` of `.app`:
```tsx
      {csvRawText !== null && (
        <CsvPreviewDialog
          rawText={csvRawText}
          onConfirm={defs => {
            setComponentDefs(defs);
            setCsvRawText(null);
          }}
          onCancel={() => setCsvRawText(null)}
        />
      )}
```

- [ ] **Step 4: TypeScript check**

```bash
cd "C:/AI/Layout" && npx tsc --noEmit
```

Fix any errors.

- [ ] **Step 5: Run all tests**

```bash
cd "C:/AI/Layout" && npm test
```

Expected: all tests still pass.

- [ ] **Step 6: Verify dialog behaviour**

Run `npm run dev`. Click "Load CSV", select `Mockup.csv`. Expected:
- Dialog opens with a preview table showing 6 rows
- Auto-detect picks Tab delimiter correctly
- Rows show ID, PN, Width, Height, Depth, Qty values
- Switch to Comma delimiter — data scrambles (all one column)
- Switch back to Auto — data looks correct
- Click Apply — palette populates with components
- Click outside dialog or Cancel — dialog closes, no components loaded

- [ ] **Step 7: Commit**

```bash
cd "C:/AI/Layout" && git add src/components/CsvPreviewDialog.tsx src/App.css src/App.tsx && git commit -m "feat: CSV preview dialog with delimiter selector"
```

---

## Spec Coverage Checklist

| Requirement | Task |
|-------------|------|
| Ctrl+wheel only zooms canvas, not toolbar/page | Task 1 |
| Esc cancels wireduct drawing | Task 2 |
| Esc cancels component drag (restores position) | Task 2 |
| Tool switch cancels in-progress command | Task 2 |
| Grid size label shows "unit" | Task 3 |
| Duct width label shows "unit" | Task 3 |
| CSV parsed by column position (not header names) | Task 4 |
| Auto-detect delimiter (tab/comma/semicolon) | Task 4 |
| Explicit delimiter parameter for parseCsv | Task 4 |
| CSV preview dialog shown before applying | Task 5 |
| Delimiter selector in dialog | Task 5 |
| Invalid rows highlighted in red | Task 5 |
| Apply button disabled when no valid rows | Task 5 |
| Click outside dialog to cancel | Task 5 |
