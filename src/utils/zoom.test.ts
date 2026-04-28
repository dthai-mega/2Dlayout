import { describe, it, expect } from 'vitest';
import { zoomAtPoint, zoomAll, screenToCanvas } from './zoom';
import type { ViewTransform } from '../types';

const identity: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };

describe('zoomAtPoint', () => {
  it('zooms in by factor ~1.1', () => {
    const result = zoomAtPoint(identity, 0, 0, 1);
    expect(result.scale).toBeCloseTo(1.1, 5);
  });

  it('zooms out by factor ~1/1.1', () => {
    const result = zoomAtPoint(identity, 0, 0, -1);
    expect(result.scale).toBeCloseTo(1 / 1.1, 5);
  });

  it('keeps cursor point fixed when zooming at cursor', () => {
    const t: ViewTransform = { scale: 1, offsetX: 0, offsetY: 0 };
    const result = zoomAtPoint(t, 100, 100, 1);
    const beforeCanvas = screenToCanvas(100, 100, t);
    const afterCanvas = screenToCanvas(100, 100, result);
    expect(afterCanvas.x).toBeCloseTo(beforeCanvas.x, 5);
    expect(afterCanvas.y).toBeCloseTo(beforeCanvas.y, 5);
  });

  it('clamps scale at minimum 0.1', () => {
    let t = identity;
    for (let i = 0; i < 100; i++) t = zoomAtPoint(t, 0, 0, -1);
    expect(t.scale).toBeGreaterThanOrEqual(0.1);
  });

  it('clamps scale at maximum 10', () => {
    let t = identity;
    for (let i = 0; i < 100; i++) t = zoomAtPoint(t, 0, 0, 1);
    expect(t.scale).toBeLessThanOrEqual(10);
  });
});

describe('zoomAll', () => {
  it('returns identity-like transform for empty items', () => {
    const result = zoomAll([], 800, 600);
    expect(result.scale).toBe(1);
    expect(result.offsetX).toBe(0);
    expect(result.offsetY).toBe(0);
  });

  it('fits a single item into viewport', () => {
    const result = zoomAll(
      [{ x: 0, y: 0, w: 200, h: 100 }],
      800, 600, 40
    );
    expect(result.scale).toBeGreaterThan(0);
    const cx = result.offsetX + 100 * result.scale;
    const cy = result.offsetY + 50 * result.scale;
    expect(cx).toBeCloseTo(400, 0);
    expect(cy).toBeCloseTo(300, 0);
  });
});

describe('screenToCanvas', () => {
  it('converts screen coords to canvas coords at identity', () => {
    const result = screenToCanvas(100, 200, identity);
    expect(result.x).toBe(100);
    expect(result.y).toBe(200);
  });

  it('accounts for offset and scale', () => {
    const t: ViewTransform = { scale: 2, offsetX: 50, offsetY: 50 };
    const result = screenToCanvas(150, 150, t);
    expect(result.x).toBe(50);
    expect(result.y).toBe(50);
  });
});
