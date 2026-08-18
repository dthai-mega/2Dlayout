import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { ComponentDef, PlacedComponent, Wireduct, DrawnRect, TextItem, GridSettings, ViewTransform, Tool } from './types';
import { overlaps } from './utils/overlap';
import { saveLayout, loadLayout, loadCsvFile } from './utils/storage';
import { screenToCanvas, zoomAll } from './utils/zoom';
import { nextTag, nextTags, unusedTags } from './utils/tags';
import { hasValidSize } from './utils/validate';
import { rotatedBBox } from './utils/bbox';
import type { ZoomItem } from './utils/zoom';
import Toolbar from './components/Toolbar';
import Palette from './components/Palette';
import Canvas, { type CanvasHandle } from './components/Canvas';
import CsvPreviewDialog from './components/CsvPreviewDialog';
import type { Wireduct as WireductType } from './types';

function buildWireduct(
  x1: number, y1: number,
  x2: number, y2: number,
  ductWidth: number,
  id: string = crypto.randomUUID()
): WireductType {
  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  const orientation = dx >= dy ? 'horizontal' : 'vertical';
  if (orientation === 'horizontal') {
    return {
      id,
      x: Math.min(x1, x2),
      y: y1 - ductWidth / 2,
      length: Math.max(dx, 1),
      orientation,
      ductWidth,
    };
  } else {
    return {
      id,
      x: x1 - ductWidth / 2,
      y: Math.min(y1, y2),
      length: Math.max(dy, 1),
      orientation,
      ductWidth,
    };
  }
}

function containedIn(
  outer: { x: number; y: number; w: number; h: number },
  inner: { x: number; y: number; w: number; h: number }
) {
  return inner.x >= outer.x && inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w &&
    inner.y + inner.h <= outer.y + outer.h;
}

function getPlacedBBox(p: PlacedComponent, def: ComponentDef) {
  return rotatedBBox(p.x, p.y, def.width, def.height, p.rotation);
}

function getWireductBBox(w: Wireduct) {
  const baseW = w.orientation === 'horizontal' ? w.length : w.ductWidth;
  const baseH = w.orientation === 'horizontal' ? w.ductWidth : w.length;
  return rotatedBBox(w.x, w.y, baseW, baseH, w.rotation ?? 0);
}

function getRectBBox(r: DrawnRect) {
  return rotatedBBox(r.x, r.y, r.width, r.height, r.rotation ?? 0);
}

export default function App() {
  const [componentDefs, setComponentDefs] = useState<ComponentDef[]>([]);
  const [placed, setPlaced] = useState<PlacedComponent[]>([]);
  const [wireducts, setWireducts] = useState<Wireduct[]>([]);
  const [drawnRects, setDrawnRects] = useState<DrawnRect[]>([]);
  const [textItems, setTextItems] = useState<TextItem[]>([]);
  const [textInputState, setTextInputState] = useState<{ canvasX: number; canvasY: number; screenX: number; screenY: number; editingId?: string; existingText?: string } | null>(null);
  const [gridSettings, setGridSettings] = useState<GridSettings>({ size: 20, visible: true });
  const [transform, setTransform] = useState<ViewTransform>({ scale: 1, offsetX: 0, offsetY: 0 });
  const [tool, setTool] = useState<Tool>('select');
  const [ductWidth, setDuctWidth] = useState(25);
  const [textScale, setTextScale] = useState(1.0);
  const [lineScale, setLineScale] = useState(1.0);

  const canvasRef = useRef<CanvasHandle>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [overlappingIds, setOverlappingIds] = useState<Set<string>>(new Set());
  const wireductStart = useRef<{ x: number; y: number } | null>(null);
  const [wireductPreview, setWireductPreview] = useState<WireductType | null>(null);
  const rectStart = useRef<{ x: number; y: number } | null>(null);
  const [rectPreview, setRectPreview] = useState<{ x: number; y: number; width: number; height: number; labelX: number; labelY: number } | null>(null);
  const selBoxStart = useRef<{ sx: number; sy: number } | null>(null);
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const panState = useRef<{ startX: number; startY: number; origOffsetX: number; origOffsetY: number } | null>(null);
  const lastMiddleClick = useRef<number>(0);

  const [triggerZoomAll, setTriggerZoomAll] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ instanceId: string; x: number; y: number } | null>(null);
  const [tagEditState, setTagEditState] = useState<{
    instanceId: string; screenX: number; screenY: number; current: string; defId: string;
  } | null>(null);
  const [shapeMenu, setShapeMenu] = useState<{ kind: 'rect' | 'wireduct'; id: string; x: number; y: number } | null>(null);
  const [shapeEditState, setShapeEditState] = useState<
    | { kind: 'rect'; id: string; screenX: number; screenY: number; width: number; height: number; rotation: number }
    | { kind: 'wireduct'; id: string; screenX: number; screenY: number; length: number; ductWidth: number; rotation: number }
    | null
  >(null);
  const [csvRawText, setCsvRawText] = useState<string | null>(null);

  type LayoutSnap = { placed: PlacedComponent[]; wireducts: Wireduct[]; drawnRects: DrawnRect[]; textItems: TextItem[] };
  const layoutRef = useRef<LayoutSnap>({ placed: [], wireducts: [], drawnRects: [], textItems: [] });
  const historyRef = useRef<LayoutSnap[]>([]);
  const futureRef = useRef<LayoutSnap[]>([]);
  const [dropPending, setDropPending] = useState<{
    defId: string; canvasX: number; canvasY: number;
    screenX: number; screenY: number;
    remaining: number; def: ComponentDef;
  } | null>(null);
  const [placeAllGap, setPlaceAllGap] = useState(0);

  layoutRef.current = { placed, wireducts, drawnRects, textItems };

  const pushHistory = useCallback(() => {
    historyRef.current = [...historyRef.current.slice(-49), layoutRef.current];
    futureRef.current = [];
  }, []);

  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    const snap = historyRef.current[historyRef.current.length - 1];
    futureRef.current = [...futureRef.current, layoutRef.current];
    historyRef.current = historyRef.current.slice(0, -1);
    setPlaced(snap.placed);
    setWireducts(snap.wireducts);
    setDrawnRects(snap.drawnRects);
    setTextItems(snap.textItems);
  }, []);

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return;
    const snap = futureRef.current[futureRef.current.length - 1];
    historyRef.current = [...historyRef.current, layoutRef.current];
    futureRef.current = futureRef.current.slice(0, -1);
    setPlaced(snap.placed);
    setWireducts(snap.wireducts);
    setDrawnRects(snap.drawnRects);
    setTextItems(snap.textItems);
  }, []);

  const cancelActiveCommand = useCallback(() => {
    if (wireductStart.current) {
      wireductStart.current = null;
      setWireductPreview(null);
    }
    if (rectStart.current) {
      rectStart.current = null;
      setRectPreview(null);
    }
    if (selBoxStart.current) {
      selBoxStart.current = null;
      setSelectionBox(null);
    }
    setDropPending(null);
    setTextInputState(null);
    setTagEditState(null);
    setShapeMenu(null);
    setShapeEditState(null);
    if (dragState.current) {
      const ds = dragState.current;
      setPlaced(prev => prev.map(p => {
        const item = ds.items.find(i => i.instanceId === p.instanceId);
        return item ? { ...p, x: item.origX, y: item.origY } : p;
      }));
      if (ds.textDragItems.length > 0) {
        setTextItems(prev => prev.map(t => {
          const item = ds.textDragItems.find(i => i.id === t.id);
          return item ? { ...t, x: item.origX, y: item.origY } : t;
        }));
      }
      if (ds.rectDragItems.length > 0) {
        setDrawnRects(prev => prev.map(r => {
          const item = ds.rectDragItems.find(i => i.id === r.id);
          return item ? { ...r, x: item.origX, y: item.origY } : r;
        }));
      }
      if (ds.wireductDragItems.length > 0) {
        setWireducts(prev => prev.map(w => {
          const item = ds.wireductDragItems.find(i => i.id === w.id);
          return item ? { ...w, x: item.origX, y: item.origY } : w;
        }));
      }
      dragState.current = null;
      setOverlappingIds(new Set());
    }
    panState.current = null;
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        cancelActiveCommand();
        if (tool === 'rotate') setTool('select');
        return;
      }
      if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if ((e.key === 'y' && (e.ctrlKey || e.metaKey)) || (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey)) {
        e.preventDefault();
        redo();
        return;
      }
      if (e.key !== 'Delete' || selectedIds.size === 0) return;
      pushHistory();
      setPlaced(prev => prev.filter(p => !selectedIds.has(p.instanceId)));
      setWireducts(prev => prev.filter(w => !selectedIds.has(w.id)));
      setDrawnRects(prev => prev.filter(r => !selectedIds.has(r.id)));
      setTextItems(prev => prev.filter(t => !selectedIds.has(t.id)));
      setSelectedIds(new Set());
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIds, cancelActiveCommand, tool, undo, redo, pushHistory]);

  const handleToolChange = useCallback((newTool: Tool) => {
    cancelActiveCommand();
    setTool(newTool);
  }, [cancelActiveCommand]);

  const handleComponentClick = useCallback((e: { stopPropagation: () => void; ctrlKey: boolean }, instanceId: string) => {
    e.stopPropagation();
    if (tool === 'rotate') {
      pushHistory();
      setPlaced(prev => prev.map(p =>
        p.instanceId === instanceId ? { ...p, rotation: (p.rotation + 90) % 360 } : p
      ));
      return;
    }
    if (e.ctrlKey) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(instanceId)) next.delete(instanceId); else next.add(instanceId);
        return next;
      });
    } else {
      setSelectedIds(new Set([instanceId]));
    }
  }, [tool, pushHistory]);

  const handleWireductClick = useCallback((e: { stopPropagation: () => void; ctrlKey: boolean }, id: string) => {
    e.stopPropagation();
    if (e.ctrlKey) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
    } else {
      setSelectedIds(new Set([id]));
    }
  }, []);

  const handleRectClick = useCallback((e: { stopPropagation: () => void; ctrlKey: boolean }, id: string) => {
    e.stopPropagation();
    if (e.ctrlKey) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
    } else {
      setSelectedIds(new Set([id]));
    }
  }, []);

  const handleComponentContextMenu = useCallback((e: React.MouseEvent, instanceId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ instanceId, x: e.clientX, y: e.clientY });
  }, []);

  const handleRectContextMenu = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setShapeMenu({ kind: 'rect', id, x: e.clientX, y: e.clientY });
  }, []);

  const handleWireductContextMenu = useCallback((e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    setShapeMenu({ kind: 'wireduct', id, x: e.clientX, y: e.clientY });
  }, []);

  const handleShapeEditSave = useCallback(() => {
    if (!shapeEditState) return;
    pushHistory();
    if (shapeEditState.kind === 'rect') {
      const { id, width, height, rotation } = shapeEditState;
      setDrawnRects(prev => prev.map(r => r.id === id ? { ...r, width, height, rotation } : r));
    } else {
      const { id, length, ductWidth, rotation } = shapeEditState;
      setWireducts(prev => prev.map(w => w.id === id ? { ...w, length, ductWidth, rotation } : w));
    }
    setShapeEditState(null);
  }, [shapeEditState, pushHistory]);

  const handleTogglePN = useCallback((instanceId: string) => {
    setPlaced(prev => prev.map(p =>
      p.instanceId === instanceId ? { ...p, showPN: !p.showPN } : p
    ));
    setContextMenu(null);
  }, []);

  const handleTextClick = useCallback((e: { stopPropagation: () => void; ctrlKey: boolean }, id: string) => {
    e.stopPropagation();
    if (e.ctrlKey) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
    } else {
      setSelectedIds(new Set([id]));
    }
  }, []);

  const handleTextConfirm = useCallback((text: string) => {
    if (!textInputState) return;
    pushHistory();
    if (textInputState.editingId) {
      setTextItems(prev => prev.map(t =>
        t.id === textInputState.editingId ? { ...t, text } : t
      ));
    } else {
      setTextItems(prev => [...prev, {
        id: crypto.randomUUID(),
        x: textInputState.canvasX,
        y: textInputState.canvasY,
        text,
        fontSize: 14,
      }]);
    }
    setTextInputState(null);
  }, [textInputState, pushHistory]);

  const handleTextDblClick = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const t = textItems.find(t => t.id === id);
    if (!t) return;
    const svgRect = canvasRef.current?.getSvgRect();
    if (!svgRect) return;
    const screenX = t.x * transform.scale + transform.offsetX + svgRect.left;
    const screenY = t.y * transform.scale + transform.offsetY + svgRect.top;
    setTextInputState({ canvasX: t.x, canvasY: t.y, screenX, screenY, editingId: id, existingText: t.text });
  }, [textItems, transform]);

  const handleZoomAll = useCallback(() => {
    const rect = canvasRef.current?.getSvgRect();
    if (!rect) return;

    const items: ZoomItem[] = [
      ...placed.map(p => {
        const def = componentDefs.find(d => d.id === p.defId);
        if (!def) return { x: p.x, y: p.y, w: 50, h: 50 };
        return getPlacedBBox(p, def);
      }),
      ...wireducts.map(getWireductBBox),
      ...drawnRects.map(getRectBBox),
      ...textItems.map(t => ({ x: t.x, y: t.y - t.fontSize, w: t.text.length * t.fontSize * 0.6, h: t.fontSize })),
    ];

    setTransform(zoomAll(items, rect.width, rect.height));
  }, [placed, wireducts, drawnRects, textItems, componentDefs]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey) return; // let browser handle ctrl+wheel
    e.preventDefault();
    setTransform(prev => ({
      ...prev,
      offsetX: prev.offsetX - (e.shiftKey ? e.deltaY : e.deltaX),
      offsetY: prev.offsetY - (e.shiftKey ? 0 : e.deltaY),
    }));
  }, []);

  const handleZoomSlider = useCallback((newScale: number) => {
    const rect = canvasRef.current?.getSvgRect();
    if (!rect) {
      setTransform(prev => ({ ...prev, scale: newScale }));
      return;
    }
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    setTransform(prev => {
      const factor = newScale / prev.scale;
      return {
        scale: newScale,
        offsetX: cx - (cx - prev.offsetX) * factor,
        offsetY: cy - (cy - prev.offsetY) * factor,
      };
    });
  }, []);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    setContextMenu(null);
    if (e.button === 1) {
      e.preventDefault();
      const now = Date.now();
      if (now - lastMiddleClick.current < 400) {
        handleZoomAll();
        lastMiddleClick.current = 0;
        return;
      }
      lastMiddleClick.current = now;
      panState.current = {
        startX: e.clientX,
        startY: e.clientY,
        origOffsetX: transform.offsetX,
        origOffsetY: transform.offsetY,
      };
      return;
    }
    if (e.button !== 0) return;
    if (tool === 'wireduct') {
      const rect = canvasRef.current?.getSvgRect();
      if (!rect) return;
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const { x, y } = screenToCanvas(sx, sy, transform);
      if (!wireductStart.current) {
        wireductStart.current = { x, y };
      } else {
        const start = wireductStart.current;
        const wd = buildWireduct(start.x, start.y, x, y, ductWidth);
        pushHistory();
        setWireducts(prev => [...prev, wd]);
        wireductStart.current = null;
        setWireductPreview(null);
      }
      return;
    }
    if (tool === 'rect') {
      const svgRect = canvasRef.current?.getSvgRect();
      if (!svgRect) return;
      const sx = e.clientX - svgRect.left;
      const sy = e.clientY - svgRect.top;
      const { x, y } = screenToCanvas(sx, sy, transform);
      if (!rectStart.current) {
        rectStart.current = { x, y };
      } else {
        const start = rectStart.current;
        const rx = Math.min(start.x, x);
        const ry = Math.min(start.y, y);
        const rw = Math.abs(x - start.x);
        const rh = Math.abs(y - start.y);
        if (rw > 0 && rh > 0) {
          pushHistory();
          setDrawnRects(prev => [...prev, { id: crypto.randomUUID(), x: rx, y: ry, width: rw, height: rh }]);
        }
        rectStart.current = null;
        setRectPreview(null);
      }
      return;
    }
    if (tool === 'select') {
      const svgRect2 = canvasRef.current?.getSvgRect();
      if (svgRect2) {
        selBoxStart.current = { sx: e.clientX - svgRect2.left, sy: e.clientY - svgRect2.top };
      }
      return;
    }
    if (tool === 'text') {
      const svgRect3 = canvasRef.current?.getSvgRect();
      if (!svgRect3) return;
      const sx = e.clientX - svgRect3.left;
      const sy = e.clientY - svgRect3.top;
      const { x, y } = screenToCanvas(sx, sy, transform);
      setTextInputState({ canvasX: x, canvasY: y, screenX: e.clientX, screenY: e.clientY });
      return;
    }
  }, [tool, transform, ductWidth, handleZoomAll, pushHistory]);

  const handleDeleteDef = useCallback((id: string) => {
    setComponentDefs(prev => prev.filter(d => d.id !== id));
    setPlaced(prev => prev.filter(p => p.defId !== id));
  }, []);

  const handleEditDef = useCallback((updated: ComponentDef) => {
    setComponentDefs(prev => prev.map(d => d.id === updated.id ? updated : d));
  }, []);

  const handleAddDef = useCallback((def: ComponentDef) => {
    setComponentDefs(prev => [...prev, def]);
  }, []);

  const handleLoadCsv = useCallback(async () => {
    try {
      const text = await loadCsvFile();
      setCsvRawText(text);
    } catch { /* user cancelled */ }
  }, []);

  const buildExportSvgClone = useCallback(() => {
    const svg = canvasRef.current?.getSvgElement();
    if (!svg) return null;
    const { scale: s, offsetX, offsetY } = transform;

    // Compute content bounds in canvas space, then map to screen space
    const items: ZoomItem[] = [
      ...placed.map(p => {
        const def = componentDefs.find(d => d.id === p.defId);
        if (!def) return { x: p.x, y: p.y, w: 50, h: 50 };
        return getPlacedBBox(p, def);
      }),
      ...wireducts.map(getWireductBBox),
      ...drawnRects.map(getRectBBox),
      ...textItems.map(t => {
        const th = t.fontSize * textScale;
        return { x: t.x, y: t.y - th, w: t.text.length * th * 0.6, h: th };
      }),
    ];

    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.querySelector('rect[fill="url(#grid)"]')?.remove();

    if (items.length === 0) {
      clone.setAttribute('width', '800');
      clone.setAttribute('height', '600');
      return { clone, width: 800, height: 600 };
    }

    // Map canvas bounds to screen-space coordinates (what the SVG actually renders)
    const pad = 20;
    const minX = Math.min(...items.map(i => i.x)) * s + offsetX - pad;
    const minY = Math.min(...items.map(i => i.y)) * s + offsetY - pad;
    const maxX = Math.max(...items.map(i => i.x + i.w)) * s + offsetX + pad;
    const maxY = Math.max(...items.map(i => i.y + i.h)) * s + offsetY + pad;
    const vbW = maxX - minX;
    const vbH = maxY - minY;

    const maxPx = 2000;
    const ar = vbW / vbH;
    const pxW = ar >= 1 ? maxPx : Math.round(maxPx * ar);
    const pxH = ar >= 1 ? Math.round(maxPx / ar) : maxPx;

    clone.setAttribute('width', String(pxW));
    clone.setAttribute('height', String(pxH));
    clone.setAttribute('viewBox', `${minX} ${minY} ${vbW} ${vbH}`);

    return { clone, width: pxW, height: pxH };
  }, [transform, placed, componentDefs, wireducts, drawnRects, textItems, textScale]);

  const handleExport = useCallback(async (format: 'svg' | 'png' | 'jpg') => {
    const result = buildExportSvgClone();
    if (!result) return;
    const { clone, width, height } = result;
    const svgStr = new XMLSerializer().serializeToString(clone);

    if (format === 'svg') {
      const blob = new Blob([svgStr], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'layout.svg'; a.click();
      URL.revokeObjectURL(url);
      return;
    }

    const svgBlob = new Blob([svgStr], { type: 'image/svg+xml' });
    const svgUrl = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      if (format === 'jpg') { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height); }
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(svgUrl);
      const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
      canvas.toBlob(blob => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `layout.${format}`; a.click();
        URL.revokeObjectURL(url);
      }, mimeType, 0.95);
    };
    img.src = svgUrl;
  }, [buildExportSvgClone]);

  const handleSaveJson = useCallback(() => {
    saveLayout({
      componentDefs,
      layout: { components: placed, wireducts, rects: drawnRects, texts: textItems },
    });
  }, [componentDefs, placed, wireducts, drawnRects, textItems]);

  const handleLoadJson = useCallback(async () => {
    try {
      const data = await loadLayout();
      setComponentDefs(data.componentDefs);
      setPlaced(data.layout.components);
      setWireducts(data.layout.wireducts);
      setDrawnRects(data.layout.rects ?? []);
      setTextItems(data.layout.texts ?? []);
      historyRef.current = [];
      futureRef.current = [];
      setTriggerZoomAll(true);
    } catch { /* user cancelled or bad file */ }
  }, []);

  const dragState = useRef<{
    startScreenX: number;
    startScreenY: number;
    items: Array<{ instanceId: string; origX: number; origY: number }>;
    textDragItems: Array<{ id: string; origX: number; origY: number }>;
    rectDragItems: Array<{ id: string; origX: number; origY: number }>;
    wireductDragItems: Array<{ id: string; origX: number; origY: number }>;
  } | null>(null);

  const startDrag = useCallback((e: { clientX: number; clientY: number }, startId: string, startSelected: boolean) => {
    const dragIds = startSelected ? [...selectedIds] : [startId];
    if (!startSelected) setSelectedIds(new Set([startId]));

    const items = dragIds
      .filter(id => placed.some(p => p.instanceId === id))
      .map(id => placed.find(p => p.instanceId === id)!)
      .map(p => ({ instanceId: p.instanceId, origX: p.x, origY: p.y }));

    const textDragItems = dragIds
      .filter(id => textItems.some(t => t.id === id))
      .map(id => textItems.find(t => t.id === id)!)
      .map(t => ({ id: t.id, origX: t.x, origY: t.y }));

    const rectDragItems = dragIds
      .filter(id => drawnRects.some(r => r.id === id))
      .map(id => drawnRects.find(r => r.id === id)!)
      .map(r => ({ id: r.id, origX: r.x, origY: r.y }));

    const wireductDragItems = dragIds
      .filter(id => wireducts.some(w => w.id === id))
      .map(id => wireducts.find(w => w.id === id)!)
      .map(w => ({ id: w.id, origX: w.x, origY: w.y }));

    pushHistory();
    dragState.current = { startScreenX: e.clientX, startScreenY: e.clientY, items, textDragItems, rectDragItems, wireductDragItems };
  }, [selectedIds, placed, textItems, drawnRects, wireducts, pushHistory]);

  const handleComponentMouseDown = useCallback((e: { stopPropagation: () => void; clientX: number; clientY: number; button: number; ctrlKey: boolean }, instanceId: string) => {
    e.stopPropagation();
    if (tool !== 'select') return;
    if (e.ctrlKey) return;
    startDrag(e, instanceId, selectedIds.has(instanceId));
  }, [tool, selectedIds, startDrag]);

  const handleTextMouseDown = useCallback((e: { stopPropagation: () => void; clientX: number; clientY: number; ctrlKey: boolean }, id: string) => {
    e.stopPropagation();
    if (tool !== 'select') return;
    if (e.ctrlKey) return;
    startDrag(e, id, selectedIds.has(id));
  }, [tool, selectedIds, startDrag]);

  const handleRectMouseDown = useCallback((e: { stopPropagation: () => void; clientX: number; clientY: number; ctrlKey: boolean }, id: string) => {
    e.stopPropagation();
    if (tool !== 'select') return;
    if (e.ctrlKey) return;
    startDrag(e, id, selectedIds.has(id));
  }, [tool, selectedIds, startDrag]);

  const handleWireductMouseDown = useCallback((e: { stopPropagation: () => void; clientX: number; clientY: number; ctrlKey: boolean }, id: string) => {
    e.stopPropagation();
    if (tool !== 'select') return;
    if (e.ctrlKey) return;
    startDrag(e, id, selectedIds.has(id));
  }, [tool, selectedIds, startDrag]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (panState.current) {
      const ps = panState.current;
      setTransform(prev => ({
        ...prev,
        offsetX: ps.origOffsetX + (e.clientX - ps.startX),
        offsetY: ps.origOffsetY + (e.clientY - ps.startY),
      }));
      return;
    }
    if (tool === 'wireduct' && wireductStart.current) {
      const rect = canvasRef.current?.getSvgRect();
      if (rect) {
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const { x, y } = screenToCanvas(sx, sy, transform);
        setWireductPreview(buildWireduct(
          wireductStart.current.x, wireductStart.current.y,
          x, y, ductWidth, 'preview'
        ));
      }
      return;
    }
    if (tool === 'rect' && rectStart.current) {
      const svgRect = canvasRef.current?.getSvgRect();
      if (svgRect) {
        const sx = e.clientX - svgRect.left;
        const sy = e.clientY - svgRect.top;
        const { x, y } = screenToCanvas(sx, sy, transform);
        const start = rectStart.current;
        const rx = Math.min(start.x, x);
        const ry = Math.min(start.y, y);
        const rw = Math.abs(x - start.x);
        const rh = Math.abs(y - start.y);
        const labelOffset = 8 / transform.scale;
        setRectPreview({ x: rx, y: ry, width: rw, height: rh, labelX: x + labelOffset, labelY: y - labelOffset });
      }
      return;
    }
    if (tool === 'select' && selBoxStart.current) {
      const svgRect2 = canvasRef.current?.getSvgRect();
      if (svgRect2) {
        const { x: cx, y: cy } = screenToCanvas(e.clientX - svgRect2.left, e.clientY - svgRect2.top, transform);
        const { x: sx, y: sy } = screenToCanvas(selBoxStart.current.sx, selBoxStart.current.sy, transform);
        setSelectionBox({
          x: Math.min(sx, cx), y: Math.min(sy, cy),
          width: Math.abs(cx - sx), height: Math.abs(cy - sy),
        });
      }
      return;
    }

    const ds = dragState.current;
    if (!ds) return;

    const dx = (e.clientX - ds.startScreenX) / transform.scale;
    const dy = (e.clientY - ds.startScreenY) / transform.scale;
    const movingIds = new Set(ds.items.map(i => i.instanceId));

    setPlaced(prev => {
      const updated = prev.map(p => {
        const item = ds.items.find(i => i.instanceId === p.instanceId);
        return item ? { ...p, x: item.origX + dx, y: item.origY + dy } : p;
      });

      const newOverlapping = new Set<string>();
      for (const moving of updated.filter(p => movingIds.has(p.instanceId))) {
        const movingDef = componentDefs.find(d => d.id === moving.defId);
        if (!movingDef) continue;
        const movingBox = getPlacedBBox(moving, movingDef);
        for (const other of updated.filter(p => !movingIds.has(p.instanceId))) {
          const otherDef = componentDefs.find(d => d.id === other.defId);
          if (!otherDef) continue;
          if (overlaps(movingBox, getPlacedBBox(other, otherDef))) {
            newOverlapping.add(moving.instanceId);
            newOverlapping.add(other.instanceId);
          }
        }
      }
      setOverlappingIds(newOverlapping);
      return updated;
    });

    if (ds.textDragItems.length > 0) {
      setTextItems(prev => prev.map(t => {
        const item = ds.textDragItems.find(i => i.id === t.id);
        return item ? { ...t, x: item.origX + dx, y: item.origY + dy } : t;
      }));
    }
    if (ds.rectDragItems.length > 0) {
      setDrawnRects(prev => prev.map(r => {
        const item = ds.rectDragItems.find(i => i.id === r.id);
        return item ? { ...r, x: item.origX + dx, y: item.origY + dy } : r;
      }));
    }
    if (ds.wireductDragItems.length > 0) {
      setWireducts(prev => prev.map(w => {
        const item = ds.wireductDragItems.find(i => i.id === w.id);
        return item ? { ...w, x: item.origX + dx, y: item.origY + dy } : w;
      }));
    }
  }, [tool, transform, ductWidth, componentDefs]);

  const handleCanvasMouseUp = useCallback((e: React.MouseEvent) => {
    panState.current = null;
    dragState.current = null;
    setOverlappingIds(new Set());

    if (selBoxStart.current) {
      const svgRect2 = canvasRef.current?.getSvgRect();
      if (svgRect2) {
        const start = screenToCanvas(selBoxStart.current.sx, selBoxStart.current.sy, transform);
        const end = screenToCanvas(e.clientX - svgRect2.left, e.clientY - svgRect2.top, transform);
        const box = {
          x: Math.min(start.x, end.x), y: Math.min(start.y, end.y),
          w: Math.abs(end.x - start.x), h: Math.abs(end.y - start.y),
        };

        if (box.w > 4 || box.h > 4) {
          const newIds = new Set<string>();
          for (const p of placed) {
            const def = componentDefs.find(d => d.id === p.defId);
            if (def && containedIn(box, getPlacedBBox(p, def))) newIds.add(p.instanceId);
          }
          for (const w of wireducts) {
            if (containedIn(box, getWireductBBox(w))) newIds.add(w.id);
          }
          for (const r of drawnRects) {
            if (containedIn(box, getRectBBox(r))) newIds.add(r.id);
          }
          const tUnit = textScale / transform.scale;
          for (const t of textItems) {
            const th = t.fontSize * tUnit;
            if (containedIn(box, { x: t.x, y: t.y - th, w: t.text.length * th * 0.6, h: th })) newIds.add(t.id);
          }
          setSelectedIds(e.ctrlKey ? prev => new Set([...prev, ...newIds]) : newIds);
        } else {
          if (!e.ctrlKey) setSelectedIds(new Set());
        }
      }
      selBoxStart.current = null;
      setSelectionBox(null);
    }
  }, [transform, textScale, placed, wireducts, drawnRects, textItems, componentDefs]);

  useEffect(() => {
    if (!triggerZoomAll) return;
    setTriggerZoomAll(false);
    handleZoomAll();
  }, [triggerZoomAll, handleZoomAll]);

  const handleDrop = useCallback((defId: string, canvasX: number, canvasY: number, screenX: number, screenY: number) => {
    const def = componentDefs.find(d => d.id === defId);
    if (!def) return;
    if (!hasValidSize(def)) return;   // invalid W/H -> not placeable
    const alreadyPlaced = placed.filter(p => p.defId === defId).length;
    const remaining = def.qty - alreadyPlaced;
    if (remaining <= 0) return;
    if (remaining > 1) {
      setDropPending({ defId, canvasX, canvasY, screenX, screenY, remaining, def });
      return;
    }
    pushHistory();
    setPlaced(prev => [...prev, {
      instanceId: crypto.randomUUID(), defId, x: canvasX, y: canvasY, rotation: 0,
      tag: nextTag(def, placed) || undefined,
    }]);
  }, [componentDefs, placed, pushHistory]);

  const handlePlaceOne = useCallback(() => {
    if (!dropPending) return;
    pushHistory();
    setPlaced(prev => [...prev, {
      instanceId: crypto.randomUUID(),
      defId: dropPending.defId,
      x: dropPending.canvasX,
      y: dropPending.canvasY,
      rotation: 0,
      tag: nextTag(dropPending.def, placed) || undefined,
    }]);
    setDropPending(null);
  }, [dropPending, placed, pushHistory]);

  const handlePlaceAll = useCallback(() => {
    if (!dropPending) return;
    pushHistory();
    const { defId, canvasX, canvasY, remaining, def } = dropPending;
    const tags = nextTags(def, placed, remaining);
    setPlaced(prev => [
      ...prev,
      ...Array.from({ length: remaining }, (_, i) => ({
        instanceId: crypto.randomUUID(),
        defId,
        x: canvasX + i * (def.width + placeAllGap),
        y: canvasY,
        rotation: 0,
        tag: tags[i] || undefined,
      })),
    ]);
    setDropPending(null);
  }, [dropPending, placed, placeAllGap, pushHistory]);

  return (
    <div className="app">
      <Toolbar
        gridSettings={gridSettings}
        onGridSizeChange={size => setGridSettings(g => ({ ...g, size }))}
        onGridVisibilityToggle={() => setGridSettings(g => ({ ...g, visible: !g.visible }))}
        tool={tool}
        onToolChange={handleToolChange}
        ductWidth={ductWidth}
        onDuctWidthChange={setDuctWidth}
        transform={transform}
        onZoomAll={handleZoomAll}
        onZoomChange={handleZoomSlider}
        textScale={textScale}
        onTextScaleChange={setTextScale}
        lineScale={lineScale}
        onLineScaleChange={setLineScale}
        onLoadCsv={handleLoadCsv}
        onExport={handleExport}
        onSaveJson={handleSaveJson}
        onLoadJson={handleLoadJson}
      />
      <div className="instructions-bar">
        <strong>New here?</strong>{' '}
        Download <strong>Excel Template</strong> → fill in your components (direct copy/paste from Solidworks BOM) → Save As CSV →{' '}
        <strong>Load CSV</strong> to import them.{' '}
        Use <strong>Save JSON</strong> to save your current layout to a file, and <strong>Load JSON</strong> to reopen it later.
      </div>
      <div className="main">
        <Palette
          defs={componentDefs}
          placed={placed}
          onDeleteDef={handleDeleteDef}
          onEditDef={handleEditDef}
          onAddDef={handleAddDef}
        />
        <div className="canvas-container">
          <Canvas
            ref={canvasRef}
            defs={componentDefs}
            placed={placed}
            wireducts={wireducts}
            gridSettings={gridSettings}
            transform={transform}
            tool={tool}
            selectedIds={selectedIds}
            overlappingIds={overlappingIds}
            ductWidth={ductWidth}
            textScale={textScale}
            lineScale={lineScale}
            onTransformChange={setTransform}
            onDrop={handleDrop}
            onComponentMouseDown={handleComponentMouseDown}
            onComponentClick={handleComponentClick}
            onComponentContextMenu={handleComponentContextMenu}
            onWireductClick={handleWireductClick}
            onWireductMouseDown={handleWireductMouseDown}
            onWireductContextMenu={handleWireductContextMenu}
            onRectClick={handleRectClick}
            onRectMouseDown={handleRectMouseDown}
            onRectContextMenu={handleRectContextMenu}
            drawnRects={drawnRects}
            textItems={textItems}
            onTextClick={handleTextClick}
            onTextMouseDown={handleTextMouseDown}
            onTextDblClick={handleTextDblClick}
            rectPreview={rectPreview}
            selectionBox={selectionBox}
            onCanvasMouseDown={handleCanvasMouseDown}
            onCanvasMouseMove={handleCanvasMouseMove}
            onCanvasMouseUp={handleCanvasMouseUp}
            onWheel={handleWheel}
            wireductPreview={wireductPreview}
          />
        </div>
      </div>
      {csvRawText !== null && (
        <CsvPreviewDialog
          rawText={csvRawText}
          existingIds={componentDefs.map(d => d.id)}
          onConfirm={(defs, append) => {
            if (append) {
              setComponentDefs(prev => [...prev, ...defs]);
            } else {
              setComponentDefs(defs);
            }
            setCsvRawText(null);
          }}
          onCancel={() => setCsvRawText(null)}
        />
      )}
      {textInputState && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 100 }} onClick={() => setTextInputState(null)} />
          <input
            autoFocus
            defaultValue={textInputState.existingText ?? ''}
            style={{
              position: 'fixed',
              left: textInputState.screenX,
              top: textInputState.screenY,
              zIndex: 101,
              fontSize: 14,
              border: '1px solid #3182ce',
              outline: 'none',
              background: 'rgba(255,255,255,0.92)',
              padding: '2px 6px',
              minWidth: 80,
              borderRadius: 2,
            }}
            onKeyDown={e => {
              e.stopPropagation();
              if (e.key === 'Enter') {
                const val = (e.target as HTMLInputElement).value.trim();
                if (val) handleTextConfirm(val);
                else setTextInputState(null);
              }
              if (e.key === 'Escape') setTextInputState(null);
            }}
          />
        </>
      )}
      {dropPending && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 100 }} onClick={() => setDropPending(null)} />
          <div style={{
            position: 'fixed',
            left: dropPending.screenX + 8,
            top: dropPending.screenY + 8,
            zIndex: 101,
            background: '#fff',
            border: '1px solid #ccc',
            borderRadius: 4,
            boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
            padding: '6px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}>
            <button onClick={handlePlaceOne}>Place one</button>
            <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
              Gap:
              <input
                type="number"
                min={0}
                value={placeAllGap}
                style={{ width: 52 }}
                onChange={e => setPlaceAllGap(Number(e.target.value))}
                onKeyDown={e => e.stopPropagation()}
              />
            </label>
            <button onClick={handlePlaceAll}>Place all ({dropPending.remaining})</button>
          </div>
        </>
      )}
      {contextMenu && (() => {
        const p = placed.find(p => p.instanceId === contextMenu.instanceId);
        if (!p) return null;
        return (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 100 }} onClick={() => setContextMenu(null)} />
            <div style={{
              position: 'fixed', left: contextMenu.x, top: contextMenu.y,
              zIndex: 101, background: '#fff', border: '1px solid #ccc',
              borderRadius: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
              minWidth: 140,
            }}>
              <button
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px', border: 'none', background: 'none', cursor: 'pointer' }}
                onClick={() => handleTogglePN(contextMenu.instanceId)}
              >
                {p.showPN ? 'Hide PN' : 'Show PN'}
              </button>
              <button
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px', border: 'none', background: 'none', cursor: 'pointer' }}
                onClick={() => {
                  setTagEditState({
                    instanceId: p.instanceId, defId: p.defId,
                    screenX: contextMenu.x, screenY: contextMenu.y,
                    current: p.tag ?? '',
                  });
                  setContextMenu(null);
                }}
              >
                Edit tag
              </button>
            </div>
          </>
        );
      })()}
      {tagEditState && (() => {
        const def = componentDefs.find(d => d.id === tagEditState.defId);
        const options = def ? unusedTags(def, placed) : [];
        return (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 100 }} onClick={() => setTagEditState(null)} />
            <input
              autoFocus
              list="tag-options"
              defaultValue={tagEditState.current}
              placeholder="Tag (blank = none)"
              style={{ position: 'fixed', left: tagEditState.screenX, top: tagEditState.screenY, zIndex: 101, fontSize: 13, border: '1px solid #3182ce', outline: 'none', background: 'rgba(255,255,255,0.95)', padding: '2px 6px', minWidth: 120, borderRadius: 2 }}
              onKeyDown={e => {
                e.stopPropagation();
                if (e.key === 'Enter') {
                  const val = (e.target as HTMLInputElement).value.trim();
                  pushHistory();
                  setPlaced(prev => prev.map(p =>
                    p.instanceId === tagEditState.instanceId ? { ...p, tag: val || undefined } : p
                  ));
                  setTagEditState(null);
                }
                if (e.key === 'Escape') setTagEditState(null);
              }}
            />
            <datalist id="tag-options">
              {options.map(t => <option key={t} value={t} />)}
            </datalist>
          </>
        );
      })()}
      {shapeMenu && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 100 }} onClick={() => setShapeMenu(null)} />
          <div style={{
            position: 'fixed', left: shapeMenu.x, top: shapeMenu.y,
            zIndex: 101, background: '#fff', border: '1px solid #ccc',
            borderRadius: 4, boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
            minWidth: 160,
          }}>
            <button
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 12px', border: 'none', background: 'none', cursor: 'pointer' }}
              onClick={() => {
                if (shapeMenu.kind === 'rect') {
                  const r = drawnRects.find(x => x.id === shapeMenu.id);
                  if (r) setShapeEditState({ kind: 'rect', id: r.id, screenX: shapeMenu.x, screenY: shapeMenu.y, width: r.width, height: r.height, rotation: r.rotation ?? 0 });
                } else {
                  const w = wireducts.find(x => x.id === shapeMenu.id);
                  if (w) setShapeEditState({ kind: 'wireduct', id: w.id, screenX: shapeMenu.x, screenY: shapeMenu.y, length: w.length, ductWidth: w.ductWidth, rotation: w.rotation ?? 0 });
                }
                setShapeMenu(null);
              }}
            >
              Edit size &amp; rotation
            </button>
          </div>
        </>
      )}
      {shapeEditState && (() => {
        const onKey = (e: React.KeyboardEvent) => {
          e.stopPropagation();
          if (e.key === 'Enter') handleShapeEditSave();
          if (e.key === 'Escape') setShapeEditState(null);
        };
        const valid = shapeEditState.kind === 'rect'
          ? shapeEditState.width > 0 && shapeEditState.height > 0
          : shapeEditState.length > 0 && shapeEditState.ductWidth > 0;
        return (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 100 }} onClick={() => setShapeEditState(null)} />
            <div style={{
              position: 'fixed', left: shapeEditState.screenX, top: shapeEditState.screenY,
              zIndex: 101, background: '#fff', border: '1px solid #3182ce', borderRadius: 4,
              boxShadow: '0 2px 8px rgba(0,0,0,0.18)', padding: 8,
              display: 'flex', flexDirection: 'column', gap: 4, minWidth: 170,
            }}>
              {shapeEditState.kind === 'rect' ? (
                <>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                    Width:
                    <input
                      autoFocus type="number" min={1} value={shapeEditState.width} style={{ width: 70, marginLeft: 'auto' }}
                      onChange={e => setShapeEditState(prev => prev && prev.kind === 'rect' ? { ...prev, width: Number(e.target.value) } : prev)}
                      onKeyDown={onKey}
                    />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                    Height:
                    <input
                      type="number" min={1} value={shapeEditState.height} style={{ width: 70, marginLeft: 'auto' }}
                      onChange={e => setShapeEditState(prev => prev && prev.kind === 'rect' ? { ...prev, height: Number(e.target.value) } : prev)}
                      onKeyDown={onKey}
                    />
                  </label>
                </>
              ) : (
                <>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                    Length:
                    <input
                      autoFocus type="number" min={1} value={shapeEditState.length} style={{ width: 70, marginLeft: 'auto' }}
                      onChange={e => setShapeEditState(prev => prev && prev.kind === 'wireduct' ? { ...prev, length: Number(e.target.value) } : prev)}
                      onKeyDown={onKey}
                    />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                    Duct width:
                    <input
                      type="number" min={1} value={shapeEditState.ductWidth} style={{ width: 70, marginLeft: 'auto' }}
                      onChange={e => setShapeEditState(prev => prev && prev.kind === 'wireduct' ? { ...prev, ductWidth: Number(e.target.value) } : prev)}
                      onKeyDown={onKey}
                    />
                  </label>
                </>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
                Rotation:
                <select
                  value={shapeEditState.rotation}
                  style={{ marginLeft: 'auto' }}
                  onChange={e => setShapeEditState(prev => prev ? { ...prev, rotation: Number(e.target.value) } : prev)}
                  onKeyDown={onKey}
                >
                  {[0, 90, 180, 270].map(deg => <option key={deg} value={deg}>{deg}°</option>)}
                </select>
              </label>
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                <button style={{ flex: 1 }} disabled={!valid} onClick={handleShapeEditSave}>Save</button>
                <button style={{ flex: 1 }} onClick={() => setShapeEditState(null)}>Cancel</button>
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}
