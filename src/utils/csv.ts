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

/** "SCB2, SCB3" -> ["SCB2","SCB3"]. Accepts comma, semicolon or newline separators. */
export function parseTags(raw: string): string[] {
  return raw.split(/[,;\n]/).map(t => t.trim()).filter(Boolean);
}

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
    // 0 is a real, deliberate value and stays 0 (never placeable). Only truly
    // non-numeric QTY (NaN) falls back to the tag-count guess.
    const qty = Number.isFinite(qtyRaw) && qtyRaw >= 0 ? qtyRaw : (tags.length || 1);
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
