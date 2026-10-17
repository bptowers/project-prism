import React from 'react';
import { RiskDeal } from '@/lib/types';
import { formatValue } from '@/lib/format';
import { repName } from '@/lib/dealFilters';

interface Props {
  risks: RiskDeal[];
  /** Opens the Deals tab filtered to this rep. */
  onRepClick: (rep: string) => void;
}

interface RepRow {
  name: string;
  avgHealthScore: number | null;
  dealCount: number;
  atRiskCount: number;
  totalPipeline: number;
  highCount: number;
}

function healthColor(score: number | null): string {
  if (score === null) return 'var(--border)';
  if (score >= 70) return 'var(--success)';
  if (score >= 40) return 'var(--warning)';
  return 'var(--error)';
}

export function RepHeatmap({ risks, onRepClick }: Props) {
  if (risks.length === 0) {
    return (
      <div style={{ minWidth: 0 }}>
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)',
            fontSize: '0.82rem',
            margin: 0,
          }}
        >
          No deal data available.
        </p>
      </div>
    );
  }

  // Group by rep
  const repMap = new Map<string, RiskDeal[]>();
  for (const risk of risks) {
    // Same key as the Deals tab's rep filter, so a click-through lists exactly these deals.
    const name = repName(risk);
    const existing = repMap.get(name) ?? [];
    existing.push(risk);
    repMap.set(name, existing);
  }

  const rows: RepRow[] = [];
  for (const [name, deals] of repMap.entries()) {
    if (name === 'Unassigned' && deals.length === 0) continue;

    const scoredDeals = deals.filter(
      (d) => typeof d.healthScore === 'number' && !isNaN(d.healthScore)
    );
    const avgHealthScore =
      scoredDeals.length > 0
        ? scoredDeals.reduce((sum, d) => sum + (d.healthScore as number), 0) /
          scoredDeals.length
        : null;

    rows.push({
      name,
      avgHealthScore: avgHealthScore !== null ? Math.round(avgHealthScore) : null,
      dealCount: deals.length,
      atRiskCount: deals.filter(
        (d) => d.level === 'HIGH' || d.level === 'MEDIUM'
      ).length,
      totalPipeline: deals.reduce((sum, d) => sum + (d.pipelineValue ?? 0), 0),
      highCount: deals.filter((d) => d.level === 'HIGH').length,
    });
  }

  // Sort: null avgHealthScore goes to bottom, otherwise ascending (riskiest first)
  rows.sort((a, b) => {
    if (a.avgHealthScore === null && b.avgHealthScore === null) return 0;
    if (a.avgHealthScore === null) return 1;
    if (b.avgHealthScore === null) return -1;
    return a.avgHealthScore - b.avgHealthScore;
  });

  const hasPipeline = rows.some((r) => r.totalPipeline > 0);
  const gridColumns = hasPipeline
    ? '180px 1fr auto auto auto'
    : '180px 1fr auto auto';

  return (
    // Rows keep their columns at phone width and scroll inside the panel instead of widening the page.
    <div style={{ minWidth: 0, overflowX: 'auto' }}>
      {/* Table */}
      <div style={{ minWidth: 'max-content' }}>
        {rows.map((row, idx) => {
          const isLast = idx === rows.length - 1;
          const isAlt = idx % 2 === 1;
          const color = healthColor(row.avgHealthScore);
          const barFill =
            row.avgHealthScore !== null
              ? (row.avgHealthScore / 100) * 120
              : 0;

          return (
            <button
              key={row.name}
              type="button"
              onClick={() => onRepClick(row.name)}
              aria-label={`Show deals for ${row.name}`}
              style={{
                border: 'none',
                width: '100%',
                textAlign: 'left',
                font: 'inherit',
                color: 'inherit',
                cursor: 'pointer',
                display: 'grid',
                gridTemplateColumns: gridColumns,
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.65rem 0.5rem',
                minHeight: 44,
                background: isAlt ? 'var(--bg-elevated)' : 'transparent',
                borderBottom: isLast ? 'none' : '1px solid var(--border)',
                borderRadius: isAlt ? 4 : 0,
              }}
            >
              {/* Col 1: Rep name */}
              <div
                style={{
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-body)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: 180,
                }}
                title={row.name}
              >
                {row.name}
              </div>

              {/* Col 2: Health bar + score */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <div
                  style={{
                    width: 120,
                    height: 6,
                    borderRadius: 999,
                    background: 'var(--bg-elevated)',
                    flexShrink: 0,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: barFill,
                      height: '100%',
                      borderRadius: 999,
                      background: color,
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
                {row.avgHealthScore !== null ? (
                  <span
                    style={{
                      color,
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      minWidth: 24,
                    }}
                  >
                    {row.avgHealthScore}
                  </span>
                ) : (
                  <span
                    style={{
                      color: 'var(--text-muted)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.78rem',
                      minWidth: 24,
                    }}
                  >
                    —
                  </span>
                )}
              </div>

              {/* Col 3: At-risk badge */}
              <div>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '0.2rem 0.5rem',
                    borderRadius: 999,
                    fontSize: '0.72rem',
                    fontFamily: 'var(--font-body)',
                    fontWeight: 600,
                    background:
                      row.atRiskCount > 0
                        ? 'var(--error-subtle)'
                        : 'transparent',
                    color:
                      row.atRiskCount > 0
                        ? 'var(--error)'
                        : 'var(--text-muted)',
                    border:
                      row.atRiskCount === 0
                        ? '1px solid var(--border)'
                        : 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {row.atRiskCount} at risk
                </span>
              </div>

              {/* Col 4: Pipeline value (conditional) */}
              {hasPipeline && (
                <div
                  style={{
                    color: 'var(--text-secondary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.78rem',
                    whiteSpace: 'nowrap',
                    textAlign: 'right',
                  }}
                >
                  {formatValue(row.totalPipeline, row.dealCount)}
                </div>
              )}

              {/* Col 5: Deal count */}
              <div
                style={{
                  color: 'var(--text-muted)',
                  fontSize: '0.72rem',
                  fontFamily: 'var(--font-body)',
                  whiteSpace: 'nowrap',
                  textAlign: 'right',
                }}
              >
                {row.dealCount} {row.dealCount === 1 ? 'deal' : 'deals'}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default RepHeatmap;
