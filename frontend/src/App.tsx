import { useState, useEffect } from 'react';
import { FileSpreadsheet } from 'lucide-react';
import { Navbar } from './components/Navbar';
import { SideNav, VIEWS } from './components/SideNav';
import type { ViewId } from './components/SideNav';
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
import { Notice } from './components/ui';

import type { AnalysisResponse, SampleDatasetInfo, RecipeOverride, CleaningReport } from './types';
import { fetchSampleDatasets, loadSampleDataset, uploadDatasetFile } from './services/api';

export function App() {
  const [data, setData] = useState<AnalysisResponse | null>(null);
  const [sampleDatasets, setSampleDatasets] = useState<SampleDatasetInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ViewId>('overview');
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

  const openColumn = (col: string, tab: ViewId = 'visualizer') => {
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
  const view = VIEWS.find((v) => v.id === activeTab) ?? VIEWS[0];

  const errorBanner = error && (
    <div className="mb-6">
      <Notice tone="bad" title="Something went wrong">
        <span className="break-words">{error}</span>{' '}
        <button type="button" onClick={() => setError(null)} className="font-medium underline underline-offset-2">
          Dismiss
        </button>
      </Notice>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-bg text-ink">
      <Navbar
        data={data}
        onReset={handleReset}
        onOpenTargetModal={() => setTargetModalOpen(true)}
        selectedTarget={selectedTarget}
      />

      {!data ? (
        <main className="flex-1">
          <div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6">{errorBanner}</div>
          <UploadZone
            onFileUpload={handleFileUpload}
            onSampleSelect={handleSampleSelect}
            sampleDatasets={sampleDatasets}
            isLoading={loading}
            autoRepair={autoRepair}
            onAutoRepairChange={setAutoRepair}
          />
        </main>
      ) : (
        <div className="flex flex-1 flex-col lg:flex-row">
          <SideNav
            active={activeTab}
            onSelect={setActiveTab}
            counts={{
              repairs: repairs.length,
              trace: data.inference.triggered_rules_count,
              recommendations: dropCount + missingCount,
              distributions: outlierCount,
              correlations: collinearCount,
            }}
          />

          <main className="min-w-0 flex-1 px-4 py-8 sm:px-8">
            <div className="mx-auto max-w-[1280px]">
              {errorBanner}

              <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                  <h1 className="text-2xl">{view.title}</h1>
                  <p className="mt-1 max-w-2xl text-ink-3">{view.blurb}</p>
                </div>

                {/* Excel sheet picker: re-uploads the same file with the chosen sheet */}
                {activeTab === 'overview' && lastFile && sheets.length > 1 && (
                  <label className="flex items-center gap-2 text-sm text-ink-2">
                    <FileSpreadsheet className="h-4 w-4 text-ink-3" aria-hidden />
                    Sheet
                    <select
                      value={data.metadata.sheet_name ?? sheets[0]}
                      disabled={loading}
                      onChange={(e) => handleFileUpload(lastFile, e.target.value)}
                      className="field max-w-[220px]"
                    >
                      {sheets.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              {activeTab === 'overview' && (
                <div className="space-y-6">
                  <HealthScoreCard
                    health={data.inference.health_score}
                    onOpenRepairs={() => setActiveTab('repairs')}
                  />
                  <DatasetOverview
                    summary={data.facts.dataset_summary}
                    metadata={data.metadata}
                    preview={data.preview}
                    columnFacts={data.facts.columns}
                    recommendations={data.inference.column_recommendations}
                    onInspectColumn={(col) => openColumn(col, 'visualizer')}
                    onOpenRecipes={(col) => openColumn(col, 'recommendations')}
                  />
                </div>
              )}

              {activeTab === 'repairs' && <DataRepairs repairs={repairs} autoRepairOn={loadedWithAutoRepair} />}

              {activeTab === 'visualizer' && (
                <DataVisualizer
                  columnFacts={data.facts.columns}
                  recommendations={data.inference.column_recommendations}
                  selectedColumn={inspectCol}
                  onSelectedColumnChange={setInspectCol}
                />
              )}

              {activeTab === 'trace' && (
                <ReasoningTrace
                  trace={data.inference.reasoning_trace}
                  rulesCount={data.inference.triggered_rules_count}
                />
              )}

              {activeTab === 'recommendations' && (
                <div className="space-y-5">
                  <div className="seg" role="group" aria-label="Recipe view">
                    <button
                      type="button"
                      aria-pressed={recipeViewMode === 'customizer'}
                      onClick={() => setRecipeViewMode('customizer')}
                    >
                      Edit recipe
                    </button>
                    <button type="button" aria-pressed={recipeViewMode === 'rules'} onClick={() => setRecipeViewMode('rules')}>
                      Why these rules
                    </button>
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

              {activeTab === 'pipeline' && <CodeExport code={data.pipeline_code} />}

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
          </main>
        </div>
      )}

      {targetModalOpen && (
        <SupervisedTargetModal
          columns={columnList}
          initialTarget={selectedTarget}
          onClose={() => setTargetModalOpen(false)}
          onTargetSelect={handleTargetSelect}
        />
      )}
    </div>
  );
}

export default App;
