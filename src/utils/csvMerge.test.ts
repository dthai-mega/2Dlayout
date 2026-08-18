import { describe, it, expect } from 'vitest';
import type { ComponentDef } from '../types';
import { applyCsvDefs } from './csvMerge';

function def(id: string, partNumber: string): ComponentDef {
  return { id, partNumber, width: 10, height: 10, depth: 10, qty: 1 };
}

describe('applyCsvDefs', () => {
  it('replace: returns exactly the CSV rows, ignoring existing defs entirely', () => {
    const existing = [def('1', 'OLD')];
    const csv = [def('2', 'NEW')];
    expect(applyCsvDefs('replace', existing, csv)).toEqual(csv);
  });

  it('append-keep: appends new IDs after existing ones', () => {
    const existing = [def('1', 'OLD')];
    const csv = [def('2', 'NEW')];
    expect(applyCsvDefs('append-keep', existing, csv)).toEqual([def('1', 'OLD'), def('2', 'NEW')]);
  });

  it('append-keep: on an ID match, keeps the existing row and drops the CSV row', () => {
    const existing = [def('1', 'OLD')];
    const csv = [def('1', 'FROM-CSV')];
    expect(applyCsvDefs('append-keep', existing, csv)).toEqual([def('1', 'OLD')]);
  });

  it('append-overwrite: appends new IDs after existing ones', () => {
    const existing = [def('1', 'OLD')];
    const csv = [def('2', 'NEW')];
    expect(applyCsvDefs('append-overwrite', existing, csv)).toEqual([def('1', 'OLD'), def('2', 'NEW')]);
  });

  it('append-overwrite: on an ID match, replaces the existing row with the CSV row', () => {
    const existing = [def('1', 'OLD')];
    const csv = [def('1', 'FROM-CSV')];
    expect(applyCsvDefs('append-overwrite', existing, csv)).toEqual([def('1', 'FROM-CSV')]);
  });

  it('append-overwrite: untouched existing defs keep their original relative order', () => {
    const existing = [def('1', 'A'), def('2', 'B'), def('3', 'C')];
    const csv = [def('2', 'B-UPDATED')];
    expect(applyCsvDefs('append-overwrite', existing, csv)).toEqual([
      def('1', 'A'), def('3', 'C'), def('2', 'B-UPDATED'),
    ]);
  });
});
