import { formatCurrency } from '@/lib/format';
import type { RiskDimension } from '@/lib/dealMetrics';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function RiskDriversRadar({
  dimensions,
  valueTotal,
}: {
  dimensions: RiskDimension[];
  valueTotal: number;
}) {
  const size = 300;
  const center = size / 2;
  const radius = 96;
  const chartDrivers = dimensions;
  const angleStep = (Math.PI * 2) / Math.max(chartDrivers.length, 1);

  const pointFor = (index: number, scale: number) => {
    const angle = -Math.PI / 2 + index * angleStep;
    return {
      x: center + Math.cos(angle) * radius * scale,
      y: center + Math.sin(angle) * radius * scale,
    };
  };

  const gridLevels = [0.25, 0.5, 0.75, 1];
  const polygonPoints = chartDrivers
    .map(({ value }, index) => {
      const point = pointFor(index, clamp(value / 100, 0.05, 1));
      return `${point.x},${point.y}`;
    })
    .join(' ');

  if (chartDrivers.every(driver => driver.value === 0)) {
    return (
      <div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.76rem' }}>No risk drivers in this view.</div>
      </div>
    );
  }

  return (
    <div>
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Top risk drivers radar chart" style={{ width: '100%', maxWidth: 340, height: 'auto', display: 'block', margin: '0 auto 0.85rem' }}>
        {gridLevels.map(level => (
          <polygon
            key={level}
            points={chartDrivers.map((_, index) => {
              const point = pointFor(index, level);
              return `${point.x},${point.y}`;
            }).join(' ')}
            fill="none"
            stroke="var(--border)"
            strokeWidth="1"
          />
        ))}
        {chartDrivers.map(({ label }, index) => {
          const edge = pointFor(index, 1);
          const labelPoint = pointFor(index, 1.28);
          const anchor = Math.abs(labelPoint.x - center) < 10 ? 'middle' : labelPoint.x > center ? 'start' : 'end';
          return (
            <g key={label}>
              <line x1={center} y1={center} x2={edge.x} y2={edge.y} stroke="var(--border)" strokeWidth="1" opacity="0.75" />
              <text
                x={labelPoint.x}
                y={labelPoint.y}
                textAnchor={anchor}
                dominantBaseline="middle"
                fill="var(--text-secondary)"
                fontSize="10"
                fontWeight="700"
              >
                {label}
              </text>
            </g>
          );
        })}
        <polygon points={polygonPoints} fill="var(--prism-blue)" fillOpacity="0.18" stroke="var(--prism-blue)" strokeWidth="2.5" />
        {chartDrivers.map(({ label, value, pipeline }, index) => {
          const point = pointFor(index, clamp(value / 100, 0.05, 1));
          return (
            <circle key={label} cx={point.x} cy={point.y} r="4.5" fill="var(--prism-blue)" stroke="var(--bg-surface)" strokeWidth="2">
              <title>{`${label}: ${value}/100${valueTotal > 0 ? `, ${formatCurrency(pipeline)} pipeline` : ''}`}</title>
            </circle>
          );
        })}
      </svg>
    </div>
  );
}
