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
      {(() => {
        const lines: { text: string; size: number; fill: string }[] = [
          { text: def.id, size: 11, fill: '#222' },
        ];
        if (item.tag) lines.push({ text: item.tag, size: 10, fill: '#1a56a8' });
        if (item.showPN) lines.push({ text: def.partNumber, size: 10, fill: '#555' });

        const lineH = 12 * textUnit;
        const top = def.height / 2 - ((lines.length - 1) * lineH) / 2;

        return lines.map((l, i) => (
          <text
            key={i}
            x={def.width / 2}
            y={top + i * lineH}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={l.size * textUnit}
            fill={l.fill}
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          >
            {l.text}
          </text>
        ));
      })()}
    </g>
  );
}
