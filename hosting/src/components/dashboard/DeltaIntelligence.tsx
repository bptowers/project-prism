import React from 'react';
import { motion } from 'framer-motion';
import { itemVariants, cardHover } from '@/theme/animations';
import { Badge } from '@/components/ui/Badge';
import type { DeltaIntelligenceData } from '@/lib/types';

interface Props { data?: DeltaIntelligenceData; }

const DIRECTION_BADGE: Record<string, { variant: 'success' | 'medium' | 'high'; label: string }> = {
  improving: { variant: 'success', label: 'IMPROVING' },
  stable: { variant: 'medium', label: 'STABLE' },
  declining: { variant: 'high', label: 'DECLINING' },
};

const SEVERITY_BADGE: Record<string, 'high' | 'medium' | 'low'> = {
  critical: 'high',
  important: 'medium',
  watch: 'low',
};

export const DeltaIntelligence: React.FC<Props> = ({ data }) => {
  if (!data) return null;

  const trajectory = data.pipelineTrajectory;
  const hasContent = trajectory || data.earlyWarnings?.length || data.forecastDrift;
  if (!hasContent) return null;

  return (
    <motion.div variants={itemVariants} style={{ marginBottom: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '1rem' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
          Delta Intelligence
        </h3>
        {data.comparedTo && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            vs {data.comparedTo}{data.daysBetween ? ` (${data.daysBetween}d)` : ''}
          </span>
        )}
      </div>

      {/* Pipeline Trajectory */}
      {trajectory && (
        <motion.div
          whileHover={cardHover}
          style={{
            padding: '1.25rem',
            border: '1px solid var(--border)',
            borderRadius: 8,
            background: 'var(--bg-elevated)',
            marginBottom: '1.5rem',
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            {trajectory.direction && (
              <Badge variant={DIRECTION_BADGE[trajectory.direction]?.variant ?? 'medium'}>
                {DIRECTION_BADGE[trajectory.direction]?.label ?? trajectory.direction.toUpperCase()}
              </Badge>
            )}
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{trajectory.headline}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
            {trajectory.pipelineMrrDelta && (
              <div>
                <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>MRR Delta</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 700, color: trajectory.pipelineMrrDelta.startsWith('+') ? 'var(--success)' : trajectory.pipelineMrrDelta.startsWith('-') ? 'var(--error)' : 'var(--text-primary)' }}>
                  {trajectory.pipelineMrrDelta}
                </div>
              </div>
            )}
            {trajectory.activeDealsChange && (
              <div>
                <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Deals</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{trajectory.activeDealsChange}</div>
              </div>
            )}
            {trajectory.winRateChange && (
              <div>
                <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Win Rate</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{trajectory.winRateChange}</div>
              </div>
            )}
          </div>
          {trajectory.riskTrajectory && (
            <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              {trajectory.riskTrajectory}
            </div>
          )}
        </motion.div>
      )}

      {/* Deal Changes — Improved & Deteriorated */}
      {data.significantDealChanges && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          {/* Improved */}
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--success)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Improved ({data.significantDealChanges.improved?.length ?? 0})
            </div>
            {data.significantDealChanges.improved?.map((deal, i) => (
              <div key={i} style={{ padding: '0.75rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-elevated)', marginBottom: '0.5rem', borderLeft: '3px solid var(--success)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{deal.deal}</span>
                  <Badge variant="info">{deal.region}</Badge>
                </div>
                <div style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{deal.rep}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{deal.change}</div>
              </div>
            ))}
          </div>
          {/* Deteriorated */}
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--error)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Deteriorated ({data.significantDealChanges.deteriorated?.length ?? 0})
            </div>
            {data.significantDealChanges.deteriorated?.map((deal, i) => (
              <div key={i} style={{ padding: '0.75rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-elevated)', marginBottom: '0.5rem', borderLeft: '3px solid var(--error)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>{deal.deal}</span>
                  <Badge variant="info">{deal.region}</Badge>
                  {deal.urgency && <Badge variant={deal.urgency === 'P1' ? 'high' : deal.urgency === 'P2' ? 'medium' : 'low'}>{deal.urgency}</Badge>}
                </div>
                <div style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{deal.rep}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{deal.change}</div>
                {deal.interventionNeeded && (
                  <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600 }}>{deal.interventionNeeded}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Forecast Drift */}
      {data.forecastDrift && (
        <motion.div
          whileHover={cardHover}
          style={{
            padding: '1rem',
            border: '1px solid var(--border)',
            borderRadius: 8,
            background: 'var(--bg-elevated)',
            marginBottom: '1.5rem',
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Forecast Drift</div>
            {data.forecastDrift.driftDirection && (
              <Badge variant={DIRECTION_BADGE[data.forecastDrift.driftDirection]?.variant ?? 'medium'}>
                {DIRECTION_BADGE[data.forecastDrift.driftDirection]?.label ?? data.forecastDrift.driftDirection.toUpperCase()}
              </Badge>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '0.75rem' }}>
            <div>
              <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Previous</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{data.forecastDrift.previousRealistic}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Current</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{data.forecastDrift.currentRealistic}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Delta</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', fontWeight: 700, color: data.forecastDrift.delta?.startsWith('+') ? 'var(--success)' : data.forecastDrift.delta?.startsWith('-') ? 'var(--error)' : 'var(--text-primary)' }}>
                {data.forecastDrift.delta}
              </div>
            </div>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{data.forecastDrift.primaryCause}</div>
          {data.forecastDrift.quarterEndProjection && (
            <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', background: 'var(--accent-subtle)', borderRadius: 4, fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600 }}>
              Quarter-end: {data.forecastDrift.quarterEndProjection}
            </div>
          )}
        </motion.div>
      )}

      {/* Regional Trajectory */}
      {data.regionalTrajectory && data.regionalTrajectory.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {data.regionalTrajectory.map((rt, i) => (
            <div key={i} style={{ padding: '0.75rem 1rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-elevated)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <Badge variant="info">{rt.region}</Badge>
                <Badge variant={DIRECTION_BADGE[rt.direction]?.variant ?? 'medium'}>
                  {DIRECTION_BADGE[rt.direction]?.label ?? rt.direction.toUpperCase()}
                </Badge>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{rt.keyChange}</div>
            </div>
          ))}
        </div>
      )}

      {/* Early Warnings */}
      {data.earlyWarnings && data.earlyWarnings.length > 0 && (
        <>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--error)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Early Warnings
          </div>
          {data.earlyWarnings.map((w, i) => (
            <div
              key={i}
              style={{
                padding: '0.75rem 1rem',
                border: '1px solid var(--border)',
                borderRadius: 8,
                background: 'var(--bg-elevated)',
                marginBottom: '0.5rem',
                borderLeft: `3px solid ${w.severity === 'critical' ? 'var(--error)' : w.severity === 'important' ? 'var(--warning)' : 'var(--prism-blue)'}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Badge variant={SEVERITY_BADGE[w.severity] ?? 'low'}>{w.severity.toUpperCase()}</Badge>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{w.signal}</span>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--error)', fontWeight: 600 }}>{w.affectedMrr}</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600 }}>{w.recommendedAction}</div>
            </div>
          ))}
        </>
      )}

      {/* Competitive Momentum */}
      {data.competitiveMomentumShift && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
          {data.competitiveMomentumShift.gaining?.length > 0 && (
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--error)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Competitors Gaining
              </div>
              {data.competitiveMomentumShift.gaining.map((c, i) => (
                <div key={i} style={{ padding: '0.5rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-elevated)', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-primary)' }}>{c.competitor}</span>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>{c.evidence}</div>
                </div>
              ))}
            </div>
          )}
          {data.competitiveMomentumShift.losing?.length > 0 && (
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--success)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Competitors Fading
              </div>
              {data.competitiveMomentumShift.losing.map((c, i) => (
                <div key={i} style={{ padding: '0.5rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-elevated)', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-primary)' }}>{c.competitor}</span>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>{c.evidence}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};
