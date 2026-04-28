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
