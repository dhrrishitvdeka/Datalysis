import React, { useState } from 'react';
import { Trash2, Search, CheckCircle2, AlertTriangle, Eye, X } from 'lucide-react';
import type { ColumnRecommendation, ColumnFact } from '../types';

interface RecommendationsTableProps {
  recommendations: Record<string, ColumnRecommendation>;
  columnFacts: Record<string, ColumnFact>;
}

export const RecommendationsTable: React.FC<RecommendationsTableProps> = ({
  recommendations,
  columnFacts,
}) => {
  const [filter, setFilter] = useState<'ALL' | 'DROP' | 'IMPUTE' | 'OUTLIERS' | 'HEALTHY'>('ALL');
  const [search, setSearch] = useState('');
  const [selectedCol, setSelectedCol] = useState<string | null>(null);

  const colList = Object.values(recommendations);

  const filteredColumns = colList.filter((col) => {
    if (search && !col.column.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (filter === 'DROP') return col.should_drop;
    if (filter === 'IMPUTE') return col.missing_pct > 0 && !col.should_drop;
    if (filter === 'OUTLIERS') {
      const fact = columnFacts[col.column];
      return fact?.numeric_stats && (fact.numeric_stats.outliers_iqr_count > 0 || Math.abs(fact.numeric_stats.skewness) >= 1.0);
    }
    if (filter === 'HEALTHY') return col.status === 'HEALTHY' || col.status === 'READY_WITH_PREPROCESSING';
    return true;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DROP_RECOMMENDED':
        return (
          <span className="inline-flex items-center space-x-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <Trash2 className="w-2.5 h-2.5" />
            <span>Drop</span>
          </span>
        );
      case 'CRITICAL_ATTENTION':
        return (
          <span className="inline-flex items-center space-x-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertTriangle className="w-2.5 h-2.5" />
            <span>Critical</span>
          </span>
        );
      case 'REQUIRES_TRANSFORMATION':
        return (
          <span className="inline-flex items-center space-x-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-2.5 h-2.5" />
            <span>Remediate</span>
          </span>
        );
      case 'READY_WITH_PREPROCESSING':
        return (
          <span className="inline-flex items-center space-x-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <CheckCircle2 className="w-2.5 h-2.5" />
            <span>Standard Preprocess</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center space-x-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-2.5 h-2.5" />
            <span>Healthy</span>
          </span>
        );
    }
  };

  const activeColRec = selectedCol ? recommendations[selectedCol] : null;
  const activeColFact = selectedCol ? columnFacts[selectedCol] : null;

  return (
    <div className="space-y-3">
      {/* Controls Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filter features..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-black/60 border border-white/[0.08] rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition"
          />
        </div>

        {/* Filter Chips */}
        <div className="flex items-center space-x-1 overflow-x-auto pb-1 sm:pb-0">
          {[
            { id: 'ALL', label: 'All' },
            { id: 'DROP', label: 'Pruned' },
            { id: 'IMPUTE', label: 'Missing' },
            { id: 'OUTLIERS', label: 'Outliers & Skew' },
            { id: 'HEALTHY', label: 'Healthy' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as any)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition ${
                filter === tab.id
                  ? 'bg-zinc-100 text-zinc-950 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl glass-card">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-black/90 border-b border-white/[0.06] text-zinc-500 uppercase tracking-wider text-[10px] font-mono">
              <th className="py-2.5 px-3">Feature & Role</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Missingness & Imputation</th>
              <th className="py-2.5 px-3">Distribution & Outliers</th>
              <th className="py-2.5 px-3">Encoding</th>
              <th className="py-2.5 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {filteredColumns.map((col) => {
              const fact = columnFacts[col.column];
              const numStats = fact?.numeric_stats;

              return (
                <tr
                  key={col.column}
                  className={`hover:bg-zinc-900/40 transition cursor-pointer ${
                    col.should_drop ? 'bg-rose-950/10' : ''
                  }`}
                  onClick={() => setSelectedCol(col.column)}
                >
                  <td className="py-2.5 px-3">
                    <div className="flex flex-col">
                      <span className="font-medium text-zinc-200 font-mono">{col.column}</span>
                      <span className="text-[10px] font-mono text-zinc-500">
                        {col.inferred_type.replace('_', ' ')} • {col.raw_dtype}
                      </span>
                    </div>
                  </td>

                  <td className="py-2.5 px-3">
                    {getStatusBadge(col.status)}
                  </td>

                  <td className="py-2.5 px-3">
                    {col.missing_pct > 0 ? (
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-1.5 font-mono text-[11px]">
                          <span className="text-amber-400 font-medium">{col.missing_pct}%</span>
                          <span className="text-zinc-600">({fact?.missing_count} rows)</span>
                        </div>
                        <div className="text-[10px] text-zinc-400">
                          {col.imputation?.technique || 'Drop'}
                        </div>
                      </div>
                    ) : (
                      <span className="text-zinc-500 font-mono text-[11px]">0%</span>
                    )}
                  </td>

                  <td className="py-2.5 px-3">
                    {numStats ? (
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-1 text-[11px] font-mono">
                          <span className="text-zinc-500">Skew:</span>
                          <span className={Math.abs(numStats.skewness) >= 1.0 ? 'text-amber-400' : 'text-zinc-300'}>
                            {numStats.skewness}
                          </span>
                        </div>
                        {numStats.outliers_iqr_count > 0 ? (
                          <span className="text-[10px] font-mono text-rose-400 block">
                            {numStats.outliers_iqr_count} outliers ({numStats.outliers_iqr_pct}%)
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-zinc-600 text-[11px]">—</span>
                    )}
                  </td>

                  <td className="py-2.5 px-3">
                    {col.encoding ? (
                      <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-white/[0.06] text-zinc-300 text-[10px] font-mono">
                        {col.encoding.technique}
                      </span>
                    ) : col.datetime_engineering ? (
                      <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-white/[0.06] text-zinc-300 text-[10px] font-mono">
                        Datetime Decompose
                      </span>
                    ) : numStats ? (
                      <span className="text-zinc-500 text-[10px] font-mono">Continuous</span>
                    ) : (
                      <span className="text-zinc-600 text-[11px]">—</span>
                    )}
                  </td>

                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCol(col.column);
                      }}
                      className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-white/[0.06] text-[11px] transition"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Inspect</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Modal Drawer */}
      {selectedCol && activeColRec && activeColFact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="bg-zinc-950 border border-white/[0.1] rounded-xl max-w-xl w-full max-h-[85vh] overflow-y-auto p-5 space-y-4 shadow-2xl">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-white/[0.06] pb-3">
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-semibold text-white font-mono">{activeColRec.column}</h3>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-900 text-zinc-400 border border-white/[0.06] font-mono">
                    {activeColFact.inferred_type}
                  </span>
                </div>
                <p className="text-xs text-zinc-500 mt-0.5 font-mono">
                  Type: {activeColFact.raw_dtype} • {activeColFact.unique_count} distinct values
                </p>
              </div>

              <button
                onClick={() => setSelectedCol(null)}
                className="p-1 rounded text-zinc-500 hover:text-white hover:bg-zinc-900 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Drop Warning */}
            {activeColRec.should_drop && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs space-y-1">
                <div className="flex items-center space-x-1.5 font-medium uppercase font-mono text-[11px]">
                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                  <span>Pruning Target Active</span>
                </div>
                <p className="text-xs leading-relaxed">{activeColRec.drop_reason}</p>
              </div>
            )}

            {/* Facts Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-white/[0.06]">
                <span className="text-zinc-500 text-[10px] font-mono uppercase">Missing</span>
                <p className="text-xs font-semibold font-mono text-white mt-0.5">
                  {activeColFact.missing_pct}% <span className="text-zinc-600 font-normal">({activeColFact.missing_count})</span>
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-white/[0.06]">
                <span className="text-zinc-500 text-[10px] font-mono uppercase">Uniqueness</span>
                <p className="text-xs font-semibold font-mono text-white mt-0.5">
                  {(activeColFact.uniqueness_ratio * 100).toFixed(1)}%
                </p>
              </div>

              {activeColFact.numeric_stats ? (
                <>
                  <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-white/[0.06]">
                    <span className="text-zinc-500 text-[10px] font-mono uppercase">Skew</span>
                    <p className="text-xs font-semibold font-mono text-white mt-0.5">{activeColFact.numeric_stats.skewness}</p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-white/[0.06]">
                    <span className="text-zinc-500 text-[10px] font-mono uppercase">Outliers</span>
                    <p className="text-xs font-semibold font-mono text-white mt-0.5">{activeColFact.numeric_stats.outliers_iqr_count}</p>
                  </div>
                </>
              ) : (
                <div className="p-2.5 rounded-lg bg-zinc-900/60 border border-white/[0.06] col-span-2">
                  <span className="text-zinc-500 text-[10px] font-mono uppercase">Entropy</span>
                  <p className="text-xs font-semibold font-mono text-white mt-0.5">
                    {activeColFact.categorical_stats?.entropy ?? 'N/A'} bits
                  </p>
                </div>
              )}
            </div>

            {/* Rules Triggered */}
            <div className="space-y-2 pt-1">
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                Rule Activations ({activeColRec.all_rules_triggered.length})
              </span>

              {activeColRec.all_rules_triggered.map((rule, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-zinc-900/40 border border-white/[0.06] space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 font-mono">
                      <span className="text-zinc-400 font-bold">{rule.rule_id}</span>
                      <span className="text-zinc-200 text-xs font-sans">{rule.rule_name}</span>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500">{(rule.confidence * 100).toFixed(0)}% conf</span>
                  </div>

                  <p className="text-zinc-300 leading-relaxed bg-black/50 p-2 rounded border border-white/[0.04] text-[11px]">
                    {rule.rationale}
                  </p>

                  <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 pt-0.5">
                    <span>Action: {rule.technique}</span>
                    <span className="text-zinc-300">{rule.impact}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Close */}
            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedCol(null)}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-medium border border-white/[0.08] transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
