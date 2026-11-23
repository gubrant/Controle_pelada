import type { PlayerCriteria } from '../types.ts';
import { CRITERIA_LABELS } from '../lib/api.ts';

interface RadarChartProps {
  primary: PlayerCriteria;
  primaryLabel: string;
  secondary?: PlayerCriteria;
  secondaryLabel?: string;
  size?: number;
}

export function RadarChart({
  primary,
  primaryLabel,
  secondary,
  secondaryLabel = 'Média da Pelada',
  size = 260,
}: RadarChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const maxRadius = size * 0.34;
  const levels = [2, 4, 6, 8, 10];

  const getPoint = (index: number, value: number): [number, number] => {
    const angle = (Math.PI * 2 * index) / 6 - Math.PI / 2;
    const ratio = Math.min(10, Math.max(0, value)) / 10;
    return [cx + Math.cos(angle) * maxRadius * ratio, cy + Math.sin(angle) * maxRadius * ratio];
  };

  const toPolygonPoints = (criteria: PlayerCriteria) =>
    CRITERIA_LABELS.map((c, idx) => getPoint(idx, criteria[c.key]).join(',')).join(' ');

  return (
    <div className="flex flex-col items-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="overflow-visible select-none"
        role="img"
        aria-label={`Gráfico de atributos de ${primaryLabel}`}
      >
        {levels.map((lvl) => {
          const pts = CRITERIA_LABELS.map((_, idx) => getPoint(idx, lvl).join(',')).join(' ');
          return (
            <polygon
              key={lvl}
              points={pts}
              fill="none"
              stroke={lvl === 10 ? '#cbd5e1' : '#e2e8f0'}
              strokeWidth={lvl === 10 ? 1.25 : 1}
              strokeDasharray={lvl === 10 ? undefined : '2 2'}
            />
          );
        })}

        {CRITERIA_LABELS.map((c, idx) => {
          const [x2, y2] = getPoint(idx, 10);
          const [lx, ly] = getPoint(idx, 12.2);
          return (
            <g key={c.key}>
              <line x1={cx} y1={cy} x2={x2} y2={y2} stroke="#e2e8f0" strokeWidth={1} />
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-slate-600 text-[11px] font-medium"
              >
                {c.short}
              </text>
            </g>
          );
        })}

        {secondary && (
          <polygon
            points={toPolygonPoints(secondary)}
            fill="rgba(100, 116, 139, 0.14)"
            stroke="#64748b"
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
        )}

        <polygon
          points={toPolygonPoints(primary)}
          fill="rgba(5, 150, 105, 0.22)"
          stroke="#059669"
          strokeWidth={2.2}
        />

        {CRITERIA_LABELS.map((c, idx) => {
          const [px, py] = getPoint(idx, primary[c.key]);
          return (
            <circle
              key={c.key}
              cx={px}
              cy={py}
              r={3.5}
              fill="#059669"
              stroke="#ffffff"
              strokeWidth={1.5}
            />
          );
        })}
      </svg>

      <div className="mt-2 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-600" />
          <span className="font-medium text-slate-800">{primaryLabel}</span>
        </span>
        {secondary && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm border border-dashed border-slate-500 bg-slate-300/40" />
            <span>{secondaryLabel}</span>
          </span>
        )}
      </div>
    </div>
  );
}
