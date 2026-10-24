import { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { UploadZone } from './components/UploadZone';
import { HealthScoreCard } from './components/HealthScoreCard';
import { ReasoningTrace } from './components/ReasoningTrace';
import { RecommendationsTable } from './components/RecommendationsTable';
import { RecipeCustomizer } from './components/RecipeCustomizer';
import { SupervisedTargetModal } from './components/SupervisedTargetModal';
import { OutlierDistribution } from './components/OutlierDistribution';
import { CorrelationMatrix } from './components/CorrelationMatrix';
import { CodeExport } from './components/CodeExport';
import { CleanedDataPreview } from './components/CleanedDataPreview';
import { DatasetOverview } from './components/DatasetOverview';
import { DataVisualizer } from './components/DataVisualizer';
import { DataRepairs } from './components/DataRepairs';

import type { AnalysisResponse, SampleDatasetInfo, RecipeOverride, CleaningReport } from './types';
import {
  fetchSampleDatasets,
  loadSampleDataset,
  uploadDatasetFile,
  getReportDownloadUrl,
  getPipelineDownloadUrl,
  getNotebookDownloadUrl,
} from './services/api';
import { FileJson, Code2, WandSparkles, BookOpen, Target, SlidersHorizontal, Table, FileSpreadsheet } from 'lucide-react';

export function App() {
  const [data, setData] = useState<AnalysisResponse | null>(null);
  const [sampleDatasets, setSampleDatasets] = useState<SampleDatasetInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [inspectCol, setInspectCol] = useState<string | null>(null);

  // Advanced features state
  const [customRecipe, setCustomRecipe] = useState<Record<string, RecipeOverride>>({});
  const [cleaningReport, setCleaningReport] = useState<CleaningReport | null>(null);
  const [targetModalOpen, setTargetModalOpen] = useState(false);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [recipeViewMode, setRecipeViewMode] = useState<'customizer' | 'rules'>('customizer');

  // Load options: the toggle on the upload screen, and the last uploaded file (kept so another Excel sheet can be re-loaded)
  const [autoRepair, setAutoRepair] = useState(true);
  const [loadedWithAutoRepair, setLoadedWithAutoRepair] = useState(true);
  const [lastFile, setLastFile] = useState<File | null>(null);

  useEffect(() => {
    fetchSampleDatasets()
      .then(setSampleDatasets)
      .catch((err) => console.error('Could not load sample dataset list:', err));
  }, []);

  // `sheet` is only passed when the user picks another sheet of an already uploaded Excel file
  const handleFileUpload = async (file: File, sheet?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await uploadDatasetFile(file, { autoRepair, sheet });
      setData(res);
      setLastFile(file);
      setLoadedWithAutoRepair(autoRepair);
      setInspectCol(null);
      setCustomRecipe({});
      setCleaningReport(null);
      setSelectedTarget(null);
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
      const res = await loadSampleDataset(sampleId, { autoRepair });
      setData(res);
      setLastFile(null);
      setLoadedWithAutoRepair(autoRepair);
      setInspectCol(null);
      setCustomRecipe({});
      setCleaningReport(null);
      setSelectedTarget(sampleId === 'titanic' ? 'Survived' : null);
      setActiveTab('overview');
    } catch (err: any) {
      setError(err.message || 'Failed to load sample dataset.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setData(null);
    setLastFile(null);
    setError(null);
    setInspectCol(null);
    setCustomRecipe({});
    setCleaningReport(null);
    setSelectedTarget(null);
    setActiveTab('overview');
  };

  const openColumn = (col: string, tab: string = 'visualizer') => {
    setInspectCol(col);
    setActiveTab(tab);
  };

  // A cleaning run is only valid for the target it was made with (the backend drops its copy too)
  const handleTargetSelect = (target: string) => {
    if (target !== selectedTarget) setCleaningReport(null);
    setSelectedTarget(target);
  };

  const handleCustomRecipeRunSuccess = (report: CleaningReport) => {
    setCleaningReport(report);
    setActiveTab('cleaned');
  };

  const recs = data?.inference.column_recommendations ?? {};
  const dropCount = Object.values(recs).filter((r) => r.should_drop).length;
  const missingCount = Object.values(recs).filter((r) => r.missing_pct > 0 && !r.should_drop).length;
  const outlierCount = Object.values(data?.facts.columns ?? {}).filter(
    (f) => (f.numeric_stats?.outliers_iqr_count ?? 0) > 0
  ).length;
  const collinearCount = data?.facts.high_correlation_pairs.length ?? 0;
  const columnList = data ? Object.keys(data.facts.columns) : [];
  const repairs = data?.repairs ?? [];
  const sheets = data?.metadata.all_sheets ?? [];

  return (
    <div className="min-h-screen amoled-bg text-zinc-100 flex flex-col selection:bg-zinc-800 selection:text-white">
      <Navbar
        data={data}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onReset={handleReset}
        onOpenTargetModal={() => setTargetModalOpen(true)}
        selectedTarget={selectedTarget}
        tabCounts={{
          repairs: repairs.length,
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
            autoRepair={autoRepair}
            onAutoRepairChange={setAutoRepair}
          />
        ) : (
          <div className="space-y-3">
            {/* Top Overview & Action Buttons Strip */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
              <HealthScoreCard
                health={data.inference.health_score}
                summary={data.facts.dataset_summary}
              />

              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                {/* Excel sheet picker: re-uploads the same file with the chosen sheet */}
                {lastFile && sheets.length > 1 && (
                  <label className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-zinc-950 border border-white/[0.08] text-[11px] font-mono text-zinc-300">
                    <FileSpreadsheet className="w-3.5 h-3.5 text-zinc-400" />
                    <span className="text-zinc-500">Sheet</span>
                    <select
                      value={data.metadata.sheet_name ?? sheets[0]}
                      disabled={loading}
                      onChange={(e) => handleFileUpload(lastFile, e.target.value)}
                      className="bg-zinc-950 text-zinc-200 focus:outline-none max-w-[160px] disabled:opacity-50"
                    >
                      {sheets.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <button
                  onClick={() => setTargetModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-zinc-950 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 text-[11px] font-mono transition"
                >
                  <Target className="w-3.5 h-3.5" />
                  <span>{selectedTarget ? `Target: ${selectedTarget}` : 'Target Mode'}</span>
                </button>

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

                <a
                  href={getNotebookDownloadUrl()}
                  download
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-zinc-950 border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 text-[11px] font-mono transition"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Notebook (.ipynb)
                </a>

                <button
                  onClick={() => setActiveTab('cleaned')}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-zinc-100 text-zinc-950 text-[11px] font-semibold hover:bg-white transition shadow-sm"
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

            {/* Active Tab View */}
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

              {activeTab === 'repairs' && (
                <DataRepairs repairs={repairs} autoRepairOn={loadedWithAutoRepair} />
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
                <div className="space-y-3">
                  {/* Toggle sub-view: Interactive Customizer vs Rule Detail Table */}
                  <div className="flex items-center justify-between pb-1">
                    <div className="flex items-center space-x-1 p-0.5 rounded-lg bg-zinc-950 border border-white/[0.08]">
                      <button
                        onClick={() => setRecipeViewMode('customizer')}
                        className={`px-3 py-1 rounded-md text-xs font-mono flex items-center space-x-1.5 transition ${
                          recipeViewMode === 'customizer'
                            ? 'bg-zinc-100 text-zinc-950 font-semibold'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        <span>Interactive Customizer</span>
                      </button>
                      <button
                        onClick={() => setRecipeViewMode('rules')}
                        className={`px-3 py-1 rounded-md text-xs font-mono flex items-center space-x-1.5 transition ${
                          recipeViewMode === 'rules'
                            ? 'bg-zinc-100 text-zinc-950 font-semibold'
                            : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        <Table className="w-3.5 h-3.5" />
                        <span>Expert Rules Rationale</span>
                      </button>
                    </div>
                  </div>

                  {recipeViewMode === 'customizer' ? (
                    <RecipeCustomizer
                      recommendations={data.inference.column_recommendations}
                      columnFacts={data.facts.columns}
                      customRecipe={customRecipe}
                      onRecipeChange={setCustomRecipe}
                      targetColumn={selectedTarget}
                      onRunSuccess={handleCustomRecipeRunSuccess}
                    />
                  ) : (
                    <RecommendationsTable
                      recommendations={data.inference.column_recommendations}
                      columnFacts={data.facts.columns}
                      selectedColumn={inspectCol}
                      onSelectedColumnChange={setInspectCol}
                    />
                  )}
                </div>
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
                <CleanedDataPreview
                  key={selectedTarget ?? 'no-target'}
                  initialReport={cleaningReport}
                  rawPreview={data.preview}
                  customRecipe={customRecipe}
                  targetColumn={selectedTarget}
                  onReportChange={setCleaningReport}
                />
              )}
            </div>
          </div>
        )}
      </main>

      {/* Supervised Target Mode Modal */}
      {targetModalOpen && (
        <SupervisedTargetModal
          columns={columnList}
          initialTarget={selectedTarget}
          onClose={() => setTargetModalOpen(false)}
          onTargetSelect={handleTargetSelect}
        />
      )}

      <footer className="border-t border-white/[0.04] bg-black py-2.5 text-xs text-zinc-500 font-mono">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-1 text-[11px]">
          <span>Datalysis v1.1 • Autonomous Expert Preprocessing System</span>
          <span>100% Local & Deterministic • Zero External API Dependencies</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
