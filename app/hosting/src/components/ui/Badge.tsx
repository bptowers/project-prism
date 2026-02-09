import React from 'react';

type BadgeVariant = 'high' | 'medium' | 'low' | 'info' | 'success';

const styles: Record<BadgeVariant, React.CSSProperties> = {
  high: { background: 'rgba(199,93,93,0.2)', color: 'var(--error)', border: '1px solid rgba(199,93,93,0.4)' },
  medium: { background: 'rgba(212,165,116,0.2)', color: 'var(--accent)', border: '1px solid rgba(212,165,116,0.4)' },
  low: { background: 'var(--success-subtle)', color: 'var(--success)', border: '1px solid rgba(126,181,99,0.4)' },
  info: { background: 'rgba(107,163,199,0.15)', color: 'var(--prism-blue)', border: '1px solid rgba(107,163,199,0.4)' },
  success: { background: 'var(--success-subtle)', color: 'var(--success)', border: '1px solid rgba(126,181,99,0.4)' },
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
