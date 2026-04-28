import { useRef, forwardRef, useImperativeHandle } from 'react';
import type {
  ComponentDef, PlacedComponent, Wireduct as WireductType, DrawnRect, TextItem,
  GridSettings, ViewTransform, Tool,
} from '../types';
import PlacedComponentEl from './PlacedComponent';
import WireductEl from './Wireduct';

export interface CanvasHandle {
  getSvgRect: () => DOMRect | undefined;
  getSvgElement: () => SVGSVGElement | null;
}

interface Props {
  defs: ComponentDef[];
  placed: PlacedComponent[];
  wireducts: WireductType[];
  gridSettings: GridSettings;
  transform: ViewTransform;
  tool: Tool;
  selectedIds: Set<string>;
  overlappingIds: Set<string>;
  ductWidth: number;
  textScale: number;
  lineScale: number;
  onTransformChange: (t: ViewTransform) => void;
  onDrop: (defId: string, canvasX: number, canvasY: number, screenX: number, screenY: number) => void;
  onComponentMouseDown: (e: React.MouseEvent, instanceId: string) => void;
  onComponentClick: (e: React.MouseEvent, instanceId: string) => void;
  onComponentContextMenu: (e: React.MouseEvent, instanceId: string) => void;
  onWireductClick: (e: React.MouseEvent, id: string) => void;
  onWireductMouseDown: (e: React.MouseEvent, id: string) => void;
  onRectClick: (e: React.MouseEvent, id: string) => void;
  onRectMouseDown: (e: React.MouseEvent, id: string) => void;
  onCanvasMouseDown: (e: React.MouseEvent) => void;
  onCanvasMouseMove: (e: React.MouseEvent) => void;
  onCanvasMouseUp: (e: React.MouseEvent) => void;
  onWheel: (e: React.WheelEvent) => void;
  wireductPreview: WireductType | null;
  drawnRects: DrawnRect[];
  rectPreview: { x: number; y: number; width: number; height: number; labelX: number; labelY: number } | null;
  selectionBox: { x: number; y: number; width: number; height: number } | null;
  textItems: TextItem[];
  onTextClick: (e: React.MouseEvent, id: string) => void;
  onTextMouseDown: (e: React.MouseEvent, id: string) => void;
  onTextDblClick: (e: React.MouseEvent, id: string) => void;
}

const Canvas = forwardRef<CanvasHandle, Props>(({
  defs, placed, wireducts, gridSettings, transform, tool,
  selectedIds, overlappingIds, ductWidth: _ductWidth, textScale, lineScale, onTransformChange: _onTransformChange, onDrop,
  onComponentMouseDown, onComponentClick, onComponentContextMenu, onWireductClick, onWireductMouseDown, onRectClick, onRectMouseDown,
  onCanvasMouseDown, onCanvasMouseMove, onCanvasMouseUp, onWheel,
  wireductPreview, drawnRects, rectPreview, selectionBox, textItems, onTextClick, onTextMouseDown, onTextDblClick,
}, ref) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useImperativeHandle(ref, () => ({
    getSvgRect: () => svgRef.current?.getBoundingClientRect(),
    getSvgElement: () => svgRef.current,
  }));

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const defId = e.dataTransfer.getData('defId');
    if (!defId) return;
    const rect = svgRef.current!.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const cx = (sx - transform.offsetX) / transform.scale;
    const cy = (sy - transform.offsetY) / transform.scale;
    onDrop(defId, cx, cy, e.clientX, e.clientY);
  }

  const { scale, offsetX, offsetY } = transform;
  const textUnit = textScale / scale;
  const strokeUnit = lineScale / scale;
  const patternSize = gridSettings.size;

  return (
    <svg
      ref={svgRef}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onMouseDown={onCanvasMouseDown}
      onMouseMove={onCanvasMouseMove}
      onMouseUp={onCanvasMouseUp}
      onMouseLeave={onCanvasMouseUp}
      onWheel={onWheel}
      onContextMenu={e => e.preventDefault()}
      style={{ display: 'block', width: '100%', height: '100%', cursor: tool === 'rotate' ? 'pointer' : (tool === 'wireduct' || tool === 'rect' || tool === 'text') ? 'crosshair' : 'default' }}
    >
      <defs>
        <pattern
          id="grid"
          width={patternSize}
          height={patternSize}
          patternUnits="userSpaceOnUse"
          patternTransform={`translate(${offsetX % (patternSize * scale)}, ${offsetY % (patternSize * scale)}) scale(${scale})`}
        >
          <path
            d={`M ${patternSize} 0 L 0 0 0 ${patternSize}`}
            fill="none"
            stroke="#ddd"
            strokeWidth={0.5 * strokeUnit}
          />
        </pattern>
      </defs>

      <rect
        width="100%"
        height="100%"
        fill="url(#grid)"
        opacity={gridSettings.visible ? 1 : 0}
      />

      <g transform={`translate(${offsetX}, ${offsetY}) scale(${scale})`}>
        {wireducts.map(w => (
          <WireductEl
            key={w.id}
            item={w}
            selected={selectedIds.has(w.id)}
            textUnit={textUnit}
            strokeUnit={strokeUnit}
            onMouseDown={onWireductMouseDown}
            onClick={onWireductClick}
          />
        ))}

        {wireductPreview && (
          <WireductEl
            item={wireductPreview}
            selected={false}
            textUnit={textUnit}
            strokeUnit={strokeUnit}
            onMouseDown={() => {}}
            onClick={() => {}}
          />
        )}

        {drawnRects.map(r => {
          const color = selectedIds.has(r.id) ? '#3182ce' : '#555';
          const fs = 11 * textUnit;
          const pad = 4 / scale;
          return (
            <g key={r.id} style={{ cursor: 'move' }} onMouseDown={e => onRectMouseDown(e, r.id)} onClick={e => onRectClick(e, r.id)}>
              <rect
                x={r.x}
                y={r.y}
                width={r.width}
                height={r.height}
                fill="none"
                stroke={selectedIds.has(r.id) ? '#3182ce' : '#333'}
                strokeWidth={selectedIds.has(r.id) ? 2 * strokeUnit : 1.5 * strokeUnit}
                strokeDasharray={`${6 / scale} ${3 / scale}`}
              />
              <text
                x={r.x + r.width / 2}
                y={r.y - pad}
                textAnchor="middle"
                dominantBaseline="auto"
                fontSize={fs}
                fill={color}
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {Math.round(r.width)}
              </text>
              <text
                x={r.x + r.width + pad}
                y={r.y + r.height / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={fs}
                fill={color}
                transform={`rotate(90, ${r.x + r.width + pad}, ${r.y + r.height / 2})`}
                style={{ pointerEvents: 'none', userSelect: 'none' }}
              >
                {Math.round(r.height)}
              </text>
            </g>
          );
        })}

        {rectPreview && (
          <g>
            <rect
              x={rectPreview.x}
              y={rectPreview.y}
              width={rectPreview.width}
              height={rectPreview.height}
              fill="none"
              stroke="#3182ce"
              strokeWidth={1}
              strokeDasharray="4 3"
            />
            <text
              x={rectPreview.labelX}
              y={rectPreview.labelY}
              fontSize={12 / scale}
              fill="#3182ce"
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            >
              {Math.round(rectPreview.width)} × {Math.round(rectPreview.height)}
            </text>
          </g>
        )}

        {selectionBox && selectionBox.width > 0 && selectionBox.height > 0 && (
          <rect
            x={selectionBox.x}
            y={selectionBox.y}
            width={selectionBox.width}
            height={selectionBox.height}
            fill="rgba(49,130,206,0.08)"
            stroke="#3182ce"
            strokeWidth={1 / scale}
            strokeDasharray={`${4 / scale} ${3 / scale}`}
            style={{ pointerEvents: 'none' }}
          />
        )}

        {placed.map(p => {
          const def = defs.find(d => d.id === p.defId);
          if (!def) return null;
          return (
            <PlacedComponentEl
              key={p.instanceId}
              item={p}
              def={def}
              selected={selectedIds.has(p.instanceId)}
              overlapping={overlappingIds.has(p.instanceId)}
              textUnit={textUnit}
              strokeUnit={strokeUnit}
              onMouseDown={onComponentMouseDown}
              onClick={onComponentClick}
              onContextMenu={onComponentContextMenu}
            />
          );
        })}
        {textItems.map(t => (
          <text
            key={t.id}
            x={t.x}
            y={t.y}
            fontSize={t.fontSize * textUnit}
            fill={selectedIds.has(t.id) ? '#3182ce' : '#222'}
            style={{ cursor: 'move', userSelect: 'none' }}
            onMouseDown={e => onTextMouseDown(e, t.id)}
            onClick={e => onTextClick(e, t.id)}
            onDoubleClick={e => onTextDblClick(e, t.id)}
          >
            {t.text}
          </text>
        ))}
      </g>
    </svg>
  );
});

Canvas.displayName = 'Canvas';
export default Canvas;
