import React from 'react';

interface Props {
  /** The deals subcollection load error, if any. */
  error?: string;
  /** Whether the capped list embedded in the report is standing in for the full one. */
  hasDeals: boolean;
}

/** Warns that the full deal list failed to load, so tabs don't quietly show the capped list. */
export const DealsLoadError: React.FC<Props> = ({ error, hasDeals }) => {
  if (!error) return null;
  return (
    <div role="alert" style={{ padding: '0.6rem 0.85rem', borderRadius: 6, border: '1px solid var(--error)', background: 'var(--error-subtle)', color: 'var(--error-text)', fontSize: '0.8rem' }}>
      Could not load deals: {error.replace(/\.$/, '')}.{hasDeals && ' Showing the capped list embedded in the report.'}
    </div>
  );
};
