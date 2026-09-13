import React, { useState } from 'react';
import {
  Play,
  Download,
  CheckCircle2,
  ArrowRight,
  FileCheck,
  FileSpreadsheet,
  Database,
  BookOpen,
  Code2,
  ChevronDown,
} from 'lucide-react';
import type { CleaningReport, RecipeOverride } from '../types';
import {
  executePreprocessing,
  getCleanedDownloadUrl,
  getNotebookDownloadUrl,
  getSchemaDownloadUrl,
} from '../services/api';
import { DataDiffViewer } from './DataDiffViewer';

interface CleanedDataPreviewProps {
  initialReport: CleaningReport | null;
  rawPreview?: Record<string, any>[];
  customRecipe?: Record<string, RecipeOverride>;
  onReportChange?: (report: CleaningReport) => void;
}

export const CleanedDataPreview: React.FC<CleanedDataPreviewProps> = ({
  initialReport,
  rawPreview = [],
  customRecipe = {},
  onReportChange,
}) => {
  const [report, setReport] = useState<CleaningReport | null>(initialReport);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);

  const handleRunPreprocessing = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = Object.keys(customRecipe).length > 0 ? { column_overrides: customRecipe } : undefined;
      const res = await executePreprocessing(payload);
      setReport(res);
      onReportChange?.(res);
    } catch (err: any) {
      setError(err.message || 'Preprocessing execution failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Action Header */}
      <div className="p-5 rounded-xl glass-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <FileCheck className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white font-mono">
              In-Memory Pipeline Execution & Export
            </h3>
            {Object.keys(customRecipe).length > 0 && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Custom Recipe Active ({Object.keys(customRecipe).length} overrides)
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400">
            Executes full deterministic transformations: column pruning, imputation, Winsorization, power transforms, and feature encoding.
          </p>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto relative">
          <button
            onClick={handleRunPreprocessing}
            disabled={loading}
            className="flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-white disabled:opacity-30 text-zinc-950 text-xs font-semibold flex items-center justify-center space-x-1.5 transition"
          >
            {loading ? (
              <span className="flex items-center space-x-2">
                <span className="w-3 h-3 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin" />
                <span>Transforming...</span>
              </span>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{report ? 'Re-Run Pipeline' : 'Run Preprocessing'}</span>
              </>
            )}
          </button>

          {report && (
            <div className="relative">
              <button
                onClick={() => setExportMenuOpen(!exportMenuOpen)}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-medium flex items-center space-x-1.5 border border-white/[0.08] transition"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Dataset</span>
                <ChevronDown className="w-3 h-3 text-zinc-400" />
              </button>

              {exportMenuOpen && (
                <div
                  className="absolute right-0 mt-1 w-56 rounded-xl bg-zinc-950 border border-white/[0.1] shadow-2xl p-1.5 z-30 space-y-1 font-mono text-xs"
                  onMouseLeave={() => setExportMenuOpen(false)}
                >
                  <a
                    href={getCleanedDownloadUrl('csv')}
                    download
                    onClick={() => setExportMenuOpen(false)}
                    className="flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 text-zinc-300 hover:text-white transition"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-400" />
                    <span>CSV (.csv)</span>
                  </a>
                  <a
                    href={getCleanedDownloadUrl('excel')}
                    download
                    onClick={() => setExportMenuOpen(false)}
                    className="flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 text-zinc-300 hover:text-white transition"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Excel (.xlsx Multi-Sheet)</span>
                  </a>
                  <a
                    href={getCleanedDownloadUrl('parquet')}
                    download
                    onClick={() => setExportMenuOpen(false)}
                    className="flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 text-zinc-300 hover:text-white transition"
                  >
                    <Database className="w-3.5 h-3.5 text-blue-400" />
                    <span>Parquet (.parquet)</span>
                  </a>
                  <a
                    href={getCleanedDownloadUrl('sqlite')}
                    download
                    onClick={() => setExportMenuOpen(false)}
                    className="flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 text-zinc-300 hover:text-white transition"
                  >
                    <Database className="w-3.5 h-3.5 text-purple-400" />
                    <span>SQLite Database (.db)</span>
                  </a>
                  <div className="h-px bg-white/[0.08] my-1" />
                  <a
                    href={getNotebookDownloadUrl()}
                    download
                    onClick={() => setExportMenuOpen(false)}
                    className="flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 text-zinc-300 hover:text-white transition"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                    <span>Jupyter Notebook (.ipynb)</span>
                  </a>
                  <a
                    href={getSchemaDownloadUrl()}
                    download
                    onClick={() => setExportMenuOpen(false)}
                    className="flex items-center space-x-2 px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 text-zinc-300 hover:text-white transition"
                  >
                    <Code2 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Pandera Schema (.py)</span>
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-mono">
          {error}
        </div>
      )}

      {/* Side-by-Side Diff Viewer and Execution Trace */}
      {report ? (
        <div className="space-y-4">
          <DataDiffViewer
            rawPreview={rawPreview}
            cleanedPreview={report.preview}
            report={report}
          />

          {/* Steps Executed Log */}
          <div className="p-4 rounded-xl glass-card space-y-2">
            <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-300 flex items-center space-x-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Transformation Steps Executed ({report.steps_executed.length})</span>
            </h4>
            <div className="space-y-1.5 text-xs font-mono text-zinc-400 max-h-48 overflow-y-auto pr-2">
              {report.steps_executed.map((step, idx) => (
                <div key={idx} className="flex items-start space-x-2">
                  <span className="text-emerald-400 font-bold shrink-0">✓</span>
                  <span>{step}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center rounded-xl glass-card space-y-3">
          <div className="w-12 h-12 rounded-full bg-zinc-900 border border-white/[0.08] flex items-center justify-center mx-auto text-zinc-400">
            <FileCheck className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-semibold text-zinc-200 font-mono">Ready to Clean Dataset</h4>
            <p className="text-xs text-zinc-500 max-w-md mx-auto">
              Click "Run Preprocessing" above to execute the automated expert rules and generate the cleaned matrix with side-by-side diff.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
