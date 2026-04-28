import { describe, it, expect } from 'vitest';
import { overlaps, type BBox } from './overlap';

describe('overlaps', () => {
  const box = (x: number, y: number, w: number, h: number): BBox => ({ x, y, w, h });

  it('returns true for overlapping boxes', () => {
    expect(overlaps(box(0, 0, 10, 10), box(5, 5, 10, 10))).toBe(true);
  });

  it('returns false when boxes are side by side', () => {
    expect(overlaps(box(0, 0, 10, 10), box(10, 0, 10, 10))).toBe(false);
  });

  it('returns false when boxes are above and below', () => {
    expect(overlaps(box(0, 0, 10, 10), box(0, 10, 10, 10))).toBe(false);
  });

  it('returns true when one box is inside another', () => {
    expect(overlaps(box(0, 0, 100, 100), box(10, 10, 10, 10))).toBe(true);
  });

  it('returns false when boxes are far apart', () => {
    expect(overlaps(box(0, 0, 10, 10), box(100, 100, 10, 10))).toBe(false);
  });
});
