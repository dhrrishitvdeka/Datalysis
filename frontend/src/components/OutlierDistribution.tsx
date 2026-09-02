import React, { useState } from 'react';
import { AlertOctagon } from 'lucide-react';
import type { ColumnFact, ColumnRecommendation } from '../types';

interface OutlierDistributionProps {
  columnFacts: Record<string, ColumnFact>;
  recommendations: Record<string, ColumnRecommendation>;
}

export const OutlierDistribution: React.FC<OutlierDistributionProps> = ({
  columnFacts,
  recommendations,
}) => {
  const numericCols = Object.entries(columnFacts)
    .filter(([_, fact]) => fact.numeric_stats !== null)
    .map(([name, fact]) => ({ name, fact, rec: recommendations[name] }));

  const [selectedCol, setSelectedCol] = useState<string>(numericCols[0]?.name || '');

  if (numericCols.length === 0) {
    return (
      <div className="p-8 rounded-xl glass-card text-center text-zinc-500 text-xs font-mono">
        No continuous numerical features found in this dataset.
      </div>
    );
  }

  const active = numericCols.find((c) => c.name === selectedCol) || numericCols[0];
  const ns = active.fact.numeric_stats!;
  const rec = active.rec;

  const maxCount = Math.max(...(ns.histogram.counts.length > 0 ? ns.histogram.counts : [1]));

  return (
    <div className="space-y-4">
      {/* Column Pills */}
      <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 no-scrollbar">
        {numericCols.map((c) => {
          const isSelected = c.name === active.name;
          const hasOutliers = (c.fact.numeric_stats?.outliers_iqr_count || 0) > 0;
          return (
            <button
              key={c.name}
              onClick={() => setSelectedCol(c.name)}
              className={`px-2.5 py-1 rounded-md text-xs font-mono whitespace-nowrap transition flex items-center space-x-1.5 ${
                isSelected
                  ? 'bg-zinc-100 text-zinc-950 font-semibold shadow-sm'
                  : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200 border border-white/[0.06]'
              }`}
            >
              <span>{c.name}</span>
              {hasOutliers && (
                <span className={`w-1 h-1 rounded-full ${isSelected ? 'bg-zinc-950' : 'bg-rose-400'}`} />
              )}
            </button>
          );
        })}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Histogram */}
        <div className="lg:col-span-2 p-5 rounded-xl glass-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white font-mono flex items-center space-x-2">
                <span>{active.name}</span>
              </h3>
              <p className="text-xs text-zinc-500">Frequency distribution with 1.5x IQR outlier cutoffs</p>
            </div>

            <div className="flex items-center space-x-1.5 font-mono text-[11px]">
              <span className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-white/[0.06]">
                Skew: {ns.skewness}
              </span>
              <span className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-white/[0.06]">
                Kurt: {ns.kurtosis}
              </span>
            </div>
          </div>

          {/* Minimalist Bar Display */}
          <div className="h-48 flex items-end justify-between gap-1 pt-6 pb-2 px-3 bg-black/80 rounded-lg border border-white/[0.04]">
            {ns.histogram.counts.map((cnt, idx) => {
              const heightPct = (cnt / maxCount) * 100;
              const edgeLow = ns.histogram.bin_edges[idx];
              const edgeHigh = ns.histogram.bin_edges[idx + 1];
              const isOutlierBin = edgeLow < ns.lower_bound_iqr || edgeHigh > ns.upper_bound_iqr;

              return (
                <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                  <div className="absolute -top-8 hidden group-hover:flex flex-col items-center z-20 pointer-events-none">
                    <span className="bg-zinc-900 text-zinc-200 text-[10px] font-mono px-2 py-0.5 rounded shadow-lg border border-zinc-700 whitespace-nowrap">
                      [{edgeLow}, {edgeHigh}]: {cnt}
                    </span>
                  </div>

                  <div
                    className={`w-full rounded-t-sm transition-all duration-200 ${
                      isOutlierBin
                        ? 'bg-rose-500/70 group-hover:bg-rose-400'
                        : 'bg-zinc-600 group-hover:bg-zinc-400'
                    }`}
                    style={{ height: `${Math.max(4, heightPct)}%` }}
                  />
                  <span className="text-[9px] font-mono text-zinc-600 mt-1 truncate max-w-[36px]">
                    {edgeLow}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Boxplot Quartiles */}
          <div className="grid grid-cols-5 gap-2 text-xs">
            <div className="p-2 rounded-lg bg-zinc-950 border border-white/[0.06] text-center">
              <span className="text-zinc-500 text-[10px] font-mono block">Min</span>
              <span className="font-mono font-medium text-zinc-300">{ns.min}</span>
            </div>
            <div className="p-2 rounded-lg bg-zinc-950 border border-white/[0.06] text-center">
              <span className="text-zinc-500 text-[10px] font-mono block">Q25</span>
              <span className="font-mono font-medium text-zinc-300">{ns.q25}</span>
            </div>
            <div className="p-2 rounded-lg bg-zinc-950 border border-white/[0.06] text-center">
              <span className="text-zinc-500 text-[10px] font-mono block">Median</span>
              <span className="font-mono font-medium text-white">{ns.median}</span>
            </div>
            <div className="p-2 rounded-lg bg-zinc-950 border border-white/[0.06] text-center">
              <span className="text-zinc-500 text-[10px] font-mono block">Q75</span>
              <span className="font-mono font-medium text-zinc-300">{ns.q75}</span>
            </div>
            <div className="p-2 rounded-lg bg-zinc-950 border border-white/[0.06] text-center">
              <span className="text-zinc-500 text-[10px] font-mono block">Max</span>
              <span className="font-mono font-medium text-zinc-300">{ns.max}</span>
            </div>
          </div>
        </div>

        {/* Diagnostics & Recipe */}
        <div className="space-y-3">
          <div className="p-5 rounded-xl glass-card space-y-3">
            <div className="flex items-center space-x-1.5 text-rose-400">
              <AlertOctagon className="w-3.5 h-3.5" />
              <h4 className="text-[10px] font-mono uppercase tracking-wider font-semibold">Tukey's IQR Outliers</h4>
            </div>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded-lg bg-black/60 border border-white/[0.06] flex items-center justify-between font-mono">
                <span className="text-zinc-500">Outlier Count</span>
                <span className="text-rose-400 font-semibold">{ns.outliers_iqr_count} ({ns.outliers_iqr_pct}%)</span>
              </div>
              <div className="p-2.5 rounded-lg bg-black/60 border border-white/[0.06] flex items-center justify-between font-mono">
                <span className="text-zinc-500">IQR Lower Cutoff</span>
                <span className="text-zinc-300">{ns.lower_bound_iqr}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-black/60 border border-white/[0.06] flex items-center justify-between font-mono">
                <span className="text-zinc-500">IQR Upper Cutoff</span>
                <span className="text-zinc-300">{ns.upper_bound_iqr}</span>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-xl glass-card space-y-2.5">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block">
              Remediation Action
            </span>

            {rec?.scaling_and_outliers.length ? (
              rec.scaling_and_outliers.map((step, idx) => (
                <div key={idx} className="p-3 rounded-lg bg-zinc-950 border border-white/[0.06] space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono font-medium text-zinc-200">
                    <span>{step.technique}</span>
                    <span className="text-[10px] text-zinc-500">{step.rule_id}</span>
                  </div>
                  <p className="text-[11px] text-zinc-400 leading-relaxed font-sans">
                    {step.rationale}
                  </p>
                </div>
              ))
            ) : (
              <div className="p-3 rounded-lg bg-zinc-950 border border-white/[0.06] text-xs text-zinc-400">
                Standard normal distribution: StandardScaler without capping.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
