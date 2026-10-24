import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, X } from 'lucide-react';
import type { ColumnRecommendation, ColumnFact } from '../types';
import { Badge, Measure, Notice, SearchBox, StatusBadge, STATUS_RANK, fmtType } from './ui';

interface RecommendationsTableProps {
  recommendations: Record<string, ColumnRecommendation>;
  columnFacts: Record<string, ColumnFact>;
  selectedColumn?: string | null;
  onSelectedColumnChange?: (col: string | null) => void;
}

type FilterId = 'ALL' | 'DROP' | 'IMPUTE' | 'OUTLIERS' | 'ENCODE' | 'HEALTHY';
type SortKey = 'column' | 'missing' | 'status';

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
  const hasOutlierIssue = (name: string) => {
    const ns = columnFacts[name]?.numeric_stats;
    return !!ns && (ns.outliers_iqr_count > 0 || Math.abs(ns.skewness) >= 1.0);
  };
  const counts: Record<FilterId, number> = {
    ALL: colList.length,
    DROP: colList.filter((c) => c.should_drop).length,
    IMPUTE: colList.filter((c) => c.missing_pct > 0 && !c.should_drop).length,
    OUTLIERS: colList.filter((c) => hasOutlierIssue(c.column)).length,
    ENCODE: colList.filter((c) => !!c.encoding && !c.should_drop).length,
    HEALTHY: colList.filter((c) => c.status === 'HEALTHY' || c.status === 'READY_WITH_PREPROCESSING').length,
  };

  const filteredColumns = useMemo(() => {
    const list = colList.filter((col) => {
      if (search && !col.column.toLowerCase().includes(search.toLowerCase())) return false;
      if (filter === 'DROP') return col.should_drop;
      if (filter === 'IMPUTE') return col.missing_pct > 0 && !col.should_drop;
      if (filter === 'OUTLIERS') return hasOutlierIssue(col.column);
      if (filter === 'ENCODE') return !!col.encoding && !col.should_drop;
      if (filter === 'HEALTHY') return col.status === 'HEALTHY' || col.status === 'READY_WITH_PREPROCESSING';
      return true;
    });
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortKey === 'column') return dir * a.column.localeCompare(b.column);
      if (sortKey === 'missing') return dir * (a.missing_pct - b.missing_pct);
      return dir * ((STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9));
    });
  }, [colList, search, filter, columnFacts, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'missing' ? 'desc' : 'asc');
    }
  };

  const SortHead = ({ k, children }: { k: SortKey; children: React.ReactNode }) => {
    const Icon = sortKey === k ? (sortDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
    return (
      <th aria-sort={sortKey === k ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
        <button type="button" onClick={() => toggleSort(k)} className="inline-flex items-center gap-1.5 hover:text-ink">
          {children}
          <Icon className={`h-3.5 w-3.5 ${sortKey === k ? 'text-accent' : 'text-ink-3'}`} aria-hidden />
        </button>
      </th>
    );
  };

  const activeColRec = selectedCol ? recommendations[selectedCol] : null;
  const activeColFact = selectedCol ? columnFacts[selectedCol] : null;

  const recipeLine = (col: ColumnRecommendation) => {
    if (col.should_drop) return 'Drop the column';
    const parts: string[] = [];
    if (col.imputation) parts.push(col.imputation.technique);
    if (col.encoding) parts.push(col.encoding.technique);
    col.scaling_and_outliers.forEach((s) => parts.push(s.technique));
    if (col.datetime_engineering) parts.push('Split date into parts');
    return parts.join(', then ') || 'Keep as is';
  };

  const filters: { id: FilterId; label: string }[] = [
    { id: 'ALL', label: 'All' },
    { id: 'DROP', label: 'Drop' },
    { id: 'IMPUTE', label: 'Missing values' },
    { id: 'OUTLIERS', label: 'Outliers' },
    { id: 'ENCODE', label: 'Encode' },
    { id: 'HEALTHY', label: 'Ready' },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="seg" role="group" aria-label="Filter columns">
          {filters.map((t) => (
            <button key={t.id} type="button" aria-pressed={filter === t.id} onClick={() => setFilter(t.id)}>
              {t.label} <span className="tabular-nums text-ink-3">{counts[t.id]}</span>
            </button>
          ))}
        </div>
        <SearchBox value={search} onChange={setSearch} placeholder="Find a column" className="w-full sm:w-64" />
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="panel overflow-hidden">
          <div className="max-h-[70vh] overflow-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <SortHead k="column">Column</SortHead>
                  <SortHead k="status">Status</SortHead>
                  <SortHead k="missing">Missing</SortHead>
                  <th>Shape</th>
                  <th>What will happen</th>
                </tr>
              </thead>
              <tbody>
                {filteredColumns.map((col) => {
                  const fact = columnFacts[col.column];
                  const ns = fact?.numeric_stats;
                  return (
                    <tr
                      key={col.column}
                      className="is-row-link"
                      aria-selected={selectedCol === col.column}
                      onClick={() => setSelectedCol(col.column)}
                    >
                      <td>
                        <button
                          type="button"
                          className="block text-left"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCol(col.column);
                          }}
                        >
                          <span className="block font-mono font-medium">{col.column}</span>
                          <span className="block text-xs text-ink-3">
                            {fmtType(col.inferred_type)} · {col.unique_count.toLocaleString()} unique
                          </span>
                        </button>
                      </td>
                      <td>
                        <StatusBadge status={col.status} />
                      </td>
                      <td>
                        {col.missing_pct > 0 ? (
                          <>
                            <span className="font-medium tabular-nums text-warn">{col.missing_pct}%</span>
                            <span className="block text-xs text-ink-3">{col.imputation?.technique || 'Drop'}</span>
                          </>
                        ) : (
                          <span className="text-ink-3">None</span>
                        )}
                      </td>
                      <td>
                        {ns ? (
                          <>
                            <span className={`tabular-nums ${Math.abs(ns.skewness) >= 1 ? 'font-medium text-warn' : ''}`}>skew {ns.skewness}</span>
                            {ns.outliers_iqr_count > 0 && (
                              <span className="block text-xs text-bad">
                                {ns.outliers_iqr_count} outliers ({ns.outliers_iqr_pct}%)
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-ink-3">—</span>
                        )}
                      </td>
                      <td className="max-w-[280px] text-ink-2">
                        <span className="line-clamp-2">{recipeLine(col)}</span>
                      </td>
                    </tr>
                  );
                })}
                {filteredColumns.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-ink-3">
                      No columns match this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="panel max-h-[calc(100vh-8rem)] overflow-y-auto xl:sticky xl:top-20" aria-label="Column inspector">
          {activeColRec && activeColFact ? (
            <div className="space-y-5 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-mono text-lg">{activeColRec.column}</h3>
                  <p className="text-sm text-ink-3">
                    {fmtType(activeColFact.inferred_type)} · {activeColFact.raw_dtype}
                  </p>
                </div>
                <button type="button" onClick={() => setSelectedCol(null)} className="btn btn-quiet btn-icon -mr-2 -mt-1" aria-label="Close inspector">
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>

              {activeColRec.should_drop && <Notice tone="bad" title="Recommended to drop">{activeColRec.drop_reason}</Notice>}

              <div className="grid grid-cols-2 gap-4">
                <Measure label="Missing" value={`${activeColFact.missing_pct}%`} hint={`${activeColFact.missing_count} rows`} />
                <Measure label="Unique" value={`${(activeColFact.uniqueness_ratio * 100).toFixed(1)}%`} hint={`${activeColFact.unique_count} values`} />
                {activeColFact.numeric_stats ? (
                  <>
                    <Measure label="Skewness" value={activeColFact.numeric_stats.skewness} />
                    <Measure label="Outliers" value={activeColFact.numeric_stats.outliers_iqr_count} />
                  </>
                ) : (
                  <Measure label="Entropy" value={`${activeColFact.categorical_stats?.entropy ?? 'n/a'} bits`} />
                )}
              </div>

              <div>
                <h4 className="mb-2 text-base">Rules that fired ({activeColRec.all_rules_triggered.length})</h4>
                {activeColRec.all_rules_triggered.length === 0 && (
                  <p className="text-sm text-ink-3">No rules fired. This column can be used as it is.</p>
                )}
                <ul className="space-y-3">
                  {activeColRec.all_rules_triggered.map((rule, idx) => (
                    <li key={idx} className="rounded-lg border border-line p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{rule.rule_name}</span>
                        <Badge>{(rule.confidence * 100).toFixed(0)}% sure</Badge>
                      </div>
                      <p className="mt-1 text-sm text-ink-2">{rule.rationale}</p>
                      <p className="mt-2 text-xs text-ink-3">
                        <span className="font-mono">{rule.rule_id}</span> · {rule.technique}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <p className="px-6 py-12 text-center text-ink-3">Select a column to see which rules fired for it and why.</p>
          )}
        </aside>
      </div>
    </div>
  );
};
