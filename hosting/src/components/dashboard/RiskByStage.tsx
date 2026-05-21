import React from 'react';
import type { RiskDeal } from '@/lib/types';

interface Props {
  risks: RiskDeal[];
}

const STAGE_ORDER = [
  'Discovery',
  'Qualification',
  'Solution',
  'Proposal',
  'Negotiation',
  'Commit',
  'Contract Review',
  'Approved',
];

function normalizeStage(stage?: string): string {
  if (!stage) return 'Unknown';
  const lower = stage.toLowerCase();
  if (lower.includes('signature') || lower.includes('commit')) return 'Commit';
  if (lower.includes('contract')) return 'Contract Review';
  if (lower.includes('draft')) return 'Proposal';
  if (lower.includes('approved')) return 'Approved';
  const match = STAGE_ORDER.find(s => lower.includes(s.toLowerCase()));
  return match || stage;
}

export const RiskByStage: React.FC<Props> = ({ risks }) => {
  if (risks.length === 0) {
    return (
      <div style={{
        padding: '2rem',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.8rem',
      }}>
        No risk data available
      </div>
    );
  }

  const stageMap: Record<string, { high: number; medium: number; low: number; total: number }> = {};
  for (const risk of risks) {
    const stage = normalizeStage(risk.stage);
    if (!stageMap[stage]) stageMap[stage] = { high: 0, medium: 0, low: 0, total: 0 };
    stageMap[stage].total++;
    if (risk.level === 'HIGH') stageMap[stage].high++;
    else if (risk.level === 'MEDIUM') stageMap[stage].medium++;
    else stageMap[stage].low++;
  }

  const orderedStages: string[] = [];
  for (const s of STAGE_ORDER) {
    if (stageMap[s]) orderedStages.push(s);
  }
  for (const s of Object.keys(stageMap)) {
    if (!STAGE_ORDER.includes(s) && stageMap[s]) orderedStages.push(s);
  }

  const maxTotal = Math.max(...orderedStages.map(s => stageMap[s].total), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {orderedStages.map(stage => {
        const { high, medium, low, total } = stageMap[stage];
        const barWidth = (total / maxTotal) * 100;
        const highPct = total > 0 ? (high / total) * barWidth : 0;
        const medPct = total > 0 ? (medium / total) * barWidth : 0;
        const lowPct = total > 0 ? (low / total) * barWidth : 0;

        return (
          <div key={stage} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: 110,
              flexShrink: 0,
              fontFamily: 'var(--font-mono)',
              fontSize: '0.72rem',
              color: 'var(--text-secondary)',
              textAlign: 'right',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {stage}
            </div>

            <div style={{
              flex: 1,
              height: 14,
              background: 'var(--bg-elevated)',
              borderRadius: 3,
              overflow: 'hidden',
              display: 'flex',
            }}>
              {high > 0 && (
                <div style={{ width: `${highPct}%`, background: 'var(--error)', height: '100%', borderRadius: lowPct === 0 && medPct === 0 ? 3 : '3px 0 0 3px' }} />
              )}
              {medium > 0 && (
                <div style={{ width: `${medPct}%`, background: 'var(--warning)', height: '100%' }} />
              )}
              {low > 0 && (
                <div style={{ width: `${lowPct}%`, background: 'var(--success)', height: '100%', borderRadius: highPct === 0 && medPct === 0 ? 3 : '0 3px 3px 0' }} />
              )}
            </div>

            <div style={{
              width: 28,
              flexShrink: 0,
              fontFamily: 'var(--font-mono)',
              fontSize: '0.72rem',
              color: 'var(--text-muted)',
              textAlign: 'right',
            }}>
              {total}
            </div>
          </div>
        );
      })}

      <div style={{
        display: 'flex',
        gap: '1rem',
        marginTop: '0.5rem',
        paddingTop: '0.5rem',
        borderTop: '1px solid var(--border)',
      }}>
        {[
          { color: 'var(--error)', label: 'High' },
          { color: 'var(--warning)', label: 'Medium' },
          { color: 'var(--success)', label: 'Low' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>{label}</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
          {risks.length} total
        </div>
      </div>
    </div>
  );
};
