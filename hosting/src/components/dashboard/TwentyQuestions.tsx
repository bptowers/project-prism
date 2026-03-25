import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { itemVariants } from '@/theme/animations';
import { Badge } from '@/components/ui/Badge';
import type { TwentyQuestionsData, TQQuestion } from '@/lib/types';

interface Props { data?: TwentyQuestionsData; }

const QUESTION_KEYS = ['question1', 'question2', 'question3', 'question4', 'question5', 'question6', 'question7'] as const;

const QUESTION_ICONS: Record<string, string> = {
  question1: 'Slip Risk',
  question2: 'Ghost Pipeline',
  question3: 'Rep Quality',
  question4: 'Velocity Reality',
  question5: 'Below Benchmark',
  question6: 'Bottleneck',
  question7: 'Forecast Fiction',
};

function DealTable({ deals }: { deals: { name: string; rep: string; region: string; mrr: string; reason?: string; primaryReason?: string; mostLikelyOutcome?: string }[] }) {
  if (!deals?.length) return null;
  return (
    <div style={{ marginTop: '0.75rem', overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', fontFamily: 'var(--font-mono)' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 500 }}>Deal</th>
            <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 500 }}>Rep</th>
            <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 500 }}>Region</th>
            <th style={{ textAlign: 'right', padding: '4px 8px', fontWeight: 500 }}>MRR</th>
            <th style={{ textAlign: 'left', padding: '4px 8px', fontWeight: 500 }}>Reason</th>
          </tr>
        </thead>
        <tbody>
          {deals.map((d, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '6px 8px', color: 'var(--text-primary)' }}>{d.name}</td>
              <td style={{ padding: '6px 8px', color: 'var(--text-secondary)' }}>{d.rep}</td>
              <td style={{ padding: '6px 8px' }}><Badge variant="info">{d.region}</Badge></td>
              <td style={{ padding: '6px 8px', textAlign: 'right', color: 'var(--accent)', fontWeight: 600 }}>{d.mrr}</td>
              <td style={{ padding: '6px 8px', color: 'var(--text-secondary)', maxWidth: 300 }}>{d.reason || d.primaryReason || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RepList({ label, reps, variant }: { label: string; reps: { name: string; region: string; reason: string }[]; variant: 'success' | 'high' }) {
  if (!reps?.length) return null;
  return (
    <div style={{ marginTop: '0.5rem' }}>
      <div style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      {reps.map((r, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
          <Badge variant={variant}>{r.region}</Badge>
          <div>
            <span style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-primary)' }}>{r.name}</span>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>{r.reason}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function QuestionDetail({ qKey, question }: { qKey: string; question: TQQuestion }) {
  return (
    <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
      {/* Q1 & Q5 & Q7: deal tables */}
      {(qKey === 'question1' || qKey === 'question5') && question.deals && (
        <>
          {question.totalMrrAtRisk && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--error)', fontWeight: 600, marginBottom: '0.5rem' }}>
              Total MRR at risk: {question.totalMrrAtRisk}
            </div>
          )}
          <DealTable deals={question.deals} />
        </>
      )}

      {qKey === 'question7' && question.atRiskDeals && (
        <>
          <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.75rem', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
            {question.reportedForecast && <div>Reported: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{question.reportedForecast}</span></div>}
            {question.realisticForecast && <div>Realistic: <span style={{ color: 'var(--error)', fontWeight: 600 }}>{question.realisticForecast}</span></div>}
            {question.forecastFictionDelta && <div>Gap: <span style={{ color: 'var(--error)', fontWeight: 600 }}>{question.forecastFictionDelta}</span></div>}
          </div>
          <DealTable deals={question.atRiskDeals} />
        </>
      )}

      {/* Q2: ghost pipeline */}
      {qKey === 'question2' && (
        <>
          <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
            {question.reportedPipeline && <div>Reported: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{question.reportedPipeline}</span></div>}
            {question.ghostStrippedPipeline && <div>Ghost-stripped: <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{question.ghostStrippedPipeline}</span></div>}
            {question.delta && <div>Delta: <span style={{ color: 'var(--error)', fontWeight: 600 }}>{question.delta}</span></div>}
          </div>
          {question.inactiveDeals?.map((d, i) => (
            <div key={i} style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', padding: '3px 0', borderBottom: '1px solid var(--border)' }}>{d}</div>
          ))}
        </>
      )}

      {/* Q3: rep rankings */}
      {qKey === 'question3' && (
        <>
          <RepList label="Top Reps" reps={question.topReps || []} variant="success" />
          <RepList label="Bottom Reps" reps={question.bottomReps || []} variant="high" />
        </>
      )}

      {/* Q4: velocity segments */}
      {qKey === 'question4' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--success)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Accelerating</div>
            {question.accelerating?.map((s, i) => (
              <div key={i} style={{ fontSize: '0.75rem', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.segment}</div>
                <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>{s.evidence}</div>
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--error)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Decelerating</div>
            {question.decelerating?.map((s, i) => (
              <div key={i} style={{ fontSize: '0.75rem', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{s.segment}</div>
                <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>{s.evidence}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Q6: bottleneck */}
      {qKey === 'question6' && (
        <>
          <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.5rem', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
            {question.bottleneckStage && <div>Stage: <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{question.bottleneckStage}</span></div>}
            {question.mrrStuck && <div>MRR stuck: <span style={{ color: 'var(--error)', fontWeight: 600 }}>{question.mrrStuck}</span></div>}
            {question.dealsStuck != null && <div>Deals: <span style={{ fontWeight: 600 }}>{question.dealsStuck}</span></div>}
            {question.isSystemic != null && <Badge variant={question.isSystemic ? 'high' : 'low'}>{question.isSystemic ? 'Systemic' : 'Isolated'}</Badge>}
          </div>
          {question.details && <DealTable deals={question.details.map(d => ({ name: d.name || '', rep: d.rep, region: d.region, mrr: d.mrr || '—', reason: d.primaryBlocker }))} />}
        </>
      )}
    </div>
  );
}

export const TwentyQuestions: React.FC<Props> = ({ data }) => {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!data) return null;

  const questions: { key: string; question: TQQuestion }[] = [];
  for (const key of QUESTION_KEYS) {
    const question = data[key];
    if (question) questions.push({ key, question });
  }

  if (questions.length === 0) return null;

  return (
    <motion.div variants={itemVariants} style={{ marginBottom: '2rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem', marginBottom: '1rem' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
          CRO Intelligence
        </h3>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          {questions.length} questions
        </span>
      </div>
      {questions.map(({ key, question }) => (
        <div
          key={key}
          onClick={() => setExpanded(expanded === key ? null : key)}
          style={{
            padding: '1rem',
            border: '1px solid var(--border)',
            borderRadius: 8,
            marginBottom: '0.75rem',
            background: 'var(--bg-elevated)',
            cursor: 'pointer',
            borderLeft: '3px solid var(--prism-blue)',
            transition: 'all 0.15s ease',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Badge variant="info">{QUESTION_ICONS[key] || key}</Badge>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {question.label}
              </span>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)' }}>
              {expanded === key ? '▼' : '▶'}
            </span>
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {question.answer}
          </div>
          {expanded === key && <QuestionDetail qKey={key} question={question} />}
        </div>
      ))}
    </motion.div>
  );
};
