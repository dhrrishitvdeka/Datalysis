import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { UploadZone } from './components/UploadZone';
import { HealthScoreCard } from './components/HealthScoreCard';
import { ReasoningTrace } from './components/ReasoningTrace';
import { RecommendationsTable } from './components/RecommendationsTable';
import { OutlierDistribution } from './components/OutlierDistribution';
import { CorrelationMatrix } from './components/CorrelationMatrix';
import { CodeExport } from './components/CodeExport';
import { CleanedDataPreview } from './components/CleanedDataPreview';
import { DatasetOverview } from './components/DatasetOverview';
import { DataVisualizer } from './components/DataVisualizer';

import type { AnalysisResponse, SampleDatasetInfo } from './types';
import {
  fetchSampleDatasets,
  loadSampleDataset,
  uploadDatasetFile,
  getReportDownloadUrl,
  getPipelineDownloadUrl,
} from './services/api';
import { FileJson, Code2, WandSparkles } from 'lucide-react';

export function App() {
  const [data, setData] = useState<AnalysisResponse | null>(null);
  const [sampleDatasets, setSampleDatasets] = useState<SampleDatasetInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [inspectCol, setInspectCol] = useState<string | null>(null);

  useEffect(() => {
    fetchSampleDatasets()
      .then(setSampleDatasets)
      .catch((err) => console.error('Could not load sample dataset list:', err));
  }, []);

  const handleFileUpload = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const res = await uploadDatasetFile(file);
      setData(res);
      setInspectCol(null);
      setActiveTab('overview');
    } catch (err: any) {
      setError(err.message || 'Failed to analyze dataset.');
    } finally {
      setLoading(false);
    }
  };

  const handleSampleSelect = async (sampleId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await loadSampleDataset(sampleId);
      setData(res);
      setInspectCol(null);
      setActiveTab('overview');
    } catch (err: any) {
      setError(err.message || 'Failed to load sample dataset.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setData(null);
    setError(null);
    setInspectCol(null);
    setActiveTab('overview');
  };

  const openColumn = (col: string, tab: string = 'visualizer') => {
    setInspectCol(col);
    setActiveTab(tab);
  };

  const recs = data?.inference.column_recommendations ?? {};
  const dropCount = Object.values(recs).filter((r) => r.should_drop).length;
  const missingCount = Object.values(recs).filter((r) => r.missing_pct > 0 && !r.should_drop).length;
  const outlierCount = Object.values(data?.facts.columns ?? {}).filter(
    (f) => (f.numeric_stats?.outliers_iqr_count ?? 0) > 0
  ).length;
  const collinearCount = data?.facts.high_correlation_pairs.length ?? 0;

  return (
    <div className="min-h-screen amoled-bg text-zinc-100 flex flex-col selection:bg-zinc-800 selection:text-white">
      <Navbar
        data={data}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onReset={handleReset}
        tabCounts={{
          recommendations: dropCount + missingCount,
          distributions: outlierCount,
          correlations: collinearCount,
        }}
      />

      <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 py-4">
        {error && (
          <div className="mb-3 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between font-mono">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-zinc-400 hover:text-white text-xs underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {!data ? (
          <UploadZone
            onFileUpload={handleFileUpload}
            onSampleSelect={handleSampleSelect}
            sampleDatasets={sampleDatasets}
            isLoading={loading}
          />
        ) : (
          <div className="space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
              <HealthScoreCard
                health={data.inference.health_score}
                summary={data.facts.dataset_summary}
              />
              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                <a
                  href={getReportDownloadUrl()}
                  download
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-zinc-950 border border-white/[0.08] text-[11px] font-mono text-zinc-300 hover:text-white hover:border-white/20 transition"
                >
                  <FileJson className="w-3.5 h-3.5" />
                  Audit JSON
                </a>
                <a
                  href={getPipelineDownloadUrl()}
                  download="datalysis_pipeline.py"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-zinc-950 border border-white/[0.08] text-[11px] font-mono text-zinc-300 hover:text-white hover:border-white/20 transition"
                >
                  <Code2 className="w-3.5 h-3.5" />
                  pipeline.py
                </a>
                <button
                  onClick={() => setActiveTab('cleaned')}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-zinc-100 text-zinc-950 text-[11px] font-semibold hover:bg-white transition"
                >
                  <WandSparkles className="w-3.5 h-3.5" />
                  Clean & Export
                </button>
              </div>
            </div>

            <ReasoningTrace
              trace={data.inference.reasoning_trace}
              rulesCount={data.inference.triggered_rules_count}
            />

            <div className="pt-1">
              {activeTab === 'overview' && (
                <DatasetOverview
                  summary={data.facts.dataset_summary}
                  metadata={data.metadata}
                  preview={data.preview}
                  columnFacts={data.facts.columns}
                  recommendations={data.inference.column_recommendations}
                  onInspectColumn={(col) => openColumn(col, 'visualizer')}
                  onOpenRecipes={(col) => openColumn(col, 'recommendations')}
                />
              )}

              {activeTab === 'visualizer' && (
                <DataVisualizer
                  columnFacts={data.facts.columns}
                  recommendations={data.inference.column_recommendations}
                  selectedColumn={inspectCol}
                  onSelectedColumnChange={setInspectCol}
                />
              )}

              {activeTab === 'recommendations' && (
                <RecommendationsTable
                  recommendations={data.inference.column_recommendations}
                  columnFacts={data.facts.columns}
                  selectedColumn={inspectCol}
                  onSelectedColumnChange={setInspectCol}
                />
              )}

              {activeTab === 'distributions' && (
                <OutlierDistribution
                  columnFacts={data.facts.columns}
                  recommendations={data.inference.column_recommendations}
                />
              )}

              {activeTab === 'correlations' && (
                <CorrelationMatrix
                  pairs={data.facts.high_correlation_pairs}
                  matrix={data.facts.correlation_matrix}
                  missingPairs={data.facts.missing_corr_pairs ?? []}
                />
              )}

              {activeTab === 'pipeline' && (
                <CodeExport code={data.pipeline_code} />
              )}

              {activeTab === 'cleaned' && (
                <CleanedDataPreview initialReport={null} />
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-white/[0.04] bg-black py-2.5 text-xs text-zinc-600 font-mono">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-1 text-[11px]">
          <span>Datalysis • Local rule-based preprocessing</span>
          <span>No external API calls • Data stays on this machine</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
