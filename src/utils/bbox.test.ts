import { describe, it, expect } from 'vitest';
import { rotatedBBox } from './bbox';

describe('rotatedBBox', () => {
  it('rotation 0 returns the box unchanged', () => {
    expect(rotatedBBox(10, 20, 40, 30, 0)).toEqual({ x: 10, y: 20, w: 40, h: 30 });
  });

  it('rotation 180 returns the box unchanged (dimensions and position preserved)', () => {
    expect(rotatedBBox(10, 20, 40, 30, 180)).toEqual({ x: 10, y: 20, w: 40, h: 30 });
  });

  it('rotation 90 swaps width and height, keeping the same visual center', () => {
    // center is (10+40/2, 20+30/2) = (30, 35); after swap w=30,h=40 -> x=30-15=15, y=35-20=15
    expect(rotatedBBox(10, 20, 40, 30, 90)).toEqual({ x: 15, y: 15, w: 30, h: 40 });
  });

  it('rotation 270 swaps width and height the same way as 90', () => {
    expect(rotatedBBox(10, 20, 40, 30, 270)).toEqual({ x: 15, y: 15, w: 30, h: 40 });
  });

  it('normalizes an out-of-range rotation before applying it', () => {
    expect(rotatedBBox(10, 20, 40, 30, -90)).toEqual({ x: 15, y: 15, w: 30, h: 40 });
    expect(rotatedBBox(10, 20, 40, 30, 450)).toEqual({ x: 15, y: 15, w: 30, h: 40 });
  });
});
