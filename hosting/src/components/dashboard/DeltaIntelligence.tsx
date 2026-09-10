import React from 'react';
import { motion } from 'framer-motion';
import { itemVariants, cardHover } from '@/theme/animations';
import { Badge } from '@/components/ui/Badge';
import type { DeltaIntelligenceData, DeltaDeal, EarlyWarning } from '@/lib/types';
import { asArray, isRecord } from '@/lib/guards';
import { formatDate } from '@/lib/format';

interface Props { data?: DeltaIntelligenceData; }

/** Safe uppercase for LLM-authored enum-ish strings that may be missing or non-string. */
const upper = (v: unknown): string => String(v ?? '').toUpperCase();
const startsWith = (v: unknown, ch: string): boolean => typeof v === 'string' && v.startsWith(ch);

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

  // LLM-authored payload: coerce every slot to the shape we iterate. Older
  // reports in Firestore may carry prose strings where arrays belong.
  const trajectory = isRecord(data.pipelineTrajectory) ? data.pipelineTrajectory : undefined;
  const forecastDrift = isRecord(data.forecastDrift) ? data.forecastDrift : undefined;
  const regionalTrajectory = asArray<NonNullable<DeltaIntelligenceData['regionalTrajectory']>[number]>(data.regionalTrajectory);
  const earlyWarnings = asArray<EarlyWarning>(data.earlyWarnings);
  const dealChanges = isRecord(data.significantDealChanges)
    ? {
        improved: asArray<DeltaDeal>(data.significantDealChanges.improved),
        deteriorated: asArray<DeltaDeal>(data.significantDealChanges.deteriorated),
      }
    : undefined;
  const momentum = isRecord(data.competitiveMomentumShift)
    ? {
        gaining: asArray<{ competitor: string; evidence: string }>(data.competitiveMomentumShift.gaining),
        losing: asArray<{ competitor: string; evidence: string }>(data.competitiveMomentumShift.losing),
      }
    : undefined;

  const hasContent = trajectory || earlyWarnings.length || forecastDrift;
  if (!hasContent) return null;

  return (
    <motion.div variants={itemVariants} style={{ marginBottom: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '1rem' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
          Delta Intelligence
        </h3>
        {data.comparedTo && (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            vs {formatDate(data.comparedTo)}{data.daysBetween ? ` (${data.daysBetween}d)` : ''}
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
                {DIRECTION_BADGE[trajectory.direction]?.label ?? upper(trajectory.direction)}
              </Badge>
            )}
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{trajectory.headline}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
            {trajectory.pipelineMrrDelta && (
              <div>
                <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>MRR Delta</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 700, color: startsWith(trajectory.pipelineMrrDelta, '+') ? 'var(--success)' : startsWith(trajectory.pipelineMrrDelta, '-') ? 'var(--error)' : 'var(--text-primary)' }}>
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
      {dealChanges && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          {/* Improved */}
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--success)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Improved ({dealChanges.improved?.length ?? 0})
            </div>
            {dealChanges.improved?.map((deal, i) => (
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
              Deteriorated ({dealChanges.deteriorated?.length ?? 0})
            </div>
            {dealChanges.deteriorated?.map((deal, i) => (
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
      {forecastDrift && (
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
            {forecastDrift.driftDirection && (
              <Badge variant={DIRECTION_BADGE[forecastDrift.driftDirection]?.variant ?? 'medium'}>
                {DIRECTION_BADGE[forecastDrift.driftDirection]?.label ?? upper(forecastDrift.driftDirection)}
              </Badge>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '0.75rem' }}>
            <div>
              <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Previous</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{forecastDrift.previousRealistic}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Current</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{forecastDrift.currentRealistic}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Delta</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', fontWeight: 700, color: forecastDrift.delta?.startsWith('+') ? 'var(--success)' : forecastDrift.delta?.startsWith('-') ? 'var(--error)' : 'var(--text-primary)' }}>
                {forecastDrift.delta}
              </div>
            </div>
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{forecastDrift.primaryCause}</div>
          {forecastDrift.quarterEndProjection && (
            <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', background: 'var(--accent-subtle)', borderRadius: 4, fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600 }}>
              Quarter-end: {forecastDrift.quarterEndProjection}
            </div>
          )}
        </motion.div>
      )}

      {/* Regional Trajectory */}
      {regionalTrajectory.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {regionalTrajectory.map((rt, i) => (
            <div key={i} style={{ padding: '0.75rem 1rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-elevated)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                <Badge variant="info">{rt.region}</Badge>
                <Badge variant={DIRECTION_BADGE[rt.direction]?.variant ?? 'medium'}>
                  {DIRECTION_BADGE[rt.direction]?.label ?? upper(rt.direction)}
                </Badge>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{rt.keyChange}</div>
            </div>
          ))}
        </div>
      )}

      {/* Early Warnings */}
      {earlyWarnings.length > 0 && (
        <>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--error)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Early Warnings
          </div>
          {earlyWarnings.map((w, i) => (
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
                  <Badge variant={SEVERITY_BADGE[w.severity] ?? 'low'}>{upper(w.severity)}</Badge>
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
      {momentum && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
          {momentum.gaining?.length > 0 && (
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--error)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Competitors Gaining
              </div>
              {momentum.gaining.map((c, i) => (
                <div key={i} style={{ padding: '0.5rem', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--bg-elevated)', marginBottom: '0.5rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-primary)' }}>{c.competitor}</span>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>{c.evidence}</div>
                </div>
              ))}
            </div>
          )}
          {momentum.losing?.length > 0 && (
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--success)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Competitors Fading
              </div>
              {momentum.losing.map((c, i) => (
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
