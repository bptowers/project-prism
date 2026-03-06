import React from 'react';
import { motion } from 'framer-motion';
import { itemVariants } from '@/theme/animations';

interface AIBriefingProps {
  briefing?: string;
  totalOpportunities?: number;
  period?: string;
  isLive?: boolean;
}

export const AIBriefing: React.FC<AIBriefingProps> = ({
  briefing,
  totalOpportunities,
  period,
  isLive = false,
}) => {
  const label = period || 'Weekly Intelligence Summary';

  return (
    <motion.div variants={itemVariants} style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10,
      padding: '1.5rem 2rem', marginBottom: '2rem', position: 'relative', overflow: 'hidden',
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
          {isLive ? 'AI-GENERATED BRIEFING' : 'SAMPLE BRIEFING'}
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

      {isLive && briefing ? (
        // Live LLM-generated briefing — render as plain text with preserved formatting
        <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 1100, margin: 0 }}>
          {briefing}
        </p>
      ) : isLive && !briefing ? (
        // Live data loaded but enrichment still running
        <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', margin: 0 }}>
          Intelligence briefing generating… analysis complete, enrichment pass in progress.
        </p>
      ) : (
        // Sample data — clearly labelled
        <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 1100, margin: 0, opacity: 0.7 }}>
          Global pipeline stands at <strong style={{ color: 'var(--text-primary)' }}>$47.2M</strong> across <strong style={{ color: 'var(--text-primary)' }}>347 opportunities</strong>, with a blended win rate of <span style={{ color: 'var(--success)', fontWeight: 600 }}>42%</span> — up 3 points from last quarter. The primary concern this week is a coordinated <span style={{ color: 'var(--error)', fontWeight: 600 }}>competitor FUD campaign on pricing</span> detected across 14 deals in NA and UK. <em style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>(Upload a CSV to replace this with live intelligence.)</em>
        </p>
      )}
    </motion.div>
  );
};
