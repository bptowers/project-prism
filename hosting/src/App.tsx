import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { containerVariants } from '@/theme/animations';
import { useRegion } from '@/hooks/useRegion';
import { Header } from '@/components/layout/Header';
import { PrismBar } from '@/components/layout/PrismBar';
import { ProcessingFooter } from '@/components/layout/ProcessingFooter';
import { AIBriefing } from '@/components/dashboard/AIBriefing';
import { StatsRow } from '@/components/dashboard/StatsRow';
import { RegionTabs } from '@/components/dashboard/RegionTabs';
import { PipelineFunnel } from '@/components/dashboard/PipelineFunnel';
import { ThemeChart } from '@/components/dashboard/ThemeChart';
import { RiskRadar } from '@/components/dashboard/RiskRadar';
import { MarketSignals } from '@/components/dashboard/MarketSignals';
import { TrendChart } from '@/components/dashboard/TrendChart';
import { CompetitorIntel } from '@/components/dashboard/CompetitorIntel';
import { Recommendations } from '@/components/dashboard/Recommendations';
import { Panel } from '@/components/ui/Panel';
import { UploadModal } from '@/components/dashboard/UploadModal';

export default function App() {
  const { region, data, selectRegion, loading, isLive, hasLiveData, forceSample, resetToSample, useLiveData } = useRegion();
  const [uploadOpen, setUploadOpen] = useState(false);

  return (
    <div style={{ maxWidth: 1920, margin: '0 auto', padding: '0 2rem' }}>
      <Header onUploadClick={() => setUploadOpen(true)} />
      <UploadModal isOpen={uploadOpen} onClose={() => setUploadOpen(false)} />
      <PrismBar style={{ marginBottom: '2rem' }} />

      {/* Data source indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: '1rem',
        fontSize: '0.75rem',
        fontFamily: 'var(--font-mono)',
      }}>
        <span style={{
          display: 'inline-block',
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: isLive ? 'var(--success)' : 'var(--text-muted)',
        }} />
        <span style={{ color: isLive ? 'var(--success)' : 'var(--text-muted)' }}>
          {loading ? 'Loading...' : isLive ? 'Live Data' : 'Sample Data'}
        </span>
        {hasLiveData && (
          <button
            onClick={forceSample ? useLiveData : resetToSample}
            style={{
              marginLeft: 8,
              padding: '3px 10px',
              fontSize: '0.7rem',
              fontFamily: 'var(--font-mono)',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {forceSample ? '← Back to Live Data' : 'Reset to Sample Data'}
          </button>
        )}
      </div>

      <motion.div variants={containerVariants} initial="hidden" animate="visible">
        <AIBriefing />
        <StatsRow stats={data.stats} sparklines={data.sparklines} />
        <RegionTabs region={region} onSelect={selectRegion} />
        <PipelineFunnel stages={data.funnel} />

        {/* 2x2 Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '1.5rem',
          marginBottom: '2rem',
        }}>
          <Panel title="Win Themes" accent="green" meta={`${data.winThemes.length} themes`}>
            <ThemeChart themes={data.winThemes} type="win" />
          </Panel>
          <Panel title="Loss Themes" accent="red" meta={`${data.lossThemes.length} themes`}>
            <ThemeChart themes={data.lossThemes} type="loss" />
          </Panel>
          <Panel title="Risk Radar" accent="amber" meta={`${data.risks.length} at risk`}>
            <RiskRadar risks={data.risks} />
          </Panel>
          <Panel title="Market Signals" accent="blue" meta={`${data.signals.length} signals`}>
            <MarketSignals signals={data.signals} />
          </Panel>
        </div>

        <TrendChart trendData={data.trendData} />
        <CompetitorIntel competitors={data.competitors} />
        <Recommendations items={data.recommendations} />
        <ProcessingFooter />
      </motion.div>
    </div>
  );
}
