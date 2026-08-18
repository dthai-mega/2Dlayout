import type { ComponentDef } from '../types';

/** Only W and H matter for placement. D is metadata and is never validated. */
export function hasValidSize(def: ComponentDef): boolean {
  return Number.isFinite(def.width) && def.width > 0
    && Number.isFinite(def.height) && def.height > 0;
}
