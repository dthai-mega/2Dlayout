import type { ComponentDef, PlacedComponent as PlacedComp } from '../types';

interface Props {
  item: PlacedComp;
  def: ComponentDef;
  selected: boolean;
  overlapping: boolean;
  textUnit: number;
  strokeUnit: number;
  onMouseDown: (e: React.MouseEvent, instanceId: string) => void;
  onClick: (e: React.MouseEvent, instanceId: string) => void;
  onContextMenu: (e: React.MouseEvent, instanceId: string) => void;
}

export default function PlacedComponent({ item, def, selected, overlapping, textUnit, strokeUnit, onMouseDown, onClick, onContextMenu }: Props) {
  const stroke = overlapping ? '#e53e3e' : selected ? '#3182ce' : '#555';
  const strokeWidth = (selected || overlapping ? 2 : 1) * strokeUnit;

  return (
    <g
      transform={`translate(${item.x}, ${item.y}) rotate(${item.rotation}, ${def.width / 2}, ${def.height / 2})`}
      style={{ cursor: 'move' }}
      onMouseDown={e => onMouseDown(e, item.instanceId)}
      onClick={e => onClick(e, item.instanceId)}
      onContextMenu={e => onContextMenu(e, item.instanceId)}
    >
      <rect
        width={def.width}
        height={def.height}
        fill="#e8e8e8"
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
      <text
        x={def.width / 2}
        y={item.showPN ? def.height / 2 - 6 * textUnit : def.height / 2}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={11 * textUnit}
        fill="#222"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {def.id}
      </text>
      {item.showPN && (
        <text
          x={def.width / 2}
          y={def.height / 2 + 8 * textUnit}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={10 * textUnit}
          fill="#555"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
          {def.partNumber}
        </text>
      )}
    </g>
  );
}
