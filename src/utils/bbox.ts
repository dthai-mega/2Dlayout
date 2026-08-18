import type { BBox } from './overlap';

/**
 * AABB of a w x h box at (x, y), rotated in 90-degree steps around its own
 * visual center. At 90/270 the width and height swap and the position
 * shifts to keep the center fixed; at 0/180 the box is unchanged.
 */
export function rotatedBBox(x: number, y: number, w: number, h: number, rotation: number): BBox {
  const norm = ((rotation % 360) + 360) % 360;
  if (norm === 90 || norm === 270) {
    const dx = (w - h) / 2;
    const dy = (h - w) / 2;
    return { x: x + dx, y: y + dy, w: h, h: w };
  }
  return { x, y, w, h };
}
