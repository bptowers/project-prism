import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { itemVariants } from '@/theme/animations';

function highlightBriefingText(text: string): React.ReactNode[] {
  const pattern = /(\$[\d,.]+[KMB]?|\d+%|\b\d+\b)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <strong key={match.index} style={{ color: 'var(--text-primary)', fontWeight: 800 }}>
        {match[0]}
      </strong>
    );
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

interface AIBriefingProps {
  briefing?: string;
  fallbackBriefing?: string;
  totalOpportunities?: number;
  period?: string;
  isLive?: boolean;
  /** Clamp to three lines with a "Read full briefing" toggle. */
  collapsible?: boolean;
  /** Caveat when a filter can't apply to the briefing, e.g. a selected region. */
  scopeNote?: string;
}

export const AIBriefing: React.FC<AIBriefingProps> = ({
  briefing,
  fallbackBriefing,
  totalOpportunities,
  period,
  isLive = false,
  collapsible = false,
  scopeNote,
}) => {
  const [expanded, setExpanded] = useState(false);
  const label = isLive ? period || 'Latest live analysis' : 'Awaiting live analysis';
  const displayBriefing = briefing || fallbackBriefing;

  return (
    <motion.div variants={itemVariants} style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10,
      padding: '1.5rem 2rem', marginBottom: 0, position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: 'linear-gradient(to right, var(--prism-blue), var(--prism-green) 30%, var(--prism-amber) 70%, var(--prism-red))',
      }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
          background: isLive ? 'var(--accent-subtle)' : 'rgba(120,120,120,0.08)',
          color: isLive ? 'var(--accent)' : 'var(--text-muted)',
          padding: '0.25rem 0.75rem', borderRadius: 4, fontFamily: 'var(--font-mono)',
          fontSize: 11, fontWeight: 500, letterSpacing: '0.05em',
        }}>
          <span style={{
            width: 6, height: 6,
            background: isLive ? 'var(--accent)' : 'var(--text-muted)',
            borderRadius: '50%',
            animation: isLive ? 'pulse 2s ease infinite' : 'none',
          }} />
          {isLive ? 'AI-GENERATED BRIEFING' : 'NO LIVE BRIEFING'}
        </span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem' }}>{label}</span>
        {isLive && totalOpportunities && (
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: '0.7rem',
            color: 'var(--text-muted)', marginLeft: 'auto',
          }}>
            {totalOpportunities} opportunities analysed
          </span>
        )}
      </div>
      {scopeNote && (
        <p style={{ margin: '-0.5rem 0 0.75rem', fontSize: '0.78rem', color: 'var(--warning-text)' }}>{scopeNote}</p>
      )}

      {isLive && displayBriefing ? (
        // Live LLM-generated briefing — numbers and metrics bolded for faster scanning
        <>
          <p style={{
            fontSize: '1rem', color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 1100, margin: 0,
            ...(collapsible && !expanded
              ? { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }
              : {}),
          }}>
            {highlightBriefingText(displayBriefing)}
          </p>
          {collapsible && (
            <button type="button" aria-expanded={expanded} onClick={() => setExpanded(e => !e)} style={{
              marginTop: '0.5rem', minHeight: 36, padding: 0, background: 'none', border: 'none',
              color: 'var(--accent)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer',
            }}>
              {expanded ? 'Show less' : 'Read full briefing'}
            </button>
          )}
        </>
      ) : isLive && !briefing ? (
        // Live data loaded but enrichment still running
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', margin: 0 }}>
          Intelligence briefing generating… analysis complete, enrichment pass in progress.
        </p>
      ) : (
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', margin: 0 }}>
          No live report available yet. Upload a CSV or trigger a BigQuery analysis to populate this briefing.
        </p>
      )}
    </motion.div>
  );
};
