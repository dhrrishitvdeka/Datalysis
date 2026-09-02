import React, { useEffect, useMemo, useState } from 'react';
import { Trash2, Search, CheckCircle2, AlertTriangle, X, ArrowUpDown } from 'lucide-react';
import type { ColumnRecommendation, ColumnFact } from '../types';

interface RecommendationsTableProps {
  recommendations: Record<string, ColumnRecommendation>;
  columnFacts: Record<string, ColumnFact>;
  selectedColumn?: string | null;
  onSelectedColumnChange?: (col: string | null) => void;
}

type FilterId = 'ALL' | 'DROP' | 'IMPUTE' | 'OUTLIERS' | 'ENCODE' | 'HEALTHY';
type SortKey = 'column' | 'missing' | 'unique' | 'status';

export const RecommendationsTable: React.FC<RecommendationsTableProps> = ({
  recommendations,
  columnFacts,
  selectedColumn,
  onSelectedColumnChange,
}) => {
  const [filter, setFilter] = useState<FilterId>('ALL');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('status');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [internalSelected, setInternalSelected] = useState<string | null>(null);

  const selectedCol = selectedColumn !== undefined ? selectedColumn : internalSelected;
  const setSelectedCol = (col: string | null) => {
    setInternalSelected(col);
    onSelectedColumnChange?.(col);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedCol(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const colList = Object.values(recommendations);
  const counts = {
    ALL: colList.length,
    DROP: colList.filter((c) => c.should_drop).length,
    IMPUTE: colList.filter((c) => c.missing_pct > 0 && !c.should_drop).length,
    OUTLIERS: colList.filter((c) => {
      const fact = columnFacts[c.column];
      return fact?.numeric_stats && (fact.numeric_stats.outliers_iqr_count > 0 || Math.abs(fact.numeric_stats.skewness) >= 1.0);
    }).length,
    ENCODE: colList.filter((c) => !!c.encoding && !c.should_drop).length,
    HEALTHY: colList.filter((c) => c.status === 'HEALTHY' || c.status === 'READY_WITH_PREPROCESSING').length,
  };

  const filteredColumns = useMemo(() => {
    let list = colList.filter((col) => {
      if (search && !col.column.toLowerCase().includes(search.toLowerCase())) return false;
      if (filter === 'DROP') return col.should_drop;
      if (filter === 'IMPUTE') return col.missing_pct > 0 && !col.should_drop;
      if (filter === 'OUTLIERS') {
        const fact = columnFacts[col.column];
        return !!fact?.numeric_stats && (fact.numeric_stats.outliers_iqr_count > 0 || Math.abs(fact.numeric_stats.skewness) >= 1.0);
      }
      if (filter === 'ENCODE') return !!col.encoding && !col.should_drop;
      if (filter === 'HEALTHY') return col.status === 'HEALTHY' || col.status === 'READY_WITH_PREPROCESSING';
      return true;
    });
    const dir = sortDir === 'asc' ? 1 : -1;
    const rank: Record<string, number> = {
      DROP_RECOMMENDED: 0,
      CRITICAL_ATTENTION: 1,
      REQUIRES_TRANSFORMATION: 2,
      READY_WITH_PREPROCESSING: 3,
      HEALTHY: 4,
    };
    list = [...list].sort((a, b) => {
      if (sortKey === 'column') return dir * a.column.localeCompare(b.column);
      if (sortKey === 'missing') return dir * (a.missing_pct - b.missing_pct);
      if (sortKey === 'unique') return dir * (a.unique_count - b.unique_count);
      return dir * ((rank[a.status] ?? 9) - (rank[b.status] ?? 9));
    });
    return list;
  }, [colList, search, filter, columnFacts, sortKey, sortDir]);

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
            <span>Transform</span>
          </span>
        );
      case 'READY_WITH_PREPROCESSING':
        return (
          <span className="inline-flex items-center space-x-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <CheckCircle2 className="w-2.5 h-2.5" />
            <span>Encode</span>
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

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const activeColRec = selectedCol ? recommendations[selectedCol] : null;
  const activeColFact = selectedCol ? columnFacts[selectedCol] : null;

  const recipeLine = (col: ColumnRecommendation) => {
    const parts: string[] = [];
    if (col.should_drop) return 'drop';
    if (col.imputation) parts.push(col.imputation.technique);
    if (col.encoding) parts.push(col.encoding.technique);
    col.scaling_and_outliers.forEach((s) => parts.push(s.technique));
    if (col.datetime_engineering) parts.push('datetime decompose');
    return parts.join(' → ') || 'keep as-is';
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filter features…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-black/60 border border-white/[0.08] rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 transition"
          />
        </div>

        <div className="flex items-center space-x-1 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
          {(
            [
              { id: 'ALL', label: 'All' },
              { id: 'DROP', label: 'Drop' },
              { id: 'IMPUTE', label: 'Missing' },
              { id: 'OUTLIERS', label: 'Outliers' },
              { id: 'ENCODE', label: 'Encode' },
              { id: 'HEALTHY', label: 'Healthy' },
            ] as { id: FilterId; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition ${
                filter === tab.id ? 'bg-zinc-100 text-zinc-950 font-semibold' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900'
              }`}
            >
              {tab.label}
              <span className="ml-1 font-mono tabular-nums opacity-70">{counts[tab.id]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_380px] gap-3 items-start">
        <div className="overflow-x-auto rounded-xl glass-card">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-black/90 border-b border-white/[0.06] text-zinc-500 uppercase tracking-wider text-[10px] font-mono">
                <th className="py-2.5 px-3">
                  <button onClick={() => toggleSort('column')} className="inline-flex items-center gap-1">
                    Feature <ArrowUpDown className="w-2.5 h-2.5" />
                  </button>
                </th>
                <th className="py-2.5 px-3">
                  <button onClick={() => toggleSort('status')} className="inline-flex items-center gap-1">
                    Status <ArrowUpDown className="w-2.5 h-2.5" />
                  </button>
                </th>
                <th className="py-2.5 px-3">
                  <button onClick={() => toggleSort('missing')} className="inline-flex items-center gap-1">
                    Missing <ArrowUpDown className="w-2.5 h-2.5" />
                  </button>
                </th>
                <th className="py-2.5 px-3">Distribution</th>
                <th className="py-2.5 px-3">Pipeline</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03]">
              {filteredColumns.map((col) => {
                const fact = columnFacts[col.column];
                const numStats = fact?.numeric_stats;
                const active = selectedCol === col.column;
                return (
                  <tr
                    key={col.column}
                    className={`hover:bg-zinc-900/40 transition cursor-pointer ${
                      col.should_drop ? 'bg-rose-950/10' : ''
                    } ${active ? 'bg-zinc-800/60' : ''}`}
                    onClick={() => setSelectedCol(col.column)}
                  >
                    <td className="py-2.5 px-3">
                      <div className="flex flex-col">
                        <span className="font-medium text-zinc-200 font-mono">{col.column}</span>
                        <span className="text-[10px] font-mono text-zinc-500">
                          {col.inferred_type.replace(/_/g, ' ')} · {col.unique_count} unique
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3">{getStatusBadge(col.status)}</td>
                    <td className="py-2.5 px-3">
                      {col.missing_pct > 0 ? (
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-1.5 font-mono text-[11px]">
                            <span className="text-amber-400 font-medium tabular-nums">{col.missing_pct}%</span>
                            <span className="text-zinc-600">({fact?.missing_count})</span>
                          </div>
                          <div className="text-[10px] text-zinc-400">{col.imputation?.technique || 'Drop'}</div>
                        </div>
                      ) : (
                        <span className="text-zinc-500 font-mono text-[11px]">0%</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      {numStats ? (
                        <div className="space-y-0.5 font-mono text-[11px]">
                          <span className={Math.abs(numStats.skewness) >= 1.0 ? 'text-amber-400' : 'text-zinc-300'}>
                            skew {numStats.skewness}
                          </span>
                          {numStats.outliers_iqr_count > 0 && (
                            <span className="text-[10px] text-rose-400 block">
                              {numStats.outliers_iqr_count} outliers ({numStats.outliers_iqr_pct}%)
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-zinc-600 text-[11px]">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-[10px] font-mono text-zinc-400 max-w-[280px]">
                      <span className="line-clamp-2">{recipeLine(col)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredColumns.length === 0 && (
            <div className="p-8 text-center text-zinc-600 text-xs font-mono">No features match this filter.</div>
          )}
        </div>

        <aside className="rounded-xl glass-card p-4 space-y-3 xl:sticky xl:top-24 max-h-[calc(100vh-8rem)] overflow-y-auto">
          {activeColRec && activeColFact ? (
            <>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-white font-mono">{activeColRec.column}</h3>
                  <p className="text-[11px] text-zinc-500 font-mono">
                    {activeColFact.inferred_type.replace(/_/g, ' ')} · {activeColFact.raw_dtype} · {activeColFact.unique_count} distinct
                  </p>
                </div>
                <button
                  onClick={() => setSelectedCol(null)}
                  className="p-1 rounded text-zinc-500 hover:text-white hover:bg-zinc-900"
                  aria-label="Close inspector"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {activeColRec.should_drop && (
                <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                  {activeColRec.drop_reason}
                </div>
              )}

              <div className="grid grid-cols-2 gap-1.5 text-xs">
                <div className="p-2 rounded-lg bg-zinc-900/60 border border-white/[0.06]">
                  <span className="text-zinc-500 text-[10px] font-mono uppercase">Missing</span>
                  <p className="text-xs font-mono text-white mt-0.5 tabular-nums">
                    {activeColFact.missing_pct}% ({activeColFact.missing_count})
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-zinc-900/60 border border-white/[0.06]">
                  <span className="text-zinc-500 text-[10px] font-mono uppercase">Unique</span>
                  <p className="text-xs font-mono text-white mt-0.5 tabular-nums">
                    {(activeColFact.uniqueness_ratio * 100).toFixed(1)}%
                  </p>
                </div>
                {activeColFact.numeric_stats ? (
                  <>
                    <div className="p-2 rounded-lg bg-zinc-900/60 border border-white/[0.06]">
                      <span className="text-zinc-500 text-[10px] font-mono uppercase">Skew</span>
                      <p className="text-xs font-mono text-white mt-0.5">{activeColFact.numeric_stats.skewness}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-zinc-900/60 border border-white/[0.06]">
                      <span className="text-zinc-500 text-[10px] font-mono uppercase">Outliers</span>
                      <p className="text-xs font-mono text-white mt-0.5">{activeColFact.numeric_stats.outliers_iqr_count}</p>
                    </div>
                  </>
                ) : (
                  <div className="p-2 rounded-lg bg-zinc-900/60 border border-white/[0.06] col-span-2">
                    <span className="text-zinc-500 text-[10px] font-mono uppercase">Entropy</span>
                    <p className="text-xs font-mono text-white mt-0.5">
                      {activeColFact.categorical_stats?.entropy ?? 'N/A'} bits
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">
                  Rules ({activeColRec.all_rules_triggered.length})
                </span>
                {activeColRec.all_rules_triggered.length === 0 && (
                  <p className="text-[11px] text-zinc-500">No production rules fired. Column is usable as-is.</p>
                )}
                {activeColRec.all_rules_triggered.map((rule, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-zinc-900/40 border border-white/[0.06] space-y-1 text-xs">
                    <div className="flex items-center justify-between font-mono">
                      <span className="text-zinc-400">{rule.rule_id}</span>
                      <span className="text-[10px] text-zinc-500">{(rule.confidence * 100).toFixed(0)}%</span>
                    </div>
                    <p className="text-zinc-200">{rule.rule_name}</p>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">{rule.rationale}</p>
                    <p className="text-[10px] font-mono text-zinc-500">{rule.technique}</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-zinc-500 font-mono py-8 text-center">
              Select a feature to inspect triggered rules, imputation, and encoding.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
};
