import React from 'react';
import { motion } from 'framer-motion';
import { itemVariants } from '@/theme/animations';

export const AIBriefing: React.FC = () => (
  <motion.div variants={itemVariants} style={{
    background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10,
    padding: '1.5rem 2rem', marginBottom: '2rem', position: 'relative', overflow: 'hidden',
  }}>
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, height: 3,
      background: 'linear-gradient(to right, var(--prism-blue), var(--prism-green) 30%, var(--prism-amber) 70%, var(--prism-red))',
    }} />
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
        background: 'var(--accent-subtle)', color: 'var(--accent)',
        padding: '0.25rem 0.75rem', borderRadius: 4, fontFamily: 'var(--font-mono)',
        fontSize: 11, fontWeight: 500, letterSpacing: '0.05em',
      }}>
        <span style={{ width: 6, height: 6, background: 'var(--accent)', borderRadius: '50%', animation: 'pulse 2s ease infinite' }} />
        AI-GENERATED BRIEFING
      </span>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem' }}>Weekly Intelligence Summary</span>
    </div>
    <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', lineHeight: 1.75, maxWidth: 1100, margin: 0 }}>
      Global pipeline stands at <strong style={{ color: 'var(--text-primary)' }}>$47.2M</strong> across <strong style={{ color: 'var(--text-primary)' }}>347 opportunities</strong>, with a blended win rate of <span style={{ color: 'var(--success)', fontWeight: 600 }}>42%</span> — up 3 points from last quarter. The primary concern this week is a coordinated <span style={{ color: 'var(--error)', fontWeight: 600 }}>competitor FUD campaign on pricing</span> detected across 14 deals in NA and UK. Revenue at risk totals <span style={{ color: 'var(--error)', fontWeight: 600 }}>$4.2M</span> with 5 HIGH severity deals. Recommended immediate action: executive alignment calls on OPP #4782, #3291, #2847 representing <span style={{ color: 'var(--accent)', fontWeight: 600 }}>$2.8M</span> in combined pipeline value. Positive signal: <span style={{ color: 'var(--success)', fontWeight: 600 }}>AI/automation demand accelerating</span>, mentioned in 23% of active opportunities.
    </p>
  </motion.div>
);
