import React, { useState } from 'react';
import {
  Columns2,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  TrendingDown,
  Layers,
  Search,
} from 'lucide-react';
import type { CleaningReport } from '../types';

interface DataDiffViewerProps {
  rawPreview: Record<string, any>[];
  cleanedPreview: Record<string, any>[];
  report: CleaningReport | null;
}

export const DataDiffViewer: React.FC<DataDiffViewerProps> = ({
  rawPreview,
  cleanedPreview,
  report,
}) => {
  const [viewMode, setViewMode] = useState<'split' | 'cleaned'>('split');
  const [search, setSearch] = useState('');

  const rawCols = rawPreview.length > 0 ? Object.keys(rawPreview[0]) : [];
  const cleanCols = cleanedPreview.length > 0 ? Object.keys(cleanedPreview[0]) : [];

  const droppedCols = rawCols.filter((c) => !cleanCols.includes(c));
  const newCols = cleanCols.filter((c) => !rawCols.includes(c));

  // Determine cell status for highlight
  const getCellStatus = (
    rowIdx: number,
    col: string,
    val: any
  ): 'normal' | 'imputed' | 'modified' | 'new' => {
    if (!rawPreview[rowIdx]) return 'normal';
    if (!rawCols.includes(col)) return 'new';

    const rawVal = rawPreview[rowIdx][col];
    if (rawVal === null || rawVal === undefined || rawVal === '' || Number.isNaN(rawVal)) {
      if (val !== null && val !== undefined && val !== '') {
        return 'imputed';
      }
    } else if (typeof rawVal === 'number' && typeof val === 'number') {
      if (Math.abs(rawVal - val) > 0.0001) {
        return 'modified';
      }
    } else if (String(rawVal) !== String(val)) {
      return 'modified';
    }

    return 'normal';
  };

  const filteredCleanRows = cleanedPreview.filter((row) => {
    if (!search) return true;
    return Object.values(row).some((val) =>
      String(val).toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div className="space-y-3">
      {/* Metrics Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-xl glass-card flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs text-zinc-400 font-mono">Nulls Imputed</div>
            <div className="text-sm font-bold font-mono text-emerald-400">
              {report
                ? Math.max(0, report.initial_missing_cells - report.final_missing_cells)
                : '100%'}
            </div>
          </div>
        </div>

        <div className="p-3 rounded-xl glass-card flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
            <TrendingDown className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs text-zinc-400 font-mono">Columns Pruned</div>
            <div className="text-sm font-bold font-mono text-rose-400">
              {droppedCols.length} column{droppedCols.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        <div className="p-3 rounded-xl glass-card flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs text-zinc-400 font-mono">New Features</div>
            <div className="text-sm font-bold font-mono text-purple-400">
              +{newCols.length} generated
            </div>
          </div>
        </div>

        <div className="p-3 rounded-xl glass-card flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs text-zinc-400 font-mono">Shape Shift</div>
            <div className="text-xs font-bold font-mono text-zinc-200">
              {report
                ? `${report.initial_shape[0]}x${report.initial_shape[1]} → ${report.final_shape[0]}x${report.final_shape[1]}`
                : 'Transformed'}
            </div>
          </div>
        </div>
      </div>

      {/* Control Header & Legend */}
      <div className="p-3 rounded-xl glass-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 bg-zinc-900/80 p-0.5 rounded-lg border border-white/[0.08]">
            <button
              onClick={() => setViewMode('split')}
              className={`px-3 py-1 rounded text-xs font-mono transition ${
                viewMode === 'split'
                  ? 'bg-zinc-100 text-zinc-950 font-semibold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Side-by-Side Diff
            </button>
            <button
              onClick={() => setViewMode('cleaned')}
              className={`px-3 py-1 rounded text-xs font-mono transition ${
                viewMode === 'cleaned'
                  ? 'bg-zinc-100 text-zinc-950 font-semibold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Full Cleaned Matrix
            </button>
          </div>

          <div className="hidden md:flex items-center space-x-3 text-[11px] font-mono text-zinc-400 pl-2">
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded bg-emerald-400" />
              <span>Imputed Cell</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded bg-blue-400" />
              <span>Modified / Scaled</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded bg-purple-400" />
              <span>New Feature</span>
            </span>
          </div>
        </div>

        <div className="relative w-full sm:w-60">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search preview rows..."
            className="w-full pl-8 pr-3 py-1 text-xs rounded-md bg-zinc-950 border border-white/[0.08] text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-white/25 transition"
          />
        </div>
      </div>

      {/* Side-by-Side or Cleaned Table View */}
      {viewMode === 'split' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Raw Dataset Side */}
          <div className="rounded-xl border border-white/[0.08] bg-zinc-950/70 overflow-hidden flex flex-col">
            <div className="px-3 py-2 bg-zinc-900/80 border-b border-white/[0.08] flex items-center justify-between text-xs font-mono">
              <span className="font-semibold text-zinc-300">Raw Input Preview (Before)</span>
              <span className="text-[11px] text-zinc-500">{rawCols.length} columns</span>
            </div>
            <div className="overflow-x-auto max-h-[480px]">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className="bg-zinc-900/60 text-zinc-400 border-b border-white/[0.06] text-[10px] uppercase tracking-wider sticky top-0 z-10">
                    <th className="py-2 px-2.5 w-10 text-zinc-600">#</th>
                    {rawCols.map((c) => (
                      <th
                        key={c}
                        className={`py-2 px-2.5 whitespace-nowrap ${
                          droppedCols.includes(c) ? 'text-rose-400 line-through' : ''
                        }`}
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {rawPreview.slice(0, 30).map((row, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.02]">
                      <td className="py-1.5 px-2.5 text-zinc-600">{idx + 1}</td>
                      {rawCols.map((c) => {
                        const val = row[c];
                        const isNull = val === null || val === undefined || val === '' || Number.isNaN(val);
                        return (
                          <td
                            key={c}
                            className={`py-1.5 px-2.5 whitespace-nowrap ${
                              isNull ? 'text-amber-400 bg-amber-500/10 font-bold' : 'text-zinc-300'
                            }`}
                          >
                            {isNull ? 'null' : String(val)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cleaned Dataset Side */}
          <div className="rounded-xl border border-white/[0.08] bg-zinc-950/70 overflow-hidden flex flex-col">
            <div className="px-3 py-2 bg-zinc-900/80 border-b border-white/[0.08] flex items-center justify-between text-xs font-mono">
              <span className="font-semibold text-emerald-400">Cleaned Matrix Preview (After)</span>
              <span className="text-[11px] text-zinc-500">{cleanCols.length} features</span>
            </div>
            <div className="overflow-x-auto max-h-[480px]">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className="bg-zinc-900/60 text-zinc-400 border-b border-white/[0.06] text-[10px] uppercase tracking-wider sticky top-0 z-10">
                    <th className="py-2 px-2.5 w-10 text-zinc-600">#</th>
                    {cleanCols.map((c) => (
                      <th
                        key={c}
                        className={`py-2 px-2.5 whitespace-nowrap ${
                          newCols.includes(c) ? 'text-purple-300 font-semibold' : ''
                        }`}
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.03]">
                  {cleanedPreview.slice(0, 30).map((row, idx) => (
                    <tr key={idx} className="hover:bg-white/[0.02]">
                      <td className="py-1.5 px-2.5 text-zinc-600">{idx + 1}</td>
                      {cleanCols.map((c) => {
                        const val = row[c];
                        const status = getCellStatus(idx, c, val);
                        let badgeClass = 'text-zinc-200';
                        if (status === 'imputed') badgeClass = 'text-emerald-300 bg-emerald-500/20 font-medium px-1 rounded';
                        else if (status === 'modified') badgeClass = 'text-blue-300 bg-blue-500/20 px-1 rounded';
                        else if (status === 'new') badgeClass = 'text-purple-300 bg-purple-500/10 px-1 rounded';

                        const displayVal = typeof val === 'number' ? (Number.isInteger(val) ? val : val.toFixed(3)) : String(val ?? '');

                        return (
                          <td key={c} className="py-1.5 px-2.5 whitespace-nowrap">
                            <span className={badgeClass}>{displayVal}</span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Full Cleaned Matrix View */
        <div className="rounded-xl border border-white/[0.08] bg-zinc-950/70 overflow-hidden">
          <div className="overflow-x-auto max-h-[520px]">
            <table className="w-full text-left text-xs font-mono border-collapse">
              <thead>
                <tr className="bg-zinc-900/80 text-zinc-400 border-b border-white/[0.08] text-[10px] uppercase tracking-wider sticky top-0 z-10">
                  <th className="py-2.5 px-3 w-12 text-zinc-600">#</th>
                  {cleanCols.map((c) => (
                    <th key={c} className="py-2.5 px-3 whitespace-nowrap">
                      <div className="flex items-center space-x-1">
                        <span>{c}</span>
                        {newCols.includes(c) && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-purple-500/20 text-purple-300">NEW</span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {filteredCleanRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-white/[0.02]">
                    <td className="py-1.5 px-3 text-zinc-600">{idx + 1}</td>
                    {cleanCols.map((c) => {
                      const val = row[c];
                      const status = getCellStatus(idx, c, val);
                      let badgeClass = 'text-zinc-200';
                      if (status === 'imputed') badgeClass = 'text-emerald-300 bg-emerald-500/20 font-medium px-1 rounded';
                      else if (status === 'modified') badgeClass = 'text-blue-300 bg-blue-500/20 px-1 rounded';
                      else if (status === 'new') badgeClass = 'text-purple-300 bg-purple-500/10 px-1 rounded';

                      const displayVal = typeof val === 'number' ? (Number.isInteger(val) ? val : val.toFixed(3)) : String(val ?? '');

                      return (
                        <td key={c} className="py-1.5 px-3 whitespace-nowrap">
                          <span className={badgeClass}>{displayVal}</span>
                        </td>
                      );
                    })}
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
