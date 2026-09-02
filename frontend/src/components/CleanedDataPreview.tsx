import React, { useState } from 'react';
import { Play, Download, CheckCircle2, ArrowRight, Table, FileCheck } from 'lucide-react';
import type { CleaningReport } from '../types';
import { executePreprocessing, getCleanedDownloadUrl } from '../services/api';

interface CleanedDataPreviewProps {
  initialReport: CleaningReport | null;
}

export const CleanedDataPreview: React.FC<CleanedDataPreviewProps> = ({ initialReport }) => {
  const [report, setReport] = useState<CleaningReport | null>(initialReport);
  const [loading, setLoading] = useState(false);

  const handleRunPreprocessing = async () => {
    setLoading(true);
    try {
      const res = await executePreprocessing();
      setReport(res);
    } catch (err: any) {
      alert(`Preprocessing execution failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const columns = report?.preview && report.preview.length > 0 ? Object.keys(report.preview[0]) : [];

  return (
    <div className="space-y-4">
      {/* Action Bar */}
      <div className="p-5 rounded-xl glass-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <FileCheck className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white font-mono">
              In-Memory Pipeline Execution
            </h3>
          </div>
          <p className="text-xs text-zinc-400">
            Executes missing value imputation, Winsorization clipping, and One-Hot encoding directly on the dataset.
          </p>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
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
            <a
              href={getCleanedDownloadUrl()}
              download
              className="flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-medium flex items-center justify-center space-x-1.5 border border-white/[0.08] transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download CSV</span>
            </a>
          )}
        </div>
      </div>

      {/* Before / After Stats */}
      {report && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-4 rounded-xl glass-card space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Row Count</span>
            <div className="flex items-baseline space-x-2 font-mono">
              <span className="text-lg text-zinc-500">{report.initial_shape[0]}</span>
              <ArrowRight className="w-3.5 h-3.5 text-zinc-600" />
              <span className="text-xl font-bold text-emerald-400">{report.final_shape[0]}</span>
            </div>
            <p className="text-[10px] font-mono text-zinc-600">
              {report.initial_shape[0] - report.final_shape[0]} duplicates dropped
            </p>
          </div>

          <div className="p-4 rounded-xl glass-card space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Features</span>
            <div className="flex items-baseline space-x-2 font-mono">
              <span className="text-lg text-zinc-500">{report.initial_shape[1]}</span>
              <ArrowRight className="w-3.5 h-3.5 text-zinc-600" />
              <span className="text-xl font-bold text-white">{report.final_shape[1]}</span>
            </div>
            <p className="text-[10px] font-mono text-zinc-600">
              Columns after OHE & pruning
            </p>
          </div>

          <div className="p-4 rounded-xl glass-card space-y-1">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Missing Values</span>
            <div className="flex items-baseline space-x-2 font-mono">
              <span className="text-lg text-rose-400">{report.initial_missing_cells}</span>
              <ArrowRight className="w-3.5 h-3.5 text-zinc-600" />
              <span className="text-xl font-bold text-emerald-400">0</span>
            </div>
            <p className="text-[10px] font-mono text-emerald-400">
              100% complete
            </p>
          </div>
        </div>
      )}

      {/* Sequential Execution Log */}
      {report && (
        <div className="p-5 rounded-xl glass-card space-y-2.5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block">
            Transformation Operations Applied
          </span>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-xs font-mono">
            {report.steps_executed.map((step, idx) => (
              <div
                key={idx}
                className="flex items-center space-x-2 p-2 rounded-lg bg-black/60 border border-white/[0.04] text-zinc-300 text-[11px]"
              >
                <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                <span className="truncate">{step}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data Preview */}
      {report && report.preview && (
        <div className="rounded-xl glass-card overflow-hidden">
          <div className="p-3 bg-black border-b border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Table className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-xs font-mono font-medium text-zinc-300">
                Cleaned Preview (First 30 Rows)
              </span>
            </div>
            <span className="text-[10px] text-zinc-600 font-mono">
              {columns.length} Features
            </span>
          </div>

          <div className="overflow-x-auto max-h-[460px]">
            <table className="w-full text-left text-xs border-collapse font-mono">
              <thead>
                <tr className="bg-zinc-950 border-b border-white/[0.06] text-zinc-500 text-[10px] sticky top-0 z-10">
                  <th className="py-2 px-3">#</th>
                  {columns.map((col) => (
                    <th key={col} className="py-2 px-3 whitespace-nowrap">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03] text-zinc-300 text-[11px]">
                {report.preview.map((row, idx) => (
                  <tr key={idx} className="hover:bg-zinc-900/40">
                    <td className="py-1.5 px-3 text-zinc-600 select-none text-[10px]">{idx + 1}</td>
                    {columns.map((col) => (
                      <td key={col} className="py-1.5 px-3 whitespace-nowrap">
                        {typeof row[col] === 'number'
                          ? Number(row[col]).toFixed(3).replace(/\.?0+$/, '')
                          : String(row[col] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
