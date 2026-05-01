import React, { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import type { RiskDeal } from '@/lib/types';

interface Props { risks: RiskDeal[]; }

type RiskBand = 'Green' | 'Yellow' | 'Red';
type FilterGroup = 'stages' | 'reps' | 'regions' | 'bands';
type ActiveFilters = Record<FilterGroup, string[]>;

const MAX_DEALS = 12;
const STAGE_ORDER = ['Discovery', 'Qualification', 'Solution', 'Proposal', 'Negotiation', 'Commit', 'Contract Review', 'Approved'];

const bandColor: Record<RiskBand, string> = {
  Green: 'var(--success)',
  Yellow: 'var(--warning)',
  Red: 'var(--error)',
};

function normalizeStage(stage?: string): string {
  if (!stage) return 'Unknown';
  const lower = stage.toLowerCase();
  const match = STAGE_ORDER.find(s => lower.includes(s.toLowerCase()));
  if (lower.includes('signature') || lower.includes('commit')) return 'Commit';
  if (lower.includes('contract')) return 'Contract Review';
  if (lower.includes('draft')) return 'Proposal';
  if (lower.includes('approved')) return 'Approved';
  return match || stage;
}

function isLateStage(stage?: string): boolean {
  const normalized = normalizeStage(stage);
  return ['Proposal', 'Negotiation', 'Commit', 'Contract Review', 'Approved'].includes(normalized);
}

function regionLabel(region?: string): string {
  const lower = (region || '').toLowerCase().trim();
  if (
    lower === 'na' || lower === 'us' || lower === 'usd' || lower === 'cad' || lower === 'namer' ||
    lower.includes('north america')
  ) return 'North America';
  if (
    lower === 'uk' || lower === 'gb' || lower === 'gbp' || lower === 'eu' || lower === 'eur' ||
    lower.includes('united kingdom') || lower.includes('britain') || lower.includes('emea')
  ) return 'UK';
  if (
    lower === 'au' || lower === 'aud' || lower === 'aus' || lower === 'nz' || lower === 'nzd' ||
    lower === 'anz' || lower.includes('australia') || lower.includes('new zealand') || lower.includes('apac')
  ) return 'ANZ';
  return region || 'Unknown';
}

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

function formatCurrency(value: number): string {
  if (value <= 0) return '$0';
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${Math.round(value)}`;
}

function percent(value: number, total: number): number {
  if (!total) return 0;
  return Math.round((value / total) * 100);
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

function toggleList(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter(item => item !== value) : [...list, value];
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

const MAX_BUBBLES = 40;

function PipelineRiskMap({ risks }: { risks: RiskDeal[] }) {
  const plotWidth = 760;
  const plotHeight = 260;
  const left = 42;
  const top = 24;
  const stageLabels = STAGE_ORDER.filter(stage => risks.some(r => normalizeStage(r.stage) === stage));
  const stages = stageLabels.length ? stageLabels : STAGE_ORDER.slice(0, 6);
  const stageWidth = (plotWidth - left - 24) / stages.length;

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

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-surface)', padding: '1.25rem' }}>
      <h3 style={{ margin: 0, marginBottom: 4, fontSize: '1rem', fontWeight: 800 }}>Pipeline Risk Map</h3>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 12 }}>
        Risk Score ↑
      </div>
      <svg viewBox={`0 0 ${plotWidth} ${plotHeight + 52}`} role="img" aria-label="Pipeline risk bubble chart" style={{ width: '100%', height: 'auto', display: 'block' }}>
        <rect x={left + stageWidth * Math.max(0, stages.findIndex(isLateStage))} y={top} width={stageWidth * stages.filter(isLateStage).length} height={plotHeight} fill="var(--error-subtle)" opacity="0.55" />
        {[0, 25, 50, 75, 100].map(tick => {
          const y = top + plotHeight - (tick / 100) * plotHeight;
          return (
            <g key={tick}>
              <line x1={left} y1={y} x2={plotWidth - 24} y2={y} stroke="var(--border)" strokeWidth="1" opacity="0.7" />
              <text x={12} y={y + 4} fill="var(--text-muted)" fontSize="11">{tick}</text>
            </g>
          );
        })}
        {stages.map((stage, index) => {
          const x = left + stageWidth * index;
          return (
            <g key={stage}>
              <line x1={x} y1={top} x2={x} y2={top + plotHeight} stroke="var(--border)" strokeWidth="1" opacity="0.45" />
              <text
                x={x + stageWidth / 2}
                y={top + plotHeight + 24}
                textAnchor="middle"
                fill="var(--text-secondary)"
                fontSize="11"
                fontWeight={isLateStage(stage) ? 700 : 500}
              >
                {stage}
              </text>
              <text x={x + stageWidth / 2} y={top + plotHeight + 40} textAnchor="middle" fill="var(--text-muted)" fontSize="10">
                ({stageCounts[stage] || 0})
              </text>
            </g>
          );
        })}
        {plottedRisks.map((risk, index) => {
          const stage = normalizeStage(risk.stage);
          const stageIndex = Math.max(0, stages.indexOf(stage));
          const jitter = ((index % 7) - 3) * 7;
          const x = left + stageWidth * stageIndex + stageWidth / 2 + jitter;
          const y = top + plotHeight - (riskScore(risk) / 100) * plotHeight;
          const radius = 5 + Math.sqrt(weightedValue(risk) / maxValue) * 14;
          const band = riskBand(risk);
          return (
            <circle
              key={`${risk.id}-${index}`}
              cx={x}
              cy={y}
              r={radius}
              fill={bandColor[band]}
              opacity="0.75"
              stroke="var(--bg-surface)"
              strokeWidth="1.5"
            >
              <title>{`${risk.value}: ${formatCurrency(dealValue(risk))}, risk ${riskScore(risk)}`}</title>
            </circle>
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

export const RiskRadar: React.FC<Props> = ({ risks }) => {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [lateOnly, setLateOnly] = useState(false);
  const [filters, setFilters] = useState<Record<FilterGroup, string[]>>({
    stages: [],
    reps: [],
    regions: [],
    bands: [],
  });

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
    const regionOrder = ['North America', 'UK', 'ANZ'];
    const regions = regionOrder.filter(region => regionSet.has(region));
    const extraRegions = [...regionSet].filter(region => !regionOrder.includes(region)).sort();
    return {
      stages: [...stages, ...extraStages],
      reps: [...repSet].sort(),
      regions: [...regions, ...extraRegions],
      bands: ['Green', 'Yellow', 'Red'],
    };
  }, [risks, filters, lateOnly]);

  const filteredRisks = useMemo(() => {
    return risks.filter(risk => matchesFilters(risk, filters, lateOnly));
  }, [filters, lateOnly, risks]);

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
    return { totalWeight, valueTotal, distribution, confidence, drivers };
  }, [filteredRisks]);

  const lateStageRisks = filteredRisks
    .filter(risk => isLateStage(risk.stage))
    .sort((a, b) => riskScore(b) - riskScore(a) || weightedValue(b) - weightedValue(a))
    .slice(0, 5);

  const visibleRisks = (showAll ? filteredRisks : filteredRisks.slice(0, MAX_DEALS));

  const toggleFilter = (group: FilterGroup, value: string) => {
    setFilters(current => ({ ...current, [group]: toggleList(current[group], value) }));
  };

  if (risks.length === 0) {
    return (
      <div style={{ padding: '1.5rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
        No active risks detected in the current report.
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: '1.25rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}>
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-surface)', padding: '1.25rem' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>
            Revenue Confidence
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: '2.55rem', lineHeight: 1, fontWeight: 850, color: summary.confidence < 50 ? 'var(--warning)' : 'var(--success)' }}>
              {summary.confidence}
            </span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '1.25rem' }}>/100</span>
          </div>
          <div style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: '0.78rem' }}>
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
          <FilterBlock label="Rep" values={options.reps} selected={filters.reps} onToggle={value => toggleFilter('reps', value)} />
          <FilterBlock label="Region" values={options.regions} selected={filters.regions} onToggle={value => toggleFilter('regions', value)} />
          <FilterBlock label="Risk Level" values={options.bands} selected={filters.bands} onToggle={value => toggleFilter('bands', value)} dotFor={value => bandColor[value as RiskBand]} />
        </div>
        <div style={{ marginTop: 14 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.66rem', letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>
            Quick Filter
          </div>
          <Chip active={lateOnly} onClick={() => setLateOnly(!lateOnly)}>Late-stage only</Chip>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
        <PipelineRiskMap risks={filteredRisks} />

        <div style={{ border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-surface)', padding: '1.25rem', display: 'grid', gap: '1.5rem' }}>
          <div>
            <h3 style={{ margin: 0, marginBottom: 4, fontSize: '1rem', fontWeight: 800 }}>Top Risk Drivers</h3>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem', marginBottom: 14 }}>Ranked by pipeline $ at risk</div>
            <div style={{ display: 'grid', gap: 11 }}>
              {summary.drivers.map(([driver, value], index) => (
                <div key={driver} style={{ display: 'grid', gridTemplateColumns: '18px 1fr auto', gap: 10, alignItems: 'center', fontSize: '0.82rem' }}>
                  <span style={{ color: 'var(--text-muted)' }}>{index + 1}</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{driver}</span>
                  <span style={{ color: 'var(--error)', fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
                    {summary.valueTotal > 0 ? formatCurrency(value) : `${Math.round(value)} deals`}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 style={{ margin: 0, marginBottom: 4, fontSize: '1rem', fontWeight: 800 }}>Most At-Risk Late-Stage Deals</h3>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.76rem', marginBottom: 14 }}>Proposal, Negotiation, Commit stages</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {(lateStageRisks.length ? lateStageRisks : filteredRisks.slice(0, 5)).map(risk => (
                <div key={`${risk.id}-${risk.value}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, padding: '0.85rem', borderRadius: 7, background: 'var(--bg-elevated)' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: '0.82rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{risk.value}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: 3 }}>
                      {normalizeStage(risk.stage)} · {risk.rep || 'Unassigned'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontSize: '0.73rem' }}>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{formatCurrency(dealValue(risk))}</div>
                    <div style={{ color: bandColor[riskBand(risk)], marginTop: 3 }}>Risk: {riskScore(risk)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {filteredRisks.length === 0 ? (
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '1.25rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
          No deals match the active filters.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '0.85rem' }}>
          {visibleRisks.map((risk, index) => {
            const band = riskBand(risk);
            return (
              <button
                key={`${risk.id}-${index}`}
                onClick={() => setExpanded(expanded === index ? null : index)}
                style={{
                  textAlign: 'left',
                  padding: '1rem',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  background: 'var(--bg-surface)',
                  cursor: 'pointer',
                  borderLeft: `4px solid ${bandColor[band]}`,
                  boxShadow: expanded === index ? 'var(--shadow-md)' : 'none',
                  transition: 'box-shadow 0.15s ease, transform 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '0.65rem' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 4, flexWrap: 'wrap' }}>
                      <Badge variant={band === 'Red' ? 'high' : band === 'Yellow' ? 'medium' : 'low'}>{band}</Badge>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>{risk.region}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>{normalizeStage(risk.stage)}</span>
                    </div>
                    <div style={{ color: 'var(--text-primary)', fontWeight: 800, fontSize: '0.92rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {risk.value}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 4 }}>Risk</div>
                    <div style={{ color: bandColor[band], fontWeight: 850 }}>{riskScore(risk)}</div>
                  </div>
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                  {risk.summary}
                </div>
                {expanded === index && (
                  <div style={{ marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border)', display: 'grid', gap: '0.5rem' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Recommended Action
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--accent)', fontWeight: 700 }}>{risk.action}</div>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      {filteredRisks.length > MAX_DEALS && (
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
          {showAll ? 'Show top risks only' : `Show all ${filteredRisks.length} risks`}
        </button>
      )}
    </div>
  );
};
