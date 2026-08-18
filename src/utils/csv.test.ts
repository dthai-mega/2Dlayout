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

  it('maps columns by header name, not position', () => {
    const csv = 'ID\tPN\tW\tD\tH\tQTY\nX\tY\t10\t20\t30\t1';
    const defs = parseCsv(csv);
    expect(defs[0].height).toBe(30);
    expect(defs[0].depth).toBe(20);
  });

  it('parses a quoted field containing the delimiter', () => {
    const csv = 'ID,MARK,PN,QTY,W,H,D\n2,"SCB2, SCB3",PN1,2,10,20,30';
    const defs = parseCsv(csv);
    expect(defs[0].tags).toEqual(['SCB2', 'SCB3']);
    expect(defs[0].partNumber).toBe('PN1');
  });

  it('keeps QTY/W/H aligned past a quoted DESCRIPTION containing commas', () => {
    const csv = 'ID,PN,DESCRIPTION,QTY,W,H,D\n1,PN1,"BREAKER, 230 VAC, 4A",2,10,20,30';
    const defs = parseCsv(csv);
    expect(defs[0].description).toBe('BREAKER, 230 VAC, 4A');
    expect(defs[0].qty).toBe(2);
    expect(defs[0].width).toBe(10);
    expect(defs[0].height).toBe(20);
  });

  it('unescapes "" inside a quoted field to a literal quote', () => {
    const csv = 'ID,PN,DESCRIPTION,QTY,W,H,D\n1,PN1,"7"" SCREEN",1,10,20,30';
    const defs = parseCsv(csv);
    expect(defs[0].description).toBe('7" SCREEN');
  });

  it('parses CRLF input identically to LF', () => {
    const csv = 'ID,PN,QTY,W,H,D\r\n1,PN1,1,10,20,30\r\n';
    const defs = parseCsv(csv);
    expect(defs).toHaveLength(1);
    expect(defs[0].id).toBe('1');
  });

  it('strips a leading UTF-8 BOM', () => {
    const csv = '﻿ID,PN,QTY,W,H,D\n1,PN1,1,10,20,30';
    const defs = parseCsv(csv);
    expect(defs[0].id).toBe('1');
  });

  it('backward compat: old 9-column header has no tags', () => {
    const csv = 'ID,PN,MANUFACTURER,MANUFACTURER PART #,DESCRIPTION,QTY,W,H,D\n1,PN1,ABB,SU201,desc,1,10,20,30';
    const defs = parseCsv(csv);
    expect(defs[0].tags).toBeUndefined();
  });

  it('backward compat: oldest 6-column header has no tags', () => {
    const csv = 'ID,PN,W,H,D,QTY\n1,PN1,10,20,30,1';
    const defs = parseCsv(csv);
    expect(defs[0].tags).toBeUndefined();
  });

  it('MARK column present but empty on a row gives tags undefined', () => {
    const csv = 'ID,MARK,PN,QTY,W,H,D\n1,,PN1,1,10,20,30';
    const defs = parseCsv(csv);
    expect(defs[0].tags).toBeUndefined();
  });

  it('an explicit QTY of 0 stays 0, even with tags present', () => {
    const csv = 'ID,MARK,PN,QTY,W,H,D\n1,"T1, T2",PN1,0,10,20,30';
    const defs = parseCsv(csv);
    expect(defs[0].qty).toBe(0);
  });

  it('a blank QTY stays 0', () => {
    const csv = 'ID,PN,QTY,W,H,D\n1,PN1,,10,20,30';
    const defs = parseCsv(csv);
    expect(defs[0].qty).toBe(0);
  });

  it('non-numeric QTY falls back to the tag count', () => {
    const csv = 'ID,MARK,PN,QTY,W,H,D\n1,"T1, T2",PN1,n/a,10,20,30';
    const defs = parseCsv(csv);
    expect(defs[0].qty).toBe(2);
  });
});
