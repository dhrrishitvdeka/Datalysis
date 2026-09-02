import React from 'react';
import { Table } from 'lucide-react';
import type { DatasetSummary, DatasetMetadata } from '../types';

interface DatasetOverviewProps {
  summary: DatasetSummary;
  metadata: DatasetMetadata;
  preview: Record<string, any>[];
}

export const DatasetOverview: React.FC<DatasetOverviewProps> = ({ summary, metadata, preview }) => {
  const columns = preview.length > 0 ? Object.keys(preview[0]) : [];

  return (
    <div className="space-y-4">
      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <div className="p-3.5 rounded-xl glass-card space-y-1">
          <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Records</span>
          <p className="text-lg font-bold font-mono text-white">{summary.row_count.toLocaleString()}</p>
          <span className="text-[10px] text-zinc-600 font-mono">Total rows</span>
        </div>

        <div className="p-3.5 rounded-xl glass-card space-y-1">
          <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Features</span>
          <p className="text-lg font-bold font-mono text-zinc-200">{summary.col_count}</p>
          <span className="text-[10px] text-zinc-600 font-mono">Columns detected</span>
        </div>

        <div className="p-3.5 rounded-xl glass-card space-y-1">
          <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Missing</span>
          <p className="text-lg font-bold font-mono text-amber-400">{summary.overall_missing_pct}%</p>
          <span className="text-[10px] text-zinc-600 font-mono">{summary.total_missing_cells} cells</span>
        </div>

        <div className="p-3.5 rounded-xl glass-card space-y-1">
          <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Duplicates</span>
          <p className="text-lg font-bold font-mono text-zinc-300">{summary.duplicate_rows}</p>
          <span className="text-[10px] text-zinc-600 font-mono">{summary.duplicate_pct}% overlap</span>
        </div>

        <div className="p-3.5 rounded-xl glass-card space-y-1">
          <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Memory</span>
          <p className="text-lg font-bold font-mono text-zinc-300">{summary.memory_mb} MB</p>
          <span className="text-[10px] text-zinc-600 font-mono">RAM size</span>
        </div>

        <div className="p-3.5 rounded-xl glass-card space-y-1">
          <span className="text-[10px] text-zinc-500 font-mono uppercase tracking-wider">Format</span>
          <p className="text-sm font-bold font-mono text-zinc-200 truncate mt-1">
            {metadata.format.toUpperCase()}
          </p>
          <span className="text-[10px] text-zinc-600 font-mono">
            {metadata.detected_delimiter === '\t' ? 'Tab (\\t)' : metadata.detected_delimiter || 'comma'}
          </span>
        </div>
      </div>

      {/* Role Counts */}
      <div className="p-3 rounded-xl glass-card flex flex-wrap items-center gap-1.5 text-xs font-mono">
        <span className="text-zinc-500 uppercase text-[10px] mr-2">Inferred Roles:</span>
        {Object.entries(summary.type_counts)
          .filter(([_, cnt]) => cnt > 0)
          .map(([type, cnt]) => (
            <span
              key={type}
              className="px-2 py-0.5 rounded bg-zinc-900 border border-white/[0.06] text-[11px] text-zinc-300 flex items-center space-x-1"
            >
              <span className="text-white font-semibold">{cnt}</span>
              <span className="text-zinc-500">{type.replace('_', ' ')}</span>
            </span>
          ))}
      </div>

      {/* Raw Matrix Preview */}
      <div className="rounded-xl glass-card overflow-hidden">
        <div className="p-3 bg-black border-b border-white/[0.06] flex items-center justify-between font-mono">
          <div className="flex items-center space-x-2 text-xs text-zinc-300 font-medium">
            <Table className="w-3.5 h-3.5 text-zinc-400" />
            <span>Source Data Matrix (First 20 Rows)</span>
          </div>
          <span className="text-[10px] text-zinc-600">
            {metadata.filename}
          </span>
        </div>

        <div className="overflow-x-auto max-h-[400px]">
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
              {preview.map((row, idx) => (
                <tr key={idx} className="hover:bg-zinc-900/40">
                  <td className="py-1.5 px-3 text-zinc-600 select-none text-[10px]">{idx + 1}</td>
                  {columns.map((col) => {
                    const isMissing = row[col] === null || row[col] === undefined || row[col] === '';
                    return (
                      <td key={col} className={`py-1.5 px-3 whitespace-nowrap ${isMissing ? 'text-amber-400/80 bg-amber-500/5' : ''}`}>
                        {isMissing ? 'null' : String(row[col])}
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
