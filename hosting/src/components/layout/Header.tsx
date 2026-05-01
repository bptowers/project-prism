import React from 'react';
import { motion } from 'framer-motion';
import { itemVariants } from '@/theme/animations';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/theme/ThemeProvider';

interface HeaderProps {
  onUploadClick?: () => void;
  period?: string;
  isLive?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onUploadClick, period, isLive }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <motion.header variants={itemVariants} style={{
      padding: '1.5rem 0 1rem',
      borderBottom: '1px solid var(--border)',
      marginBottom: '0.5rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '2.25rem', fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '-0.02em' }}>PRISM</div>
            <div style={{
              width: 60, height: 3, borderRadius: 2, marginTop: '0.25rem',
              background: 'linear-gradient(to right, var(--prism-blue), var(--prism-green) 30%, var(--prism-amber) 70%, var(--prism-red))',
            }} />
          </div>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>
            Global Revenue Intelligence
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{
            background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)',
            padding: '0.5rem 1rem', borderRadius: 5, fontFamily: 'var(--font-mono)', fontSize: '0.75rem',
          }}>
            {isLive ? period || 'Latest Live Report' : 'No Live Report'}
          </div>
          <Button variant="export">Export PDF</Button>
          <Button variant="export">Export Slides</Button>
          <Button variant="primary" onClick={onUploadClick}>Upload CSV</Button>
          <button
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              width: 36,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '1rem',
              color: 'var(--text-secondary)',
              transition: 'all 0.15s ease',
            }}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
        </div>
      </div>
    </motion.header>
  );
};
