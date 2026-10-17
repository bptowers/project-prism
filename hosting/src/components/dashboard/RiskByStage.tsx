import React from 'react';
import type { RiskDeal } from '@/lib/types';
import { normalizeStage, STAGE_ORDER } from '@/lib/format';
import { plural } from '@/lib/takeaways';

interface Props {
  risks: RiskDeal[];
  /** When given, each stage row is a button that drills into that stage's deals. */
  onStageClick?: (stage: string) => void;
}

// Each band segment carries its count and a letter so the split is readable
// without relying on colour alone.
const segmentStyle: React.CSSProperties = {
  height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  whiteSpace: 'nowrap', color: 'var(--on-accent)', fontFamily: 'var(--font-mono)', fontSize: '0.58rem', fontWeight: 700,
};

const rowStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.75rem' };

export const RiskByStage: React.FC<Props> = ({ risks, onStageClick }) => {
  if (risks.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
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

  const orderedStages = [
    ...STAGE_ORDER.filter(s => stageMap[s]),
    ...Object.keys(stageMap).filter(s => !STAGE_ORDER.includes(s)),
  ];
  const maxTotal = Math.max(...orderedStages.map(s => stageMap[s].total), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {orderedStages.map(stage => {
        const { high, medium, low, total } = stageMap[stage];
        const barWidth = (total / maxTotal) * 100;
        const highPct = total > 0 ? (high / total) * barWidth : 0;
        const medPct = total > 0 ? (medium / total) * barWidth : 0;
        const lowPct = total > 0 ? (low / total) * barWidth : 0;

        const content = (
          <>
            <div style={{ width: 110, flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-secondary)', textAlign: 'right', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {stage}
            </div>
            <div style={{ flex: 1, height: 14, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
              {high > 0 && (
                <div aria-label={`${stage}: ${high} high risk`} title={`${high} high`} style={{ ...segmentStyle, width: `${highPct}%`, background: 'var(--error)' }}>{high} H</div>
              )}
              {medium > 0 && (
                <div aria-label={`${stage}: ${medium} medium risk`} title={`${medium} medium`} style={{ ...segmentStyle, width: `${medPct}%`, background: 'var(--warning)' }}>{medium} M</div>
              )}
              {low > 0 && (
                <div aria-label={`${stage}: ${low} low risk`} title={`${low} low`} style={{ ...segmentStyle, width: `${lowPct}%`, background: 'var(--success)' }}>{low} L</div>
              )}
            </div>
            <div style={{ width: 28, flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'right' }}>
              {total}
            </div>
          </>
        );

        return onStageClick ? (
          <button
            key={stage}
            type="button"
            onClick={() => onStageClick(stage)}
            aria-label={`Show ${stage} deals: ${plural(total, 'deal')}, ${high} high risk`}
            style={{ ...rowStyle, width: '100%', minHeight: 36, padding: 0, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'inherit' }}
          >
            {content}
          </button>
        ) : (
          <div key={stage} style={rowStyle}>{content}</div>
        );
      })}

      <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
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
          {risks.length} total{onStageClick ? ' · click a stage to see its deals' : ''}
        </div>
      </div>
    </div>
  );
};
