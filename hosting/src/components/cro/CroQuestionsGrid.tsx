import React, { useState } from 'react';
import type { Region, TwentyQuestionsData } from '@/lib/types';
import { CRO_QUESTIONS, filterQuestionByRegion, questionStat } from '@/lib/croQuestions';
import { isRecord } from '@/lib/guards';
import { regionLabel } from '@/lib/regions';
import { InsightPanel } from '@/components/ui/InsightPanel';
import { NotGeneratedPanel } from '@/components/dashboard/NotGeneratedPanel';
import { linkButton, smallCaps } from '@/components/ui/tone';
import { QuestionDetail, hasDetail } from './QuestionDetail';

interface Props {
  data?: TwentyQuestionsData;
  region: Region;
  isLive?: boolean;
}

export const CroQuestionsGrid: React.FC<Props> = ({ data, region, isLive }) => {
  const [open, setOpen] = useState<string | null>(null);
  const questions = CRO_QUESTIONS.flatMap(meta => {
    const q = data?.[meta.key];
    return isRecord(q) ? [{ ...meta, question: filterQuestionByRegion(q, region) }] : [];
  });

  if (!questions.length) return isLive ? <NotGeneratedPanel title="CRO questions" /> : null;

  const flagged = questions.filter(q => questionStat(q.question).count > 0).length;
  const scope = region === 'all' ? 'across all regions' : `in ${regionLabel(region)}`;

  return (
    <InsightPanel
      label="CRO questions"
      question="What should I ask in the forecast call?"
      takeaway={`${flagged} of ${questions.length} questions flag something ${scope}.`}
      note={region !== 'all' ? `Counts and tables are for ${regionLabel(region)}; the AI's written answers cover all regions.` : undefined}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(300px, 100%), 1fr))', gap: '0.85rem', alignItems: 'start' }}>
        {questions.map(({ key, label, question }) => {
          const stat = questionStat(question);
          const isOpen = open === key;
          const detail = hasDetail(question);
          // AI prose: anything but a string (an object, a number) would throw as a React child.
          const answer = typeof question.answer === 'string' ? question.answer : '';
          const detailId = `cro-${key}-detail`;
          const answerId = `cro-${key}-answer`;
          return (
            <article key={key} aria-labelledby={`cro-${key}-label`} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
              <h3 id={`cro-${key}-label`} style={{ ...smallCaps, margin: 0, color: 'var(--accent)' }}>{label}</h3>
              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: stat.count ? 'var(--text-primary)' : 'var(--success-text)' }}>{stat.text}</span>
              <p id={answerId} style={{
                margin: 0, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5,
                ...(isOpen ? {} : { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }),
              }}>
                {answer}
              </p>
              {(detail || answer) && (
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={detail ? (isOpen ? detailId : undefined) : answerId}
                  onClick={() => setOpen(isOpen ? null : key)}
                  style={{ ...linkButton, alignSelf: 'flex-start', padding: 0 }}
                >
                  {isOpen ? 'Hide' : detail ? `View ${stat.count} →` : 'Read more'}
                </button>
              )}
              {isOpen && detail && <div id={detailId}><QuestionDetail qKey={key} question={question} region={region} /></div>}
            </article>
          );
        })}
      </div>
    </InsightPanel>
  );
};
