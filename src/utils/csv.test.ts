import { describe, it, expect } from 'vitest';
import { parseCsv, detectDelimiter } from './csv';

describe('detectDelimiter', () => {
  it('detects tab', () => {
    expect(detectDelimiter('id\tpn\tw\th\td\tqty')).toBe('\t');
  });

  it('detects comma', () => {
    expect(detectDelimiter('id,pn,w,h,d,qty')).toBe(',');
  });

  it('detects semicolon', () => {
    expect(detectDelimiter('id;pn;w;h;d;qty')).toBe(';');
  });

  it('prefers tab over comma when tab count is higher', () => {
    expect(detectDelimiter('a\tb\tc,d')).toBe('\t');
  });
});

describe('parseCsv', () => {
  it('parses tab-delimited by auto-detect', () => {
    const csv = 'ID\tPN\tW\tH\tD\tQTY\nCB1\tABB-S201\t45\t85\t70\t3';
    const defs = parseCsv(csv);
    expect(defs).toHaveLength(1);
    expect(defs[0]).toEqual({
      id: 'CB1',
      partNumber: 'ABB-S201',
      width: 45,
      height: 85,
      depth: 70,
      qty: 3,
    });
  });

  it('parses comma-delimited by auto-detect', () => {
    const csv = 'ID,PN,W,H,D,QTY\nCB1,PN1,10,20,30,1';
    const defs = parseCsv(csv);
    expect(defs[0].id).toBe('CB1');
    expect(defs[0].width).toBe(10);
    expect(defs[0].height).toBe(20);
  });

  it('uses explicit delimiter when provided', () => {
    const csv = 'ID;PN;W;H;D;QTY\nCB1;PN1;10;20;30;1';
    const defs = parseCsv(csv, ';');
    expect(defs[0].id).toBe('CB1');
    expect(defs[0].qty).toBe(1);
  });

  it('skips empty lines', () => {
    const csv = 'ID\tPN\tW\tH\tD\tQTY\n\nCB1\tPN1\t10\t20\t30\t1\n';
    expect(parseCsv(csv)).toHaveLength(1);
  });

  it('trims whitespace from values', () => {
    const csv = 'ID\tPN\tW\tH\tD\tQTY\n CB1 \t PN1 \t10\t20\t30\t1';
    const defs = parseCsv(csv);
    expect(defs[0].id).toBe('CB1');
    expect(defs[0].partNumber).toBe('PN1');
  });

  it('returns empty array for header-only input', () => {
    expect(parseCsv('ID\tPN\tW\tH\tD\tQTY')).toHaveLength(0);
  });

  it('uses column position not header names (col 3 = height)', () => {
    const csv = 'ID\tPN\tW\tD\tH\tQTY\nX\tY\t10\t20\t30\t1';
    const defs = parseCsv(csv);
    expect(defs[0].height).toBe(20);
    expect(defs[0].depth).toBe(30);
  });
});
