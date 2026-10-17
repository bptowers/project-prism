import React from 'react';
import type { DeltaDeal, DeltaIntelligenceData, Region } from '@/lib/types';
import { asArray, isRecord, text } from '@/lib/guards';
import { formatCurrency, parseMoney } from '@/lib/format';
import { normalizeRegionKey, regionLabel } from '@/lib/regions';
import { changeTakeaway } from '@/lib/takeaways';
import { InsightPanel } from '@/components/ui/InsightPanel';
import { NotGeneratedPanel } from '@/components/dashboard/NotGeneratedPanel';
import { smallCaps } from '@/components/ui/tone';

const DIRECTION: Record<string, { label: string; bg: string; color: string }> = {
  improving: { label: 'IMPROVING', bg: 'var(--success-subtle)', color: 'var(--success-text)' },
  stable: { label: 'STABLE', bg: 'var(--warning-subtle)', color: 'var(--warning-text)' },
  declining: { label: 'DECLINING', bg: 'var(--error-subtle)', color: 'var(--error-text)' },
};
const SEVERITY_COLOR: Record<string, string> = { critical: 'var(--error-text)', important: 'var(--warning-text)', watch: 'var(--text-muted)' };

/** Lookup by an LLM-written key without falling through to Object.prototype ("constructor"). */
const lookup = <T,>(table: Record<string, T>, key: unknown): T | undefined => {
  const k = text(key).trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(table, k) ? table[k] : undefined;
};

/** Delta rows are unvalidated LLM JSON: keep objects only, filtered to the region in view. */
const rowsIn = (raw: unknown, region: Region): DeltaDeal[] => asArray<unknown>(raw)
  .filter(isRecord)
  .filter(d => region === 'all' || normalizeRegionKey(String(d.region ?? '')) === region) as unknown as DeltaDeal[];

/** An LLM mrr: strings as written, a bare number formatted as money, nothing for zero or junk. */
const mrrText = (mrr: unknown): string => {
  if (typeof mrr === 'number') return parseMoney(mrr) > 0 ? formatCurrency(parseMoney(mrr)) : '';
  return text(mrr);
};

const DealRow: React.FC<{ deal: DeltaDeal; prefix?: string }> = ({ deal, prefix }) => {
  const region = text(deal.region).trim();
  return (
    <div style={{ padding: '0.5rem 0', borderTop: '1px solid var(--border)' }}>
      {text(deal.deal) && <div style={{ fontWeight: 700 }}>{text(deal.deal)}</div>}
      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{[prefix, text(deal.change)].filter(Boolean).join(' ')}</div>
      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
        {[text(deal.rep), region ? regionLabel(region) : '', mrrText(deal.mrr)].filter(Boolean).join(' · ')}
      </div>
    </div>
  );
};

const Column: React.FC<{ title: string; color: string; textColor: string; children: React.ReactNode }> = ({ title, color, textColor, children }) => (
  <div style={{ border: '1px solid var(--border)', borderTop: `4px solid ${color}`, borderRadius: 10, padding: '0.75rem 0.9rem', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, overflowWrap: 'anywhere' }}>
    <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: textColor }}>{title}</h3>
    {children}
  </div>
);

const Empty: React.FC<{ children: string }> = ({ children }) => (
  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{children}</span>
);

interface Props {
  data?: DeltaIntelligenceData;
  region: Region;
  isLive?: boolean;
}

/**
 * What moved since the last run? Counts are from the delta rows. The direction,
 * headline and early warnings are the AI's and cover all regions. The LLM's own
 * figures (newPipeline.count/totalMrr, comparedTo) are not shown.
 */
export const WhatChanged: React.FC<Props> = ({ data, region, isLive }) => {
  const changes = isRecord(data?.significantDealChanges) ? data.significantDealChanges : undefined;
  const trajectory = isRecord(data?.pipelineTrajectory) ? data.pipelineTrajectory : undefined;
  const warnings = asArray<unknown>(data?.earlyWarnings).filter(isRecord).filter(w => text(w.signal));
  if (!data || (!changes && !trajectory && !warnings.length)) {
    return isLive ? <NotGeneratedPanel title="What changed" /> : null;
  }

  const worse = rowsIn(changes?.deteriorated, region);
  const better = rowsIn(changes?.improved, region);
  const exited = isRecord(changes?.exited) ? changes.exited : undefined;
  const exitedDeals = [
    ...rowsIn(exited?.closedWon, region).map(deal => ({ deal, prefix: 'Closed won.' })),
    ...rowsIn(exited?.closedLost, region).map(deal => ({ deal, prefix: 'Closed lost.' })),
    ...rowsIn(exited?.goneDark, region).map(deal => ({ deal, prefix: 'Gone dark.' })),
  ];
  // newPipeline is a portfolio-wide summary with no region, so it only shows for All.
  const newPipeline = region === 'all' && isRecord(changes?.newPipeline) ? changes.newPipeline : undefined;
  const newAssessment = text(newPipeline?.qualityAssessment);
  const direction = lookup(DIRECTION, trajectory?.direction);
  const headline = text(trajectory?.headline);
  const hasGlobalProse = Boolean(direction || headline || warnings.length);

  return (
    <InsightPanel
      label="What changed"
      question="What moved since the last run?"
      takeaway={changes ? changeTakeaway(worse, better) : "Deal-level changes aren't available for this run."}
      note={region !== 'all' && hasGlobalProse ? `The AI's direction, headline and early warnings cover all regions, not just ${regionLabel(region)}.` : undefined}
      action={direction && (
        <span style={{ fontSize: '0.75rem', fontWeight: 800, letterSpacing: '0.06em', padding: '4px 10px', borderRadius: 6, background: direction.bg, color: direction.color }}>
          {direction.label}
        </span>
      )}
    >
      {headline && <p style={{ margin: 0, fontWeight: 600 }}>{headline}</p>}
      {changes && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))', gap: '0.85rem' }}>
        <Column title={`↓ Got worse (${worse.length})`} color="var(--prism-red)" textColor="var(--error-text)">
          {worse.length ? worse.map((d, i) => <DealRow key={`${text(d.deal)}-${i}`} deal={d} />) : <Empty>Nothing got worse in this view.</Empty>}
        </Column>
        <Column title={`↑ Improved (${better.length})`} color="var(--prism-green)" textColor="var(--success-text)">
          {better.length ? better.map((d, i) => <DealRow key={`${text(d.deal)}-${i}`} deal={d} />) : <Empty>Nothing improved in this view.</Empty>}
        </Column>
        <Column title="New & exited" color="var(--prism-blue)" textColor="var(--text-primary)">
          {newAssessment && (
            <div style={{ padding: '0.5rem 0', borderTop: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 700 }}>New pipeline (AI assessment)</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{newAssessment}</div>
            </div>
          )}
          {exitedDeals.length > 0 && <span style={{ ...smallCaps, marginTop: 4 }}>Exited ({exitedDeals.length})</span>}
          {exitedDeals.map(({ deal, prefix }, i) => <DealRow key={`${text(deal.deal)}-${i}`} deal={deal} prefix={prefix} />)}
          {!newAssessment && !exitedDeals.length && <Empty>No new or exited deals in this view.</Empty>}
        </Column>
      </div>}
      {warnings.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h3 style={{ ...smallCaps, margin: 0 }}>Early warnings</h3>
          {warnings.map((w, i) => (
            <div key={i} style={{ display: 'flex', gap: '4px 10px', alignItems: 'baseline', flexWrap: 'wrap' }}>
              {text(w.severity) && (
                <span style={{ flex: '0 0 84px', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: lookup(SEVERITY_COLOR, w.severity) ?? 'var(--text-muted)' }}>
                  {text(w.severity)}
                </span>
              )}
              <span style={{ flex: '1 1 260px', minWidth: 0, overflowWrap: 'anywhere' }}>{text(w.signal)}</span>
              {text(w.recommendedAction) && <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{text(w.recommendedAction)}</span>}
            </div>
          ))}
        </div>
      )}
    </InsightPanel>
  );
};
