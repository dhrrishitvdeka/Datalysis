import React, { useMemo, useState } from 'react';
import { Table, ArrowUpDown, Search } from 'lucide-react';
import type { DatasetSummary, DatasetMetadata, ColumnFact, ColumnRecommendation } from '../types';

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
  const columns = preview.length > 0 ? Object.keys(preview[0]) : Object.keys(columnFacts);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('missing');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const rows = useMemo(() => {
    let list = Object.values(columnFacts);
    if (typeFilter) list = list.filter((f) => f.inferred_type === typeFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((f) => f.name.toLowerCase().includes(q));
    }
    const dir = sortDir === 'asc' ? 1 : -1;
    list = [...list].sort((a, b) => {
      const recA = recommendations[a.name];
      const recB = recommendations[b.name];
      switch (sortKey) {
        case 'name':
          return dir * a.name.localeCompare(b.name);
        case 'type':
          return dir * a.inferred_type.localeCompare(b.inferred_type);
        case 'unique':
          return dir * (a.unique_count - b.unique_count);
        case 'status':
          return dir * (recA?.status ?? '').localeCompare(recB?.status ?? '');
        case 'missing':
        default:
          return dir * (a.missing_pct - b.missing_pct);
      }
    });
    return list;
  }, [columnFacts, recommendations, search, typeFilter, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir(key === 'name' || key === 'type' ? 'asc' : 'desc');
    }
  };

  const statusLabel = (status?: string) => {
    switch (status) {
      case 'DROP_RECOMMENDED':
        return { text: 'Drop', cls: 'text-rose-400 bg-rose-500/10 border-rose-500/20' };
      case 'CRITICAL_ATTENTION':
        return { text: 'Critical', cls: 'text-rose-400 bg-rose-500/10 border-rose-500/20' };
      case 'REQUIRES_TRANSFORMATION':
        return { text: 'Transform', cls: 'text-amber-400 bg-amber-500/10 border-amber-500/20' };
      case 'READY_WITH_PREPROCESSING':
        return { text: 'Encode', cls: 'text-sky-400 bg-sky-500/10 border-sky-500/20' };
      default:
        return { text: 'OK', cls: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' };
    }
  };

  const SortBtn = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <button
      onClick={() => toggleSort(k)}
      className={`inline-flex items-center gap-1 uppercase tracking-wider ${
        sortKey === k ? 'text-zinc-200' : 'text-zinc-500'
      }`}
    >
      {children}
      <ArrowUpDown className="w-2.5 h-2.5" />
    </button>
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {([
          { label: 'Rows', value: summary.row_count.toLocaleString(), sub: 'records', warn: false },
          { label: 'Columns', value: String(summary.col_count), sub: 'features', warn: false },
          { label: 'Missing', value: `${summary.overall_missing_pct}%`, sub: `${summary.total_missing_cells.toLocaleString()} cells`, warn: summary.overall_missing_pct > 0 },
          { label: 'Duplicates', value: String(summary.duplicate_rows), sub: `${summary.duplicate_pct}% overlap`, warn: summary.duplicate_rows > 0 },
          { label: 'Memory', value: `${summary.memory_mb} MB`, sub: 'in-process', warn: false },
          {
            label: 'Format',
            value: metadata.format.toUpperCase(),
            sub: String(metadata.detected_delimiter === '\t' ? 'tab' : metadata.detected_delimiter || metadata.detected_encoding),
            warn: false,
          },
        ] as { label: string; value: string; sub: string; warn: boolean }[]).map((m) => (
          <div key={m.label} className="p-3 rounded-xl glass-card space-y-0.5">
            <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">{m.label}</span>
            <p className={`text-lg font-bold font-mono tabular-nums ${m.warn ? 'text-amber-400' : 'text-white'}`}>{m.value}</p>
            <span className="text-[10px] text-zinc-600 font-mono">{m.sub}</span>
          </div>
        ))}
      </div>

      <div className="p-2.5 rounded-xl glass-card flex flex-wrap items-center gap-1.5 text-xs font-mono">
        <span className="text-zinc-500 uppercase text-[10px] mr-1">Types</span>
        <button
          onClick={() => setTypeFilter(null)}
          className={`px-2 py-0.5 rounded border text-[11px] ${
            typeFilter === null ? 'bg-zinc-100 text-zinc-950 border-transparent' : 'bg-zinc-900 border-white/[0.06] text-zinc-400'
          }`}
        >
          all {summary.col_count}
        </button>
        {Object.entries(summary.type_counts)
          .filter(([, cnt]) => cnt > 0)
          .map(([type, cnt]) => (
            <button
              key={type}
              onClick={() => setTypeFilter(typeFilter === type ? null : type)}
              className={`px-2 py-0.5 rounded border text-[11px] ${
                typeFilter === type
                  ? 'bg-zinc-100 text-zinc-950 border-transparent'
                  : 'bg-zinc-900 border-white/[0.06] text-zinc-300'
              }`}
            >
              <span className="font-semibold">{cnt}</span>{' '}
              <span className="text-zinc-500">{type.replace(/_/g, ' ')}</span>
            </button>
          ))}
      </div>

      <div className="rounded-xl glass-card overflow-hidden">
        <div className="p-3 bg-black border-b border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-semibold text-zinc-200 font-mono">Column dictionary</h3>
            <p className="text-[10px] text-zinc-500 font-mono">{rows.length} features · click a row to profile</p>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Find column…"
              className="w-full bg-zinc-950 border border-white/[0.08] rounded-md pl-8 pr-2 py-1.5 text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-500"
            />
          </div>
        </div>
        <div className="overflow-x-auto max-h-[380px]">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead>
              <tr className="bg-zinc-950 border-b border-white/[0.06] text-[10px]">
                <th className="py-2 px-3 sticky top-0 bg-zinc-950"><SortBtn k="name">Feature</SortBtn></th>
                <th className="py-2 px-3 sticky top-0 bg-zinc-950"><SortBtn k="type">Type</SortBtn></th>
                <th className="py-2 px-3 sticky top-0 bg-zinc-950"><SortBtn k="missing">Missing</SortBtn></th>
                <th className="py-2 px-3 sticky top-0 bg-zinc-950"><SortBtn k="unique">Unique</SortBtn></th>
                <th className="py-2 px-3 sticky top-0 bg-zinc-950">Center / mode</th>
                <th className="py-2 px-3 sticky top-0 bg-zinc-950">Range / top</th>
                <th className="py-2 px-3 sticky top-0 bg-zinc-950"><SortBtn k="status">Recipe</SortBtn></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03] text-zinc-300 text-[11px]">
              {rows.map((fact) => {
                const rec = recommendations[fact.name];
                const badge = statusLabel(rec?.status);
                const center = fact.numeric_stats
                  ? `μ ${fact.numeric_stats.mean}  med ${fact.numeric_stats.median}`
                  : fact.categorical_stats?.mode_category ?? '—';
                const range = fact.numeric_stats
                  ? `${fact.numeric_stats.min} → ${fact.numeric_stats.max}`
                  : fact.categorical_stats?.top_categories?.[0]
                    ? `${fact.categorical_stats.top_categories[0].percentage}% ${fact.categorical_stats.top_categories[0].category}`
                    : '—';
                return (
                  <tr
                    key={fact.name}
                    className={`hover:bg-zinc-900/50 cursor-pointer ${rec?.should_drop ? 'bg-rose-950/10' : ''}`}
                    onClick={() => onInspectColumn(fact.name)}
                  >
                    <td className="py-1.5 px-3">
                      <div className="font-medium text-zinc-100">{fact.name}</div>
                      <div className="text-[10px] text-zinc-600">{fact.raw_dtype}</div>
                    </td>
                    <td className="py-1.5 px-3 text-zinc-400">{fact.inferred_type.replace(/_/g, ' ')}</td>
                    <td className={`py-1.5 px-3 tabular-nums ${fact.missing_pct > 0 ? 'text-amber-400' : 'text-zinc-500'}`}>
                      {fact.missing_pct}%
                      <span className="text-zinc-600 ml-1">({fact.missing_count})</span>
                    </td>
                    <td className="py-1.5 px-3 tabular-nums text-zinc-300">
                      {fact.unique_count}
                      <span className="text-zinc-600 ml-1">{(fact.uniqueness_ratio * 100).toFixed(0)}%</span>
                    </td>
                    <td className="py-1.5 px-3 text-zinc-400 truncate max-w-[180px]" title={String(center)}>{center}</td>
                    <td className="py-1.5 px-3 text-zinc-400 truncate max-w-[160px]" title={String(range)}>{range}</td>
                    <td className="py-1.5 px-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenRecipes(fact.name);
                        }}
                        className={`px-1.5 py-0.5 rounded border text-[10px] ${badge.cls}`}
                      >
                        {badge.text}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl glass-card overflow-hidden">
        <div className="p-3 bg-black border-b border-white/[0.06] flex items-center justify-between font-mono">
          <div className="flex items-center space-x-2 text-xs text-zinc-300 font-medium">
            <Table className="w-3.5 h-3.5 text-zinc-400" />
            <span>Source preview</span>
            <span className="text-[10px] text-zinc-600">first {preview.length} rows · nulls highlighted</span>
          </div>
          <span className="text-[10px] text-zinc-600">{metadata.filename}</span>
        </div>

        <div className="overflow-x-auto max-h-[420px]">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead>
              <tr className="border-b border-white/[0.06] text-zinc-500 text-[10px]">
                <th className="py-2 px-3 sticky top-0 bg-zinc-950">#</th>
                {columns.map((col) => {
                  const fact = columnFacts[col];
                  return (
                    <th
                      key={col}
                      className="py-2 px-3 whitespace-nowrap sticky top-0 bg-zinc-950 cursor-pointer hover:text-zinc-200"
                      onClick={() => onInspectColumn(col)}
                      title="Open profiler"
                    >
                      <div className="text-zinc-300">{col}</div>
                      <div className="font-normal text-zinc-600">{fact?.inferred_type.replace(/_/g, ' ')}</div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.03] text-zinc-300 text-[11px]">
              {preview.map((row, idx) => (
                <tr key={idx} className="hover:bg-zinc-900/40">
                  <td className="py-1.5 px-3 text-zinc-600 select-none text-[10px] tabular-nums">{idx + 1}</td>
                  {columns.map((col) => {
                    const missing = isMissing(row[col]);
                    return (
                      <td key={col} className={`py-1.5 px-3 whitespace-nowrap tabular-nums ${missing ? 'cell-null' : ''}`}>
                        {missing ? 'null' : String(row[col])}
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
  );
};
