import React from 'react';
import type { Region } from '@/lib/types';
import { TABS, type TabKey } from '@/lib/dashboardView';

const REGION_OPTIONS: { key: Region; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'na', label: 'North America' },
  { key: 'uk', label: 'UK' },
  { key: 'au', label: 'AU / NZ' },
];

interface Props {
  tab: TabKey;
  region: Region;
  regionCounts?: Record<string, number>;
  onSelectTab: (tab: TabKey) => void;
  onSelectRegion: (region: Region) => void;
}

/** The one region control for the whole dashboard, plus the tab bar. Sticky so it is always in reach. */
export const DashboardNav: React.FC<Props> = ({ tab, region, regionCounts, onSelectTab, onSelectRegion }) => {
  const total = regionCounts ? Object.values(regionCounts).reduce((sum, n) => sum + n, 0) : undefined;
  const countFor = (key: Region) => (key === 'all' ? total : regionCounts ? (regionCounts[key] ?? 0) : undefined);

  // Manual activation: arrows/Home/End move focus only. Enter/Space selects via the native
  // button click, so browsing the tabs doesn't push a history entry per keypress.
  const onTabKeyDown = (e: React.KeyboardEvent, index: number) => {
    const last = TABS.length - 1;
    const target =
      e.key === 'ArrowRight' ? (index === last ? 0 : index + 1) :
      e.key === 'ArrowLeft' ? (index === 0 ? last : index - 1) :
      e.key === 'Home' ? 0 :
      e.key === 'End' ? last :
      undefined;
    if (target === undefined) return;
    e.preventDefault();
    document.getElementById(`tab-${TABS[target].key}`)?.focus();
  };

  return (
    <nav aria-label="Dashboard" style={{
      position: 'sticky', top: 0, zIndex: 20, background: 'var(--bg-deep)',
      borderBottom: '1px solid var(--border)', paddingTop: '0.75rem',
      display: 'flex', flexDirection: 'column', gap: '0.6rem',
    }}>
      <div role="group" aria-label="Region" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem' }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginRight: 4 }}>
          Region
        </span>
        {REGION_OPTIONS.map(opt => {
          const active = opt.key === region;
          const count = countFor(opt.key);
          return (
            <button
              key={opt.key}
              type="button"
              aria-pressed={active}
              aria-label={count != null ? `${opt.label}, ${count} deals` : undefined}
              onClick={() => onSelectRegion(opt.key)}
              style={{
                minHeight: 36, padding: '0 0.9rem', borderRadius: 999,
                border: `1px solid ${active ? 'var(--accent-fill)' : 'var(--border-emphasis)'}`,
                background: active ? 'var(--accent-fill)' : 'var(--bg-surface)',
                color: active ? 'var(--on-accent)' : 'var(--text-primary)',
                fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer',
              }}
            >
              {opt.label}
              {count != null && (
                <span style={{ marginLeft: 6, fontFamily: 'var(--font-mono)', fontSize: '0.7rem', opacity: active ? 1 : 0.8 }}>{count}</span>
              )}
            </button>
          );
        })}
      </div>
      <div role="tablist" aria-label="Dashboard sections" style={{ display: 'flex', gap: '0.25rem', overflowX: 'auto' }}>
        {TABS.map((t, i) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`tab-${t.key}`}
              aria-selected={active}
              aria-controls="dashboard-tabpanel"
              tabIndex={active ? 0 : -1}
              onClick={() => onSelectTab(t.key)}
              onKeyDown={e => onTabKeyDown(e, i)}
              style={{
                minHeight: 44, padding: '0 1rem', background: 'none', border: 'none',
                borderBottom: `3px solid ${active ? 'var(--accent)' : 'transparent'}`,
                color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                fontSize: '0.88rem', fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
