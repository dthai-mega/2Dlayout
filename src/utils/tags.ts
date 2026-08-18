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
