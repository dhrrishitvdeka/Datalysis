import React, { useState } from 'react';
import {
  SlidersHorizontal,
  RotateCcw,
  Play,
  Trash2,
  Sparkles,
  ShieldCheck,
  Search,
  Filter,
  Check,
} from 'lucide-react';
import type {
  ColumnRecommendation,
  ColumnFact,
  RecipeOverride,
  ProcessRequest,
  CleaningReport,
} from '../types';
import { executePreprocessing } from '../services/api';

interface RecipeCustomizerProps {
  recommendations: Record<string, ColumnRecommendation>;
  columnFacts: Record<string, ColumnFact>;
  customRecipe: Record<string, RecipeOverride>;
  onRecipeChange: (newRecipe: Record<string, RecipeOverride>) => void;
  onRunSuccess?: (report: CleaningReport) => void;
}

type FilterTab = 'ALL' | 'OVERRIDDEN' | 'DROPS' | 'IMPUTATIONS' | 'ENCODINGS' | 'SCALING';

export const RecipeCustomizer: React.FC<RecipeCustomizerProps> = ({
  recommendations,
  columnFacts,
  customRecipe,
  onRecipeChange,
  onRunSuccess,
}) => {
  const [filter, setFilter] = useState<FilterTab>('ALL');
  const [search, setSearch] = useState('');
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const columns = Object.keys(recommendations);

  const updateColumnOverride = (column: string, field: keyof RecipeOverride, value: any) => {
    const prev = customRecipe[column] || {};
    const updated = { ...prev, [field]: value };

    // If setting drop to true, keep drop
    const nextRecipe = { ...customRecipe, [column]: updated };
    onRecipeChange(nextRecipe);
  };

  const resetColumnOverride = (column: string) => {
    const nextRecipe = { ...customRecipe };
    delete nextRecipe[column];
    onRecipeChange(nextRecipe);
  };

  const resetAllOverrides = () => {
    onRecipeChange({});
  };

  const overriddenCount = Object.keys(customRecipe).length;

  const filteredColumns = columns.filter((col) => {
    if (search && !col.toLowerCase().includes(search.toLowerCase())) return false;
    const rec = recommendations[col];
    const override = customRecipe[col];

    if (filter === 'OVERRIDDEN') return !!override && Object.keys(override).length > 0;
    if (filter === 'DROPS') {
      return (override?.drop !== undefined ? override.drop : rec.should_drop);
    }
    if (filter === 'IMPUTATIONS') {
      return rec.missing_pct > 0 || !!override?.imputation;
    }
    if (filter === 'ENCODINGS') {
      return !!rec.encoding || !!override?.encoding;
    }
    if (filter === 'SCALING') {
      const fact = columnFacts[col];
      return !!fact?.numeric_stats || !!override?.scaling || !!override?.outliers;
    }
    return true;
  });

  const handleExecute = async () => {
    setExecuting(true);
    setError(null);
    try {
      const payload: ProcessRequest = {
        column_overrides: customRecipe,
        drop_duplicates: true,
      };
      const report = await executePreprocessing(payload);
      if (onRunSuccess) {
        onRunSuccess(report);
      }
    } catch (err: any) {
      setError(err.message || 'Custom recipe execution failed');
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Action & Summary Bar */}
      <div className="p-4 rounded-xl glass-card flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="flex items-center space-x-2">
            <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold font-mono tracking-tight text-white dark:text-white">
              Interactive Recipe Customizer
            </h3>
            {overriddenCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {overriddenCount} column{overriddenCount > 1 ? 's' : ''} customized
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400">
            Override automated expert rules per column. Modify drop decisions, imputation heuristics, outlier mitigation, and feature encodings.
          </p>
        </div>

        <div className="flex items-center space-x-2 w-full md:w-auto">
          {overriddenCount > 0 && (
            <button
              onClick={resetAllOverrides}
              className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-white/[0.08] text-xs font-mono flex items-center space-x-1.5 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset All to Defaults</span>
            </button>
          )}

          <button
            onClick={handleExecute}
            disabled={executing}
            className="flex-1 md:flex-none px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black font-semibold text-xs flex items-center justify-center space-x-1.5 transition shadow-sm"
          >
            {executing ? (
              <>
                <span className="w-3 h-3 border-2 border-black/40 border-t-black rounded-full animate-spin" />
                <span>Executing Pipeline...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Apply & Run Custom Recipe</span>
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-mono">
          {error}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
        <div className="flex items-center space-x-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {[
            { id: 'ALL', label: 'All Columns', count: columns.length },
            { id: 'OVERRIDDEN', label: 'Customized', count: overriddenCount },
            {
              id: 'DROPS',
              label: 'Drops',
              count: columns.filter((c) => customRecipe[c]?.drop !== undefined ? customRecipe[c]?.drop : recommendations[c]?.should_drop).length,
            },
            {
              id: 'IMPUTATIONS',
              label: 'Imputations',
              count: columns.filter((c) => recommendations[c]?.missing_pct > 0).length,
            },
            {
              id: 'ENCODINGS',
              label: 'Encodings',
              count: columns.filter((c) => !!recommendations[c]?.encoding).length,
            },
            {
              id: 'SCALING',
              label: 'Scaling & Outliers',
              count: columns.filter((c) => !!columnFacts[c]?.numeric_stats).length,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as FilterTab)}
              className={`px-2.5 py-1 rounded-md text-xs font-mono transition shrink-0 flex items-center space-x-1.5 ${
                filter === tab.id
                  ? 'bg-zinc-100 text-zinc-950 font-semibold'
                  : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <span>{tab.label}</span>
              <span className="text-[10px] opacity-60">({tab.count})</span>
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64 shrink-0">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search column..."
            className="w-full pl-8 pr-3 py-1 text-xs rounded-md bg-zinc-950/60 border border-white/[0.08] text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-white/25 transition"
          />
        </div>
      </div>

      {/* Columns Table / Customizer Grid */}
      <div className="rounded-xl border border-white/[0.08] bg-zinc-950/70 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/[0.08] bg-zinc-900/60 text-zinc-400 font-mono text-[11px] uppercase tracking-wider">
                <th className="py-2.5 px-3">Column & Type</th>
                <th className="py-2.5 px-3">Drop Decision</th>
                <th className="py-2.5 px-3">Imputation Strategy</th>
                <th className="py-2.5 px-3">Outlier Handling</th>
                <th className="py-2.5 px-3">Scaling</th>
                <th className="py-2.5 px-3">Encoding</th>
                <th className="py-2.5 px-3 text-right">Reset</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {filteredColumns.map((col) => {
                const rec = recommendations[col];
                const fact = columnFacts[col];
                const override = customRecipe[col] || {};
                const isOverridden = Object.keys(override).length > 0;

                const isNumeric = !!fact?.numeric_stats;
                const isCat = fact?.inferred_type?.includes('categorical') || fact?.is_binary;
                const hasMissing = (rec?.missing_pct ?? 0) > 0;

                // Effective drop
                const currentDrop = override.drop !== undefined ? override.drop : rec?.should_drop;
                const recImputationAction = rec?.imputation?.action;
                const currentImputation = override.imputation || (recImputationAction ? 'auto' : (hasMissing ? 'auto' : 'none'));

                const currentOutliers = override.outliers || (isNumeric ? 'auto' : 'none');
                const currentScaling = override.scaling || (isNumeric ? 'auto' : 'none');
                const currentEncoding = override.encoding || (isCat ? 'auto' : 'none');

                return (
                  <tr
                    key={col}
                    className={`hover:bg-white/[0.02] transition ${
                      currentDrop ? 'opacity-60 bg-rose-500/[0.02]' : ''
                    } ${isOverridden ? 'border-l-2 border-l-emerald-400' : ''}`}
                  >
                    {/* Column Name & Info */}
                    <td className="py-3 px-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-1.5 font-mono">
                          <span className="font-semibold text-zinc-100">{col}</span>
                          {isOverridden && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Customized" />
                          )}
                        </div>
                        <div className="flex items-center space-x-2 text-[11px] text-zinc-500 font-mono">
                          <span>{fact?.inferred_type || rec?.inferred_type}</span>
                          {rec?.missing_pct > 0 && (
                            <span className="text-amber-400">{rec.missing_pct}% null</span>
                          )}
                          <span>{fact?.unique_count ?? rec?.unique_count} uniq</span>
                        </div>
                      </div>
                    </td>

                    {/* Drop Decision */}
                    <td className="py-3 px-3">
                      <div className="flex items-center space-x-2">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={currentDrop}
                            onChange={(e) => updateColumnOverride(col, 'drop', e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-600"></div>
                        </label>
                        <span className={`text-[11px] font-mono ${currentDrop ? 'text-rose-400 font-semibold' : 'text-zinc-400'}`}>
                          {currentDrop ? 'Drop' : 'Keep'}
                        </span>
                      </div>
                      {rec?.drop_reason && (
                        <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-1 max-w-[180px]" title={rec.drop_reason}>
                          Rule: {rec.drop_reason}
                        </p>
                      )}
                    </td>

                    {/* Imputation Strategy */}
                    <td className="py-3 px-3">
                      {!currentDrop && hasMissing ? (
                        <select
                          value={currentImputation}
                          onChange={(e) => updateColumnOverride(col, 'imputation', e.target.value)}
                          className="bg-zinc-900 border border-white/[0.1] rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-white/30"
                        >
                          <option value="auto">Auto ({rec?.imputation?.technique || 'Rule'})</option>
                          <option value="median">Median</option>
                          <option value="mean">Mean</option>
                          <option value="mode">Mode (Most Frequent)</option>
                          <option value="constant">Constant ('Missing' / 0)</option>
                          {isNumeric && <option value="knn">KNN Imputer</option>}
                          <option value="drop_rows">Drop Null Rows</option>
                          <option value="none">No Imputation</option>
                        </select>
                      ) : (
                        <span className="text-[11px] text-zinc-600 font-mono">
                          {currentDrop ? '—' : 'No missing values'}
                        </span>
                      )}
                    </td>

                    {/* Outlier Handling */}
                    <td className="py-3 px-3">
                      {!currentDrop && isNumeric ? (
                        <select
                          value={currentOutliers}
                          onChange={(e) => updateColumnOverride(col, 'outliers', e.target.value)}
                          className="bg-zinc-900 border border-white/[0.1] rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-white/30"
                        >
                          <option value="auto">Auto (Rule Recommended)</option>
                          <option value="winsorize">Winsorize (1% - 99%)</option>
                          <option value="clip_iqr">Clip IQR (1.5x Fences)</option>
                          <option value="zscore">Z-Score (±3 StdDev)</option>
                          <option value="none">None (Keep Outliers)</option>
                        </select>
                      ) : (
                        <span className="text-[11px] text-zinc-600 font-mono">—</span>
                      )}
                    </td>

                    {/* Scaling */}
                    <td className="py-3 px-3">
                      {!currentDrop && isNumeric ? (
                        <select
                          value={currentScaling}
                          onChange={(e) => updateColumnOverride(col, 'scaling', e.target.value)}
                          className="bg-zinc-900 border border-white/[0.1] rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-white/30"
                        >
                          <option value="auto">Auto (Rule Recommended)</option>
                          <option value="standard">StandardScaler (Z-Score)</option>
                          <option value="robust">RobustScaler (Median/IQR)</option>
                          <option value="log1p">Log1p (Skew Mitigation)</option>
                          <option value="none">None (Raw Scale)</option>
                        </select>
                      ) : (
                        <span className="text-[11px] text-zinc-600 font-mono">—</span>
                      )}
                    </td>

                    {/* Encoding */}
                    <td className="py-3 px-3">
                      {!currentDrop && (isCat || fact?.inferred_type === 'free_text') ? (
                        <select
                          value={currentEncoding}
                          onChange={(e) => updateColumnOverride(col, 'encoding', e.target.value)}
                          className="bg-zinc-900 border border-white/[0.1] rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-white/30"
                        >
                          <option value="auto">Auto ({rec?.encoding?.technique || 'Rule'})</option>
                          <option value="onehot">One-Hot Encoding</option>
                          <option value="frequency">Frequency Encoding</option>
                          <option value="binary">Binary Integer (0/1)</option>
                          <option value="ordinal">Ordinal Sequence</option>
                          <option value="none">None (Keep Raw)</option>
                        </select>
                      ) : (
                        <span className="text-[11px] text-zinc-600 font-mono">—</span>
                      )}
                    </td>

                    {/* Reset Button */}
                    <td className="py-3 px-3 text-right">
                      {isOverridden ? (
                        <button
                          onClick={() => resetColumnOverride(col)}
                          className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                          title="Reset to rule recommendation"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <span className="text-[10px] font-mono text-zinc-600">Default</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
