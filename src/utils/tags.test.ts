import { describe, it, expect } from 'vitest';
import type { ComponentDef, PlacedComponent } from '../types';
import { nextTag, nextTags, unusedTags, usedTags } from './tags';

function def(tags?: string[]): ComponentDef {
  return { id: 'D1', partNumber: 'PN1', tags, width: 10, height: 10, depth: 10, qty: 10 };
}

function placedWith(defId: string, tag: string): PlacedComponent {
  return { instanceId: crypto.randomUUID(), defId, x: 0, y: 0, rotation: 0, tag };
}

describe('tags pool', () => {
  it('def with no tags -> nextTag returns empty string', () => {
    expect(nextTag(def(undefined), [])).toBe('');
  });

  it('nothing placed -> returns tags[0]', () => {
    expect(nextTag(def(['T1', 'T2', 'T3']), [])).toBe('T1');
  });

  it('tags[0] in use -> returns tags[1]', () => {
    const placed = [placedWith('D1', 'T1')];
    expect(nextTag(def(['T1', 'T2', 'T3']), placed)).toBe('T2');
  });

  it('all tags in use -> returns empty string', () => {
    const placed = [placedWith('D1', 'T1'), placedWith('D1', 'T2'), placedWith('D1', 'T3')];
    expect(nextTag(def(['T1', 'T2', 'T3']), placed)).toBe('');
  });

  it('deleting an instance frees its tag', () => {
    const d = def(['T1', 'T2', 'T3']);
    let placed = [placedWith('D1', 'T1')];
    expect(nextTag(d, placed)).toBe('T2');
    placed = placed.filter(p => p.tag !== 'T1');
    expect(nextTag(d, placed)).toBe('T1');
  });

  it('nextTags gives n sequential tags, padding with empty when pool runs out', () => {
    const d = def(['T1', 'T2', 'T3']);
    expect(nextTags(d, [], 3)).toEqual(['T1', 'T2', 'T3']);
    expect(nextTags(d, [], 5)).toEqual(['T1', 'T2', 'T3', '', '']);
  });

  it('a gap in the middle is refilled', () => {
    const d = def(['T1', 'T2', 'T3']);
    const placed = [placedWith('D1', 'T1'), placedWith('D1', 'T3')];
    expect(nextTag(d, placed)).toBe('T2');
  });

  it('usedTags / unusedTags scope to the given defId only', () => {
    const d = def(['T1', 'T2']);
    const placed = [placedWith('D1', 'T1'), placedWith('D2', 'T1')];
    expect(usedTags('D1', placed)).toEqual(new Set(['T1']));
    expect(unusedTags(d, placed)).toEqual(['T2']);
  });
});
