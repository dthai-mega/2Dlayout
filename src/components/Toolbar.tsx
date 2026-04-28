import { useState, useRef, useEffect } from 'react';
import type { GridSettings, Tool, ViewTransform } from '../types';

interface Props {
  gridSettings: GridSettings;
  onGridSizeChange: (size: number) => void;
  onGridVisibilityToggle: () => void;
  tool: Tool;
  onToolChange: (tool: Tool) => void;
  ductWidth: number;
  onDuctWidthChange: (w: number) => void;
  transform: ViewTransform;
  onZoomAll: () => void;
  onZoomChange: (scale: number) => void;
  textScale: number;
  onTextScaleChange: (v: number) => void;
  lineScale: number;
  onLineScaleChange: (v: number) => void;
  onLoadCsv: () => void;
  onExport: (format: 'svg' | 'png' | 'jpg') => void;
  onSaveJson: () => void;
  onLoadJson: () => void;
}

export default function Toolbar({
  gridSettings, onGridSizeChange, onGridVisibilityToggle,
  tool, onToolChange,
  ductWidth, onDuctWidthChange,
  transform, onZoomAll, onZoomChange,
  textScale, onTextScaleChange, lineScale, onLineScaleChange,
  onLoadCsv, onExport, onSaveJson, onLoadJson,
}: Props) {
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!exportOpen) return;
    function onDown(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [exportOpen]);

  return (
    <div className="toolbar">
      <button onClick={onLoadCsv}>Load CSV</button>
      <div ref={exportRef} style={{ position: 'relative', display: 'inline-block' }}>
        <button onClick={() => setExportOpen(v => !v)}>Export ▾</button>
        {exportOpen && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, zIndex: 200,
            background: '#fff', border: '1px solid #ccc', borderRadius: 4,
            boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
            display: 'flex', flexDirection: 'column', minWidth: 90,
          }}>
            {(['svg', 'png', 'jpg'] as const).map(fmt => (
              <button
                key={fmt}
                style={{ textAlign: 'left', padding: '5px 12px', border: 'none', background: 'none', cursor: 'pointer' }}
                onClick={() => { onExport(fmt); setExportOpen(false); }}
              >
                {fmt.toUpperCase()}
              </button>
            ))}
          </div>
        )}
      </div>
      <button onClick={onSaveJson}>Save JSON</button>
      <button onClick={onLoadJson}>Load JSON</button>

      <span className="toolbar-sep" />

      <label>
        Grid:
        <input
          type="number"
          min={5}
          max={200}
          value={gridSettings.size}
          onChange={e => onGridSizeChange(Number(e.target.value))}
        />
        unit
      </label>
      <label>
        <input
          type="checkbox"
          checked={gridSettings.visible}
          onChange={onGridVisibilityToggle}
        />
        Show grid
      </label>

      <span className="toolbar-sep" />

      <label>
        Tool:
        <button
          style={{ fontWeight: tool === 'select' ? 'bold' : 'normal' }}
          onClick={() => onToolChange('select')}
        >
          Select
        </button>
        <button
          style={{ fontWeight: tool === 'wireduct' ? 'bold' : 'normal' }}
          onClick={() => onToolChange('wireduct')}
        >
          Wireduct
        </button>
        <button
          style={{ fontWeight: tool === 'rect' ? 'bold' : 'normal' }}
          onClick={() => onToolChange('rect')}
        >
          Rectangle
        </button>
        <button
          style={{ fontWeight: tool === 'rotate' ? 'bold' : 'normal' }}
          onClick={() => onToolChange('rotate')}
        >
          Rotate
        </button>
        <button
          style={{ fontWeight: tool === 'text' ? 'bold' : 'normal' }}
          onClick={() => onToolChange('text')}
        >
          Text
        </button>
      </label>

      {tool === 'wireduct' && (
        <label>
          Duct width:
          <input
            type="number"
            min={5}
            max={500}
            value={ductWidth}
            onChange={e => onDuctWidthChange(Number(e.target.value))}
          />
          unit
        </label>
      )}

      <span className="toolbar-sep" />

      <label>
        Zoom:
        <input
          type="range"
          min={10}
          max={10000}
          step={5}
          value={Math.round(transform.scale * 100)}
          onChange={e => onZoomChange(Number(e.target.value) / 100)}
        />
        {Math.round(transform.scale * 100)}%
      </label>
      <button onClick={onZoomAll}>Zoom All</button>

      <span className="toolbar-sep" />

      <label>
        Text:
        <input
          type="range"
          min={0}
          max={10}
          step={0.1}
          value={textScale}
          onChange={e => onTextScaleChange(Number(e.target.value))}
        />
        {textScale.toFixed(1)}x
      </label>
      <label>
        Line:
        <input
          type="range"
          min={0}
          max={10}
          step={0.1}
          value={lineScale}
          onChange={e => onLineScaleChange(Number(e.target.value))}
        />
        {lineScale.toFixed(1)}x
      </label>
    </div>
  );
}
