import { useState } from 'react';
import type { ComponentDef } from '../types';
import { parseCsv, detectDelimiter } from '../utils/csv';

interface Props {
  rawText: string;
  existingIds: string[];
  onConfirm: (defs: ComponentDef[], append: boolean) => void;
  onCancel: () => void;
}

const DELIMITERS: { label: string; value: string }[] = [
  { label: 'Auto-detect', value: 'auto' },
  { label: 'Tab', value: '\t' },
  { label: 'Comma', value: ',' },
  { label: 'Semicolon', value: ';' },
];

const COLUMNS = ['ID', 'Part Number', 'Description', 'Width', 'Height', 'Depth', 'Qty'];

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

export default function CsvPreviewDialog({ rawText, existingIds, onConfirm, onCancel }: Props) {
  const firstLine = rawText.split('\n')[0] ?? '';
  const [delimiter, setDelimiter] = useState('auto');
  const [mode, setMode] = useState<'replace' | 'append'>('replace');

  const effectiveDelimiter = delimiter === 'auto' ? detectDelimiter(firstLine) : delimiter;
  const defs = parseCsv(rawText, effectiveDelimiter);
  const validDefs = defs.filter(isRowValid);
  const existingIdSet = new Set(existingIds);
  const appendDefs = validDefs.filter(d => !existingIdSet.has(d.id));
  const skippedCount = validDefs.length - appendDefs.length;
  const applyDefs = mode === 'append' ? appendDefs : validDefs;
  const validCount = applyDefs.length;

  function handleConfirm() {
    onConfirm(applyDefs, mode === 'append');
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
            <select value={mode} onChange={e => setMode(e.target.value as 'replace' | 'append')}>
              <option value="replace">Replace list</option>
              <option value="append">Append (skip duplicates)</option>
            </select>
          </label>
          <span style={{ color: '#666', fontSize: 12 }}>
            {defs.length} row{defs.length !== 1 ? 's' : ''} found
            {defs.length - validDefs.length > 0 ? ` (${defs.length - validDefs.length} invalid)` : ''}
            {mode === 'append' && skippedCount > 0 ? `, ${skippedCount} duplicate${skippedCount !== 1 ? 's' : ''} skipped` : ''}
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
                  <td colSpan={7} style={{ textAlign: 'center', color: '#999' }}>
                    No data rows
                  </td>
                </tr>
              )}
              {defs.map((def, i) => (
                <tr key={i} className={isRowValid(def) ? '' : 'invalid'}>
                  <td>{def.id || '—'}</td>
                  <td>{def.partNumber || '—'}</td>
                  <td>{def.description || '—'}</td>
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
            {mode === 'append' ? 'Append' : 'Apply'} ({validCount} component{validCount !== 1 ? 's' : ''})
          </button>
        </div>
      </div>
    </div>
  );
}
