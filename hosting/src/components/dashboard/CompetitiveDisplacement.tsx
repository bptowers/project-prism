import React from 'react';
import { motion } from 'framer-motion';
import { itemVariants, cardHover } from '@/theme/animations';
import { Badge } from '@/components/ui/Badge';
import type { CompetitiveDisplacementData, LossMechanism, RegionalArbitrage, RewarmOpportunity, WinMechanism } from '@/lib/types';
import { asArray, isRecord } from '@/lib/guards';

interface Props { data?: CompetitiveDisplacementData; }

export const CompetitiveDisplacement: React.FC<Props> = ({ data }) => {
  if (!data) return null;

  // LLM-authored payload: coerce every slot to the shape we iterate. Older
  // reports in Firestore may carry prose strings where arrays belong.
  const regions = isRecord(data.winMechanisms)
    ? Object.entries(data.winMechanisms as Record<string, WinMechanism>).filter(([, m]) => isRecord(m))
    : [];
  const lossMechanisms = asArray<LossMechanism>(data.lossMechanisms);
  const regionalArbitrage = asArray<RegionalArbitrage>(data.regionalArbitrage);
  const rewarmOpportunities = asArray<RewarmOpportunity>(data.rewarmOpportunities);
  const whyHaventTheyBought = isRecord(data.whyHaventTheyBought) ? data.whyHaventTheyBought : undefined;

  const hasContent = regions.length > 0 || lossMechanisms.length > 0;
  if (!hasContent) return null;

  return (
    <motion.div variants={itemVariants} style={{ marginBottom: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '1rem' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
          Competitive Displacement
        </h3>
      </div>

      {/* Win Mechanisms by Region */}
      {regions.length > 0 && (
        <>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--success)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Win Mechanisms
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            {regions.map(([region, mech]) => (
              <motion.div
                key={region}
                whileHover={cardHover}
                style={{
                  padding: '1rem',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  background: 'var(--bg-elevated)',
                  borderTop: '3px solid var(--success)',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <Badge variant="info">{region}</Badge>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    vs {mech.primaryCompetitor}
                  </span>
                </div>
                <div style={{ marginBottom: '0.5rem' }}>
                  <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Switching Trigger</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', lineHeight: 1.5, marginTop: 2 }}>{mech.primarySwitchingTrigger}</div>
                </div>
                <div style={{ marginBottom: '0.5rem' }}>
                  <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Champion Profile</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 2 }}>{mech.championProfile}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Proof Point</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--accent)', lineHeight: 1.5, marginTop: 2, fontWeight: 500 }}>{mech.decisiveProofPoint}</div>
                </div>
                {mech.winRate && (
                  <div style={{ marginTop: '0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Win rate: {mech.winRate}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </>
      )}

      {/* Loss Mechanisms */}
      {lossMechanisms.length > 0 && (
        <>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--error)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Loss Mechanisms
          </div>
          <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {lossMechanisms.map((loss, i) => (
              <div
                key={i}
                style={{
                  padding: '1rem',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  background: 'var(--bg-elevated)',
                  borderLeft: '3px solid var(--error)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <Badge variant="info">{loss.region}</Badge>
                  <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)' }}>vs {loss.competitor}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.8rem' }}>
                  <div>
                    <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Stated Reason</div>
                    <div style={{ color: 'var(--text-secondary)', marginTop: 2, lineHeight: 1.5 }}>{loss.statedReason}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--error)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Real Mechanism</div>
                    <div style={{ color: 'var(--text-primary)', marginTop: 2, lineHeight: 1.5 }}>{loss.realMechanism}</div>
                  </div>
                </div>
                <div style={{ marginTop: '0.5rem', padding: '0.5rem 0.75rem', background: 'var(--accent-subtle)', borderRadius: 4, fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600 }}>
                  Counter: {loss.counter}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Regional Arbitrage */}
      {regionalArbitrage.length > 0 && (
        <>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--prism-blue)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Regional Arbitrage
          </div>
          <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {regionalArbitrage.map((arb, i) => (
              <div key={i} style={{ padding: '1rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-elevated)' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>{arb.dealProfile}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', fontSize: '0.8rem' }}>
                  <Badge variant="success">{arb.winningRegion}</Badge>
                  <span style={{ color: 'var(--text-muted)' }}>wins but</span>
                  <Badge variant="high">{arb.losingRegion}</Badge>
                  <span style={{ color: 'var(--text-muted)' }}>loses</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '0.5rem' }}>{arb.divergenceCause}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600 }}>Transfer: {arb.transferAction}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Why Haven't They Bought */}
      {whyHaventTheyBought && (
        <div style={{ padding: '1rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-elevated)', marginBottom: '1.5rem' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--warning)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Why Haven't They Bought
          </div>
          <div style={{ fontSize: '0.8rem', lineHeight: 1.6 }}>
            <div style={{ marginBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>Silent Loss Pattern: </span>
              <span style={{ color: 'var(--text-primary)' }}>{String(whyHaventTheyBought.silentLossPattern ?? '')}</span>
            </div>
            <div style={{ marginBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>Urgency Gap: </span>
              <span style={{ color: 'var(--text-primary)' }}>{String(whyHaventTheyBought.urgencyGap ?? '')}</span>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>Missing Narrative: </span>
              <span style={{ color: 'var(--accent)' }}>{String(whyHaventTheyBought.missingNarrative ?? '')}</span>
            </div>
          </div>
        </div>
      )}

      {/* Rewarm Opportunities */}
      {rewarmOpportunities.length > 0 && (
        <>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--success)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Rewarm Opportunities
          </div>
          {rewarmOpportunities.map((rw, i) => (
            <div key={i} style={{ padding: '0.75rem 1rem', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--bg-elevated)', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{rw.lossReason}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--success)', fontWeight: 600 }}>{rw.mrrOpportunity}</span>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                {rw.dealCount} deals — {rw.changedContext}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--accent)', marginTop: '0.25rem', fontStyle: 'italic' }}>
                "{rw.outreachNarrative}"
              </div>
            </div>
          ))}
        </>
      )}
    </motion.div>
  );
};
