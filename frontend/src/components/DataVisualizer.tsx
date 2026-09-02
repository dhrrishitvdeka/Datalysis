import React, { useState, useEffect } from 'react';
import { BarChart3, ScatterChart as ScatterIcon, Layers, Grid, Sliders, ArrowRight, TrendingUp, Info } from 'lucide-react';
import type { ColumnFact, ColumnRecommendation } from '../types';
import { fetchScatterData, fetchGroupedData, fetchMissingnessMatrix } from '../services/api';

interface DataVisualizerProps {
  columnFacts: Record<string, ColumnFact>;
  recommendations: Record<string, ColumnRecommendation>;
}

export const DataVisualizer: React.FC<DataVisualizerProps> = ({ columnFacts, recommendations }) => {
  const allColumns = Object.keys(columnFacts);
  const numericColumns = allColumns.filter((c) => columnFacts[c].numeric_stats !== null);
  const categoricalColumns = allColumns.filter(
    (c) => columnFacts[c].numeric_stats === null && columnFacts[c].inferred_type !== 'datetime'
  );

  const [activeMode, setActiveMode] = useState<'UNIVARIATE' | 'BIVARIATE' | 'GROUPED' | 'MISSINGNESS'>('UNIVARIATE');

  // Univariate State
  const [selectedCol, setSelectedCol] = useState<string>(allColumns[0] || '');

  // Bivariate Scatter State
  const [scatterX, setScatterX] = useState<string>(numericColumns[0] || '');
  const [scatterY, setScatterY] = useState<string>(numericColumns[1] || numericColumns[0] || '');
  const [scatterHue, setScatterHue] = useState<string>('none');
  const [scatterData, setScatterData] = useState<{ points: any[]; stats?: any }>({ points: [], stats: null });
  const [scatterLoading, setScatterLoading] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<any | null>(null);

  // Grouped State
  const [groupedCat, setGroupedCat] = useState<string>(categoricalColumns[0] || allColumns[0] || '');
  const [groupedNum, setGroupedNum] = useState<string>(numericColumns[0] || '');
  const [groupedData, setGroupedData] = useState<any[]>([]);
  const [groupedLoading, setGroupedLoading] = useState(false);

  // Missingness Matrix State
  const [missingnessData, setMissingnessData] = useState<{ columns: string[]; total_rows: number; chunks: any[] } | null>(null);
  const [missingnessLoading, setMissingnessLoading] = useState(false);

  // Fetch Scatter
  useEffect(() => {
    if (activeMode === 'BIVARIATE' && scatterX && scatterY) {
      setScatterLoading(true);
      fetchScatterData(scatterX, scatterY, scatterHue !== 'none' ? scatterHue : undefined)
        .then(setScatterData)
        .catch((err) => console.error(err))
        .finally(() => setScatterLoading(false));
    }
  }, [activeMode, scatterX, scatterY, scatterHue]);

  // Fetch Grouped
  useEffect(() => {
    if (activeMode === 'GROUPED' && groupedCat && groupedNum) {
      setGroupedLoading(true);
      fetchGroupedData(groupedCat, groupedNum)
        .then((res) => setGroupedData(res.groups))
        .catch((err) => console.error(err))
        .finally(() => setGroupedLoading(false));
    }
  }, [activeMode, groupedCat, groupedNum]);

  // Fetch Missingness
  useEffect(() => {
    if (activeMode === 'MISSINGNESS' && !missingnessData) {
      setMissingnessLoading(true);
      fetchMissingnessMatrix()
        .then(setMissingnessData)
        .catch((err) => console.error(err))
        .finally(() => setMissingnessLoading(false));
    }
  }, [activeMode, missingnessData]);

  const activeFact = columnFacts[selectedCol];
  const numStats = activeFact?.numeric_stats;
  const catStats = activeFact?.categorical_stats;

  return (
    <div className="space-y-4">
      {/* Mode Switcher */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-1 border-b border-white/[0.04]">
        <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar">
          {[
            { id: 'UNIVARIATE', label: 'Feature Profiler', icon: BarChart3 },
            { id: 'BIVARIATE', label: 'Bivariate Scatter & Trend', icon: ScatterIcon },
            { id: 'GROUPED', label: 'Category vs Metric', icon: Layers },
            { id: 'MISSINGNESS', label: 'Sparsity Matrix', icon: Grid },
          ].map((mode) => {
            const active = activeMode === mode.id;
            const Icon = mode.icon;
            return (
              <button
                key={mode.id}
                onClick={() => setActiveMode(mode.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition flex items-center space-x-1.5 ${
                  active
                    ? 'bg-zinc-100 text-zinc-950 font-semibold shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-zinc-950' : 'text-zinc-500'}`} />
                <span>{mode.label}</span>
              </button>
            );
          })}
        </div>

        <span className="text-[11px] font-mono text-zinc-600 hidden sm:block">
          AMOLED Vector Analytics
        </span>
      </div>

      {/* =========================================================================
          MODE 1: UNIVARIATE FEATURE PROFILER
      ========================================================================= */}
      {activeMode === 'UNIVARIATE' && (
        <div className="space-y-4">
          {/* Feature Selector */}
          <div className="flex items-center space-x-2">
            <span className="text-xs text-zinc-500 font-mono">Select Feature:</span>
            <select
              value={selectedCol}
              onChange={(e) => setSelectedCol(e.target.value)}
              className="bg-zinc-950 border border-white/[0.08] text-xs font-mono text-zinc-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-zinc-500"
            >
              {allColumns.map((col) => (
                <option key={col} value={col}>
                  {col} ({columnFacts[col].inferred_type.replace('_', ' ')})
                </option>
              ))}
            </select>
          </div>

          {activeFact && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {/* Main Chart Area */}
              <div className="lg:col-span-2 p-5 rounded-xl glass-card space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white font-mono">{activeFact.name}</h3>
                    <p className="text-xs text-zinc-500 font-mono">
                      Role: {activeFact.inferred_type} • Missing: {activeFact.missing_pct}% ({activeFact.missing_count} rows)
                    </p>
                  </div>

                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-white/[0.06]">
                    {activeFact.unique_count} Distinct
                  </span>
                </div>

                {/* If Numeric: Histogram */}
                {numStats && numStats.histogram.counts.length > 0 ? (
                  <div className="space-y-4">
                    <div className="h-56 flex items-end justify-between gap-1 pt-6 pb-2 px-3 bg-black/80 rounded-lg border border-white/[0.04]">
                      {numStats.histogram.counts.map((cnt, idx) => {
                        const maxCount = Math.max(...numStats.histogram.counts);
                        const heightPct = (cnt / Math.max(1, maxCount)) * 100;
                        const edgeLow = numStats.histogram.bin_edges[idx];
                        const edgeHigh = numStats.histogram.bin_edges[idx + 1];
                        const isOutlier = edgeLow < numStats.lower_bound_iqr || edgeHigh > numStats.upper_bound_iqr;

                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                            <div className="absolute -top-8 hidden group-hover:flex flex-col items-center z-20 pointer-events-none">
                              <span className="bg-zinc-900 text-zinc-200 text-[10px] font-mono px-2 py-0.5 rounded shadow-lg border border-zinc-700 whitespace-nowrap">
                                [{edgeLow}, {edgeHigh}]: {cnt}
                              </span>
                            </div>
                            <div
                              className={`w-full rounded-t-sm transition-all duration-150 ${
                                isOutlier ? 'bg-rose-500/70 group-hover:bg-rose-400' : 'bg-zinc-500 group-hover:bg-zinc-300'
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

                    {/* Quartile Scale */}
                    <div className="grid grid-cols-5 gap-1.5 text-center text-xs font-mono">
                      <div className="p-2 rounded bg-zinc-950 border border-white/[0.04]">
                        <span className="text-zinc-500 text-[10px] block">Min</span>
                        <span className="text-zinc-300 font-medium">{numStats.min}</span>
                      </div>
                      <div className="p-2 rounded bg-zinc-950 border border-white/[0.04]">
                        <span className="text-zinc-500 text-[10px] block">Q25</span>
                        <span className="text-zinc-300 font-medium">{numStats.q25}</span>
                      </div>
                      <div className="p-2 rounded bg-zinc-950 border border-white/[0.04]">
                        <span className="text-zinc-500 text-[10px] block">Median</span>
                        <span className="text-white font-medium">{numStats.median}</span>
                      </div>
                      <div className="p-2 rounded bg-zinc-950 border border-white/[0.04]">
                        <span className="text-zinc-500 text-[10px] block">Q75</span>
                        <span className="text-zinc-300 font-medium">{numStats.q75}</span>
                      </div>
                      <div className="p-2 rounded bg-zinc-950 border border-white/[0.04]">
                        <span className="text-zinc-500 text-[10px] block">Max</span>
                        <span className="text-zinc-300 font-medium">{numStats.max}</span>
                      </div>
                    </div>
                  </div>
                ) : catStats && catStats.top_categories.length > 0 ? (
                  /* If Categorical: Horizontal Frequency Bars */
                  <div className="space-y-2 pt-2">
                    <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider block">
                      Category Frequency Distribution
                    </span>
                    {catStats.top_categories.map((cat, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-zinc-300 truncate max-w-[200px]">{cat.category}</span>
                          <span className="text-zinc-500">
                            {cat.count} rows <span className="text-zinc-300">({cat.percentage}%)</span>
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-zinc-900 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-zinc-400 transition-all duration-500"
                            style={{ width: `${cat.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-zinc-600 font-mono text-xs">
                    No discrete distribution data available for this feature.
                  </div>
                )}
              </div>

              {/* Statistical Fact Sheet */}
              <div className="p-5 rounded-xl glass-card space-y-3">
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block">
                  Statistical Dimensions
                </span>

                <div className="space-y-1.5 text-xs font-mono">
                  <div className="p-2.5 rounded bg-zinc-950 border border-white/[0.04] flex justify-between">
                    <span className="text-zinc-500">Non-Null Records</span>
                    <span className="text-zinc-200">{activeFact.non_null_count}</span>
                  </div>

                  <div className="p-2.5 rounded bg-zinc-950 border border-white/[0.04] flex justify-between">
                    <span className="text-zinc-500">Missing Rate</span>
                    <span className={activeFact.missing_pct > 0 ? 'text-amber-400' : 'text-zinc-400'}>
                      {activeFact.missing_pct}%
                    </span>
                  </div>

                  {numStats && (
                    <>
                      <div className="p-2.5 rounded bg-zinc-950 border border-white/[0.04] flex justify-between">
                        <span className="text-zinc-500">Mean</span>
                        <span className="text-zinc-200">{numStats.mean}</span>
                      </div>
                      <div className="p-2.5 rounded bg-zinc-950 border border-white/[0.04] flex justify-between">
                        <span className="text-zinc-500">Std Deviation</span>
                        <span className="text-zinc-200">{numStats.std}</span>
                      </div>
                      <div className="p-2.5 rounded bg-zinc-950 border border-white/[0.04] flex justify-between">
                        <span className="text-zinc-500">Skewness</span>
                        <span className={Math.abs(numStats.skewness) >= 1.0 ? 'text-amber-400' : 'text-zinc-200'}>
                          {numStats.skewness}
                        </span>
                      </div>
                      <div className="p-2.5 rounded bg-zinc-950 border border-white/[0.04] flex justify-between">
                        <span className="text-zinc-500">Tukey Outliers</span>
                        <span className={numStats.outliers_iqr_count > 0 ? 'text-rose-400' : 'text-zinc-200'}>
                          {numStats.outliers_iqr_count} ({numStats.outliers_iqr_pct}%)
                        </span>
                      </div>
                    </>
                  )}

                  {catStats && (
                    <>
                      <div className="p-2.5 rounded bg-zinc-950 border border-white/[0.04] flex justify-between">
                        <span className="text-zinc-500">Dominant Mode</span>
                        <span className="text-zinc-200 truncate max-w-[140px]">{catStats.mode_category}</span>
                      </div>
                      <div className="p-2.5 rounded bg-zinc-950 border border-white/[0.04] flex justify-between">
                        <span className="text-zinc-500">Shannon Entropy</span>
                        <span className="text-zinc-200">{catStats.entropy} bits</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          MODE 2: BIVARIATE SCATTER & REGRESSION
      ========================================================================= */}
      {activeMode === 'BIVARIATE' && (
        <div className="space-y-4">
          {/* Pickers Bar */}
          <div className="flex flex-wrap items-center gap-3 p-3.5 rounded-xl glass-card text-xs font-mono">
            <div className="flex items-center space-x-1.5">
              <span className="text-zinc-500">X Axis:</span>
              <select
                value={scatterX}
                onChange={(e) => setScatterX(e.target.value)}
                className="bg-zinc-950 border border-white/[0.08] text-xs text-zinc-200 rounded px-2.5 py-1 focus:outline-none"
              >
                {numericColumns.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-1.5">
              <span className="text-zinc-500">Y Axis:</span>
              <select
                value={scatterY}
                onChange={(e) => setScatterY(e.target.value)}
                className="bg-zinc-950 border border-white/[0.08] text-xs text-zinc-200 rounded px-2.5 py-1 focus:outline-none"
              >
                {numericColumns.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-1.5">
              <span className="text-zinc-500">Color Hue:</span>
              <select
                value={scatterHue}
                onChange={(e) => setScatterHue(e.target.value)}
                className="bg-zinc-950 border border-white/[0.08] text-xs text-zinc-200 rounded px-2.5 py-1 focus:outline-none"
              >
                <option value="none">None (Monochrome)</option>
                {allColumns.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {scatterData.stats && (
              <div className="ml-auto flex items-center space-x-3 text-zinc-400">
                <span>Pearson r: <strong className="text-white">{scatterData.stats.r_value}</strong></span>
                <span>R²: <strong className="text-white">{scatterData.stats.r_squared}</strong></span>
                <span className="text-zinc-600">({scatterData.stats.total_points} points)</span>
              </div>
            )}
          </div>

          {/* Scatter Chart Area */}
          <div className="p-5 rounded-xl glass-card relative">
            {scatterLoading ? (
              <div className="h-80 flex items-center justify-center font-mono text-xs text-zinc-500">
                <span className="animate-pulse">Rendering Scatter Plot...</span>
              </div>
            ) : scatterData.points.length > 0 ? (
              (() => {
                const pts = scatterData.points;
                const minX = Math.min(...pts.map((p) => p.x));
                const maxX = Math.max(...pts.map((p) => p.x));
                const minY = Math.min(...pts.map((p) => p.y));
                const maxY = Math.max(...pts.map((p) => p.y));
                const rangeX = Math.max(0.001, maxX - minX);
                const rangeY = Math.max(0.001, maxY - minY);

                // Trendline points
                let trendLineSvg = null;
                if (scatterData.stats) {
                  const { slope, intercept } = scatterData.stats;
                  const yStart = slope * minX + intercept;
                  const yEnd = slope * maxX + intercept;
                  const svgX1 = 40 + ((minX - minX) / rangeX) * 520;
                  const svgY1 = 280 - ((yStart - minY) / rangeY) * 240;
                  const svgX2 = 40 + ((maxX - minX) / rangeX) * 520;
                  const svgY2 = 280 - ((yEnd - minY) / rangeY) * 240;
                  trendLineSvg = (
                    <line
                      x1={svgX1}
                      y1={svgY1}
                      x2={svgX2}
                      y2={svgY2}
                      stroke="rgba(255, 255, 255, 0.4)"
                      strokeWidth="1.5"
                      strokeDasharray="4 3"
                    />
                  );
                }

                return (
                  <div className="space-y-3">
                    <div className="relative h-80 w-full bg-black/90 rounded-lg border border-white/[0.04] overflow-hidden">
                      {/* Tooltip Overlay */}
                      {hoveredPoint && (
                        <div className="absolute top-3 right-4 bg-zinc-900/90 border border-white/[0.1] px-2.5 py-1.5 rounded text-[11px] font-mono z-10 pointer-events-none">
                          <div>{scatterX}: {hoveredPoint.x}</div>
                          <div>{scatterY}: {hoveredPoint.y}</div>
                          {hoveredPoint.hue && <div>Hue: {hoveredPoint.hue}</div>}
                        </div>
                      )}

                      <svg viewBox="0 0 600 300" className="w-full h-full">
                        {/* Grid lines */}
                        <line x1="40" y1="280" x2="580" y2="280" stroke="#27272A" strokeWidth="1" />
                        <line x1="40" y1="20" x2="40" y2="280" stroke="#27272A" strokeWidth="1" />

                        {/* Trendline */}
                        {trendLineSvg}

                        {/* Points */}
                        {pts.map((pt, i) => {
                          const cx = 40 + ((pt.x - minX) / rangeX) * 520;
                          const cy = 280 - ((pt.y - minY) / rangeY) * 240;
                          return (
                            <circle
                              key={i}
                              cx={cx}
                              cy={cy}
                              r="3.5"
                              fill={pt.hue ? '#A1A1AA' : '#E4E4E7'}
                              fillOpacity="0.75"
                              className="hover:r-5 hover:fill-white cursor-pointer transition-all"
                              onMouseEnter={() => setHoveredPoint(pt)}
                              onMouseLeave={() => setHoveredPoint(null)}
                            />
                          );
                        })}
                      </svg>
                    </div>

                    <div className="flex justify-between text-[11px] font-mono text-zinc-500 px-2">
                      <span>X Min: {minX}</span>
                      <span className="text-zinc-400 font-semibold">{scatterX} (X) vs {scatterY} (Y)</span>
                      <span>X Max: {maxX}</span>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="h-80 flex items-center justify-center font-mono text-xs text-zinc-600">
                Please select continuous numerical features for both X and Y axes.
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          MODE 3: CATEGORY VS METRIC (GROUPED ANALYSIS)
      ========================================================================= */}
      {activeMode === 'GROUPED' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 p-3.5 rounded-xl glass-card text-xs font-mono">
            <div className="flex items-center space-x-1.5">
              <span className="text-zinc-500">Category Group (X):</span>
              <select
                value={groupedCat}
                onChange={(e) => setGroupedCat(e.target.value)}
                className="bg-zinc-950 border border-white/[0.08] text-xs text-zinc-200 rounded px-2.5 py-1 focus:outline-none"
              >
                {allColumns.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-1.5">
              <span className="text-zinc-500">Continuous Metric (Y):</span>
              <select
                value={groupedNum}
                onChange={(e) => setGroupedNum(e.target.value)}
                className="bg-zinc-950 border border-white/[0.08] text-xs text-zinc-200 rounded px-2.5 py-1 focus:outline-none"
              >
                {numericColumns.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-5 rounded-xl glass-card space-y-4">
            {groupedLoading ? (
              <div className="h-64 flex items-center justify-center font-mono text-xs text-zinc-500">
                <span className="animate-pulse">Aggregating Group Statistics...</span>
              </div>
            ) : groupedData.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-zinc-300">
                    Mean & Spread of `{groupedNum}` Grouped by `{groupedCat}`
                  </h3>
                  <span className="text-[10px] font-mono text-zinc-500">{groupedData.length} Groups</span>
                </div>

                {/* Grouped Comparison Bars */}
                <div className="space-y-2">
                  {(() => {
                    const maxMean = Math.max(...groupedData.map((g) => Math.max(g.mean, g.median)));
                    return groupedData.map((g, idx) => (
                      <div key={idx} className="p-3 rounded-lg bg-black/60 border border-white/[0.04] space-y-1.5 font-mono text-xs">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-white">{g.category}</span>
                          <div className="flex items-center space-x-3 text-[11px] text-zinc-400">
                            <span>Mean: <strong className="text-zinc-200">{g.mean}</strong></span>
                            <span>Median: <strong className="text-zinc-200">{g.median}</strong></span>
                            <span className="text-zinc-600">({g.count} rows)</span>
                          </div>
                        </div>

                        <div className="w-full h-2 rounded-full bg-zinc-900 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-zinc-300 transition-all duration-300"
                            style={{ width: `${Math.max(2, (g.mean / Math.max(0.01, maxMean)) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center text-zinc-600 font-mono text-xs">
                Select a category dimension and a numeric column to view grouped statistics.
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          MODE 4: MISSINGNESS SPARSITY MATRIX
      ========================================================================= */}
      {activeMode === 'MISSINGNESS' && (
        <div className="p-5 rounded-xl glass-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white font-mono">Missingness Sparsity Grid</h3>
              <p className="text-xs text-zinc-500 font-mono">
                Visual slice of dataset null distribution along row index
              </p>
            </div>
            <span className="text-[10px] font-mono text-zinc-500">Dark = Complete • White = Null</span>
          </div>

          {missingnessLoading ? (
            <div className="h-64 flex items-center justify-center font-mono text-xs text-zinc-500">
              <span className="animate-pulse">Computing Sparsity Matrix...</span>
            </div>
          ) : missingnessData ? (
            <div className="space-y-2 overflow-x-auto">
              <div className="min-w-[640px] space-y-1">
                {/* Column Headers */}
                <div className="flex items-center text-[10px] font-mono text-zinc-500 border-b border-white/[0.06] pb-1">
                  <span className="w-20 text-left">Slice</span>
                  {missingnessData.columns.map((c) => (
                    <span key={c} className="flex-1 text-center truncate px-0.5">
                      {c}
                    </span>
                  ))}
                </div>

                {/* Chunks */}
                {missingnessData.chunks.map((chunk, idx) => (
                  <div key={idx} className="flex items-center text-[10px] font-mono">
                    <span className="w-20 text-zinc-600 select-none text-[9px]">
                      {chunk.row_start}-{chunk.row_end}
                    </span>
                    {missingnessData.columns.map((col) => {
                      const pct = chunk.missing_pcts[col] || 0;
                      return (
                        <div
                          key={col}
                          className="flex-1 h-3 mx-0.5 rounded-xs transition"
                          style={{
                            backgroundColor: pct > 50 ? '#F43F5E' : pct > 0 ? '#F59E0B' : '#18181B'
                          }}
                          title={`${col} (${chunk.row_start}-${chunk.row_end}): ${pct}% missing`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};
