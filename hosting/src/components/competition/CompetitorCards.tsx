import React from 'react';
import type { CompetitorCard } from '@/lib/competitors';
import { formatCurrency } from '@/lib/format';
import { plural } from '@/lib/takeaways';

/** "3 deals · $12K at risk"; loss-history-only competitors have no open deals, so no "0 deals". */
function exposure(card: CompetitorCard): string {
  return [card.deals > 0 ? plural(card.deals, 'deal') : '', card.value > 0 ? `${formatCurrency(card.value)} at risk` : '']
    .filter(Boolean)
    .join(' · ');
}

export const CompetitorCards: React.FC<{ cards: CompetitorCard[] }> = ({ cards }) => {
  if (!cards.length) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: '0.85rem' }}>
      {cards.map(card => (
        <article key={card.name} aria-label={card.name} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, overflowWrap: 'anywhere' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>{card.name}</h3>
          {exposure(card)
            ? <span style={{ fontWeight: 700, color: 'var(--error-text)' }}>{exposure(card)}</span>
            : <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No open deals flagged; seen in past losses.</span>}
          {card.regions.length > 0 && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{card.regions.join(' · ')}</span>}
          {card.howTheyWin && <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}><strong>How they win:</strong> {card.howTheyWin}</span>}
          {card.counter && <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}><strong>Counter-play:</strong> {card.counter}</span>}
        </article>
      ))}
    </div>
  );
};
