import type { PlacedComponent, ComponentDef, Wireduct, DrawnRect, TextItem } from '../types';

// DXF Y-axis is inverted relative to SVG
const dy = (y: number) => -y;

function polyline(pts: Array<[number, number]>, layer: string): string {
  let s = `0\nLWPOLYLINE\n8\n${layer}\n90\n${pts.length}\n70\n1\n`;
  for (const [x, y] of pts) s += `10\n${x.toFixed(4)}\n20\n${dy(y).toFixed(4)}\n`;
  return s;
}

function dtext(x: number, y: number, h: number, str: string, layer: string): string {
  return `0\nTEXT\n8\n${layer}\n10\n${x.toFixed(4)}\n20\n${dy(y).toFixed(4)}\n30\n0\n40\n${h.toFixed(4)}\n1\n${str}\n`;
}

function rotatePt(cx: number, cy: number, x: number, y: number, deg: number): [number, number] {
  const r = (deg * Math.PI) / 180;
  return [
    cx + (x - cx) * Math.cos(r) - (y - cy) * Math.sin(r),
    cy + (x - cx) * Math.sin(r) + (y - cy) * Math.cos(r),
  ];
}

function layerTable(layers: Array<{ name: string; color: number }>): string {
  const entries = layers.map(l =>
    `0\nLAYER\n2\n${l.name}\n70\n0\n62\n${l.color}\n6\nContinuous\n`
  ).join('');
  return `0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLAYER\n70\n${layers.length}\n${entries}0\nENDTAB\n0\nENDSEC`;
}

export function generateDxf(
  placed: PlacedComponent[],
  defs: ComponentDef[],
  wireducts: Wireduct[],
  drawnRects: DrawnRect[],
  textItems: TextItem[],
): string {
  const parts: string[] = [];

  // Header
  parts.push('0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1014\n9\n$INSUNITS\n70\n4\n0\nENDSEC');

  // Layer definitions (color codes: 1=red, 2=yellow, 3=green, 4=cyan, 7=white)
  parts.push(layerTable([
    { name: 'COMPONENTS', color: 4 },
    { name: 'WIREDUCTS',  color: 3 },
    { name: 'RECTS',      color: 2 },
    { name: 'TEXT',       color: 7 },
  ]));

  parts.push('0\nSECTION\n2\nENTITIES');

  // Drawn rectangles
  for (const r of drawnRects) {
    parts.push(polyline([
      [r.x,           r.y          ],
      [r.x + r.width, r.y          ],
      [r.x + r.width, r.y + r.height],
      [r.x,           r.y + r.height],
    ], 'RECTS'));
  }

  // Wireducts
  for (const w of wireducts) {
    const ww = w.orientation === 'horizontal' ? w.length : w.ductWidth;
    const wh = w.orientation === 'horizontal' ? w.ductWidth : w.length;
    parts.push(polyline([
      [w.x,      w.y     ],
      [w.x + ww, w.y     ],
      [w.x + ww, w.y + wh],
      [w.x,      w.y + wh],
    ], 'WIREDUCTS'));
  }

  // Placed components
  for (const p of placed) {
    const def = defs.find(d => d.id === p.defId);
    if (!def) continue;
    const cx = p.x + def.width / 2;
    const cy = p.y + def.height / 2;
    const corners: Array<[number, number]> = [
      [p.x,            p.y           ],
      [p.x + def.width, p.y          ],
      [p.x + def.width, p.y + def.height],
      [p.x,            p.y + def.height],
    ].map(([x, y]) => rotatePt(cx, cy, x, y, p.rotation));
    parts.push(polyline(corners, 'COMPONENTS'));
    const th = Math.min(def.height * 0.25, 8);
    parts.push(dtext(cx - def.id.length * th * 0.3,       cy - th * 0.7, th,       def.id,         'COMPONENTS'));
    parts.push(dtext(cx - def.partNumber.length * th * 0.27, cy + th * 0.2, th * 0.85, def.partNumber, 'COMPONENTS'));
  }

  // Free text items
  for (const t of textItems) {
    parts.push(dtext(t.x, t.y, t.fontSize * 0.75, t.text, 'TEXT'));
  }

  parts.push('0\nENDSEC\n0\nEOF');
  return parts.join('\n');
}
