import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { itemVariants } from '@/theme/animations';
import { Button } from '@/components/ui/Button';
import { useTheme } from '@/theme/ThemeProvider';
import { signOut, onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface HeaderProps {
  onUploadClick?: () => void;
  period?: string;
  isLive?: boolean;
  /** ISO timestamp of when the report was generated (createdAt), used for "Nh ago". */
  generatedAt?: string;
}

type RunState = 'idle' | 'confirming' | 'loading' | 'started' | 'success' | 'error' | 'unauthenticated';

// The hosting rewrite to the function gives up after 60s and answers 504
// while the function keeps running. Abort our own fetch just after that so
// a hung connection also resolves to "started" rather than spinning forever.
const RUN_FETCH_TIMEOUT_MS = 65_000;
const STATUS_RESET_MS = 6_000;

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

const smallButton: React.CSSProperties = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '0.5rem 1rem',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.75rem',
  color: 'var(--text-primary)',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  transition: 'color 0.2s ease, opacity 0.2s ease',
};

export const Header: React.FC<HeaderProps> = ({ onUploadClick, period, isLive, generatedAt }) => {
  const { theme, toggleTheme } = useTheme();
  const [runState, setRunState] = useState<RunState>('idle');
  const [runError, setRunError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  // Subscribe to auth state instead of reading auth.currentUser during render,
  // which is stale until something else re-renders the header.
  useEffect(() => onAuthStateChanged(auth, setUser), []);

  // Transient statuses fall back to idle after a few seconds.
  useEffect(() => {
    if (runState !== 'success' && runState !== 'error' && runState !== 'unauthenticated' && runState !== 'started') return;
    const id = setTimeout(() => { setRunState('idle'); setRunError(null); }, STATUS_RESET_MS);
    return () => clearTimeout(id);
  }, [runState]);

  const handleRunClick = useCallback(() => {
    if (runState !== 'idle') return;
    if (!user) {
      setRunState('unauthenticated');
      return;
    }
    setRunState('confirming');
  }, [runState, user]);

  const handleConfirmRun = useCallback(async () => {
    if (!user) {
      setRunState('unauthenticated');
      return;
    }
    setRunState('loading');
    setRunError(null);

    const controller = new AbortController();
    const abortTimer = setTimeout(() => controller.abort(), RUN_FETCH_TIMEOUT_MS);

    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/bigquery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
        signal: controller.signal,
      });

      if (res.ok) {
        setRunState('success');
      } else if (res.status === 504) {
        // Hosting rewrite timed out; the function is still running.
        setRunState('started');
      } else {
        setRunError(`HTTP ${res.status}`);
        setRunState('error');
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        setRunState('started');
      } else {
        setRunError(err instanceof Error ? err.message : String(err));
        setRunState('error');
      }
    } finally {
      clearTimeout(abortTimer);
    }
  }, [user]);

  const runLabel =
    runState === 'loading' ? 'Running...' :
    runState === 'success' ? 'Done ✓' :
    runState === 'started' ? 'Run started — results appear when the report updates' :
    runState === 'error' ? `Failed (${runError ?? 'unknown error'})` :
    runState === 'unauthenticated' ? 'Sign in required' :
    'Run Analysis';
  const runColor =
    runState === 'success' || runState === 'started' ? 'var(--success)' :
    runState === 'error' || runState === 'unauthenticated' ? 'var(--error)' :
    'var(--text-primary)';

  const relativeTime = generatedAt ? getRelativeTime(generatedAt) : undefined;

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

          {/* Run Analysis: two-click confirm */}
          {runState === 'confirming' ? (
            <div role="group" aria-label="Confirm run analysis" style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              background: 'var(--bg-elevated)', border: '1px solid var(--warning)', borderRadius: 6,
              padding: '0.35rem 0.5rem 0.35rem 0.85rem',
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                Run full analysis? ~10 min, re-generates today's report.
              </span>
              <button onClick={handleConfirmRun} style={{ ...smallButton, padding: '0.35rem 0.75rem', background: 'var(--accent)', color: '#fff', border: 'none' }}>
                Run
              </button>
              <button onClick={() => setRunState('idle')} style={{ ...smallButton, padding: '0.35rem 0.75rem', color: 'var(--text-secondary)' }}>
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={handleRunClick}
              disabled={runState === 'loading'}
              aria-live="polite"
              style={{
                ...smallButton,
                color: runColor,
                cursor: runState === 'loading' ? 'not-allowed' : runState === 'idle' ? 'pointer' : 'default',
                opacity: runState === 'loading' ? 0.6 : 1,
              }}
            >
              {runLabel}
            </button>
          )}

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
          {user?.email && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                title={user.email}
                style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {user.email}
              </span>
              <button
                onClick={() => signOut(auth).catch(() => undefined)}
                style={{ ...smallButton, padding: '0.5rem 0.75rem', fontSize: '0.7rem', color: 'var(--text-secondary)' }}
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
