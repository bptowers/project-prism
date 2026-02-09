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
  const { region, data, selectRegion } = useRegion();
  const [uploadOpen, setUploadOpen] = useState(false);

  return (
    <div style={{ maxWidth: 1920, margin: '0 auto', padding: '0 2rem' }}>
      <Header onUploadClick={() => setUploadOpen(true)} />
      <UploadModal isOpen={uploadOpen} onClose={() => setUploadOpen(false)} />
      <PrismBar style={{ marginBottom: '2rem' }} />

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
          <Panel title="Win Themes" accent="green" meta={`146 wins analyzed`}>
            <ThemeChart themes={data.winThemes} type="win" />
          </Panel>
          <Panel title="Loss Themes" accent="red" meta={`89 losses analyzed`}>
            <ThemeChart themes={data.lossThemes} type="loss" />
          </Panel>
          <Panel title="Risk Radar" accent="amber" meta="$4.2M at risk">
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
