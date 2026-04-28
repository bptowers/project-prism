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
import { TwentyQuestions } from '@/components/dashboard/TwentyQuestions';
import { CompetitiveDisplacement } from '@/components/dashboard/CompetitiveDisplacement';
import { DeltaIntelligence } from '@/components/dashboard/DeltaIntelligence';
import { Panel } from '@/components/ui/Panel';
import { UploadModal } from '@/components/dashboard/UploadModal';

export default function App() {
  const { region, data, selectRegion, loading, isLive, hasLiveData, forceSample, resetToSample, useLiveData, sampleHidden, clearSampleData, restoreSampleData, showingContent, executiveBriefing, totalOpportunities, reportPeriod, regionCounts, twentyQuestions, competitiveDisplacement, deltaIntelligence } = useRegion();
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
        {!isLive && (
          <button
            onClick={sampleHidden ? restoreSampleData : clearSampleData}
            style={{
              marginLeft: 8,
              padding: '3px 10px',
              fontSize: '0.7rem',
              fontFamily: 'var(--font-mono)',
              background: sampleHidden ? 'var(--accent)' : 'var(--bg-elevated)',
              border: `1px solid ${sampleHidden ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 4,
              color: sampleHidden ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {sampleHidden ? '+ Show Sample Data' : '✕ Clear Sample Data'}
          </button>
        )}
      </div>

      {!showingContent && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '6rem 2rem',
          textAlign: 'center',
          gap: '1.5rem',
        }}>
          <div style={{ fontSize: '3rem', opacity: 0.3 }}>◈</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', color: 'var(--text-primary)' }}>
            No live data yet
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-muted)', maxWidth: 420, lineHeight: 1.6 }}>
            Upload a Salesforce CSV export to run your first analysis. The intelligence engine will process your pipeline and populate this dashboard with live data.
          </div>
          <button
            onClick={() => setUploadOpen(true)}
            style={{
              padding: '10px 28px',
              fontSize: '0.85rem',
              fontFamily: 'var(--font-mono)',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 6,
              color: '#fff',
              cursor: 'pointer',
              marginTop: '0.5rem',
            }}
          >
            Upload CSV →
          </button>
        </div>
      )}

      <motion.div variants={containerVariants} initial="hidden" animate={showingContent ? 'visible' : 'hidden'} style={{ display: showingContent ? 'block' : 'none' }}>
        <AIBriefing
          briefing={executiveBriefing}
          totalOpportunities={totalOpportunities}
          period={reportPeriod}
          isLive={isLive}
        />

        {/* Risk Radar — hero position: first widget after briefing */}
        <div style={{ marginBottom: '2rem' }}>
          <Panel title="Risk Radar" accent="amber" meta={`${data.risks.length} deals at risk`}>
            <RiskRadar risks={data.risks} />
          </Panel>
        </div>

        <StatsRow stats={data.stats} sparklines={data.sparklines} />
        <RegionTabs region={region} onSelect={selectRegion} regionCounts={regionCounts} isLive={isLive} />
        <PipelineFunnel stages={data.funnel} />

        {/* 3-col Grid: themes + signals */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '1.5rem',
          marginBottom: '2rem',
        }}>
          <Panel title="Win Themes" accent="green" meta={`${data.winThemes.length} themes`}>
            <ThemeChart themes={data.winThemes} type="win" />
          </Panel>
          <Panel title="Loss Themes" accent="red" meta={`${data.lossThemes.length} themes`}>
            <ThemeChart themes={data.lossThemes} type="loss" />
          </Panel>
          <Panel title="Market Signals" accent="blue" meta={`${data.signals.length} signals`}>
            <MarketSignals signals={data.signals} />
          </Panel>
        </div>

        <TrendChart trendData={data.trendData} />
        <CompetitorIntel competitors={data.competitors} />
        <Recommendations items={data.recommendations} />
        <TwentyQuestions data={twentyQuestions} />
        <CompetitiveDisplacement data={competitiveDisplacement} />
        <DeltaIntelligence data={deltaIntelligence} />
        <ProcessingFooter />
      </motion.div>
    </div>
  );
}
