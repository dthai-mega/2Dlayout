# MARK Tags + Excel Template Implementation Plan

> **For agentic workers:** implement task-by-task, in order. Steps use checkbox (`- [ ]`) syntax. Run `npx vitest run` after every task that touches `src/utils/`, and `npm run build` before declaring done.

**Goal:** Support the new `CSV Template new.csv` format (adds a `MARK` column = list of component tags), auto-assign the next unused tag on placement, let the user edit a placed component's tag, block placement of components with invalid W/H, and replace the "CSV Template" download button with an "Excel Template" link.

**Hard requirement — backward compatibility:** every CSV that imports today must keep importing with identical results. The parser is already header-name-based (`src/utils/csv.ts`), so a file with no `MARK` column yields `tags === undefined` and the app behaves exactly as it does now. This must be covered by tests, not assumed.

**Tech Stack:** Vite 5, React 18, TypeScript 5 (strict), SVG canvas, Vitest 2. No new dependencies.

---

## Verified starting state (do not re-derive)

- `src/utils/csv.ts:36` parses with `line.split(delim)` — **no quoted-field support**. Proven broken on the new template:
  row `2,"SCB2, SCB3",SPCB=SU201M-C4,ABB,SU201M-C4,"MINIATURE CIRCUIT BREAKER, 230 VAC, 4A, 1 POLE, C-CURVE TRIP",2,,,`
  splits into **15** columns instead of 10, so `PN` reads as `SCB3"`. Fixing this is task 1 and everything else depends on it.
- `npx vitest run` is **already red**: `src/utils/csv.test.ts:71` "uses column position not header names (col 3 = height)" expects `20`, gets `30`. That test is stale — it predates commit d09aed8, which switched the parser from positional to header-based. Task 1 replaces it.
- New template header: `ID,MARK,PN,MANUFACTURER,MANUFACTURER PART #,DESCRIPTION,QTY,W,H,D`, CRLF line endings, `W,H,D` **empty on every row**.
- `Number('') === 0`, so blank W/H currently import as `0` and render as invisible 0x0 rects. `isRowValid` in `CsvPreviewDialog.tsx:21` only checks `!isNaN(...)`, so it passes them.

## Decisions (already made with the user — do not re-ask)

| Question | Decision |
|---|---|
| Tag display on canvas | Second text line under `def.id`, same pattern as the existing `showPN` line. `def.id` stays always visible. |
| Blank / invalid W,H | Row still **imports** normally. Only `W` and `H` are checked (not `D`). Such a def is flagged "invalid size" in the CSV preview and in the palette, and **cannot be placed** (drag disabled, drop rejected). |
| Tag column header | `MARK` (matches `CSV Template new.csv`). |
| Max placements | `QTY` remains the source of truth. If `QTY` > number of tags, the extra instances get an empty tag. |
| Old CSVs (no MARK) | Must keep working identically — `tags` undefined, no tag line rendered. |

## Assumption to flag (easy to revert)

~~Blank / `0` / `NaN` `QTY` falls back to `tags.length || 1` instead of `0`~~ — **reverted per user feedback (2026-08-18):** `0` is a real, deliberate value (blank or explicit `"0"` in the file) and now stays `0`, matching the original pre-MARK behavior. Only a truly non-numeric `QTY` field (e.g. `"n/a"`) still falls back to `tags.length || 1`, since that's genuinely invalid input rather than a deliberate zero.

---

## File Map

| File | Change |
|------|--------|
| `src/utils/csv.ts` | **Rewrite core:** RFC 4180 record tokenizer (quotes, `""` escapes, CRLF, embedded newlines), BOM strip, parse `MARK` into `tags: string[]`, QTY fallback. Delete dead `CSV_TEMPLATE_HEADER`. |
| `src/utils/csv.test.ts` | Replace the stale positional test; add quoted-field / BOM / CRLF / MARK / backward-compat tests. |
| `src/utils/tags.ts` | **New** — `usedTags`, `unusedTags`, `nextTag`, `nextTags`. |
| `src/utils/tags.test.ts` | **New** — unit tests for the above. |
| `src/utils/validate.ts` | **New** — `hasValidSize(def)`. |
| `src/constants.ts` | **New** — `EXCEL_TEMPLATE_URL`. |
| `src/types.ts` | `ComponentDef.tags?: string[]`; `PlacedComponent.tag?: string`. |
| `src/components/PlacedComponent.tsx` | Stacked label lines: id / tag / PN. |
| `src/components/Palette.tsx` | Tags input in add+edit forms; show tag pool + free count; "Invalid size" badge; block drag when size invalid. |
| `src/components/CsvPreviewDialog.tsx` | New `Tags` column; `isRowValid` no longer size-based; `invalid-size` row styling; colSpan fix. |
| `src/components/Toolbar.tsx` | `CSV Template` button becomes `Excel Template` link; drop the `onDownloadCsvTemplate` prop. |
| `src/App.tsx` | Assign tags on drop / place-one / place-all; "Edit tag" context-menu item + inline input; reject placing invalid-size defs; remove `handleDownloadCsvTemplate`. |
| `src/App.css` | `.palette-item-tags`, `.palette-item-invalid`, `.csv-preview-table tr.invalid-size` styles. |

---

## Task 1: RFC 4180 CSV parsing + MARK column

**Files:** modify `src/utils/csv.ts`, `src/utils/csv.test.ts`

- [ ] **Step 1.1 — add a record tokenizer to `src/utils/csv.ts`**

Replace the line-splitting approach with a character state machine over the whole text. It must handle: quoted fields, `""` as a literal quote inside a quoted field, delimiters and newlines inside quotes, `\r\n` and `\n`, and a leading UTF-8 BOM (Excel writes one, and it would otherwise corrupt the `ID` header and silently blank every id).

```ts
/** Split CSV text into records -> fields, per RFC 4180. Handles quotes, "" escapes, CRLF. */
export function parseCsvRecords(text: string, delim: string): string[][] {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text; // strip BOM
  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let inQuotes = false;

  const endField = () => { record.push(field); field = ''; };
  const endRecord = () => {
    endField();
    if (record.length > 1 || record[0].trim() !== '') records.push(record);
    record = [];
  };

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
      continue;
    }
    if (c === '"' && field.trim() === '') { inQuotes = true; field = ''; continue; }
    if (c === delim) { endField(); continue; }
    if (c === '\r') { if (src[i + 1] === '\n') i++; endRecord(); continue; }
    if (c === '\n') { endRecord(); continue; }
    field += c;
  }
  if (field !== '' || record.length > 0) endRecord();
  return records.map(r => r.map(v => v.trim()));
}
```

- [ ] **Step 1.2 — add the tag splitter**

```ts
/** "SCB2, SCB3" -> ["SCB2","SCB3"]. Accepts comma, semicolon or newline separators. */
export function parseTags(raw: string): string[] {
  return raw.split(/[,;\n]/).map(t => t.trim()).filter(Boolean);
}
```

- [ ] **Step 1.3 — rewrite `parseCsv` on top of the tokenizer**

Keep the header-name lookup — that is what gives backward compatibility. Add `MARK`, and accept `TAGS` as an alias so a renamed column still works.

```ts
export function parseCsv(text: string, delimiter?: string): ComponentDef[] {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const firstLine = clean.split(/\r?\n/)[0] ?? '';
  const delim = delimiter ?? detectDelimiter(firstLine);
  const records = parseCsvRecords(clean, delim);
  if (records.length < 2) return [];

  const headers = records[0].map(h => h.trim().toUpperCase());
  const idx = (...names: string[]) => {
    for (const n of names) { const i = headers.indexOf(n); if (i >= 0) return i; }
    return -1;
  };
  const idIdx = idx('ID');
  const markIdx = idx('MARK', 'TAGS');   // absent in old templates -> -1 -> no tags
  const pnIdx = idx('PN');
  const descIdx = idx('DESCRIPTION');
  const qtyIdx = idx('QTY');
  const wIdx = idx('W');
  const hIdx = idx('H');
  const dIdx = idx('D');

  return records.slice(1).map(cols => {
    const get = (i: number) => (i >= 0 ? (cols[i] ?? '') : '');
    const tags = markIdx >= 0 ? parseTags(get(markIdx)) : [];
    const qtyRaw = Number(get(qtyIdx));
    const qty = Number.isFinite(qtyRaw) && qtyRaw > 0 ? qtyRaw : (tags.length || 1);
    return {
      id: get(idIdx),
      partNumber: get(pnIdx),
      description: descIdx >= 0 ? get(descIdx) || undefined : undefined,
      tags: tags.length > 0 ? tags : undefined,   // undefined, not [] -> old files unchanged
      width: Number(get(wIdx)),
      height: Number(get(hIdx)),
      depth: Number(get(dIdx)),
      qty,
    };
  });
}
```

Delete the now-unused `export const CSV_TEMPLATE_HEADER`. Leave `detectDelimiter` untouched — it only ever sees the header line, which is unquoted in every template.

- [ ] **Step 1.4 — fix and extend `src/utils/csv.test.ts`**

Delete the stale test `uses column position not header names (col 3 = height)` and replace it with the header-based expectation it should always have had:

```ts
it('maps columns by header name, not position', () => {
  const csv = 'ID\tPN\tW\tD\tH\tQTY\nX\tY\t10\t20\t30\t1';
  const defs = parseCsv(csv);
  expect(defs[0].height).toBe(30);
  expect(defs[0].depth).toBe(20);
});
```

Add tests for:

- quoted field containing the delimiter — `parseCsv('ID,MARK,PN,QTY,W,H,D\n2,"SCB2, SCB3",PN1,2,10,20,30')` gives `tags` of `['SCB2','SCB3']` and `partNumber` of `'PN1'`.
- quoted DESCRIPTION containing commas keeps QTY/W/H aligned.
- `""` escape inside a quoted field yields a literal `"` (the real template contains `7"" SCREEN`).
- CRLF input parses identically to LF.
- leading BOM: `'﻿ID,PN,QTY,W,H,D\n1,PN1,1,10,20,30'` gives `defs[0].id === '1'`.
- **backward compat, old 9-column header** `ID,PN,MANUFACTURER,MANUFACTURER PART #,DESCRIPTION,QTY,W,H,D` parses and `tags` is `undefined`.
- **backward compat, oldest 6-column header** `ID,PN,W,H,D,QTY` parses and `tags` is `undefined`.
- `MARK` column present but empty on a row gives `tags` of `undefined`.

- [ ] **Step 1.5 — verify against the real file.** `npx vitest run` must be fully green. Then sanity-check the actual template end-to-end (a node one-liner is fine): read `CSV Template new.csv`, run `parseCsv`, and assert that row 2's `partNumber` is `SPCB=SU201M-C4` with tags `['SCB2','SCB3']`, and that the 75-tag `FC*` row yields 75 tags.

---

## Task 2: Types

**Files:** modify `src/types.ts`

- [ ] **Step 2.1** — `ComponentDef`: add `tags?: string[]; // MARK column — ordered tag pool`
- [ ] **Step 2.2** — `PlacedComponent`: add `tag?: string; // assigned from def.tags on placement; undefined = untagged`

Both optional, so existing saved JSON (`SaveFile`) loads unchanged and no migration is needed.

---

## Task 3: Tag pool helpers

**Files:** create `src/utils/tags.ts`, `src/utils/tags.test.ts`

The tag pool is **derived, never stored**. "Used" is the set of tags on currently placed instances of that def. That is what makes deletion return a tag to the pool automatically — no free-list to keep in sync — and it makes undo/redo work for free, because undo already restores `placed`.

- [ ] **Step 3.1 — write `src/utils/tags.ts`**

```ts
import type { ComponentDef, PlacedComponent } from '../types';

export function usedTags(defId: string, placed: PlacedComponent[]): Set<string> {
  const used = new Set<string>();
  for (const p of placed) if (p.defId === defId && p.tag) used.add(p.tag);
  return used;
}

export function unusedTags(def: ComponentDef, placed: PlacedComponent[]): string[] {
  const used = usedTags(def.id, placed);
  return (def.tags ?? []).filter(t => !used.has(t));
}

/** First tag of def.tags not already in use. '' when there are no tags or all are consumed. */
export function nextTag(def: ComponentDef, placed: PlacedComponent[], alsoUsed: string[] = []): string {
  const used = usedTags(def.id, placed);
  for (const t of alsoUsed) if (t) used.add(t);
  return (def.tags ?? []).find(t => !used.has(t)) ?? '';
}

/** n sequential tags for a batch placement; pads with '' when the pool runs out. */
export function nextTags(def: ComponentDef, placed: PlacedComponent[], n: number): string[] {
  const taken: string[] = [];
  for (let i = 0; i < n; i++) taken.push(nextTag(def, placed, taken));
  return taken;
}
```

- [ ] **Step 3.2 — tests in `src/utils/tags.test.ts`**
  - def with no `tags` — `nextTag` returns `''`
  - nothing placed — returns `tags[0]`
  - `tags[0]` in use — returns `tags[1]`
  - all tags in use — returns `''` (out of range means empty, as specified)
  - **deleting frees the tag:** with `T1` placed, `nextTag` gives `T2`; remove that instance from the array and `nextTag` gives `T1` again
  - `nextTags(def, [], 3)` gives `['T1','T2','T3']`; asking for 5 from a 3-tag pool gives `['T1','T2','T3','','']`
  - a gap in the middle is refilled: with `T1` and `T3` placed, `nextTag` returns `T2`

---

## Task 4: Invalid-size guard

**Files:** create `src/utils/validate.ts`

- [ ] **Step 4.1**

```ts
import type { ComponentDef } from '../types';

/** Only W and H matter for placement. D is metadata and is never validated. */
export function hasValidSize(def: ComponentDef): boolean {
  return Number.isFinite(def.width) && def.width > 0
    && Number.isFinite(def.height) && def.height > 0;
}
```

This is the single gate reused by the palette, the drop handler and the CSV preview. Do not duplicate the condition inline anywhere.

---

## Task 5: Excel Template link

**Files:** create `src/constants.ts`; modify `src/components/Toolbar.tsx`, `src/App.tsx`

- [ ] **Step 5.1 — `src/constants.ts`**

```ts
export const EXCEL_TEMPLATE_URL =
  'https://docs.google.com/spreadsheets/d/12bYMhMRwOSN26mmT6CdmT3cc8VklsITm/edit?usp=sharing&ouid=110950666986120905322&rtpof=true&sd=true';
```

- [ ] **Step 5.2 — `src/components/Toolbar.tsx`**
  - Remove `onDownloadCsvTemplate` from `Props` (line ~20) and from the destructured params (line ~32).
  - Replace the button at line ~49:

```tsx
<button onClick={() => window.open(EXCEL_TEMPLATE_URL, '_blank', 'noopener,noreferrer')}>
  Excel Template
</button>
```

  Import `EXCEL_TEMPLATE_URL` from `../constants`. Leave the `Load CSV` button untouched.

- [ ] **Step 5.3 — `src/App.tsx`**
  - Delete `handleDownloadCsvTemplate` (lines ~464-471) and the `onDownloadCsvTemplate={...}` prop (line ~866).

**Note for the user, not a code change:** the linked file is an `.xlsx`. `loadCsvFile` in `src/utils/storage.ts` accepts `.csv,text/csv` only, so the workflow stays *download Excel, fill in, Save As CSV, Load CSV*. Do not add xlsx parsing; it was not requested.

---

## Task 6: Render the tag on the placed component

**Files:** modify `src/components/PlacedComponent.tsx`

The current code hardcodes two cases (id centered, or id-up plus PN-down). With a tag there can be three lines, so replace the two `<text>` blocks with a computed stack. Tag goes on line 2, directly under `def.id`; PN stays last.

- [ ] **Step 6.1**

```tsx
const lines: { text: string; size: number; fill: string }[] = [
  { text: def.id, size: 11, fill: '#222' },
];
if (item.tag) lines.push({ text: item.tag, size: 10, fill: '#1a56a8' });
if (item.showPN) lines.push({ text: def.partNumber, size: 10, fill: '#555' });

const lineH = 12 * textUnit;
const top = def.height / 2 - ((lines.length - 1) * lineH) / 2;
```

then render:

```tsx
{lines.map((l, i) => (
  <text
    key={i}
    x={def.width / 2}
    y={top + i * lineH}
    textAnchor="middle"
    dominantBaseline="middle"
    fontSize={l.size * textUnit}
    fill={l.fill}
    style={{ pointerEvents: 'none', userSelect: 'none' }}
  >
    {l.text}
  </text>
))}
```

With no tag and `showPN` false this must be visually identical to today (one centered id line) — confirm by eye before moving on. Export (`buildExportSvgClone`) needs no change: it clones the live SVG.

---

## Task 7: Assign tags on placement

**Files:** modify `src/App.tsx`

Import `nextTag`, `nextTags` from `./utils/tags` and `hasValidSize` from `./utils/validate`.

- [ ] **Step 7.1 — block invalid-size placement in `handleDrop` (line ~804)**

```tsx
const def = componentDefs.find(d => d.id === defId);
if (!def) return;
if (!hasValidSize(def)) return;   // invalid W/H -> not placeable
```

- [ ] **Step 7.2 — single placement gets a tag** (`handleDrop`, line ~815)

```tsx
setPlaced(prev => [...prev, {
  instanceId: crypto.randomUUID(), defId, x: canvasX, y: canvasY, rotation: 0,
  tag: nextTag(def, placed) || undefined,
}]);
```

- [ ] **Step 7.3 — `handlePlaceOne`** (line ~818): same treatment, using `dropPending.def` and the current `placed`.

- [ ] **Step 7.4 — `handlePlaceAll`** (line ~831): must be sequential, not N copies of one tag.

```tsx
const tags = nextTags(def, placed, remaining);
setPlaced(prev => [
  ...prev,
  ...Array.from({ length: remaining }, (_, i) => ({
    instanceId: crypto.randomUUID(),
    defId,
    x: canvasX + i * (def.width + placeAllGap),
    y: canvasY,
    rotation: 0,
    tag: tags[i] || undefined,
  })),
]);
```

Add `placed` to the `useCallback` deps of `handlePlaceOne` and `handlePlaceAll` — they currently omit it, and they now read it.

- [ ] **Step 7.5 — nothing to do for deletion.** The `Delete`-key handler (line ~197) and `handleDeleteDef` (line ~444) both prune `placed`, and the pool is derived from `placed`, so a deleted component returns its tag to the list automatically. Verify by hand in Task 10; do not add code.

---

## Task 8: Edit a placed component's tag

**Files:** modify `src/App.tsx`

Follow the existing `textInputState` inline-input pattern rather than inventing a modal.

- [ ] **Step 8.1 — state**

```tsx
const [tagEditState, setTagEditState] = useState<{
  instanceId: string; screenX: number; screenY: number; current: string; defId: string;
} | null>(null);
```

- [ ] **Step 8.2 — context menu item.** In the `contextMenu` render block (line ~995), add a second button under `Show PN` / `Hide PN`:

```tsx
<button
  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px', border: 'none', background: 'none', cursor: 'pointer' }}
  onClick={() => {
    setTagEditState({
      instanceId: p.instanceId, defId: p.defId,
      screenX: contextMenu.x, screenY: contextMenu.y,
      current: p.tag ?? '',
    });
    setContextMenu(null);
  }}
>
  Edit tag
</button>
```

- [ ] **Step 8.3 — the inline input.** Render it next to the `textInputState` input with the same fixed-position styling. Offer the still-unused tags of that def in a `<datalist>` so the common case is one click, but keep it free text — an empty value is legal and clears the tag.

```tsx
{tagEditState && (() => {
  const def = componentDefs.find(d => d.id === tagEditState.defId);
  const options = def ? unusedTags(def, placed) : [];
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 100 }} onClick={() => setTagEditState(null)} />
      <input
        autoFocus
        list="tag-options"
        defaultValue={tagEditState.current}
        placeholder="Tag (blank = none)"
        style={{ position: 'fixed', left: tagEditState.screenX, top: tagEditState.screenY, zIndex: 101, fontSize: 13, border: '1px solid #3182ce', outline: 'none', background: 'rgba(255,255,255,0.95)', padding: '2px 6px', minWidth: 120, borderRadius: 2 }}
        onKeyDown={e => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            const val = (e.target as HTMLInputElement).value.trim();
            pushHistory();
            setPlaced(prev => prev.map(p =>
              p.instanceId === tagEditState.instanceId ? { ...p, tag: val || undefined } : p
            ));
            setTagEditState(null);
          }
          if (e.key === 'Escape') setTagEditState(null);
        }}
      />
      <datalist id="tag-options">
        {options.map(t => <option key={t} value={t} />)}
      </datalist>
    </>
  );
})()}
```

`pushHistory()` before the mutation makes Ctrl+Z undo a tag edit like every other change. `e.stopPropagation()` on keydown is required — the global `Delete` handler at line ~195 would otherwise delete the selection while the user types.

- [ ] **Step 8.4 — add `tagEditState` to `cancelActiveCommand()`** (line ~131) so Esc and a tool switch close it, matching the other transient inputs.

---

## Task 9: Palette and CSV preview UI

**Files:** modify `src/components/Palette.tsx`, `src/components/CsvPreviewDialog.tsx`, `src/App.css`

- [ ] **Step 9.1 — `Palette.tsx`: tags in the forms.** Add `tags: string` to `FormState` (a comma-separated string, the same shape the user types in Excel). Add an input to `FormFields` under Description with `placeholder="Tags (comma separated)"`. In `startEdit`, seed it with `(def.tags ?? []).join(', ')`. In `submitEdit` and `submitAdd`, convert with `parseTags(form.tags)` and pass `tags: parsed.length ? parsed : undefined`. `isFormValid` must **not** require tags.

- [ ] **Step 9.2 — `Palette.tsx`: invalid-size card.** Compute `const badSize = !hasValidSize(def)`. On the card:
  - `draggable={!full && !badSize}`, and omit `onDragStart` when `badSize`
  - add class `palette-item-invalid` when `badSize`
  - render `<div className="palette-item-invalid-msg">Invalid size — set W and H</div>`

  This is the visible half of the "don't place it" rule; `handleDrop` (Step 7.1) is the enforcing half. Keep both.

- [ ] **Step 9.3 — `Palette.tsx`: show the tag pool.** Under the existing `{count}/{def.qty} placed` line, when `def.tags` is set:

```tsx
<div className="palette-item-tags">
  Tags: {def.tags.join(', ')} — {unusedTags(def, placed).length} free
</div>
```

- [ ] **Step 9.4 — `CsvPreviewDialog.tsx`.**
  - `COLUMNS` becomes `['ID', 'Tags', 'Part Number', 'Description', 'Width', 'Height', 'Depth', 'Qty']` and the empty-state `colSpan` goes from 7 to **8**.
  - `isRowValid` must stop rejecting on size, so the new template still imports: `return !!def.id && !!def.partNumber;`
  - add a separate size check and use it for row styling only:
    `className={!isRowValid(def) ? 'invalid' : !hasValidSize(def) ? 'invalid-size' : ''}`
  - render the tags cell as `{def.tags?.join(', ') || '—'}`, and show `?` for a non-positive or NaN width/height.
  - extend the summary line with a count of size-flagged rows, e.g. `, 41 need W/H`.

- [ ] **Step 9.5 — `src/App.css`.** Add `.palette-item-tags` (11px, `#666`), `.palette-item-invalid` (dashed `#e53e3e` border, `not-allowed` cursor, reduced opacity), `.palette-item-invalid-msg` (11px, `#e53e3e`), and `.csv-preview-table tr.invalid-size` (amber tint such as `#fff8e1`, visually distinct from the existing red `.invalid`).

---

## Task 10: Verification

- [ ] **Step 10.1** — `npx vitest run` fully green, zero failures. It started red, so a green bar is the proof the stale test was actually fixed.
- [ ] **Step 10.2** — `npm run build` — `tsc --noEmit` clean and the vite build succeeds.
- [ ] **Step 10.3** — manual pass with `npm run dev`, in this order:
  1. Load `CSV Template new.csv`. Preview shows the Tags column; the `SCB2, SCB3` row shows PN `SPCB=SU201M-C4` and tags `SCB2, SCB3`; rows are amber-flagged for missing W/H; the row count matches the file.
  2. Apply. Palette lists items with tag pools; every card shows "Invalid size — set W and H" and refuses to drag.
  3. Edit one def, set W=45 H=85, save. It becomes draggable.
  4. Drop it — canvas shows `id` on line 1 and the **first** tag on line 2.
  5. Drop again — the **second** tag. Delete the first instance, drop again — the freed **first** tag comes back.
  6. Drop with qty > 1 and choose "Place all" — tags assigned in order, empty after the pool runs out.
  7. Right-click a placed item, choose "Edit tag" — the datalist offers only unused tags; type a value and press Enter; Ctrl+Z undoes it.
  8. `Excel Template` button opens the Google Sheets URL in a new tab.
  9. **Backward compat:** load `Mockup.csv` (old 9-column header, no MARK) — imports exactly as before, no tag line rendered, no invalid-size flags (it has real W/H).
  10. Save JSON and reload it — def tags and per-instance tags survive; a JSON saved *before* this change still loads without error.
- [ ] **Step 10.4** — report results with the actual command output. Do not claim "works" for any step in 10.3 that was not actually clicked.
