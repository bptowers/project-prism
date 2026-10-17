import React, { useState } from 'react';
import type { Recommendation } from '@/lib/types';
import { asArray, isRecord, text } from '@/lib/guards';
import { plural } from '@/lib/takeaways';
import { InsightPanel } from '@/components/ui/InsightPanel';

const ORDER: Record<string, number> = { P1: 0, P2: 1, P3: 2 };
const PRIORITY_STYLE: Record<string, React.CSSProperties> = {
  P1: { background: 'var(--error-subtle)', color: 'var(--error-text)' },
  P2: { background: 'var(--accent-subtle)', color: 'var(--accent)' },
  P3: { background: 'var(--success-subtle)', color: 'var(--success-text)' },
};

/** This week's actions: one line each, P1 first, click for the detail. */
export const ActionList: React.FC<{ items: Recommendation[] }> = ({ items }) => {
  const [open, setOpen] = useState<number | null>(null);
  const list = asArray<unknown>(items)
    .filter(isRecord)
    // Unvalidated LLM fields: an object value would throw as a React child.
    .map((item, index) => ({ item: { priority: text(item.priority), title: text(item.title), desc: text(item.desc), impact: text(item.impact) }, index }))
    .sort((a, b) => (ORDER[a.item.priority] ?? 3) - (ORDER[b.item.priority] ?? 3));
  const p1 = list.filter(x => x.item.priority === 'P1').length;
  const takeaway = !list.length
    ? 'No recommendations were generated for this run.'
    : p1 ? `${plural(p1, 'P1 action')} this week, highest revenue impact first.` : `${plural(list.length, 'action')} this week; none are P1.`;

  return (
    <InsightPanel label="This week's actions" question="What should we do this week?" takeaway={takeaway}>
      {list.map(({ item, index }) => {
        const isOpen = open === index;
        const detailId = `action-${index}-detail`;
        return (
          <div key={index} style={{ border: '1px solid var(--border)', borderRadius: 10 }}>
            <button type="button" aria-expanded={isOpen} aria-controls={isOpen ? detailId : undefined} onClick={() => setOpen(isOpen ? null : index)} style={{
              width: '100%', minHeight: 48, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem 0.9rem',
              padding: '0.6rem 0.9rem', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', color: 'var(--text-primary)', font: 'inherit',
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: 6, ...(PRIORITY_STYLE[item.priority] ?? {}) }}>{item.priority}</span>
              <span style={{ flex: '1 1 260px', fontWeight: 700, fontSize: '0.9rem' }}>{item.title}</span>
              {item.impact && <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--success-text)' }}>{item.impact}</span>}
              <span aria-hidden="true" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{isOpen ? 'Hide' : 'More'}</span>
            </button>
            {isOpen && <p id={detailId} style={{ margin: 0, padding: '0 0.9rem 0.75rem', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>{item.desc}</p>}
          </div>
        );
      })}
    </InsightPanel>
  );
};
