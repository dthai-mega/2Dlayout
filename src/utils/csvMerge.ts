import type { ComponentDef } from '../types';

export type CsvLoadMode = 'replace' | 'append-overwrite' | 'append-keep';

/**
 * Merge a freshly-loaded CSV's valid rows into the existing component defs.
 * - replace: the CSV rows become the entire list; existing defs are dropped.
 * - append-keep: new IDs are appended; an ID already present keeps its existing row.
 * - append-overwrite: new IDs are appended; an ID already present is replaced by the CSV row.
 */
export function applyCsvDefs(mode: CsvLoadMode, existing: ComponentDef[], csvDefs: ComponentDef[]): ComponentDef[] {
  if (mode === 'replace') return csvDefs;

  if (mode === 'append-keep') {
    const existingIds = new Set(existing.map(d => d.id));
    return [...existing, ...csvDefs.filter(d => !existingIds.has(d.id))];
  }

  // append-overwrite: new IDs join the end, matching IDs are replaced in place of the old row
  const csvIds = new Set(csvDefs.map(d => d.id));
  return [...existing.filter(d => !csvIds.has(d.id)), ...csvDefs];
}
