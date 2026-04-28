export interface ComponentDef {
  id: string;
  partNumber: string;
  width: number;   // mm → canvas px (1:1)
  height: number;  // mm → canvas px (1:1)
  depth: number;   // mm, stored only
  qty: number;
}

export interface PlacedComponent {
  instanceId: string;  // crypto.randomUUID()
  defId: string;
  x: number;           // canvas px (pre-transform)
  y: number;
  rotation: number;    // degrees: 0 | 90 | 180 | 270
  showPN?: boolean;    // show part number label; default false
}

export interface Wireduct {
  id: string;          // crypto.randomUUID()
  x: number;           // top-left canvas px
  y: number;
  length: number;      // px along the long axis
  orientation: 'horizontal' | 'vertical';
  ductWidth: number;   // px — the short dimension
}

export interface TextItem {
  id: string;
  x: number;
  y: number;
  text: string;
  fontSize: number;
}

export interface DrawnRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Layout {
  components: PlacedComponent[];
  wireducts: Wireduct[];
  rects: DrawnRect[];
  texts?: TextItem[];
}

export interface GridSettings {
  size: number;    // px per cell at scale=1
  visible: boolean;
}

export interface ViewTransform {
  scale: number;   // 1.0 = 100%
  offsetX: number; // px
  offsetY: number;
}

export type Tool = 'select' | 'wireduct' | 'rect' | 'rotate' | 'text';

export interface SaveFile {
  componentDefs: ComponentDef[];
  layout: Layout;
}
