export interface BBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function overlaps(a: BBox, b: BBox): boolean {
  return !(
    a.x + a.w <= b.x ||
    b.x + b.w <= a.x ||
    a.y + a.h <= b.y ||
    b.y + b.h <= a.y
  );
}
