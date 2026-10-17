import React from 'react';
import type { RiskDeal } from '@/lib/types';
import type { RiskBand } from '@/lib/dealMetrics';
import { ACTIVITY_BUCKETS, repsIn, stagesIn, type ActivityBucket, type DealFilters } from '@/lib/dealFilters';
import { BAND_NAME, smallCaps } from '@/components/ui/tone';

export type DealsTabFilters = DealFilters & { hideReviewed?: boolean };

interface Props {
  deals: RiskDeal[];
  filters: DealsTabFilters;
  onChange: (patch: Partial<DealsTabFilters>) => void;
  exportCount: number;
  onExport: () => void;
}

const CLEARED: Partial<DealsTabFilters> = {
  rep: undefined, stage: undefined, band: undefined, activity: undefined,
  riskOnly: undefined, lateOnly: undefined, hideReviewed: undefined,
};

const selectStyle: React.CSSProperties = {
  width: '100%', minHeight: 40, padding: '0 0.6rem', borderRadius: 6, border: '1px solid var(--border-emphasis)',
  background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '0.85rem',
};
const fieldLabel: React.CSSProperties = { ...smallCaps, display: 'block', marginBottom: 4 };
const checkLabel: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 36, fontSize: '0.85rem', color: 'var(--text-primary)' };

export const DealFiltersBar: React.FC<Props> = ({ deals, filters, onChange, exportCount, onExport }) => {
  const chips: { label: string; clear: Partial<DealsTabFilters> }[] = [];
  if (filters.rep) chips.push({ label: `Rep: ${filters.rep}`, clear: { rep: undefined } });
  if (filters.stage) chips.push({ label: `Stage: ${filters.stage}`, clear: { stage: undefined } });
  if (filters.band) chips.push({ label: `Risk: ${BAND_NAME[filters.band]}`, clear: { band: undefined } });
  if (filters.activity) chips.push({ label: `Activity: ${ACTIVITY_BUCKETS.find(b => b.key === filters.activity)?.label}`, clear: { activity: undefined } });
  if (filters.riskOnly) chips.push({ label: 'At risk only', clear: { riskOnly: undefined } });
  if (filters.lateOnly) chips.push({ label: 'Late stage only', clear: { lateOnly: undefined } });
  if (filters.hideReviewed) chips.push({ label: 'Hiding reviewed', clear: { hideReviewed: undefined } });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(180px, 100%), 1fr))', gap: '0.75rem', alignItems: 'end' }}>
        <div>
          <label htmlFor="deals-rep" style={fieldLabel}>Rep</label>
          <select id="deals-rep" value={filters.rep ?? ''} onChange={e => onChange({ rep: e.target.value || undefined })} style={selectStyle}>
            <option value="">All reps</option>
            {repsIn(deals).map(rep => <option key={rep} value={rep}>{rep}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="deals-stage" style={fieldLabel}>Stage</label>
          <select id="deals-stage" value={filters.stage ?? ''} onChange={e => onChange({ stage: e.target.value || undefined })} style={selectStyle}>
            <option value="">All stages</option>
            {stagesIn(deals).map(stage => <option key={stage} value={stage}>{stage}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="deals-activity" style={fieldLabel}>Activity</label>
          <select id="deals-activity" value={filters.activity ?? ''} onChange={e => onChange({ activity: (e.target.value || undefined) as ActivityBucket | undefined })} style={selectStyle}>
            <option value="">Any activity</option>
            {ACTIVITY_BUCKETS.map(b => <option key={b.key} value={b.key}>{b.label} ({b.range})</option>)}
          </select>
        </div>
        <div role="group" aria-label="Risk band">
          <span style={fieldLabel}>Risk band</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['Red', 'Yellow', 'Green'] as RiskBand[]).map(band => {
              const active = filters.band === band;
              return (
                <button key={band} type="button" aria-pressed={active} onClick={() => onChange({ band: active ? undefined : band })} style={{
                  minHeight: 40, padding: '0 0.7rem', borderRadius: 6, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700,
                  border: `1px solid ${active ? 'var(--accent-fill)' : 'var(--border-emphasis)'}`,
                  background: active ? 'var(--accent-fill)' : 'var(--bg-surface)', color: active ? 'var(--on-accent)' : 'var(--text-primary)',
                }}>
                  {BAND_NAME[band]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem 1.2rem' }}>
        <label style={checkLabel}><input type="checkbox" checked={!!filters.riskOnly} onChange={e => onChange({ riskOnly: e.target.checked || undefined })} /> At risk only</label>
        <label style={checkLabel}><input type="checkbox" checked={!!filters.lateOnly} onChange={e => onChange({ lateOnly: e.target.checked || undefined })} /> Late stage only</label>
        <label style={checkLabel}><input type="checkbox" checked={!!filters.hideReviewed} onChange={e => onChange({ hideReviewed: e.target.checked || undefined })} /> Hide reviewed</label>
        <button type="button" onClick={onExport} disabled={exportCount === 0} style={{
          marginLeft: 'auto', minHeight: 36, padding: '0 0.85rem', borderRadius: 6, border: '1px solid var(--border-emphasis)',
          background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: '0.8rem',
          cursor: exportCount === 0 ? 'not-allowed' : 'pointer', opacity: exportCount === 0 ? 0.5 : 1,
        }}>
          Export CSV ({exportCount})
        </button>
      </div>

      {chips.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
          {chips.map(chip => (
            <span key={chip.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 4px 2px 10px', borderRadius: 999, background: 'var(--takeaway-bg)', color: 'var(--takeaway-text)', fontSize: '0.8rem', fontWeight: 600, maxWidth: '100%', overflowWrap: 'anywhere' }}>
              {chip.label}
              <button type="button" aria-label={`Remove filter: ${chip.label}`} onClick={() => onChange(chip.clear)} style={{ minWidth: 28, minHeight: 28, border: 'none', background: 'none', color: 'inherit', fontWeight: 800, cursor: 'pointer' }}>×</button>
            </span>
          ))}
          <button type="button" onClick={() => onChange(CLEARED)} style={{ minHeight: 28, border: 'none', background: 'none', color: 'var(--accent)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}>
            Clear all
          </button>
        </div>
      )}
    </div>
  );
};
