import React, { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import type { RiskDeal } from '@/lib/types';
import { DealDetailModal } from '@/components/dashboard/DealDetailModal';
import { useDealReviews } from '@/hooks/useDealReviews';
import { formatCurrency, normalizeStage, isLateStage, STAGE_ORDER } from '@/lib/format';
import { regionLabel, REGION_LABEL_ORDER } from '@/lib/regions';
import { dimensionSignals, RISK_DIMENSION_LABELS } from '@/lib/riskSignals';

interface Props {
  risks: RiskDeal[];
  onFilteredRisksChange?: (risks: RiskDeal[], isFiltered: boolean) => void;
  deltaIntelligence?: import('@/lib/types').DeltaIntelligenceData;
  /** Message from a failed /reports/{date}/deals fetch — shown instead of "no risks". */
  dealsError?: string;
}

type RiskBand = 'Green' | 'Yellow' | 'Red';
type FilterGroup = 'stages' | 'reps' | 'regions' | 'bands';
type ActiveFilters = Record<FilterGroup, string[]>;
type RiskDimension = { label: string; value: number; pipeline: number };

const MAX_DEALS = 12;

const bandColor: Record<RiskBand, string> = {
  Green: 'var(--success)',
  Yellow: 'var(--warning)',
  Red: 'var(--error)',
};

function riskScore(risk: RiskDeal): number {
  if (typeof risk.healthScore === 'number') return Math.max(0, Math.min(100, 100 - risk.healthScore));
  const stalledPressure = Math.min(18, Math.max(0, risk.daysStalled || 0) * 2);
  return risk.level === 'HIGH' ? 68 + stalledPressure : 36 + stalledPressure;
}

function riskBand(risk: RiskDeal): RiskBand {
  if (typeof risk.healthScore === 'number') {
    if (risk.healthScore >= 70) return 'Green';
    if (risk.healthScore >= 40) return 'Yellow';
    return 'Red';
  }
  if (risk.level === 'HIGH') return 'Red';
  if (risk.level === 'MEDIUM') return 'Yellow';
  return 'Green';
}

function matchesFilters(
  risk: RiskDeal,
  filters: ActiveFilters,
  lateOnly: boolean,
  exclude?: FilterGroup
): boolean {
  const stage = normalizeStage(risk.stage);
  if (lateOnly && !isLateStage(stage)) return false;
  if (exclude !== 'stages' && filters.stages.length && !filters.stages.includes(stage)) return false;
  if (exclude !== 'reps' && filters.reps.length && !filters.reps.includes(risk.rep || 'Unassigned')) return false;
  if (exclude !== 'regions' && filters.regions.length && !filters.regions.includes(regionLabel(risk.region))) return false;
  if (exclude !== 'bands' && filters.bands.length && !filters.bands.includes(riskBand(risk))) return false;
  return true;
}

function dealValue(risk: RiskDeal): number {
  return Math.max(0, risk.pipelineValue || 0);
}

function weightedValue(risk: RiskDeal): number {
  const value = dealValue(risk);
  return value > 0 ? value : 1;
}

function percent(value: number, total: number): number {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function classifySignal(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('ghost') || lower.includes('dark') || lower.includes('activity') || lower.includes('engagement')) return 'Engagement';
  if (lower.includes('close date') || lower.includes('stalled') || lower.includes('stage') || lower.includes('velocity')) return 'Velocity';
  if (lower.includes('forecast') || lower.includes('probability') || lower.includes('fiction')) return 'Forecast hygiene';
  if (lower.includes('competitor') || lower.includes('competitive')) return 'Competitive pressure';
  if (lower.includes('economic buyer') || lower.includes('stakeholder') || lower.includes('single')) return 'Stakeholder coverage';
  return 'Process hygiene';
}

function buildRiskDimensions(risks: RiskDeal[]): RiskDimension[] {
  const labels = RISK_DIMENSION_LABELS;
  const totals = labels.reduce<Record<string, RiskDimension>>((acc, label) => {
    acc[label] = { label, value: 0, pipeline: 0 };
    return acc;
  }, {});

  for (const risk of risks) {
    const dimensions = dimensionSignals(risk);
    const pipeline = dealValue(risk);
    const weight = weightedValue(risk);
    const severity = Math.max(0.25, riskScore(risk) / 100);
    const contribution = weight * severity;

    for (const label of dimensions) {
      totals[label].value += contribution;
      totals[label].pipeline += pipeline / dimensions.length;
    }
  }

  const max = Math.max(...Object.values(totals).map(item => item.value), 1);
  return labels.map(label => ({
    ...totals[label],
    value: Math.round((totals[label].value / max) * 100),
  }));
}

function toggleList(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter(item => item !== value) : [...list, value];
}

function exportToCSV(risks: RiskDeal[]): void {
  const headers = ['Account Name','Opportunity Name','Region','Stage','Rep','Risk Level','Health Score','Pipeline Value','Days Stalled','Confidence','Summary','Recommended Action'];
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = risks.map(r => [
    r.accountName ?? '',
    r.value,
    r.region,
    normalizeStage(r.stage),
    r.rep ?? 'Unassigned',
    r.level,
    r.healthScore ?? '',
    r.pipelineValue ?? 0,
    r.daysStalled,
    r.confidence,
    escape(r.summary),
    escape(r.action),
  ].join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `prism-deals-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function Chip({
  active,
  children,
  onClick,
  dot,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
  dot?: string;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        minHeight: 26,
        padding: '0.32rem 0.55rem',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 6,
        background: active ? 'var(--accent-subtle)' : 'var(--bg-elevated)',
        color: active ? 'var(--accent)' : 'var(--text-secondary)',
        fontSize: '0.72rem',
        fontWeight: 700,
        cursor: 'pointer',
      }}
    >
      {dot && <span style={{ width: 7, height: 7, borderRadius: 999, background: dot }} />}
      {children}
    </button>
  );
}

function FilterBlock({
  label,
  values,
  selected,
  onToggle,
  dotFor,
}: {
  label: string;
  values: string[];
  selected: string[];
  onToggle: (value: string) => void;
  dotFor?: (value: string) => string;
}) {
  return (
    <div>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '0.66rem',
        letterSpacing: '0.08em',
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        marginBottom: 8,
      }}>
        {label}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {values.map(value => (
          <Chip key={value} active={selected.includes(value)} onClick={() => onToggle(value)} dot={dotFor?.(value)}>
            {value}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function SelectFilter({
  label,
  value,
  options,
  allLabel,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  allLabel: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '0.66rem',
        letterSpacing: '0.08em',
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        marginBottom: 8,
      }}>
        {label}
      </div>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{
          width: '100%',
          minHeight: 32,
          padding: '0.38rem 2rem 0.38rem 0.65rem',
          border: `1px solid ${value ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 6,
          background: value ? 'var(--accent-subtle)' : 'var(--bg-elevated)',
          color: value ? 'var(--accent)' : 'var(--text-secondary)',
          fontSize: '0.75rem',
          fontWeight: 700,
          fontFamily: 'var(--font-body)',
          cursor: 'pointer',
          outline: 'none',
        }}
      >
        <option value="">{allLabel}</option>
        {options.map(option => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </div>
  );
}

const MAX_BUBBLES = 40;

function PipelineRiskMap({ risks }: { risks: RiskDeal[] }) {
  const plotWidth = 760;
  const plotHeight = 280;
  const left = 42;
  const top = 28;
  const right = 28;
  const stageLabels = STAGE_ORDER.filter(stage => risks.some(r => normalizeStage(r.stage) === stage));
  const stages = stageLabels.length ? stageLabels : STAGE_ORDER.slice(0, 6);
  const stageWidth = (plotWidth - left - right) / stages.length;

  // Per-stage counts always reflect the full risks set (so the "(N)" labels
  // under each stage stay accurate even when the bubbles are capped).
  const stageCounts = stages.reduce<Record<string, number>>((acc, stage) => {
    acc[stage] = risks.filter(r => normalizeStage(r.stage) === stage).length;
    return acc;
  }, {});

  // Cap to the top deals by dollar value to keep the chart readable when the
  // active pipeline is large. Largest deals are what leadership cares about.
  const plottedRisks = risks.length > MAX_BUBBLES
    ? [...risks].sort((a, b) => dealValue(b) - dealValue(a)).slice(0, MAX_BUBBLES)
    : risks;
  const truncated = risks.length > MAX_BUBBLES;
  const maxValue = Math.max(...plottedRisks.map(weightedValue), 1);
  const stageOffsets: Record<string, number> = {};
  const points = [...plottedRisks]
    .sort((a, b) => weightedValue(b) - weightedValue(a))
    .map((risk) => {
      const stage = normalizeStage(risk.stage);
      const stageIndex = Math.max(0, stages.indexOf(stage));
      const count = stageOffsets[stage] || 0;
      stageOffsets[stage] = count + 1;
      const columns = Math.min(5, Math.max(1, stageCounts[stage] || 1));
      const column = count % columns;
      const row = Math.floor(count / columns);
      const spread = Math.min(stageWidth * 0.34, 52);
      const columnOffset = columns === 1 ? 0 : (column - (columns - 1) / 2) * (spread / Math.max(1, columns - 1));
      const rowOffset = ((row % 3) - 1) * 7;
      const radius = clamp(5 + Math.sqrt(weightedValue(risk) / maxValue) * 12, 6, 17);
      const score = riskScore(risk);
      return {
        risk,
        score,
        radius,
        band: riskBand(risk),
        x: left + stageWidth * stageIndex + stageWidth / 2 + columnOffset,
        y: clamp(top + plotHeight - (score / 100) * plotHeight + rowOffset, top + radius, top + plotHeight - radius),
      };
    });

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-surface)', padding: '1.25rem' }}>
      <h3 style={{ margin: 0, marginBottom: 4, fontSize: '1rem', fontWeight: 800 }}>Pipeline Risk Map</h3>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
        Risk Score ↑
      </div>
      <svg viewBox={`0 0 ${plotWidth} ${plotHeight + 58}`} role="img" aria-label="Pipeline risk bubble chart" style={{ width: '100%', height: 'auto', display: 'block' }}>
        <rect x={left + stageWidth * Math.max(0, stages.findIndex(isLateStage))} y={top} width={stageWidth * stages.filter(isLateStage).length} height={plotHeight} fill="var(--error-subtle)" opacity="0.35" />
        {[0, 25, 50, 75, 100].map(tick => {
          const y = top + plotHeight - (tick / 100) * plotHeight;
          return (
            <g key={tick}>
              <line x1={left} y1={y} x2={plotWidth - right} y2={y} stroke="var(--border)" strokeWidth="1" opacity="0.7" />
              <text x={12} y={y + 4} fill="var(--text-muted)" fontSize="11">{tick}</text>
            </g>
          );
        })}
        {stages.map((stage, index) => {
          const x = left + stageWidth * index;
          return (
            <g key={stage}>
              <line x1={x} y1={top} x2={x} y2={top + plotHeight} stroke="var(--border)" strokeWidth="1" opacity="0.35" />
              <text
                x={x + stageWidth / 2}
                y={top + plotHeight + 26}
                textAnchor="middle"
                fill="var(--text-secondary)"
                fontSize="11"
                fontWeight={isLateStage(stage) ? 700 : 500}
              >
                {stage}
              </text>
              <text x={x + stageWidth / 2} y={top + plotHeight + 42} textAnchor="middle" fill="var(--text-muted)" fontSize="10">
                ({stageCounts[stage] || 0})
              </text>
            </g>
          );
        })}
        {points.map(({ risk, score, radius, band, x, y }, index) => {
          return (
            <g key={`${risk.id}-${index}`}>
              <circle
                cx={x}
                cy={y}
                r={radius + 2}
                fill="transparent"
                stroke={bandColor[band]}
                strokeOpacity="0.16"
                strokeWidth="4"
              />
              <circle
                cx={x}
                cy={y}
                r={radius}
                fill={bandColor[band]}
                opacity="0.78"
                stroke="var(--bg-surface)"
                strokeWidth="2"
              >
                <title>{`${risk.value}: ${formatCurrency(dealValue(risk))}, risk ${score}`}</title>
              </circle>
            </g>
          );
        })}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', flexWrap: 'wrap', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
        {(['Green', 'Yellow', 'Red'] as RiskBand[]).map(label => (
          <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
            <span style={{ width: 11, height: 11, borderRadius: 999, background: bandColor[label] }} />
            {label}
          </span>
        ))}
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>Bubble = deal $</span>
        {truncated && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
            Showing top {MAX_BUBBLES} of {risks.length} by deal $
          </span>
        )}
      </div>
    </div>
  );
}

function RiskDriversRadar({
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
        <h3 style={{ margin: 0, marginBottom: 4, fontSize: '1rem', fontWeight: 800 }}>Top Risk Drivers</h3>
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.76rem' }}>No risk drivers match the current filters.</div>
      </div>
    );
  }

  return (
    <div>
      <h3 style={{ margin: 0, marginBottom: 4, fontSize: '1rem', fontWeight: 800 }}>Top Risk Drivers</h3>
      <div style={{ color: 'var(--text-secondary)', fontSize: '0.76rem', marginBottom: 10 }}>Driver radar weighted by risk severity and pipeline</div>

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
        <polygon points={polygonPoints} fill="rgba(37, 99, 235, 0.18)" stroke="var(--prism-blue)" strokeWidth="2.5" />
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

function RiskDriverRanking({ dimensions }: { dimensions: RiskDimension[] }) {
  const ranked = [...dimensions].sort((a, b) => b.value - a.value).slice(0, 6);

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-surface)', padding: '1.25rem' }}>
      <h3 style={{ margin: 0, marginBottom: 4, fontSize: '1rem', fontWeight: 800 }}>Risk Driver Ranking</h3>
      <div style={{ color: 'var(--text-secondary)', fontSize: '0.76rem', marginBottom: 16 }}>Highest normalized driver scores</div>
      <div style={{ display: 'grid', gap: 13 }}>
        {ranked.map((driver, index) => {
          const width = Math.max(8, driver.value);
          return (
            <div key={driver.label} style={{ display: 'grid', gridTemplateColumns: '18px 1fr auto', gap: 10, alignItems: 'center', fontSize: '0.78rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>{index + 1}</span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', color: 'var(--text-primary)', fontWeight: 750, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{driver.label}</span>
                <span style={{ display: 'block', height: 6, marginTop: 6, background: 'var(--bg-elevated)', borderRadius: 999, overflow: 'hidden' }}>
                  <span style={{ display: 'block', width: `${width}%`, height: '100%', background: 'var(--prism-blue)', borderRadius: 999 }} />
                </span>
              </span>
              <span style={{ color: 'var(--prism-blue)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem', fontWeight: 800 }}>
                {driver.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LateStageDealsStrip({ risks }: { risks: RiskDeal[] }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-surface)', padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '1rem', marginBottom: 14 }}>
        <div>
          <h3 style={{ margin: 0, marginBottom: 4, fontSize: '1rem', fontWeight: 800 }}>Most At-Risk Late-Stage Deals</h3>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.76rem' }}>Proposal, Negotiation, Commit, Contract Review, Approved stages</div>
        </div>
        <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>{risks.length} shown</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
        {risks.map(risk => {
          const band = riskBand(risk);
          return (
            <div key={`${risk.id}-${risk.value}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, padding: '0.9rem', borderRadius: 7, background: 'var(--bg-elevated)', borderLeft: `3px solid ${bandColor[band]}` }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: '0.82rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{risk.value}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: 4 }}>
                  {normalizeStage(risk.stage)} · {risk.rep || 'Unassigned'}
                </div>
              </div>
              <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
                <div style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{formatCurrency(dealValue(risk))}</div>
                <div style={{ color: bandColor[band], marginTop: 4 }}>Risk: {riskScore(risk)}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const RiskRadar: React.FC<Props> = ({ risks, onFilteredRisksChange, deltaIntelligence, dealsError }) => {
  const [selectedDeal, setSelectedDeal] = useState<RiskDeal | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [lateOnly, setLateOnly] = useState(false);
  const [hideReviewed, setHideReviewed] = useState(false);
  const [filters, setFilters] = useState<Record<FilterGroup, string[]>>({
    stages: [],
    reps: [],
    regions: [],
    bands: [],
  });

  const { reviewed, isReviewed, toggleReview } = useDealReviews();

  // Filter-aware deteriorated count: cross-references the AI delta data against
  // the active region and rep filters so the badge reflects the current view.
  const deterioratedCount = useMemo(() => {
    const deteriorated = deltaIntelligence?.significantDealChanges?.deteriorated ?? [];
    if (!deteriorated.length) return 0;
    if (filters.regions.length === 0 && filters.reps.length === 0) return deteriorated.length;
    return deteriorated.filter(d => {
      if (filters.regions.length > 0 && !filters.regions.includes(regionLabel(d.region))) return false;
      if (filters.reps.length > 0 && !filters.reps.includes(d.rep)) return false;
      return true;
    }).length;
  }, [deltaIntelligence, filters.regions, filters.reps]);

  const options = useMemo(() => {
    const stageSet = new Set<string>();
    const repSet = new Set<string>();
    const regionSet = new Set<string>();
    risks.forEach(risk => {
      if (matchesFilters(risk, filters, lateOnly, 'stages')) {
        stageSet.add(normalizeStage(risk.stage));
      }
      if (matchesFilters(risk, filters, lateOnly, 'reps')) {
        repSet.add(risk.rep || 'Unassigned');
      }
      if (matchesFilters(risk, filters, lateOnly, 'regions')) {
        regionSet.add(regionLabel(risk.region));
      }
    });
    const stages = STAGE_ORDER.filter(stage => stageSet.has(stage));
    const extraStages = [...stageSet].filter(stage => !STAGE_ORDER.includes(stage)).sort();
    const regions = REGION_LABEL_ORDER.filter(region => regionSet.has(region));
    const extraRegions = [...regionSet].filter(region => !REGION_LABEL_ORDER.includes(region)).sort();
    return {
      stages: [...stages, ...extraStages],
      reps: [...repSet].sort(),
      regions: [...regions, ...extraRegions],
      bands: ['Green', 'Yellow', 'Red'],
    };
  }, [risks, filters, lateOnly]);

  useEffect(() => {
    if (filters.reps.length && !options.reps.includes(filters.reps[0])) {
      setFilters(current => ({ ...current, reps: [] }));
    }
  }, [filters.reps, options.reps]);

  const filteredRisks = useMemo(() => {
    return risks.filter(risk => matchesFilters(risk, filters, lateOnly));
  }, [filters, lateOnly, risks]);

  const visibleFilteredRisks = useMemo(() => {
    return hideReviewed
      ? filteredRisks.filter(r => !isReviewed(r.opportunityId || r.value))
      : filteredRisks;
  }, [filteredRisks, hideReviewed, isReviewed]);

  const isFiltered = filters.stages.length > 0 || filters.reps.length > 0 || filters.regions.length > 0 || filters.bands.length > 0 || lateOnly;

  useEffect(() => {
    // Always fire with filteredRisks (not visibleFilteredRisks) so stats row
    // is unaffected by the hide-reviewed toggle.
    onFilteredRisksChange?.(filteredRisks, isFiltered);
  }, [filteredRisks, isFiltered, onFilteredRisksChange]);

  const summary = useMemo(() => {
    const totalWeight = filteredRisks.reduce((sum, r) => sum + weightedValue(r), 0);
    const valueTotal = filteredRisks.reduce((sum, r) => sum + dealValue(r), 0);
    const distribution = (['Green', 'Yellow', 'Red'] as RiskBand[]).map(label => {
      const value = filteredRisks.filter(r => riskBand(r) === label).reduce((sum, r) => sum + weightedValue(r), 0);
      const pipeline = filteredRisks.filter(r => riskBand(r) === label).reduce((sum, r) => sum + dealValue(r), 0);
      return { label, value, pipeline, pct: percent(value, totalWeight) };
    });
    const confidence = totalWeight
      ? Math.round(filteredRisks.reduce((sum, r) => sum + (100 - riskScore(r)) * weightedValue(r), 0) / totalWeight)
      : 0;
    const drivers = Object.entries(filteredRisks.reduce<Record<string, number>>((acc, risk) => {
      const driver = classifySignal(`${risk.summary} ${risk.action}`);
      acc[driver] = (acc[driver] || 0) + weightedValue(risk);
      return acc;
    }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const dimensions = buildRiskDimensions(filteredRisks);
    return { totalWeight, valueTotal, distribution, confidence, drivers, dimensions };
  }, [filteredRisks]);

  const lateStageRisks = visibleFilteredRisks
    .filter(risk => isLateStage(risk.stage))
    .sort((a, b) => riskScore(b) - riskScore(a) || weightedValue(b) - weightedValue(a))
    .slice(0, 5);

  const visibleRisks = (showAll ? visibleFilteredRisks : visibleFilteredRisks.slice(0, MAX_DEALS));

  const toggleFilter = (group: FilterGroup, value: string) => {
    setFilters(current => ({ ...current, [group]: toggleList(current[group], value) }));
  };

  const selectRep = (value: string) => {
    setFilters(current => ({ ...current, reps: value ? [value] : [] }));
  };

  if (risks.length === 0) {
    return (
      <div style={{ padding: '1.5rem', color: dealsError ? 'var(--error)' : 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
        {dealsError ? `Could not load deals: ${dealsError}` : 'No active risks detected in the current report.'}
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      {dealsError && (
        <div style={{
          padding: '0.6rem 0.85rem',
          borderRadius: 6,
          background: 'var(--error-subtle)',
          border: '1px solid var(--error)',
          fontSize: '0.78rem',
          fontFamily: 'var(--font-mono)',
          color: 'var(--error)',
        }}>
          Could not load deals: {dealsError} — showing the capped list embedded in the report.
        </div>
      )}
      {deterioratedCount > 0 && (
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '0.4rem 0.85rem',
          borderRadius: 6,
          background: 'var(--error-subtle)',
          border: '1px solid var(--error)',
          fontSize: '0.78rem',
          fontFamily: 'var(--font-mono)',
          color: 'var(--error)',
          fontWeight: 700,
          alignSelf: 'flex-start',
        }}>
          ↓ {deterioratedCount} deal{deterioratedCount !== 1 ? 's' : ''} deteriorated since last run
        </div>
      )}
      {reviewed.size > 0 && (
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.72rem',
          color: 'var(--success)',
          alignSelf: 'flex-start',
        }}>
          ✓ {reviewed.size} deal{reviewed.size !== 1 ? 's' : ''} marked as reviewed
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-surface)', padding: '1.25rem' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>
            Revenue Confidence
          </div>
          {(() => {
            const conf = summary.confidence;
            const arcColor = conf >= 70 ? 'var(--success)' : conf >= 40 ? 'var(--warning)' : 'var(--error)';
            const cx = 80, cy = 80, r = 60;
            // Foreground arc: sweeps from 180° (left) toward 0° (right) proportional to conf/100
            const angle = Math.PI - (conf / 100) * Math.PI;
            const endX = cx + r * Math.cos(angle);
            const endY = cy - r * Math.sin(angle);
            const largeArcFlag = conf > 50 ? 1 : 0;
            const fgPath = `M ${cx - r} ${cy} A ${r} ${r} 0 ${largeArcFlag} 1 ${endX.toFixed(2)} ${endY.toFixed(2)}`;
            return (
              <svg viewBox="0 0 160 90" style={{ width: '100%', maxWidth: 160, display: 'block' }} aria-label={`Revenue confidence: ${conf} out of 100`}>
                {/* Background arc */}
                <path
                  d={`M 20 80 A 60 60 0 0 1 140 80`}
                  fill="none"
                  stroke="var(--border)"
                  strokeWidth={10}
                  strokeLinecap="round"
                />
                {/* Foreground arc */}
                {conf > 0 && (
                  <path
                    d={fgPath}
                    fill="none"
                    stroke={arcColor}
                    strokeWidth={10}
                    strokeLinecap="round"
                  />
                )}
                {/* Confidence number */}
                <text
                  x={cx}
                  y={cy - 2}
                  textAnchor="middle"
                  dominantBaseline="auto"
                  fontSize={28}
                  fontWeight={850}
                  fill={arcColor}
                  fontFamily="inherit"
                >
                  {conf}
                </text>
                {/* /100 label */}
                <text
                  x={cx}
                  y={cy + 14}
                  textAnchor="middle"
                  dominantBaseline="auto"
                  fontSize={11}
                  fill="var(--text-muted)"
                  fontFamily="inherit"
                >
                  /100
                </text>
              </svg>
            );
          })()}
          <div style={{ marginTop: 4, color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
            Weighted by deal value
          </div>
        </div>

        <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-surface)', padding: '1.25rem' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 14 }}>
            Risk Distribution by Pipeline Value
          </div>
          <div style={{ display: 'flex', height: 25, borderRadius: 6, overflow: 'hidden', background: 'var(--bg-elevated)' }}>
            {summary.distribution.map(item => (
              <div
                key={item.label}
                style={{
                  width: `${Math.max(item.pct, item.value ? 4 : 0)}%`,
                  background: bandColor[item.label],
                  minWidth: item.value ? 18 : 0,
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: '1.3rem', flexWrap: 'wrap', marginTop: 14 }}>
            {summary.distribution.map(item => (
              <span key={item.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                <span style={{ width: 10, height: 10, borderRadius: 999, background: bandColor[item.label] }} />
                <strong style={{ color: 'var(--text-primary)' }}>{item.pct}%</strong>
                {summary.valueTotal > 0 ? formatCurrency(item.pipeline) : `${Math.round(item.value)} deals`}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-surface)', padding: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, color: 'var(--text-primary)', fontWeight: 800, fontSize: '0.9rem' }}>
          <span style={{ fontSize: '0.95rem' }}>▿</span>
          Filters
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', alignItems: 'start' }}>
          <FilterBlock label="Stage" values={options.stages} selected={filters.stages} onToggle={value => toggleFilter('stages', value)} />
          <SelectFilter label="Rep" value={filters.reps[0] || ''} options={options.reps} allLabel="All reps" onChange={selectRep} />
          <FilterBlock label="Region" values={options.regions} selected={filters.regions} onToggle={value => toggleFilter('regions', value)} />
          <FilterBlock label="Risk Level" values={options.bands} selected={filters.bands} onToggle={value => toggleFilter('bands', value)} dotFor={value => bandColor[value as RiskBand]} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 14 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.66rem', letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
              Quick Filter
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Chip active={lateOnly} onClick={() => setLateOnly(!lateOnly)}>Late-stage only</Chip>
              <Chip active={hideReviewed} onClick={() => setHideReviewed(!hideReviewed)}>Hide reviewed</Chip>
            </div>
          </div>
          <button
            onClick={() => exportToCSV(filteredRisks)}
            disabled={filteredRisks.length === 0}
            style={{
              padding: '0.38rem 0.85rem',
              border: '1px solid var(--border)',
              borderRadius: 6,
              background: 'var(--bg-elevated)',
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.72rem',
              cursor: filteredRisks.length === 0 ? 'not-allowed' : 'pointer',
              opacity: filteredRisks.length === 0 ? 0.4 : 1,
            }}
          >
            Export CSV ({filteredRisks.length})
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(420px, 1.55fr) minmax(300px, 0.85fr) minmax(280px, 0.8fr)', gap: '1rem' }}>
        <PipelineRiskMap risks={filteredRisks} />

        <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-surface)', padding: '1.25rem', display: 'grid', gap: '1.5rem' }}>
          <RiskDriversRadar dimensions={summary.dimensions} valueTotal={summary.valueTotal} />
        </div>

        <RiskDriverRanking dimensions={summary.dimensions} />
      </div>

      <LateStageDealsStrip risks={lateStageRisks.length ? lateStageRisks : filteredRisks.slice(0, 5)} />

      {visibleFilteredRisks.length === 0 ? (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '1.25rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
          {filteredRisks.length > 0 && hideReviewed
            ? `All ${filteredRisks.length} deal${filteredRisks.length !== 1 ? 's' : ''} have been reviewed.`
            : 'No deals match the active filters.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '0.85rem' }}>
          {visibleRisks.map((risk, index) => {
            const band = riskBand(risk);
            const reviewKey = risk.opportunityId || risk.value;
            const dealReviewed = isReviewed(reviewKey);
            return (
              <button
                key={`${risk.id}-${index}`}
                onClick={() => setSelectedDeal(risk)}
                style={{
                  textAlign: 'left',
                  padding: '1rem',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  background: 'var(--bg-surface)',
                  cursor: 'pointer',
                  borderLeft: `4px solid ${bandColor[band]}`,
                  boxShadow: 'none',
                  transition: 'box-shadow 0.15s ease, transform 0.15s ease, opacity 0.15s ease',
                  opacity: dealReviewed ? 0.65 : 1,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.65rem' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 4, flexWrap: 'wrap' }}>
                      <Badge variant={band === 'Red' ? 'high' : band === 'Yellow' ? 'medium' : 'low'}>{band}</Badge>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>{regionLabel(risk.region)}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>{normalizeStage(risk.stage)}</span>
                    </div>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: '0.92rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {risk.value}
                    </div>
                  </div>
                  {/* Reviewed toggle — stopPropagation so it doesn't open the modal */}
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      toggleReview(reviewKey);
                    }}
                    title={dealReviewed ? 'Mark as not reviewed' : 'Mark as reviewed'}
                    style={{
                      background: 'none',
                      border: `1px solid ${dealReviewed ? 'var(--success)' : 'var(--border)'}`,
                      borderRadius: 4,
                      padding: '2px 7px',
                      fontSize: '0.65rem',
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      color: dealReviewed ? 'var(--success)' : 'var(--text-muted)',
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    {dealReviewed ? '✓ Reviewed' : 'Review'}
                  </button>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 4 }}>Risk</div>
                    <div style={{ color: bandColor[band], fontWeight: 850 }}>{riskScore(risk)}</div>
                  </div>
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  {risk.summary}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {visibleFilteredRisks.length > MAX_DEALS && (
        <button
          onClick={() => setShowAll(!showAll)}
          style={{
            justifySelf: 'center',
            padding: '0.55rem 1rem',
            border: '1px solid var(--border)',
            borderRadius: 6,
            background: 'var(--bg-elevated)',
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            cursor: 'pointer',
          }}
        >
          {showAll ? 'Show top risks only' : `Show all ${visibleFilteredRisks.length} risks`}
        </button>
      )}
      <DealDetailModal deal={selectedDeal} onClose={() => setSelectedDeal(null)} />
    </div>
  );
};
