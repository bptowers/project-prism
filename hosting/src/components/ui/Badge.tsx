import React from 'react';

type BadgeVariant = 'high' | 'medium' | 'low' | 'info' | 'success';

const styles: Record<BadgeVariant, React.CSSProperties> = {
  high: { background: 'var(--error-subtle)', color: 'var(--error)', border: '1px solid var(--error)' },
  medium: { background: 'var(--warning-subtle)', color: 'var(--warning)', border: '1px solid var(--warning)' },
  low: { background: 'var(--success-subtle)', color: 'var(--success)', border: '1px solid var(--success)' },
  info: { background: 'var(--accent-subtle)', color: 'var(--prism-blue)', border: '1px solid var(--prism-blue)' },
  success: { background: 'var(--success-subtle)', color: 'var(--success)', border: '1px solid var(--success)' },
};

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({ variant, children }) => (
  <span style={{
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '2px 8px',
    borderRadius: '3px',
    fontSize: '10px',
    fontWeight: 600,
    fontFamily: 'var(--font-mono)',
    ...styles[variant],
  }}>
    {children}
  </span>
);
