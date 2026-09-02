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
import { fetchSampleDatasets, loadSampleDataset, uploadDatasetFile } from './services/api';

export function App() {
  const [data, setData] = useState<AnalysisResponse | null>(null);
  const [sampleDatasets, setSampleDatasets] = useState<SampleDatasetInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('overview');

  useEffect(() => {
    fetchSampleDatasets()
      .then(setSampleDatasets)
      .catch((err) => console.error("Could not load sample dataset list:", err));
  }, []);

  const handleFileUpload = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const res = await uploadDatasetFile(file);
      setData(res);
      setActiveTab('overview');
    } catch (err: any) {
      setError(err.message || "Failed to analyze dataset.");
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
      setActiveTab('overview');
    } catch (err: any) {
      setError(err.message || "Failed to load sample dataset.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setData(null);
    setError(null);
    setActiveTab('overview');
  };

  return (
    <div className="min-h-screen amoled-bg text-zinc-100 flex flex-col selection:bg-zinc-800 selection:text-white">
      <Navbar
        data={data}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onReset={handleReset}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center justify-between font-mono">
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
          <div className="space-y-4">
            {/* Top Diagnostics: Health Metric & Reasoning Trace */}
            <HealthScoreCard
              health={data.inference.health_score}
              summary={data.facts.dataset_summary}
            />

            <ReasoningTrace
              trace={data.inference.reasoning_trace}
              rulesCount={data.inference.triggered_rules_count}
            />

            {/* Active Tab View */}
            <div className="pt-2">
              {activeTab === 'overview' && (
                <DatasetOverview
                  summary={data.facts.dataset_summary}
                  metadata={data.metadata}
                  preview={data.preview}
                />
              )}

              {activeTab === 'visualizer' && (
                <DataVisualizer
                  columnFacts={data.facts.columns}
                  recommendations={data.inference.column_recommendations}
                />
              )}

              {activeTab === 'recommendations' && (
                <RecommendationsTable
                  recommendations={data.inference.column_recommendations}
                  columnFacts={data.facts.columns}
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

      {/* Footer */}
      <footer className="border-t border-white/[0.04] bg-black py-3 text-xs text-zinc-600 font-mono">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px]">
          <span>Datalysis • Deterministic Rule-Based Preprocessing Engine</span>
          <span>Zero External LLM Calls • Local Execution</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
