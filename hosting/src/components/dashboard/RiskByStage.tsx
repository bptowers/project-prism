import React from 'react';
import type { RiskDeal } from '@/lib/types';
import { normalizeStage, STAGE_ORDER } from '@/lib/format';

interface Props {
  risks: RiskDeal[];
}

// Each band segment carries its count and a letter so the split is readable
// without relying on colour alone.
const segmentStyle: React.CSSProperties = {
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  color: '#fff',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.58rem',
  fontWeight: 700,
};

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
                <div aria-label={`${stage}: ${high} high risk`} title={`${high} high`} style={{ ...segmentStyle, width: `${highPct}%`, background: 'var(--error)', borderRadius: lowPct === 0 && medPct === 0 ? 3 : '3px 0 0 3px' }}>
                  {high} H
                </div>
              )}
              {medium > 0 && (
                <div aria-label={`${stage}: ${medium} medium risk`} title={`${medium} medium`} style={{ ...segmentStyle, width: `${medPct}%`, background: 'var(--warning)' }}>
                  {medium} M
                </div>
              )}
              {low > 0 && (
                <div aria-label={`${stage}: ${low} low risk`} title={`${low} low`} style={{ ...segmentStyle, width: `${lowPct}%`, background: 'var(--success)', borderRadius: highPct === 0 && medPct === 0 ? 3 : '0 3px 3px 0' }}>
                  {low} L
                </div>
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
