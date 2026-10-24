import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { DatasetSummary, DatasetMetadata, ColumnFact, ColumnRecommendation } from '../types';
import { Badge, Measure, SearchBox, StatusBadge, STATUS_RANK, fmtType } from './ui';

interface DatasetOverviewProps {
  summary: DatasetSummary;
  metadata: DatasetMetadata;
  preview: Record<string, any>[];
  columnFacts: Record<string, ColumnFact>;
  recommendations: Record<string, ColumnRecommendation>;
  onInspectColumn: (col: string) => void;
  onOpenRecipes: (col: string) => void;
}

type SortKey = 'name' | 'type' | 'missing' | 'unique' | 'status';

function isMissing(value: unknown) {
  return value === null || value === undefined || value === '';
}

export const DatasetOverview: React.FC<DatasetOverviewProps> = ({
  summary,
  metadata,
  preview,
  columnFacts,
  recommendations,
  onInspectColumn,
  onOpenRecipes,
}) => {
  const hiddenDuplicates = summary.hidden_duplicate_rows ?? 0;
  const columns = preview.length > 0 ? Object.keys(preview[0]) : Object.keys(columnFacts);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('status');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const rows = useMemo(() => {
    let list = Object.values(columnFacts);
    if (typeFilter) list = list.filter((f) => f.inferred_type === typeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((f) => f.name.toLowerCase().includes(q));
    }
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return dir * a.name.localeCompare(b.name);
        case 'type':
          return dir * a.inferred_type.localeCompare(b.inferred_type);
        case 'unique':
          return dir * (a.unique_count - b.unique_count);
        case 'status':
          return (
            dir * ((STATUS_RANK[recommendations[a.name]?.status] ?? 9) - (STATUS_RANK[recommendations[b.name]?.status] ?? 9))
          );
        case 'missing':
        default:
          return dir * (a.missing_pct - b.missing_pct);
      }
    });
  }, [columnFacts, recommendations, search, typeFilter, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'name' || key === 'type' || key === 'status' ? 'asc' : 'desc');
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

  const DELIMITER_NAMES: Record<string, string> = { ',': 'comma-separated', '\t': 'tab-separated', ';': 'semicolon-separated', '|': 'pipe-separated' };
  const delimiter = DELIMITER_NAMES[metadata.detected_delimiter ?? ''] ?? metadata.detected_encoding;

  return (
    <div className="space-y-6">
      <section aria-label="Dataset facts" className="panel grid grid-cols-2 gap-x-6 gap-y-5 p-5 sm:grid-cols-3 xl:grid-cols-6">
        <Measure label="Rows" value={summary.row_count.toLocaleString()} />
        <Measure label="Columns" value={summary.col_count} />
        <Measure
          label="Missing cells"
          value={`${summary.overall_missing_pct}%`}
          hint={`${summary.total_missing_cells.toLocaleString()} of ${summary.total_cells.toLocaleString()}`}
          tone={summary.overall_missing_pct > 0 ? 'warn' : 'default'}
        />
        <Measure
          label="Duplicate rows"
          value={summary.duplicate_rows.toLocaleString()}
          hint={hiddenDuplicates > 0 ? `+${hiddenDuplicates} that differ only by ID` : `${summary.duplicate_pct}% of rows`}
          tone={summary.duplicate_rows > 0 || hiddenDuplicates > 0 ? 'warn' : 'default'}
        />
        <Measure label="Memory" value={`${summary.memory_mb} MB`} />
        <Measure label="Format" value={metadata.format.toUpperCase()} hint={String(delimiter)} />
      </section>

      <section className="panel overflow-hidden" aria-labelledby="dict-title">
        <div className="panel-head">
          <div>
            <h2 id="dict-title" className="panel-title">
              Column dictionary
            </h2>
            <p className="panel-sub">
              {rows.length} of {summary.col_count} columns. Select a row to profile it.
            </p>
          </div>
          <SearchBox value={search} onChange={setSearch} placeholder="Find a column" className="w-full sm:w-64" />
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
          <span className="mr-1 text-sm text-ink-3">Filter by type</span>
          <div className="seg" role="group" aria-label="Filter by column type">
            <button type="button" aria-pressed={typeFilter === null} onClick={() => setTypeFilter(null)}>
              All {summary.col_count}
            </button>
            {Object.entries(summary.type_counts)
              .filter(([, cnt]) => cnt > 0)
              .map(([type, cnt]) => (
                <button
                  key={type}
                  type="button"
                  aria-pressed={typeFilter === type}
                  onClick={() => setTypeFilter(typeFilter === type ? null : type)}
                >
                  {fmtType(type)} <span className="tabular-nums text-ink-3">{cnt}</span>
                </button>
              ))}
          </div>
        </div>

        <div className="max-h-[560px] overflow-auto">
          <table className="tbl">
            <thead>
              <tr>
                <SortHead k="name">Column</SortHead>
                <SortHead k="type">Type</SortHead>
                <SortHead k="missing">Missing</SortHead>
                <SortHead k="unique">Unique values</SortHead>
                <th>Typical value</th>
                <th>Range or most common</th>
                <SortHead k="status">Recommendation</SortHead>
              </tr>
            </thead>
            <tbody>
              {rows.map((fact) => {
                const rec = recommendations[fact.name];
                const center = fact.numeric_stats
                  ? `mean ${fact.numeric_stats.mean}, median ${fact.numeric_stats.median}`
                  : fact.categorical_stats?.mode_category ?? '—';
                const top = fact.categorical_stats?.top_categories?.[0];
                const range = fact.numeric_stats
                  ? `${fact.numeric_stats.min} to ${fact.numeric_stats.max}`
                  : top
                    ? `${top.category} (${top.percentage}%)`
                    : '—';
                return (
                  <tr key={fact.name} className="is-row-link">
                    <td>
                      <button
                        type="button"
                        onClick={() => onInspectColumn(fact.name)}
                        className="block text-left"
                        title="Open in the profiler"
                      >
                        <span className="block font-mono font-medium text-accent hover:underline">{fact.name}</span>
                        <span className="block text-xs text-ink-3">{fact.raw_dtype}</span>
                      </button>
                    </td>
                    <td className="text-ink-2">
                      {fmtType(fact.inferred_type)}
                      {fact.is_quasi_constant && (
                        <span className="ml-2 align-middle">
                          <Badge tone="warn" title={`One value fills ${fact.dominant_value_pct ?? 99}% of rows (rule R-FLT-04, advisory)`}>
                            near-constant
                          </Badge>
                        </span>
                      )}
                    </td>
                    <td className={`tabular-nums ${fact.missing_pct > 0 ? 'font-medium text-warn' : 'text-ink-3'}`}>
                      {fact.missing_pct}%
                      <span className="ml-1 font-normal text-ink-3">({fact.missing_count})</span>
                    </td>
                    <td className="tabular-nums">
                      {fact.unique_count.toLocaleString()}
                      <span className="ml-1 text-ink-3">{(fact.uniqueness_ratio * 100).toFixed(0)}%</span>
                    </td>
                    <td className="max-w-[200px] truncate font-mono text-[0.8125rem] text-ink-2" title={center}>
                      {center}
                    </td>
                    <td className="max-w-[200px] truncate font-mono text-[0.8125rem] text-ink-2" title={range}>
                      {range}
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => onOpenRecipes(fact.name)}
                        title="Open the recipe for this column"
                        className="rounded-md"
                      >
                        <StatusBadge status={rec?.status} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-ink-3">
                    No column matches that search and type filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel overflow-hidden" aria-labelledby="preview-title">
        <div className="panel-head">
          <div>
            <h2 id="preview-title" className="panel-title">
              Source preview
            </h2>
            <p className="panel-sub">First {preview.length} rows of {metadata.filename}. Missing values are highlighted.</p>
          </div>
        </div>
        <div className="max-h-[440px] overflow-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th className="w-12 text-right">#</th>
                {columns.map((col) => (
                  <th key={col}>
                    <button type="button" onClick={() => onInspectColumn(col)} className="text-left hover:text-accent" title="Open in the profiler">
                      <span className="block font-mono">{col}</span>
                      <span className="block font-normal text-ink-3">{fmtType(columnFacts[col]?.inferred_type)}</span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.map((row, idx) => (
                <tr key={idx}>
                  <td className="text-right text-ink-3">{idx + 1}</td>
                  {columns.map((col) => {
                    const missing = isMissing(row[col]);
                    return (
                      <td key={col} className={`whitespace-nowrap font-mono text-[0.8125rem] ${missing ? 'cell-null' : ''}`}>
                        {missing ? 'missing' : String(row[col])}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
