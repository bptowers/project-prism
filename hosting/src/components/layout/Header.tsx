import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { itemVariants } from '@/theme/animations';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/theme/ThemeProvider';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface HeaderProps {
  onUploadClick?: () => void;
  period?: string;
  isLive?: boolean;
  reportDate?: string;
}

type RunState = 'idle' | 'loading' | 'success' | 'error';

function getRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 2) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}

export const Header: React.FC<HeaderProps> = ({ onUploadClick, period, isLive, reportDate }) => {
  const { theme, toggleTheme } = useTheme();
  const [runState, setRunState] = useState<RunState>('idle');

  const handleRunAnalysis = useCallback(async () => {
    if (runState === 'loading') return;
    setRunState('loading');

    try {
      let token: string | undefined;
      try {
        const user = auth.currentUser;
        if (user) {
          token = await user.getIdToken();
        }
      } catch {
        // Fall through without token — may work in emulator mode
      }

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/bigquery', {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      setRunState('success');
      setTimeout(() => setRunState('idle'), 4000);
    } catch {
      setRunState('error');
      setTimeout(() => setRunState('idle'), 4000);
    }
  }, [runState]);

  const runLabel = runState === 'loading' ? 'Running...' : runState === 'success' ? 'Done ✓' : runState === 'error' ? 'Failed ✗' : 'Run Analysis';
  const runColor = runState === 'success' ? 'var(--success)' : runState === 'error' ? 'var(--error)' : 'var(--text-primary)';

  const relativeTime = reportDate ? getRelativeTime(reportDate) : undefined;

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
          {/* Period pill with optional relative time */}
          <div style={{
            background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)',
            padding: '0.5rem 1rem', borderRadius: 5, fontFamily: 'var(--font-mono)', fontSize: '0.75rem',
            display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.1rem',
          }}>
            <span>{isLive ? period || 'Latest Live Report' : 'No Live Report'}</span>
            {relativeTime && (
              <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>
                {relativeTime}
              </span>
            )}
          </div>
          {/* Run Analysis button */}
          <button
            onClick={handleRunAnalysis}
            disabled={runState === 'loading'}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '0.5rem 1rem',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.75rem',
              color: runColor,
              cursor: runState === 'loading' ? 'not-allowed' : 'pointer',
              opacity: runState === 'loading' ? 0.6 : 1,
              transition: 'color 0.2s ease, opacity 0.2s ease',
              whiteSpace: 'nowrap',
            }}
          >
            {runLabel}
          </button>
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
          {auth.currentUser?.email && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                title={auth.currentUser.email}
                style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {auth.currentUser.email}
              </span>
              <button
                onClick={() => signOut(auth).catch(() => undefined)}
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '0.5rem 0.75rem',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.7rem',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.header>
  );
};
