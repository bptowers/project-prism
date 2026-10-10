import React from 'react';
import type { RiskDeal, StatData } from '@/lib/types';
import { formatCurrency } from '@/lib/format';
import { isMisaligned, isUnderivableRate } from '@/lib/dealClassifiers';

interface Props {
  risks: RiskDeal[];
  forecastStat: StatData;
}

export const ForecastIntegrity: React.FC<Props> = ({ risks, forecastStat }) => {
  const misaligned = risks.filter(isMisaligned);
  const forecastUnavailable = isUnderivableRate(forecastStat.value);

  const misalignedPipelineValue = misaligned.reduce((sum, r) => sum + (r.pipelineValue ?? 0), 0);

  const dirColor = forecastStat.dir === 'up' ? 'var(--success)' : forecastStat.dir === 'down' ? 'var(--error)' : 'var(--text-muted)';
  const dirArrow = forecastStat.dir === 'up' ? '▲' : forecastStat.dir === 'down' ? '▼' : '—';

  if (risks.length === 0) {
    return (
      <div style={{
        padding: '2rem',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.8rem',
      }}>
        No forecast data available
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '0.75rem 1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.65rem',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: 2,
          }}>
            Forecast Confidence
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: '1.75rem',
              fontWeight: 700,
              color: forecastUnavailable ? 'var(--text-muted)' : 'var(--text-primary)',
              lineHeight: 1,
            }}>
              {forecastUnavailable ? 'n/a' : forecastStat.value}
            </span>
            {!forecastUnavailable && (
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.75rem',
                color: dirColor,
                fontWeight: 600,
              }}>
                {dirArrow} {forecastStat.change}
              </span>
            )}
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.65rem',
            color: 'var(--text-muted)',
            marginTop: 2,
          }}>
            {forecastUnavailable ? 'no closed deals in source' : forecastStat.sub}
          </div>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.65rem',
            color: 'var(--text-muted)',
            marginBottom: 2,
          }}>
            Misaligned
          </div>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.75rem',
            fontWeight: 700,
            color: misaligned.length > 0 ? 'var(--error)' : 'var(--success)',
            lineHeight: 1,
          }}>
            {misaligned.length}
          </div>
          {misalignedPipelineValue > 0 && (
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.65rem',
              color: 'var(--error)',
              marginTop: 2,
            }}>
              {formatCurrency(misalignedPipelineValue)}
            </div>
          )}
        </div>
      </div>

      {misaligned.length === 0 ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '0.6rem 0.75rem',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          borderLeft: '3px solid var(--success)',
        }}>
          <span style={{ color: 'var(--success)', fontSize: '0.85rem' }}>✓</span>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            color: 'var(--success)',
            fontWeight: 600,
          }}>
            Forecast looks clean
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.65rem',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            paddingBottom: '0.25rem',
            borderBottom: '1px solid var(--border)',
          }}>
            High confidence / poor health
          </div>
          {misaligned.slice(0, 5).map(r => (
            <div
              key={r.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.5rem 0.6rem',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                borderLeft: '3px solid var(--error)',
                gap: '0.5rem',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {r.value}
                </div>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.62rem',
                  color: 'var(--text-muted)',
                  marginTop: 1,
                }}>
                  {[r.rep, r.stage].filter(Boolean).join(' · ') || r.region}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.68rem',
                  color: 'var(--text-muted)',
                }}>
                  {r.confidence}% conf
                </div>
                {r.healthScore !== undefined && (
                  <div style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.62rem',
                    color: 'var(--error)',
                  }}>
                    health {r.healthScore}
                  </div>
                )}
              </div>
            </div>
          ))}
          {misaligned.length > 5 && (
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '0.65rem',
              color: 'var(--text-muted)',
              textAlign: 'center',
              paddingTop: '0.25rem',
            }}>
              +{misaligned.length - 5} more
            </div>
          )}
        </div>
      )}
    </div>
  );
};
