import type { Wireduct as WireductType } from '../types';

interface Props {
  item: WireductType;
  selected: boolean;
  textUnit: number;
  strokeUnit: number;
  onMouseDown: (e: React.MouseEvent, id: string) => void;
  onClick: (e: React.MouseEvent, id: string) => void;
}

export default function Wireduct({ item, selected, textUnit, strokeUnit, onMouseDown, onClick }: Props) {
  const w = item.orientation === 'horizontal' ? item.length : item.ductWidth;
  const h = item.orientation === 'horizontal' ? item.ductWidth : item.length;
  const stroke = selected ? '#3182ce' : '#444';

  return (
    <g
      transform={`translate(${item.x}, ${item.y})`}
      style={{ cursor: 'move' }}
      onMouseDown={e => onMouseDown(e, item.id)}
      onClick={e => onClick(e, item.id)}
    >
      <rect
        width={w}
        height={h}
        fill="#d4e8f5"
        stroke={stroke}
        strokeWidth={(selected ? 2 : 1) * strokeUnit}
      />
      <text
        x={w / 2}
        y={h / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={10 * textUnit}
        fill="#333"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        WIREDUCT
      </text>
    </g>
  );
}
