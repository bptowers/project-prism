import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { itemVariants } from '@/theme/animations';
import { Badge } from '@/components/ui/Badge';
import type {
  TwentyQuestionsData,
  TQQuestion,
  TQSilentDeal,
  TQDealRow,
  TQRegionRow,
  TQRepRow,
  TQThreatRow,
  TQGapDeal,
} from '@/lib/types';
import { asArray } from '@/lib/guards';
import { formatDate } from '@/lib/format';
import { NotGeneratedPanel } from '@/components/dashboard/NotGeneratedPanel';

interface Props { data?: TwentyQuestionsData; isLive?: boolean; }

// All ten CRO questions the backend answers (see TWENTY_QUESTIONS_PROMPT).
// Previously only question1–7 were listed here, so questions 8–10 never
// rendered even when present in the data.
const QUESTION_KEYS = [
  'question1', 'question2', 'question3', 'question4', 'question5',
  'question6', 'question7', 'question8', 'question9', 'question10',
] as const;

const QUESTION_BADGES: Record<string, string> = {
  question1: 'Gone Silent',
  question2: 'Slippage',
  question3: 'Coverage',
  question4: 'Rep Risk',
  question5: 'No Econ Buyer',
  question6: 'Competitive',
  question7: 'Forecast Fiction',
  question8: 'Risk by Region',
  question9: 'Stage Stalls',
  question10: 'CRO Actions',
};

// ── Generic table ──────────────────────────────────────────────────────────
interface Col<T> {
  header: string;
  align?: 'left' | 'right';
  cell: (row: T) => React.ReactNode;
}

function DataTable<T>({ columns, rows }: { columns: Col<T>[]; rows?: T[] }) {
  // LLM-authored rows: a prose string here must render as "no rows", not throw.
  const list = asArray<T>(rows);
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

const dealCell = (v: string) => <span style={{ color: 'var(--text-primary)' }}>{v}</span>;
const mrrCell = (v?: string) => <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{v || '—'}</span>;
const regionCell = (v: string) => <Badge variant="info">{v}</Badge>;

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', margin: '0.75rem 0 0.25rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
      {children}
    </div>
  );
}

// ── Per-question detail ─────────────────────────────────────────────────────
function QuestionDetail({ qKey, question }: { qKey: string; question: TQQuestion }) {
  const silentCols: Col<TQSilentDeal>[] = [
    { header: 'Deal', cell: (d) => dealCell(d.name) },
    { header: 'Rep', cell: (d) => d.rep },
    { header: 'Region', cell: (d) => regionCell(d.region) },
    { header: 'Stage', cell: (d) => d.stage },
    { header: 'MRR', align: 'right', cell: (d) => mrrCell(d.mrr) },
    { header: 'Days Silent', align: 'right', cell: (d) => d.daysSinceActivity },
  ];

  const gapCols: Col<TQGapDeal>[] = [
    { header: 'Deal', cell: (d) => dealCell(d.name) },
    { header: 'Rep', cell: (d) => d.rep },
    { header: 'Region', cell: (d) => regionCell(d.region) },
    { header: 'Prob %', align: 'right', cell: (d) => d.statedProbability },
    { header: 'Health', align: 'right', cell: (d) => d.dealHealthScore },
    { header: 'Gap', align: 'right', cell: (d) => <span style={{ color: 'var(--error)', fontWeight: 600 }}>{d.gap}</span> },
    { header: 'Interpretation', cell: (d) => d.interpretation },
  ];

  const content = (() => {
    switch (qKey) {
      case 'question1':
        return (
          <>
            {question.silent7Days?.length ? (<><SectionLabel>7-Day Silence · Early Warning</SectionLabel><DataTable columns={silentCols} rows={question.silent7Days} /></>) : null}
            {question.silent14Days?.length ? (<><SectionLabel>14-Day Silence · Active Risk</SectionLabel><DataTable columns={silentCols} rows={question.silent14Days} /></>) : null}
            {question.silent30Days?.length ? (<><SectionLabel>30-Day Silence · Ghost Deals</SectionLabel><DataTable columns={silentCols} rows={question.silent30Days} /></>) : null}
          </>
        );
      case 'question2':
        return (
          <DataTable<TQDealRow>
            columns={[
              { header: 'Deal', cell: (d) => dealCell(d.name) },
              { header: 'Rep', cell: (d) => d.rep },
              { header: 'Region', cell: (d) => regionCell(d.region) },
              { header: 'MRR', align: 'right', cell: (d) => mrrCell(d.mrr) },
              { header: 'Close Date', cell: (d) => formatDate(d.currentCloseDate) || '—' },
              { header: 'Signal', cell: (d) => d.slippageSignal || '—' },
              { header: 'Likely Cause', cell: (d) => d.likelyCause || '—' },
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
              { header: 'Coverage', align: 'right', cell: (r) => (r.coverageRatio != null ? `${r.coverageRatio}x` : '—') },
              { header: 'Gap to 3x', align: 'right', cell: (r) => r.gap || '—' },
              { header: 'Fastest Path', cell: (r) => r.fastestPath || '—' },
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
              { header: 'Total', align: 'right', cell: (r) => r.totalDeals },
              { header: 'High-Risk', align: 'right', cell: (r) => r.highRiskDeals },
              { header: 'At-Risk MRR', align: 'right', cell: (r) => mrrCell(r.highRiskMrr) },
              { header: 'Primary Pattern', cell: (r) => r.primaryPattern },
            ]}
            rows={question.reps}
          />
        );
      case 'question5':
        return (
          <DataTable<TQDealRow>
            columns={[
              { header: 'Deal', cell: (d) => dealCell(d.name) },
              { header: 'Rep', cell: (d) => d.rep },
              { header: 'Region', cell: (d) => regionCell(d.region) },
              { header: 'Stage', cell: (d) => d.stage || '—' },
              { header: 'MRR', align: 'right', cell: (d) => mrrCell(d.mrr) },
              { header: 'Days in Stage', align: 'right', cell: (d) => d.daysInStage ?? '—' },
              { header: 'Action', cell: (d) => d.recommendedAction || '—' },
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
              { header: 'Deals', align: 'right', cell: (t) => t.affectedDeals },
              { header: 'MRR at Risk', align: 'right', cell: (t) => mrrCell(t.mrrAtRisk) },
              { header: 'Displacement Pattern', cell: (t) => t.displacementPattern },
            ]}
            rows={question.threats}
          />
        );
      case 'question7':
        return (
          <>
            {question.optimismBias?.length ? (<><SectionLabel>Optimism Bias · Rep over-confident vs. health</SectionLabel><DataTable columns={gapCols} rows={question.optimismBias} /></>) : null}
            {question.sandbagging?.length ? (<><SectionLabel>Sandbagging · Upside opportunity</SectionLabel><DataTable columns={gapCols} rows={question.sandbagging} /></>) : null}
          </>
        );
      case 'question8':
        return (
          <DataTable<TQRegionRow>
            columns={[
              { header: 'Region', cell: (r) => dealCell(r.region) },
              { header: 'Active MRR', align: 'right', cell: (r) => mrrCell(r.totalActiveMrr) },
              { header: 'High-Risk MRR', align: 'right', cell: (r) => mrrCell(r.highRiskMrr) },
              { header: 'Risk %', align: 'right', cell: (r) => (r.riskPercentage != null ? `${r.riskPercentage}%` : '—') },
              { header: 'Primary Driver', cell: (r) => r.primaryRiskDriver || '—' },
            ]}
            rows={question.regions}
          />
        );
      case 'question9':
        return (
          <>
            <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', flexWrap: 'wrap' }}>
              {question.bottleneckStage && <div>Bottleneck: <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{question.bottleneckStage}</span></div>}
              {question.totalMrrStuck && <div>MRR stuck: <span style={{ color: 'var(--error)', fontWeight: 600 }}>{question.totalMrrStuck}</span></div>}
              {question.isSystemic != null && <Badge variant={question.isSystemic ? 'high' : 'low'}>{question.isSystemic ? 'Systemic' : 'Isolated'}</Badge>}
            </div>
            <DataTable<TQDealRow>
              columns={[
                { header: 'Deal', cell: (d) => dealCell(d.name) },
                { header: 'Rep', cell: (d) => d.rep },
                { header: 'Region', cell: (d) => regionCell(d.region) },
                { header: 'Stage', cell: (d) => d.stage || '—' },
                { header: 'Days', align: 'right', cell: (d) => d.daysInStage ?? '—' },
                { header: 'Over By', align: 'right', cell: (d) => d.overBy || '—' },
                { header: 'MRR', align: 'right', cell: (d) => mrrCell(d.mrr) },
                { header: 'Blocker', cell: (d) => d.primaryBlocker || '—' },
              ]}
              rows={question.deals}
            />
          </>
        );
      case 'question10':
        return (
          <DataTable<TQDealRow>
            columns={[
              { header: 'Deal', cell: (d) => dealCell(d.name) },
              { header: 'Rep', cell: (d) => d.rep },
              { header: 'Region', cell: (d) => regionCell(d.region) },
              { header: 'MRR', align: 'right', cell: (d) => mrrCell(d.mrr) },
              { header: 'Health', align: 'right', cell: (d) => d.healthScore ?? '—' },
              { header: 'Urgency', cell: (d) => d.urgencySignal || '—' },
              { header: 'CRO Action', cell: (d) => d.croAction || '—' },
              { header: 'By', cell: (d) => (d.deadline ? <Badge variant="high">{formatDate(d.deadline)}</Badge> : '—') },
            ]}
            rows={question.deals}
          />
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
function hasDetail(q: TQQuestion): boolean {
  return Boolean(
    q.silent7Days?.length || q.silent14Days?.length || q.silent30Days?.length ||
    q.deals?.length || q.regions?.length || q.reps?.length || q.threats?.length ||
    q.optimismBias?.length || q.sandbagging?.length
  );
}

export const TwentyQuestions: React.FC<Props> = ({ data, isLive }) => {
  const [expanded, setExpanded] = useState<string | null>(null);

  const questions: { key: string; question: TQQuestion }[] = [];
  if (data) {
    for (const key of QUESTION_KEYS) {
      const question = data[key];
      if (question) questions.push({ key, question });
    }
  }

  if (questions.length === 0) {
    return isLive ? <NotGeneratedPanel title="CRO Intelligence" /> : null;
  }

  return (
    <motion.div variants={itemVariants} style={{ marginBottom: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '1rem' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
          CRO Intelligence
        </h3>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          {questions.length} of 10 questions
        </span>
      </div>
      {questions.map(({ key, question }) => {
        const expandable = hasDetail(question);
        return (
          <div
            key={key}
            onClick={() => expandable && setExpanded(expanded === key ? null : key)}
            style={{
              padding: '1rem',
              border: '1px solid var(--border)',
              borderRadius: 8,
              marginBottom: '0.75rem',
              background: 'var(--bg-elevated)',
              cursor: expandable ? 'pointer' : 'default',
              borderLeft: '3px solid var(--prism-blue)',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Badge variant="info">{QUESTION_BADGES[key] || key}</Badge>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {question.label}
                </span>
              </div>
              {expandable && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
                  {expanded === key ? '▼' : '▶'}
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {question.answer}
            </div>
            {expanded === key && <QuestionDetail qKey={key} question={question} />}
          </div>
        );
      })}
    </motion.div>
  );
};
