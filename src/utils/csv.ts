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

export const CSV_TEMPLATE_HEADER = 'ID,PN,MANUFACTURER,MANUFACTURER PART #,DESCRIPTION,QTY,W,H,D';

export function parseCsv(text: string, delimiter?: string): ComponentDef[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const delim = delimiter ?? detectDelimiter(lines[0]);
  const headers = lines[0].split(delim).map(h => h.trim().toUpperCase());

  const idx = (name: string) => headers.indexOf(name);
  const idIdx = idx('ID');
  const pnIdx = idx('PN');
  const descIdx = idx('DESCRIPTION');
  const qtyIdx = idx('QTY');
  const wIdx = idx('W');
  const hIdx = idx('H');
  const dIdx = idx('D');

  return lines.slice(1).map(line => {
    const cols = line.split(delim).map(v => v.trim());
    const get = (i: number) => i >= 0 ? (cols[i] ?? '') : '';
    return {
      id: get(idIdx),
      partNumber: get(pnIdx),
      description: descIdx >= 0 ? get(descIdx) || undefined : undefined,
      width: Number(get(wIdx)),
      height: Number(get(hIdx)),
      depth: Number(get(dIdx)),
      qty: Number(get(qtyIdx)),
    };
  });
}
