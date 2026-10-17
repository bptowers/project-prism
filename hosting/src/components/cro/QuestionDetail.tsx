import React from 'react';
import { Badge } from '@/components/ui/Badge';
import type {
  Region,
  TQQuestion,
  TQSilentDeal,
  TQDealRow,
  TQRegionRow,
  TQRepRow,
  TQThreatRow,
  TQGapDeal,
} from '@/lib/types';
import { asArray, isRecord, text } from '@/lib/guards';
import { formatDate } from '@/lib/format';

// ── Generic table ──────────────────────────────────────────────────────────
interface Col<T> {
  header: string;
  align?: 'left' | 'right';
  cell: (row: T) => React.ReactNode;
}

function DataTable<T>({ columns, rows }: { columns: Col<T>[]; rows?: T[] }) {
  // LLM-authored rows: a prose string here must render as "no rows", and a null entry is skipped, not thrown on.
  const list = asArray<T>(rows).filter(row => isRecord(row));
  if (!list.length) return null;
  return (
    <div style={{ marginTop: '0.75rem', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            {columns.map((c, i) => (
              <th key={i} style={{ textAlign: c.align || 'left', padding: '4px 8px', fontWeight: 500 }}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {list.map((row, ri) => (
            <tr key={ri} style={{ borderBottom: '1px solid var(--border)' }}>
              {columns.map((c, ci) => (
                <td key={ci} style={{ padding: '6px 8px', textAlign: c.align || 'left', color: 'var(--text-secondary)' }}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Cells take unknown: rows are unvalidated LLM JSON, and an object value would throw as a React child.
const dealCell = (v: unknown) => <span style={{ color: 'var(--text-primary)' }}>{text(v)}</span>;
const mrrCell = (v: unknown) => <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{text(v) || '—'}</span>;
const regionCell = (v: unknown) => <Badge variant="info">{text(v)}</Badge>;

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', margin: '0.75rem 0 0.25rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
      {children}
    </div>
  );
}

// ── Per-question detail ─────────────────────────────────────────────────────
export function QuestionDetail({ qKey, question, region = 'all' }: { qKey: string; question: TQQuestion; region?: Region }) {
  // The rows are region-filtered, but the AI's Q9 summary figures are portfolio-wide.
  const scope = region !== 'all' ? ' (all regions)' : '';
  const silentCols: Col<TQSilentDeal>[] = [
    { header: 'Deal', cell: (d) => dealCell(d.name) },
    { header: 'Rep', cell: (d) => text(d.rep) },
    { header: 'Region', cell: (d) => regionCell(d.region) },
    { header: 'Stage', cell: (d) => text(d.stage) },
    { header: 'MRR', align: 'right', cell: (d) => mrrCell(d.mrr) },
    { header: 'Days Silent', align: 'right', cell: (d) => text(d.daysSinceActivity) },
  ];

  const gapCols: Col<TQGapDeal>[] = [
    { header: 'Deal', cell: (d) => dealCell(d.name) },
    { header: 'Rep', cell: (d) => text(d.rep) },
    { header: 'Region', cell: (d) => regionCell(d.region) },
    { header: 'Prob %', align: 'right', cell: (d) => text(d.statedProbability) },
    { header: 'Health', align: 'right', cell: (d) => text(d.dealHealthScore) },
    { header: 'Gap', align: 'right', cell: (d) => <span style={{ color: 'var(--error)', fontWeight: 600 }}>{text(d.gap)}</span> },
    { header: 'Interpretation', cell: (d) => text(d.interpretation) },
  ];

  const content = (() => {
    switch (qKey) {
      case 'question1':
        return (
          <>
            {asArray(question.silent7Days).some(isRecord) ? (<><SectionLabel>7-Day Silence · Early Warning</SectionLabel><DataTable columns={silentCols} rows={question.silent7Days} /></>) : null}
            {asArray(question.silent14Days).some(isRecord) ? (<><SectionLabel>14-Day Silence · Active Risk</SectionLabel><DataTable columns={silentCols} rows={question.silent14Days} /></>) : null}
            {asArray(question.silent30Days).some(isRecord) ? (<><SectionLabel>30-Day Silence · Ghost Deals</SectionLabel><DataTable columns={silentCols} rows={question.silent30Days} /></>) : null}
          </>
        );
      case 'question2':
        return (
          <DataTable<TQDealRow>
            columns={[
              { header: 'Deal', cell: (d) => dealCell(d.name) },
              { header: 'Rep', cell: (d) => text(d.rep) },
              { header: 'Region', cell: (d) => regionCell(d.region) },
              { header: 'MRR', align: 'right', cell: (d) => mrrCell(d.mrr) },
              { header: 'Close Date', cell: (d) => formatDate(text(d.currentCloseDate)) || '—' },
              { header: 'Signal', cell: (d) => text(d.slippageSignal) || '—' },
              { header: 'Likely Cause', cell: (d) => text(d.likelyCause) || '—' },
            ]}
            rows={question.deals}
          />
        );
      case 'question3':
        return (
          <DataTable<TQRegionRow>
            columns={[
              { header: 'Region', cell: (r) => dealCell(r.region) },
              { header: 'Active Pipeline', align: 'right', cell: (r) => mrrCell(r.activePipelineMrr) },
              { header: 'Coverage', align: 'right', cell: (r) => (text(r.coverageRatio) ? `${text(r.coverageRatio)}x` : '—') },
              { header: 'Gap to 3x', align: 'right', cell: (r) => text(r.gap) || '—' },
              { header: 'Fastest Path', cell: (r) => text(r.fastestPath) || '—' },
            ]}
            rows={question.regions}
          />
        );
      case 'question4':
        return (
          <DataTable<TQRepRow>
            columns={[
              { header: 'Rep', cell: (r) => dealCell(r.name) },
              { header: 'Region', cell: (r) => regionCell(r.region) },
              { header: 'Total', align: 'right', cell: (r) => text(r.totalDeals) },
              { header: 'High-Risk', align: 'right', cell: (r) => text(r.highRiskDeals) },
              { header: 'At-Risk MRR', align: 'right', cell: (r) => mrrCell(r.highRiskMrr) },
              { header: 'Primary Pattern', cell: (r) => text(r.primaryPattern) },
            ]}
            rows={question.reps}
          />
        );
      case 'question5':
        return (
          <DataTable<TQDealRow>
            columns={[
              { header: 'Deal', cell: (d) => dealCell(d.name) },
              { header: 'Rep', cell: (d) => text(d.rep) },
              { header: 'Region', cell: (d) => regionCell(d.region) },
              { header: 'Stage', cell: (d) => text(d.stage) || '—' },
              { header: 'MRR', align: 'right', cell: (d) => mrrCell(d.mrr) },
              { header: 'Days in Stage', align: 'right', cell: (d) => text(d.daysInStage) || '—' },
              { header: 'Action', cell: (d) => text(d.recommendedAction) || '—' },
            ]}
            rows={question.deals}
          />
        );
      case 'question6':
        return (
          <DataTable<TQThreatRow>
            columns={[
              { header: 'Competitor', cell: (t) => dealCell(t.competitor) },
              { header: 'Region', cell: (t) => regionCell(t.region) },
              { header: 'Deals', align: 'right', cell: (t) => text(t.affectedDeals) },
              { header: 'MRR at Risk', align: 'right', cell: (t) => mrrCell(t.mrrAtRisk) },
              { header: 'Displacement Pattern', cell: (t) => text(t.displacementPattern) },
            ]}
            rows={question.threats}
          />
        );
      case 'question7':
        return (
          <>
            {asArray(question.optimismBias).some(isRecord) ? (<><SectionLabel>Optimism Bias · Rep over-confident vs. health</SectionLabel><DataTable columns={gapCols} rows={question.optimismBias} /></>) : null}
            {asArray(question.sandbagging).some(isRecord) ? (<><SectionLabel>Sandbagging · Upside opportunity</SectionLabel><DataTable columns={gapCols} rows={question.sandbagging} /></>) : null}
          </>
        );
      case 'question8':
        return (
          <DataTable<TQRegionRow>
            columns={[
              { header: 'Region', cell: (r) => dealCell(r.region) },
              { header: 'Active MRR', align: 'right', cell: (r) => mrrCell(r.totalActiveMrr) },
              { header: 'High-Risk MRR', align: 'right', cell: (r) => mrrCell(r.highRiskMrr) },
              { header: 'Risk %', align: 'right', cell: (r) => (text(r.riskPercentage) ? `${text(r.riskPercentage)}%` : '—') },
              { header: 'Primary Driver', cell: (r) => text(r.primaryRiskDriver) || '—' },
            ]}
            rows={question.regions}
          />
        );
      case 'question9':
        return (
          <>
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', flexWrap: 'wrap' }}>
              {text(question.bottleneckStage) && <div>Bottleneck{scope}: <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{text(question.bottleneckStage)}</span></div>}
              {text(question.totalMrrStuck) && <div>MRR stuck{scope}: <span style={{ color: 'var(--error)', fontWeight: 600 }}>{text(question.totalMrrStuck)}</span></div>}
              {typeof question.isSystemic === 'boolean' && <Badge variant={question.isSystemic ? 'high' : 'low'}>{question.isSystemic ? 'Systemic' : 'Isolated'}{scope}</Badge>}
            </div>
            <DataTable<TQDealRow>
              columns={[
                { header: 'Deal', cell: (d) => dealCell(d.name) },
                { header: 'Rep', cell: (d) => text(d.rep) },
                { header: 'Region', cell: (d) => regionCell(d.region) },
                { header: 'Stage', cell: (d) => text(d.stage) || '—' },
                { header: 'Days', align: 'right', cell: (d) => text(d.daysInStage) || '—' },
                { header: 'Over By', align: 'right', cell: (d) => text(d.overBy) || '—' },
                { header: 'MRR', align: 'right', cell: (d) => mrrCell(d.mrr) },
                { header: 'Blocker', cell: (d) => text(d.primaryBlocker) || '—' },
              ]}
              rows={question.deals}
            />
          </>
        );
      default:
        return null;
    }
  })();

  if (!content) return null;
  return (
    <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
      {content}
    </div>
  );
}

// Detail is only meaningful for questions that carry structured rows.
export function hasDetail(q: TQQuestion): boolean {
  // asArray, not ?.length: prose where an array belongs has a length but no rows.
  return [
    q.silent7Days, q.silent14Days, q.silent30Days, q.deals, q.regions, q.reps, q.threats, q.optimismBias, q.sandbagging,
  ].some(rows => asArray(rows).some(isRecord));
}
