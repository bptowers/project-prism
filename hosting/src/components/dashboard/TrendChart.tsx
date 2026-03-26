import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { itemVariants } from '@/theme/animations';
import type { TrendData } from '@/lib/types';

interface Props { trendData: TrendData; }

export const TrendChart: React.FC<Props> = ({ trendData }) => {
  const svg = useMemo(() => {
    // Defensive fallback: old Firestore reports may have `anz` instead of `au`
    const td = trendData as TrendData & { anz?: number[] };
    const auVals: number[] = td.au?.length ? td.au : (td.anz ?? []);

    const w = 900, h = 180, padL = 45, padR = 20, padT = 20, padB = 35;
    const chartW = w - padL - padR, chartH = h - padT - padB;
    const allVals = [...trendData.all, ...trendData.na, ...trendData.uk, ...auVals];
    if (allVals.length === 0) return { viewBox: `0 0 ${w} ${h}`, content: '' };

    const minV = Math.min(...allVals) - 3, maxV = Math.max(...allVals) + 3;
    const rangeV = maxV - minV || 1;

    const toPath = (vals: number[]) => {
      if (!vals || vals.length < 2) return '';
      return vals.map((v, i) => {
        const x = padL + (i / (vals.length - 1)) * chartW;
        const y = padT + chartH - ((v - minV) / rangeV) * chartH;
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ');
    };

    const toArea = (vals: number[]) => {
      const path = toPath(vals);
      if (!path) return '';
      return `${path} L${padL + chartW},${padT + chartH} L${padL},${padT + chartH} Z`;
    };

    const gridLines = [30, 35, 40, 45, 50].filter(v => v >= minV && v <= maxV);
    const regionLines: { key: string; vals: number[]; color: string }[] = [
      { key: 'na', vals: trendData.na, color: 'var(--prism-blue)' },
      { key: 'uk', vals: trendData.uk, color: 'var(--prism-green)' },
      { key: 'au', vals: auVals, color: 'var(--prism-amber)' },
    ];

    let svgContent = `<defs><linearGradient id="tG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--accent)" stop-opacity="0.2"/><stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>`;
    gridLines.forEach(v => {
      const y = padT + chartH - ((v - minV) / rangeV) * chartH;
      svgContent += `<line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="var(--border)" stroke-width="0.5"/>`;
      svgContent += `<text x="${padL - 8}" y="${y + 3}" text-anchor="end" style="font-family:var(--font-mono);font-size:10px;fill:var(--text-muted)">${v}%</text>`;
    });
    trendData.weeks.forEach((label, i) => {
      const x = padL + (i / (trendData.weeks.length - 1)) * chartW;
      svgContent += `<text x="${x}" y="${h - 5}" text-anchor="middle" style="font-family:var(--font-mono);font-size:10px;fill:var(--text-muted)">${label}</text>`;
    });
    regionLines.forEach(({ vals, color }) => {
      const path = toPath(vals);
      if (path) svgContent += `<path d="${path}" fill="none" stroke="${color}" stroke-width="1" stroke-opacity="0.4" stroke-dasharray="4,4"/>`;
    });
    const allArea = toArea(trendData.all);
    if (allArea) svgContent += `<path d="${allArea}" fill="url(#tG)"/>`;
    const allPath = toPath(trendData.all);
    if (allPath) svgContent += `<path d="${allPath}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;
    trendData.all.forEach((v, i) => {
      const x = padL + (i / (trendData.all.length - 1)) * chartW;
      const y = padT + chartH - ((v - minV) / rangeV) * chartH;
      svgContent += `<circle cx="${x}" cy="${y}" r="3" fill="var(--accent)" stroke="var(--bg-surface)" stroke-width="2"/>`;
    });

    return { viewBox: `0 0 ${w} ${h}`, content: svgContent };
  }, [trendData]);

  return (
    <motion.div variants={itemVariants} style={{ marginBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem' }}>Win Rate Trend</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>8-week rolling | By region</span>
      </div>
      <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '1.5rem' }}>
        <svg viewBox={svg.viewBox} style={{ width: '100%', height: 200 }} preserveAspectRatio="xMidYMid meet" dangerouslySetInnerHTML={{ __html: svg.content }} />
        <div style={{ display: 'flex', gap: 24, marginTop: 8, paddingLeft: 45 }}>
          {[
            { label: 'All Regions', color: 'var(--accent)',       dash: false },
            { label: 'North America', color: 'var(--prism-blue)', dash: true  },
            { label: 'UK',            color: 'var(--prism-green)', dash: true  },
            { label: 'AU / NZ',       color: 'var(--prism-amber)', dash: true  },
          ].map(item => (
            <span key={item.label} style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: item.color, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 20, height: item.dash ? 0 : 2, background: item.dash ? 'none' : item.color, borderTop: item.dash ? `2px dashed ${item.color}` : 'none', display: 'inline-block' }} />
              {item.label}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
};
