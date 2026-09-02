import React, { useState, useEffect, useMemo } from 'react';
import { BarChart3, ScatterChart as ScatterIcon, Layers, Grid } from 'lucide-react';
import type { ColumnFact, ColumnRecommendation } from '../types';
import { fetchScatterData, fetchGroupedData, fetchMissingnessMatrix } from '../services/api';

interface DataVisualizerProps {
  columnFacts: Record<string, ColumnFact>;
  recommendations: Record<string, ColumnRecommendation>;
  selectedColumn?: string | null;
  onSelectedColumnChange?: (col: string | null) => void;
}

const HUE_PALETTE = ['#E4E4E7', '#38BDF8', '#F59E0B', '#A78BFA', '#34D399', '#F43F5E', '#FBBF24', '#2DD4BF', '#FB7185', '#67E8F9'];

function hueColor(value: string | null | undefined): string {
  if (!value || value === 'none') return '#E4E4E7';
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return HUE_PALETTE[h % HUE_PALETTE.length];
}

export const DataVisualizer: React.FC<DataVisualizerProps> = ({
  columnFacts,
  selectedColumn,
  onSelectedColumnChange,
}) => {
  const allColumns = Object.keys(columnFacts);
  const numericColumns = allColumns.filter((c) => columnFacts[c].numeric_stats !== null);
  const categoricalColumns = allColumns.filter(
    (c) => columnFacts[c].numeric_stats === null && columnFacts[c].inferred_type !== 'datetime'
  );

  const [activeMode, setActiveMode] = useState<'UNIVARIATE' | 'BIVARIATE' | 'GROUPED' | 'MISSINGNESS'>('UNIVARIATE');
  const [selectedCol, setSelectedCol] = useState<string>(selectedColumn || allColumns[0] || '');

  const [scatterX, setScatterX] = useState<string>(numericColumns[0] || '');
  const [scatterY, setScatterY] = useState<string>(numericColumns[1] || numericColumns[0] || '');
  const [scatterHue, setScatterHue] = useState<string>('none');
  const [scatterData, setScatterData] = useState<{ points: any[]; stats?: any }>({ points: [], stats: null });
  const [scatterLoading, setScatterLoading] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<any | null>(null);

  const [groupedCat, setGroupedCat] = useState<string>(categoricalColumns[0] || allColumns[0] || '');
  const [groupedNum, setGroupedNum] = useState<string>(numericColumns[0] || '');
  const [groupedData, setGroupedData] = useState<any[]>([]);
  const [groupedLoading, setGroupedLoading] = useState(false);

  const [missingnessData, setMissingnessData] = useState<{ columns: string[]; total_rows: number; chunks: any[] } | null>(null);
  const [missingnessLoading, setMissingnessLoading] = useState(false);

  useEffect(() => {
    if (selectedColumn && columnFacts[selectedColumn]) {
      setSelectedCol(selectedColumn);
      if (columnFacts[selectedColumn].numeric_stats) {
        setScatterX(selectedColumn);
        setGroupedNum(selectedColumn);
      } else {
        setGroupedCat(selectedColumn);
      }
    }
  }, [selectedColumn]);

  const pickColumn = (col: string) => {
    setSelectedCol(col);
    onSelectedColumnChange?.(col);
  };

  useEffect(() => {
    if (activeMode === 'BIVARIATE' && scatterX && scatterY) {
      setScatterLoading(true);
      fetchScatterData(scatterX, scatterY, scatterHue !== 'none' ? scatterHue : undefined)
        .then(setScatterData)
        .catch((err) => console.error(err))
        .finally(() => setScatterLoading(false));
    }
  }, [activeMode, scatterX, scatterY, scatterHue]);

  useEffect(() => {
    if (activeMode === 'GROUPED' && groupedCat && groupedNum) {
      setGroupedLoading(true);
      fetchGroupedData(groupedCat, groupedNum)
        .then((res) => setGroupedData(res.groups))
        .catch((err) => console.error(err))
        .finally(() => setGroupedLoading(false));
    }
  }, [activeMode, groupedCat, groupedNum]);

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

  const hueLegend = useMemo(() => {
    if (scatterHue === 'none') return [];
    const uniq = Array.from(new Set(scatterData.points.map((p) => String(p.hue ?? '')))).filter(Boolean);
    return uniq.slice(0, 12);
  }, [scatterData.points, scatterHue]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-1 border-b border-white/[0.04]">
        <div className="flex items-center space-x-1.5 overflow-x-auto no-scrollbar">
          {[
            { id: 'UNIVARIATE', label: 'Univariate', icon: BarChart3 },
            { id: 'BIVARIATE', label: 'Scatter', icon: ScatterIcon },
            { id: 'GROUPED', label: 'Grouped', icon: Layers },
            { id: 'MISSINGNESS', label: 'Missingness', icon: Grid },
          ].map((mode) => {
            const active = activeMode === mode.id;
            const Icon = mode.icon;
            return (
              <button
                key={mode.id}
                onClick={() => setActiveMode(mode.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition flex items-center space-x-1.5 ${
                  active ? 'bg-zinc-100 text-zinc-950 font-semibold shadow-sm' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? 'text-zinc-950' : 'text-zinc-500'}`} />
                <span>{mode.label}</span>
              </button>
            );
          })}
        </div>
        <span className="text-[11px] font-mono text-zinc-600 hidden sm:block">
          {numericColumns.length} numeric · {categoricalColumns.length} categorical
        </span>
      </div>

      {activeMode === 'UNIVARIATE' && (
        <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] gap-3">
          <div className="rounded-xl glass-card overflow-hidden max-h-[640px] flex flex-col">
            <div className="px-3 py-2 border-b border-white/[0.06] text-[10px] font-mono uppercase tracking-wider text-zinc-500">
              Columns
            </div>
            <div className="overflow-y-auto flex-1">
              {allColumns.map((col) => {
                const f = columnFacts[col];
                const active = col === selectedCol;
                return (
                  <button
                    key={col}
                    onClick={() => pickColumn(col)}
                    className={`w-full text-left px-3 py-1.5 text-[11px] font-mono border-b border-white/[0.03] ${
                      active ? 'bg-zinc-100 text-zinc-950' : 'text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-200'
                    }`}
                  >
                    <div className="truncate font-medium">{col}</div>
                    <div className={`truncate text-[10px] ${active ? 'text-zinc-600' : 'text-zinc-600'}`}>
                      {f.inferred_type.replace(/_/g, ' ')}
                      {f.missing_pct > 0 ? ` · ${f.missing_pct}% NA` : ''}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {activeFact && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 min-w-0">
              <div className="xl:col-span-2 p-4 rounded-xl glass-card space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white font-mono">{activeFact.name}</h3>
                    <p className="text-xs text-zinc-500 font-mono">
                      {activeFact.inferred_type.replace(/_/g, ' ')} · missing {activeFact.missing_pct}% ({activeFact.missing_count})
                    </p>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-white/[0.06]">
                    {activeFact.unique_count} distinct
                  </span>
                </div>

                {numStats && numStats.histogram.counts.length > 0 ? (
                  <div className="space-y-4">
                    <div className="h-56 flex items-end justify-between gap-px pt-6 pb-2 px-2 bg-black/80 rounded-lg border border-white/[0.04]">
                      {numStats.histogram.counts.map((cnt, idx) => {
                        const maxCount = Math.max(...numStats.histogram.counts);
                        const heightPct = (cnt / Math.max(1, maxCount)) * 100;
                        const edgeLow = numStats.histogram.bin_edges[idx];
                        const edgeHigh = numStats.histogram.bin_edges[idx + 1];
                        const isOutlier = edgeLow < numStats.lower_bound_iqr || edgeHigh > numStats.upper_bound_iqr;
                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group relative min-w-0">
                            <div className="absolute -top-8 hidden group-hover:flex z-20 pointer-events-none">
                              <span className="bg-zinc-900 text-zinc-200 text-[10px] font-mono px-2 py-0.5 rounded border border-zinc-700 whitespace-nowrap">
                                [{edgeLow}, {edgeHigh}]: {cnt}
                              </span>
                            </div>
                            <div
                              className={`w-full rounded-t-sm ${isOutlier ? 'bg-rose-500/70 group-hover:bg-rose-400' : 'bg-zinc-500 group-hover:bg-zinc-300'}`}
                              style={{ height: `${Math.max(3, heightPct)}%` }}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <div className="grid grid-cols-5 gap-1.5 text-center text-xs font-mono">
                      {[
                        ['Min', numStats.min],
                        ['Q25', numStats.q25],
                        ['Median', numStats.median],
                        ['Q75', numStats.q75],
                        ['Max', numStats.max],
                      ].map(([k, v]) => (
                        <div key={k} className="p-2 rounded bg-zinc-950 border border-white/[0.04]">
                          <span className="text-zinc-500 text-[10px] block">{k}</span>
                          <span className="text-zinc-200 tabular-nums">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : catStats && catStats.top_categories.length > 0 ? (
                  <div className="space-y-2 pt-1">
                    {catStats.top_categories.map((cat, idx) => (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs font-mono">
                          <span className="text-zinc-300 truncate max-w-[220px]">{cat.category}</span>
                          <span className="text-zinc-500 tabular-nums">
                            {cat.count} <span className="text-zinc-300">({cat.percentage}%)</span>
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-zinc-900 overflow-hidden">
                          <div className="h-full rounded-full bg-zinc-400" style={{ width: `${cat.percentage}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-zinc-600 font-mono text-xs">No distribution available.</div>
                )}
              </div>

              <div className="p-4 rounded-xl glass-card space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block">Stats</span>
                <div className="space-y-1.5 text-xs font-mono">
                  {[
                    ['Non-null', activeFact.non_null_count],
                    ['Missing', `${activeFact.missing_pct}%`],
                    ...(numStats
                      ? [
                          ['Mean', numStats.mean],
                          ['Std', numStats.std],
                          ['Skew', numStats.skewness],
                          ['Kurtosis', numStats.kurtosis],
                          ['IQR outliers', `${numStats.outliers_iqr_count} (${numStats.outliers_iqr_pct}%)`],
                          ['IQR fence', `${numStats.lower_bound_iqr} … ${numStats.upper_bound_iqr}`],
                        ]
                      : []),
                    ...(catStats
                      ? [
                          ['Mode', catStats.mode_category],
                          ['Mode share', `${catStats.mode_frequency_pct}%`],
                          ['Entropy', `${catStats.entropy} bits`],
                          ['Rare levels', catStats.rare_categories_count],
                        ]
                      : []),
                  ].map(([k, v]) => (
                    <div key={String(k)} className="p-2 rounded bg-zinc-950 border border-white/[0.04] flex justify-between gap-2">
                      <span className="text-zinc-500 shrink-0">{k}</span>
                      <span className="text-zinc-200 truncate tabular-nums text-right">{String(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeMode === 'BIVARIATE' && (
        <div className="space-y-3">
          {numericColumns.length < 2 ? (
            <div className="p-8 rounded-xl glass-card text-center text-xs font-mono text-zinc-500">
              Need at least two numeric columns for a scatter plot.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl glass-card text-xs font-mono">
                <label className="flex items-center gap-1.5">
                  <span className="text-zinc-500">X</span>
                  <select value={scatterX} onChange={(e) => setScatterX(e.target.value)} className="bg-zinc-950 border border-white/[0.08] rounded px-2 py-1">
                    {numericColumns.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-1.5">
                  <span className="text-zinc-500">Y</span>
                  <select value={scatterY} onChange={(e) => setScatterY(e.target.value)} className="bg-zinc-950 border border-white/[0.08] rounded px-2 py-1">
                    {numericColumns.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-1.5">
                  <span className="text-zinc-500">Hue</span>
                  <select value={scatterHue} onChange={(e) => setScatterHue(e.target.value)} className="bg-zinc-950 border border-white/[0.08] rounded px-2 py-1">
                    <option value="none">None</option>
                    {allColumns.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                {scatterData.stats && (
                  <div className="ml-auto flex items-center gap-3 text-zinc-400">
                    <span>r <strong className="text-white tabular-nums">{scatterData.stats.r_value}</strong></span>
                    <span>R² <strong className="text-white tabular-nums">{scatterData.stats.r_squared}</strong></span>
                    <span className="text-zinc-600">{scatterData.stats.total_points} pts (sampled)</span>
                  </div>
                )}
              </div>

              <div className="p-4 rounded-xl glass-card">
                {scatterLoading ? (
                  <div className="h-80 flex items-center justify-center font-mono text-xs text-zinc-500">Loading scatter…</div>
                ) : scatterData.points.length > 0 ? (
                  (() => {
                    const pts = scatterData.points;
                    const minX = Math.min(...pts.map((p) => p.x));
                    const maxX = Math.max(...pts.map((p) => p.x));
                    const minY = Math.min(...pts.map((p) => p.y));
                    const maxY = Math.max(...pts.map((p) => p.y));
                    const rangeX = Math.max(0.001, maxX - minX);
                    const rangeY = Math.max(0.001, maxY - minY);
                    let trend: React.ReactNode = null;
                    if (scatterData.stats) {
                      const { slope, intercept } = scatterData.stats;
                      const yStart = slope * minX + intercept;
                      const yEnd = slope * maxX + intercept;
                      trend = (
                        <line
                          x1={40}
                          y1={280 - ((yStart - minY) / rangeY) * 240}
                          x2={560}
                          y2={280 - ((yEnd - minY) / rangeY) * 240}
                          stroke="rgba(255,255,255,0.35)"
                          strokeWidth="1.5"
                          strokeDasharray="4 3"
                        />
                      );
                    }
                    return (
                      <div className="space-y-2">
                        <div className="relative h-80 w-full bg-black/90 rounded-lg border border-white/[0.04] overflow-hidden">
                          {hoveredPoint && (
                            <div className="absolute top-3 right-4 bg-zinc-900/90 border border-white/[0.1] px-2.5 py-1.5 rounded text-[11px] font-mono z-10 pointer-events-none">
                              <div>{scatterX}: {hoveredPoint.x}</div>
                              <div>{scatterY}: {hoveredPoint.y}</div>
                              {hoveredPoint.hue != null && <div>{scatterHue}: {hoveredPoint.hue}</div>}
                            </div>
                          )}
                          <svg viewBox="0 0 600 300" className="w-full h-full">
                            <line x1="40" y1="280" x2="580" y2="280" stroke="#27272A" />
                            <line x1="40" y1="20" x2="40" y2="280" stroke="#27272A" />
                            <text x="300" y="296" fill="#71717A" fontSize="9" textAnchor="middle">{scatterX}</text>
                            <text x="12" y="150" fill="#71717A" fontSize="9" transform="rotate(-90 12 150)" textAnchor="middle">{scatterY}</text>
                            {trend}
                            {pts.map((pt, i) => {
                              const cx = 40 + ((pt.x - minX) / rangeX) * 520;
                              const cy = 280 - ((pt.y - minY) / rangeY) * 240;
                              return (
                                <circle
                                  key={i}
                                  cx={cx}
                                  cy={cy}
                                  r="3.2"
                                  fill={hueColor(pt.hue)}
                                  fillOpacity="0.8"
                                  onMouseEnter={() => setHoveredPoint(pt)}
                                  onMouseLeave={() => setHoveredPoint(null)}
                                />
                              );
                            })}
                          </svg>
                        </div>
                        {hueLegend.length > 0 && (
                          <div className="flex flex-wrap gap-2 text-[10px] font-mono text-zinc-400">
                            {hueLegend.map((h) => (
                              <span key={h} className="inline-flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full" style={{ background: hueColor(h) }} />
                                {h}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()
                ) : (
                  <div className="h-80 flex items-center justify-center font-mono text-xs text-zinc-600">
                    No overlapping non-null points for this pair.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {activeMode === 'GROUPED' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl glass-card text-xs font-mono">
            <label className="flex items-center gap-1.5">
              <span className="text-zinc-500">Group</span>
              <select value={groupedCat} onChange={(e) => setGroupedCat(e.target.value)} className="bg-zinc-950 border border-white/[0.08] rounded px-2 py-1">
                {allColumns.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-1.5">
              <span className="text-zinc-500">Metric</span>
              <select value={groupedNum} onChange={(e) => setGroupedNum(e.target.value)} className="bg-zinc-950 border border-white/[0.08] rounded px-2 py-1">
                {numericColumns.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>

          <div className="p-4 rounded-xl glass-card">
            {groupedLoading ? (
              <div className="h-64 flex items-center justify-center font-mono text-xs text-zinc-500">Aggregating…</div>
            ) : groupedData.length > 0 ? (
              <div className="space-y-2">
                {(() => {
                  return groupedData.map((g, idx) => {
                    const q25p = (g.q25 / Math.max(g.max, 0.01)) * 100;
                    const q75p = (g.q75 / Math.max(g.max, 0.01)) * 100;
                    const meanp = (g.mean / Math.max(g.max, 0.01)) * 100;
                    return (
                      <div key={idx} className="p-3 rounded-lg bg-black/60 border border-white/[0.04] space-y-1.5 font-mono text-xs">
                        <div className="flex justify-between items-center gap-2">
                          <span className="font-semibold text-white truncate">{g.category}</span>
                          <div className="flex items-center gap-3 text-[11px] text-zinc-400 tabular-nums">
                            <span>n={g.count}</span>
                            <span>mean <strong className="text-zinc-200">{g.mean}</strong></span>
                            <span>med {g.median}</span>
                            <span className="text-zinc-600">IQR {g.q25}–{g.q75}</span>
                          </div>
                        </div>
                        <div className="relative w-full h-2.5 rounded-full bg-zinc-900">
                          <div
                            className="absolute top-0 h-full rounded-full bg-zinc-700"
                            style={{ left: `${Math.min(q25p, q75p)}%`, width: `${Math.max(2, Math.abs(q75p - q25p))}%` }}
                          />
                          <div
                            className="absolute top-[-2px] w-0.5 h-3.5 bg-white"
                            style={{ left: `${Math.max(0, Math.min(100, meanp))}%` }}
                          />
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            ) : (
              <div className="p-8 text-center text-zinc-600 font-mono text-xs">Pick a grouping column and a numeric metric.</div>
            )}
          </div>
        </div>
      )}

      {activeMode === 'MISSINGNESS' && (
        <div className="p-4 rounded-xl glass-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white font-mono">Missingness grid</h3>
              <p className="text-xs text-zinc-500 font-mono">Row slices · dark = complete · amber = sparse · rose = majority null</p>
            </div>
          </div>
          {missingnessLoading ? (
            <div className="h-64 flex items-center justify-center font-mono text-xs text-zinc-500">Computing…</div>
          ) : missingnessData ? (
            <div className="overflow-x-auto">
              <div className="min-w-[640px] space-y-1">
                <div className="flex items-center text-[10px] font-mono text-zinc-500 border-b border-white/[0.06] pb-1">
                  <span className="w-20 text-left">Slice</span>
                  {missingnessData.columns.map((c) => (
                    <span key={c} className="flex-1 text-center truncate px-0.5" title={c}>{c}</span>
                  ))}
                </div>
                {missingnessData.chunks.map((chunk, idx) => (
                  <div key={idx} className="flex items-center text-[10px] font-mono">
                    <span className="w-20 text-zinc-600 text-[9px] tabular-nums">{chunk.row_start}–{chunk.row_end}</span>
                    {missingnessData.columns.map((col) => {
                      const pct = chunk.missing_pcts[col] || 0;
                      return (
                        <div
                          key={col}
                          className="flex-1 h-3 mx-0.5 rounded-sm"
                          style={{ backgroundColor: pct > 50 ? '#F43F5E' : pct > 0 ? '#F59E0B' : '#18181B' }}
                          title={`${col} (${chunk.row_start}–${chunk.row_end}): ${pct}% missing`}
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
