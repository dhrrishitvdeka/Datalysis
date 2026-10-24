import React, { useState } from 'react';
import type { CleaningReport } from '../types';
import { Measure, SearchBox } from './ui';

interface DataDiffViewerProps {
  rawPreview: Record<string, any>[];
  cleanedPreview: Record<string, any>[];
  report: CleaningReport | null;
}

const isNullish = (v: any) => v === null || v === undefined || v === '' || Number.isNaN(v);

export const DataDiffViewer: React.FC<DataDiffViewerProps> = ({ rawPreview, cleanedPreview, report }) => {
  const [viewMode, setViewMode] = useState<'split' | 'cleaned'>('split');
  const [search, setSearch] = useState('');

  const rawCols = rawPreview.length > 0 ? Object.keys(rawPreview[0]) : [];
  const cleanCols = cleanedPreview.length > 0 ? Object.keys(cleanedPreview[0]) : [];
  const droppedCols = rawCols.filter((c) => !cleanCols.includes(c));
  const newCols = cleanCols.filter((c) => !rawCols.includes(c));

  const getCellStatus = (rowIdx: number, col: string, val: any): 'normal' | 'imputed' | 'modified' | 'new' => {
    if (!rawPreview[rowIdx]) return 'normal';
    if (!rawCols.includes(col)) return 'new';
    const rawVal = rawPreview[rowIdx][col];
    if (isNullish(rawVal)) return !isNullish(val) ? 'imputed' : 'normal';
    if (typeof rawVal === 'number' && typeof val === 'number') return Math.abs(rawVal - val) > 0.0001 ? 'modified' : 'normal';
    return String(rawVal) !== String(val) ? 'modified' : 'normal';
  };

  const filteredCleanRows = cleanedPreview
    .map((row, idx) => ({ row, idx }))
    .filter(({ row }) => !search || Object.values(row).some((val) => String(val).toLowerCase().includes(search.toLowerCase())));

  const fmt = (val: any) => (typeof val === 'number' ? (Number.isInteger(val) ? val : val.toFixed(3)) : String(val ?? ''));

  const cleanedTable = (rows: { row: Record<string, any>; idx: number }[], maxHeight: string) => (
    <div className={`overflow-auto ${maxHeight}`}>
      <table className="tbl">
        <thead>
          <tr>
            <th className="w-12 text-right">#</th>
            {cleanCols.map((c) => (
              <th key={c} className="font-mono">
                {c}
                {newCols.includes(c) && <span className="ml-1.5 font-sans font-semibold text-accent">new</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ row, idx }) => (
            <tr key={idx}>
              <td className="text-right text-ink-3">{idx + 1}</td>
              {cleanCols.map((c) => {
                const status = getCellStatus(idx, c, row[c]);
                const cls = { normal: '', imputed: 'cell-imputed', modified: 'cell-modified', new: 'cell-new' }[status];
                return (
                  <td key={c} className="whitespace-nowrap font-mono text-[0.8125rem]">
                    <span className={cls}>{fmt(row[c])}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-5">
      <section className="panel grid grid-cols-2 gap-x-6 gap-y-4 p-5 sm:grid-cols-4" aria-label="What changed">
        <Measure
          label="Missing cells filled"
          value={report ? Math.max(0, report.initial_missing_cells - report.final_missing_cells).toLocaleString() : '—'}
          tone="good"
        />
        <Measure label="Original columns removed" value={droppedCols.length} hint="dropped, or replaced by encoded columns" />
        <Measure label="Columns created" value={newCols.length} hint="in the preview" />
        <Measure
          label="Shape"
          value={report ? `${report.initial_shape[0]}×${report.initial_shape[1]} → ${report.final_shape[0]}×${report.final_shape[1]}` : '—'}
        />
      </section>

      <section className="panel overflow-hidden">
        <div className="panel-head">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <div className="seg" role="group" aria-label="Comparison layout">
              <button type="button" aria-pressed={viewMode === 'split'} onClick={() => setViewMode('split')}>
                Before and after
              </button>
              <button type="button" aria-pressed={viewMode === 'cleaned'} onClick={() => setViewMode('cleaned')}>
                Cleaned data only
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-2">
              <span className="cell-imputed">Filled in</span>
              <span className="cell-modified">Changed or scaled</span>
              <span className="cell-new">New column</span>
            </div>
          </div>
          {viewMode === 'cleaned' && <SearchBox value={search} onChange={setSearch} placeholder="Search rows" className="w-full sm:w-60" />}
        </div>

        {viewMode === 'split' ? (
          <div className="grid divide-y divide-line lg:grid-cols-2 lg:divide-x lg:divide-y-0">
            <div className="min-w-0">
              <div className="flex items-center justify-between border-b border-line px-5 py-2.5">
                <h3 className="text-base">Before</h3>
                <span className="text-sm text-ink-3">{rawCols.length} columns</span>
              </div>
              <div className="max-h-[480px] overflow-auto">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th className="w-12 text-right">#</th>
                      {rawCols.map((c) => (
                        <th key={c} className={`font-mono ${droppedCols.includes(c) ? 'text-bad line-through' : ''}`} title={droppedCols.includes(c) ? 'Dropped by the recipe' : undefined}>
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rawPreview.slice(0, 30).map((row, idx) => (
                      <tr key={idx}>
                        <td className="text-right text-ink-3">{idx + 1}</td>
                        {rawCols.map((c) => {
                          const nullish = isNullish(row[c]);
                          return (
                            <td key={c} className={`whitespace-nowrap font-mono text-[0.8125rem] ${nullish ? 'cell-null' : ''}`}>
                              {nullish ? 'missing' : String(row[c])}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center justify-between border-b border-line px-5 py-2.5">
                <h3 className="text-base">After</h3>
                <span className="text-sm text-ink-3">{cleanCols.length} columns</span>
              </div>
              {cleanedTable(cleanedPreview.slice(0, 30).map((row, idx) => ({ row, idx })), 'max-h-[480px]')}
            </div>
          </div>
        ) : (
          <>
            {cleanedTable(filteredCleanRows, 'max-h-[560px]')}
            {filteredCleanRows.length === 0 && <p className="py-10 text-center text-ink-3">No preview row matches that search.</p>}
          </>
        )}
      </section>
    </div>
  );
};
