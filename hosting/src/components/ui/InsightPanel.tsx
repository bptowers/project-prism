import React from 'react';

interface Props {
  /** Small uppercase name of the panel, e.g. "Activity health". */
  label: string;
  /** The plain-English question the panel answers. */
  question: string;
  /** One line computed in code from the data in view. */
  takeaway?: string;
  /** Caveat shown under the takeaway, e.g. "AI answers cover all regions". */
  note?: string;
  /** Optional control on the right of the header ("See all deals →"). */
  action?: React.ReactNode;
  children: React.ReactNode;
}

export const InsightPanel: React.FC<Props> = ({ label, question, takeaway, note, action, children }) => (
  <section
    aria-label={label}
    style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '1.1rem 1.25rem',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.75rem',
      minWidth: 0,
    }}
  >
    <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          {label}
        </div>
        <h2 style={{ margin: '2px 0 0', fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{question}</h2>
      </div>
      {action}
    </header>
    {takeaway && (
      <p data-testid="takeaway" style={{
        margin: 0, padding: '0.6rem 0.75rem', borderRadius: 8,
        background: 'var(--takeaway-bg)', color: 'var(--takeaway-text)', fontSize: '0.9rem', fontWeight: 600,
      }}>
        {takeaway}
      </p>
    )}
    {note && <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--warning-text)' }}>{note}</p>}
    {children}
  </section>
);
