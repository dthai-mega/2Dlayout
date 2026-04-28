import type { ViewTransform } from '../types';

const ZOOM_FACTOR = 1.1;
const MIN_SCALE = 0.1;
const MAX_SCALE = 10;

export function zoomAtPoint(
  t: ViewTransform,
  screenX: number,
  screenY: number,
  delta: number
): ViewTransform {
  const factor = delta > 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
  const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, t.scale * factor));
  const actualFactor = newScale / t.scale;
  return {
    scale: newScale,
    offsetX: screenX - (screenX - t.offsetX) * actualFactor,
    offsetY: screenY - (screenY - t.offsetY) * actualFactor,
  };
}

export interface ZoomItem {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function zoomAll(
  items: ZoomItem[],
  viewportWidth: number,
  viewportHeight: number,
  margin = 40
): ViewTransform {
  if (items.length === 0) return { scale: 1, offsetX: 0, offsetY: 0 };

  const minX = Math.min(...items.map(i => i.x));
  const minY = Math.min(...items.map(i => i.y));
  const maxX = Math.max(...items.map(i => i.x + i.w));
  const maxY = Math.max(...items.map(i => i.y + i.h));

  const contentW = maxX - minX;
  const contentH = maxY - minY;

  const scaleX = (viewportWidth - margin * 2) / contentW;
  const scaleY = (viewportHeight - margin * 2) / contentH;
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.min(scaleX, scaleY)));

  const offsetX = (viewportWidth - contentW * scale) / 2 - minX * scale;
  const offsetY = (viewportHeight - contentH * scale) / 2 - minY * scale;

  return { scale, offsetX, offsetY };
}

export function screenToCanvas(
  screenX: number,
  screenY: number,
  t: ViewTransform
): { x: number; y: number } {
  return {
    x: (screenX - t.offsetX) / t.scale,
    y: (screenY - t.offsetY) / t.scale,
  };
}
