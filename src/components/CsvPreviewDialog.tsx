import { useState } from 'react';
import type { ComponentDef } from '../types';
import { parseCsv, detectDelimiter } from '../utils/csv';
import { hasValidSize } from '../utils/validate';
import { applyCsvDefs, type CsvLoadMode } from '../utils/csvMerge';

interface Props {
  rawText: string;
  existingDefs: ComponentDef[];
  onConfirm: (finalDefs: ComponentDef[], mode: CsvLoadMode, csvIds: string[]) => void;
  onCancel: () => void;
}

const DELIMITERS: { label: string; value: string }[] = [
  { label: 'Auto-detect', value: 'auto' },
  { label: 'Tab', value: '\t' },
  { label: 'Comma', value: ',' },
  { label: 'Semicolon', value: ';' },
];

const MODES: { label: string; value: CsvLoadMode }[] = [
  { label: 'Replace project (clears all placed objects)', value: 'replace' },
  { label: 'Append — overwrite matching IDs (clears their placed objects)', value: 'append-overwrite' },
  { label: 'Append — keep existing on match', value: 'append-keep' },
];

const COLUMNS = ['ID', 'Tags', 'Part Number', 'Description', 'Width', 'Height', 'Depth', 'Qty'];

function isRowValid(def: ComponentDef): boolean {
  return !!def.id && !!def.partNumber;
}

export default function CsvPreviewDialog({ rawText, existingDefs, onConfirm, onCancel }: Props) {
  const firstLine = rawText.split('\n')[0] ?? '';
  const [delimiter, setDelimiter] = useState('auto');
  const [mode, setMode] = useState<CsvLoadMode>('replace');

  const effectiveDelimiter = delimiter === 'auto' ? detectDelimiter(firstLine) : delimiter;
  const defs = parseCsv(rawText, effectiveDelimiter);
  const validDefs = defs.filter(isRowValid);
  const existingIdSet = new Set(existingDefs.map(d => d.id));
  const matchCount = validDefs.filter(d => existingIdSet.has(d.id)).length;
  const finalDefs = applyCsvDefs(mode, existingDefs, validDefs);
  const validCount = mode === 'append-keep' ? validDefs.length - matchCount : validDefs.length;
  const badSizeCount = defs.filter(d => !hasValidSize(d)).length;

  function handleConfirm() {
    onConfirm(finalDefs, mode, validDefs.map(d => d.id));
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
          <label>
            Mode:
            <select value={mode} onChange={e => setMode(e.target.value as CsvLoadMode)}>
              {MODES.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </label>
          <span style={{ color: '#666', fontSize: 12 }}>
            {defs.length} row{defs.length !== 1 ? 's' : ''} found
            {defs.length - validDefs.length > 0 ? ` (${defs.length - validDefs.length} invalid)` : ''}
            {mode === 'append-keep' && matchCount > 0 ? `, ${matchCount} duplicate${matchCount !== 1 ? 's' : ''} skipped` : ''}
            {mode === 'append-overwrite' && matchCount > 0 ? `, ${matchCount} existing ID${matchCount !== 1 ? 's' : ''} will be overwritten` : ''}
            {badSizeCount > 0 ? `, ${badSizeCount} need W/H` : ''}
          </span>
        </div>

        <div className="csv-preview-table-wrap">
          <table className="csv-preview-table">
            <thead>
              <tr>{COLUMNS.map(col => <th key={col}>{col}</th>)}</tr>
            </thead>
            <tbody>
              {defs.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', color: '#999' }}>
                    No data rows
                  </td>
                </tr>
              )}
              {defs.map((def, i) => (
                <tr key={i} className={!isRowValid(def) ? 'invalid' : !hasValidSize(def) ? 'invalid-size' : ''}>
                  <td>{def.id || '—'}</td>
                  <td>{def.tags?.join(', ') || '—'}</td>
                  <td>{def.partNumber || '—'}</td>
                  <td>{def.description || '—'}</td>
                  <td>{isNaN(def.width) || def.width <= 0 ? '?' : def.width}</td>
                  <td>{isNaN(def.height) || def.height <= 0 ? '?' : def.height}</td>
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
            {mode === 'replace' ? 'Apply' : 'Append'} ({validCount} component{validCount !== 1 ? 's' : ''})
          </button>
        </div>
      </div>
    </div>
  );
}
