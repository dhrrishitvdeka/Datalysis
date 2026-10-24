import React, { useState, useEffect, useMemo, useRef } from 'react';
import type { ColumnFact, ColumnRecommendation } from '../types';
import { fetchScatterData, fetchGroupedData, fetchMissingnessMatrix } from '../services/api';
import { Badge, ColumnPicker, EmptyState, Measure, fmtNum, fmtType } from './ui';
import { Histogram } from './Histogram';

interface DataVisualizerProps {
  columnFacts: Record<string, ColumnFact>;
  recommendations: Record<string, ColumnRecommendation>;
  selectedColumn?: string | null;
  onSelectedColumnChange?: (col: string | null) => void;
}

type Mode = 'UNIVARIATE' | 'BIVARIATE' | 'GROUPED' | 'MISSINGNESS';
type Point = { x: number; y: number; hue?: string | null };

// Colour-blind-safe categorical colours that hold up on both the light and the dark surface
const CATEGORY_COLORS = ['#3B82F6', '#E69F00', '#1FA37A', '#D4559C', '#9A7BE0', '#E5533D', '#17A2B8', '#8A94A6'];
const ACCENT_FILL = 'rgb(var(--accent))';

function hueColor(value: string | null | undefined): string {
  if (!value || value === 'none') return ACCENT_FILL;
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return CATEGORY_COLORS[h % CATEGORY_COLORS.length];
}

/** Track the rendered width of an element so SVG text can stay at its true pixel size. */
function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.floor(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

const SelectField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}> = ({ label, value, onChange, options }) => (
  <label className="flex items-center gap-2 text-sm text-ink-2">
    {label}
    <select value={value} onChange={(e) => onChange(e.target.value)} className="field max-w-[220px] font-mono">
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  </label>
);

const ScatterPlot: React.FC<{ points: Point[]; xLabel: string; yLabel: string; slope?: number; intercept?: number; hueName: string }> = ({
  points,
  xLabel,
  yLabel,
  slope,
  intercept,
  hueName,
}) => {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const height = 400;
  const m = { l: 64, r: 20, t: 16, b: 52 };

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const rangeX = Math.max(1e-9, maxX - minX);
  const rangeY = Math.max(1e-9, maxY - minY);
  const px = (v: number) => m.l + ((v - minX) / rangeX) * (width - m.l - m.r);
  const py = (v: number) => height - m.b - ((v - minY) / rangeY) * (height - m.t - m.b);
  const tickList = [0, 0.25, 0.5, 0.75, 1];

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let best = -1;
    let bestD = 18 * 18;
    points.forEach((p, i) => {
      const d = (px(p.x) - mx) ** 2 + (py(p.y) - my) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    setHover(best === -1 ? null : best);
  };

  const hp = hover !== null ? points[hover] : null;

  return (
    <div ref={ref} className="relative">
      <svg width={width} height={height} onMouseMove={onMove} onMouseLeave={() => setHover(null)} role="img" aria-label={`Scatter plot of ${yLabel} against ${xLabel}`}>
        {tickList.map((t) => {
          const x = m.l + t * (width - m.l - m.r);
          const y = height - m.b - t * (height - m.t - m.b);
          return (
            <g key={t}>
              <line x1={m.l} x2={width - m.r} y1={y} y2={y} className="stroke-line" />
              <line x1={x} x2={x} y1={m.t} y2={height - m.b} className="stroke-line" />
              <text x={m.l - 8} y={y + 4} textAnchor="end" fontSize="12" className="fill-ink-3 font-mono">
                {fmtNum(minY + t * rangeY)}
              </text>
              <text x={x} y={height - m.b + 18} textAnchor="middle" fontSize="12" className="fill-ink-3 font-mono">
                {fmtNum(minX + t * rangeX)}
              </text>
            </g>
          );
        })}
        <line x1={m.l} x2={width - m.r} y1={height - m.b} y2={height - m.b} className="stroke-line-strong" />
        <line x1={m.l} x2={m.l} y1={m.t} y2={height - m.b} className="stroke-line-strong" />
        <text x={(m.l + width - m.r) / 2} y={height - 8} textAnchor="middle" fontSize="13" fontWeight="500" className="fill-ink-2">
          {xLabel}
        </text>
        <text x={14} y={(m.t + height - m.b) / 2} textAnchor="middle" fontSize="13" fontWeight="500" className="fill-ink-2" transform={`rotate(-90 14 ${(m.t + height - m.b) / 2})`}>
          {yLabel}
        </text>

        {slope !== undefined && intercept !== undefined && (
          <line
            x1={px(minX)}
            y1={Math.max(m.t, Math.min(height - m.b, py(slope * minX + intercept)))}
            x2={px(maxX)}
            y2={Math.max(m.t, Math.min(height - m.b, py(slope * maxX + intercept)))}
            className="stroke-ink-2"
            strokeWidth="2"
            strokeDasharray="6 4"
          />
        )}

        {points.map((p, i) => (
          <circle key={i} cx={px(p.x)} cy={py(p.y)} r="4" style={{ fill: hueColor(p.hue) }} fillOpacity="0.6" />
        ))}
        {hp && <circle cx={px(hp.x)} cy={py(hp.y)} r="7" fill="none" strokeWidth="2" className="stroke-ink" />}
      </svg>
      <p className="mt-2 min-h-[1.375rem] font-mono text-sm text-ink-2" aria-live="polite">
        {hp ? `${xLabel} ${fmtNum(hp.x)} · ${yLabel} ${fmtNum(hp.y)}${hp.hue != null ? ` · ${hueName} ${hp.hue}` : ''}` : ''}
      </p>
    </div>
  );
};

export const DataVisualizer: React.FC<DataVisualizerProps> = ({ columnFacts, selectedColumn, onSelectedColumnChange }) => {
  const allColumns = Object.keys(columnFacts);
  const numericColumns = allColumns.filter((c) => columnFacts[c].numeric_stats !== null);
  const categoricalColumns = allColumns.filter((c) => columnFacts[c].numeric_stats === null && columnFacts[c].inferred_type !== 'datetime');

  const [activeMode, setActiveMode] = useState<Mode>('UNIVARIATE');
  const [selectedCol, setSelectedCol] = useState<string>(selectedColumn || allColumns[0] || '');

  const [scatterX, setScatterX] = useState<string>(numericColumns[0] || '');
  const [scatterY, setScatterY] = useState<string>(numericColumns[1] || numericColumns[0] || '');
  const [scatterHue, setScatterHue] = useState<string>('none');
  const [scatterData, setScatterData] = useState<{ points: Point[]; stats?: any }>({ points: [], stats: null });
  const [scatterLoading, setScatterLoading] = useState(false);

  // Grouping by an identifier gives one group per row, so prefer a column with a handful of levels
  const groupable = categoricalColumns.filter((c) => {
    const u = columnFacts[c].unique_count;
    return u >= 2 && u <= 20 && !columnFacts[c].is_identifier;
  });
  const [groupedCat, setGroupedCat] = useState<string>(groupable[0] || categoricalColumns[0] || allColumns[0] || '');
  const [groupedNum, setGroupedNum] = useState<string>(numericColumns[0] || '');
  const [groupedData, setGroupedData] = useState<any[]>([]);
  const [groupedLoading, setGroupedLoading] = useState(false);

  const [missingnessData, setMissingnessData] = useState<{ columns: string[]; total_rows: number; chunks: any[] } | null>(null);
  const [missingnessLoading, setMissingnessLoading] = useState(false);
  const [missHover, setMissHover] = useState('');

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
    return Array.from(new Set(scatterData.points.map((p) => String(p.hue ?? '')))).filter(Boolean).slice(0, 12);
  }, [scatterData.points, scatterHue]);

  const pickerItems = allColumns.map((c) => ({
    name: c,
    meta: fmtType(columnFacts[c].inferred_type),
    flag: columnFacts[c].missing_pct > 0 ? { label: `${columnFacts[c].missing_pct}% missing`, tone: 'warn' as const } : null,
  }));

  const modes: { id: Mode; label: string }[] = [
    { id: 'UNIVARIATE', label: 'One column' },
    { id: 'BIVARIATE', label: 'Two columns' },
    { id: 'GROUPED', label: 'Compare groups' },
    { id: 'MISSINGNESS', label: 'Missing values' },
  ];

  const colOptions = (cols: string[]) => cols.map((c) => ({ value: c, label: c }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="seg" role="group" aria-label="Profiler view">
          {modes.map((mode) => (
            <button key={mode.id} type="button" aria-pressed={activeMode === mode.id} onClick={() => setActiveMode(mode.id)}>
              {mode.label}
            </button>
          ))}
        </div>
        <span className="text-sm text-ink-3">
          {numericColumns.length} numeric · {categoricalColumns.length} categorical
        </span>
      </div>

      {activeMode === 'UNIVARIATE' && (
        <div className="grid items-start gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
          <ColumnPicker items={pickerItems} selected={selectedCol} onSelect={pickColumn} />

          {activeFact && (
            <div className="min-w-0 space-y-5">
              <section className="panel overflow-hidden">
                <div className="panel-head">
                  <div className="min-w-0">
                    <h2 className="truncate font-mono text-lg font-semibold">{activeFact.name}</h2>
                    <p className="panel-sub">
                      {fmtType(activeFact.inferred_type)} · {activeFact.raw_dtype}
                    </p>
                  </div>
                  <Badge>{activeFact.unique_count.toLocaleString()} distinct values</Badge>
                </div>

                <div className="p-5">
                  {numStats && numStats.histogram.counts.length > 0 ? (
                    <Histogram stats={numStats} />
                  ) : catStats && catStats.top_categories.length > 0 ? (
                    <ul className="space-y-3">
                      {/* Bars are scaled to the most common value so small shares stay readable; the printed share is exact */}
                      {catStats.top_categories.map((cat, idx) => (
                        <li key={idx} className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)_7rem] items-center gap-3 text-sm sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_8rem]">
                          <span className="truncate" title={cat.category}>
                            {cat.category}
                          </span>
                          <span className="h-3 overflow-hidden rounded-sm bg-sunken">
                            <span className="block h-full rounded-sm bg-accent" style={{ width: `${(cat.percentage / Math.max(...catStats.top_categories.map((c) => c.percentage), 0.01)) * 100}%` }} />
                          </span>
                          <span className="text-right font-mono tabular-nums text-ink-2">
                            {cat.count.toLocaleString()} · {cat.percentage}%
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="py-8 text-center text-ink-3">No distribution is available for this column.</p>
                  )}
                </div>

                {numStats && (
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line p-5 sm:grid-cols-5">
                    <Measure label="Minimum" value={numStats.min} />
                    <Measure label="25th percentile" value={numStats.q25} />
                    <Measure label="Median" value={numStats.median} />
                    <Measure label="75th percentile" value={numStats.q75} />
                    <Measure label="Maximum" value={numStats.max} />
                  </div>
                )}
              </section>

              <section className="panel p-5">
                <h3 className="panel-title mb-3">Details</h3>
                <dl className="grid gap-x-10 sm:grid-cols-2">
                  {(
                    [
                      ['Non-missing values', activeFact.non_null_count.toLocaleString()],
                      ['Missing', `${activeFact.missing_pct}% (${activeFact.missing_count.toLocaleString()})`],
                      ...(numStats
                        ? [
                            ['Mean', numStats.mean],
                            ['Standard deviation', numStats.std],
                            ['Skewness', numStats.skewness],
                            ['Kurtosis', numStats.kurtosis],
                            ['Outliers (1.5 × IQR)', `${numStats.outliers_iqr_count} (${numStats.outliers_iqr_pct}%)`],
                            ['Fences', `${numStats.lower_bound_iqr} to ${numStats.upper_bound_iqr}`],
                          ]
                        : []),
                      ...(catStats
                        ? [
                            ['Most common', catStats.mode_category ?? '—'],
                            ['Share of most common', `${catStats.mode_frequency_pct}%`],
                            ['Entropy', `${catStats.entropy} bits`],
                            ['Rare levels', catStats.rare_categories_count],
                          ]
                        : []),
                    ] as [string, React.ReactNode][]
                  ).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 border-b border-line py-2 text-sm">
                      <dt className="text-ink-3">{k}</dt>
                      <dd className="truncate text-right font-mono tabular-nums">{v}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            </div>
          )}
        </div>
      )}

      {activeMode === 'BIVARIATE' &&
        (numericColumns.length < 2 ? (
          <EmptyState title="Two numeric columns are needed">A scatter plot compares two numeric columns, and this dataset has fewer than two.</EmptyState>
        ) : (
          <section className="panel overflow-hidden">
            <div className="panel-head">
              <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                <SelectField label="X axis" value={scatterX} onChange={setScatterX} options={colOptions(numericColumns)} />
                <SelectField label="Y axis" value={scatterY} onChange={setScatterY} options={colOptions(numericColumns)} />
                <SelectField
                  label="Colour by"
                  value={scatterHue}
                  onChange={setScatterHue}
                  options={[{ value: 'none', label: 'Nothing' }, ...colOptions(allColumns)]}
                />
              </div>
              {scatterData.stats && (
                <div className="flex items-center gap-5 text-sm text-ink-2">
                  <span>
                    r <strong className="font-mono text-ink">{scatterData.stats.r_value}</strong>
                  </span>
                  <span>
                    R² <strong className="font-mono text-ink">{scatterData.stats.r_squared}</strong>
                  </span>
                  <span className="text-ink-3">{scatterData.stats.total_points} points (sampled)</span>
                </div>
              )}
            </div>
            <div className="p-5">
              {scatterLoading ? (
                <p className="flex h-[400px] items-center justify-center text-ink-3">Loading scatter plot…</p>
              ) : scatterData.points.length > 0 ? (
                <>
                  <ScatterPlot
                    points={scatterData.points}
                    xLabel={scatterX}
                    yLabel={scatterY}
                    slope={scatterData.stats?.slope}
                    intercept={scatterData.stats?.intercept}
                    hueName={scatterHue}
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-ink-2">
                    {scatterData.stats && (
                      <span className="flex items-center gap-2">
                        <span className="w-6 border-t-2 border-dashed border-ink-2" aria-hidden /> Linear fit
                      </span>
                    )}
                    {hueLegend.map((h) => (
                      <span key={h} className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: hueColor(h) }} aria-hidden />
                        {h}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <p className="flex h-[400px] items-center justify-center text-ink-3">No rows have a value in both columns.</p>
              )}
            </div>
          </section>
        ))}

      {activeMode === 'GROUPED' && (
        <section className="panel overflow-hidden">
          <div className="panel-head">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
              <SelectField label="Group by" value={groupedCat} onChange={setGroupedCat} options={colOptions(allColumns)} />
              <SelectField label="Measure" value={groupedNum} onChange={setGroupedNum} options={colOptions(numericColumns)} />
            </div>
          </div>
          <div className="p-5">
            {groupedLoading ? (
              <p className="py-16 text-center text-ink-3">Calculating groups…</p>
            ) : groupedData.length > 0 ? (
              (() => {
                const lo = Math.min(...groupedData.map((g) => g.min));
                const hi = Math.max(...groupedData.map((g) => g.max));
                const span = Math.max(1e-9, hi - lo);
                const pos = (v: number) => `${Math.max(0, Math.min(100, ((v - lo) / span) * 100))}%`;
                const shown = groupedData.slice(0, 30);
                return (
                  <>
                    <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-ink-2">
                      <span className="flex items-center gap-2">
                        <span className="h-3 w-5 rounded-sm border border-accent bg-accent-soft" aria-hidden /> Middle 50% of values
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-0.5 bg-accent" aria-hidden /> Median
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rotate-45 bg-ink" aria-hidden /> Mean
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="w-5 border-t-2 border-ink-3" aria-hidden /> Min to max
                      </span>
                    </div>
                    <div className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-x-4 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_13rem]">
                      <span />
                      <div className="flex justify-between font-mono text-xs text-ink-3">
                        <span>{fmtNum(lo)}</span>
                        <span>{fmtNum(hi)}</span>
                      </div>
                      <span className="hidden sm:block" />
                      {shown.map((g, idx) => (
                        <React.Fragment key={idx}>
                          <span className="truncate border-t border-line py-3 text-sm font-medium" title={String(g.category)}>
                            {String(g.category)}
                          </span>
                          <div className="relative border-t border-line py-3">
                            <div className="relative h-5">
                              <span className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-ink-3" style={{ left: pos(g.min), width: `calc(${pos(g.max)} - ${pos(g.min)})` }} />
                              <span
                                className="absolute top-0 h-5 rounded-sm border border-accent bg-accent-soft"
                                style={{ left: pos(g.q25), width: `max(3px, calc(${pos(g.q75)} - ${pos(g.q25)}))` }}
                              />
                              <span className="absolute top-0 h-5 w-0.5 bg-accent" style={{ left: pos(g.median) }} />
                              <span className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-ink" style={{ left: pos(g.mean) }} />
                            </div>
                          </div>
                          <span className="hidden border-t border-line py-3 text-right font-mono text-xs tabular-nums text-ink-2 sm:block">
                            n={g.count.toLocaleString()} · mean {fmtNum(g.mean)}
                            <br />
                            median {fmtNum(g.median)}
                          </span>
                        </React.Fragment>
                      ))}
                    </div>
                    {groupedData.length > shown.length && (
                      <p className="mt-3 text-sm text-ink-3">Showing the first {shown.length} of {groupedData.length} groups.</p>
                    )}
                  </>
                );
              })()
            ) : (
              <p className="py-16 text-center text-ink-3">Pick a column to group by and a numeric column to measure.</p>
            )}
          </div>
        </section>
      )}

      {activeMode === 'MISSINGNESS' && (
        <section className="panel overflow-hidden">
          <div className="panel-head">
            <div>
              <h2 className="panel-title">Where values are missing</h2>
              <p className="panel-sub">Each strip runs down one column from the first row to the last. Clusters of colour mean the gaps are not random.</p>
            </div>
            <div className="flex items-center gap-4 text-sm text-ink-2">
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-sunken ring-1 ring-line-strong" aria-hidden /> Complete</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-warn" aria-hidden /> Some missing</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-bad" aria-hidden /> Over half</span>
            </div>
          </div>
          {missingnessLoading ? (
            <p className="py-16 text-center text-ink-3">Scanning for missing values…</p>
          ) : missingnessData ? (
            (() => {
              // Worst columns first, so the interesting strips sit at the top
              const cols = [...missingnessData.columns].sort(
                (a, b) => (columnFacts[b]?.missing_pct ?? 0) - (columnFacts[a]?.missing_pct ?? 0)
              );
              const chunks = missingnessData.chunks;
              const last = chunks.length ? chunks[chunks.length - 1].row_end : missingnessData.total_rows;
              return (
                <div className="p-5">
                  <div className="grid items-center gap-x-4 gap-y-2" style={{ gridTemplateColumns: 'minmax(7rem,13rem) minmax(0,1fr) 4.5rem' }}>
                    <span />
                    <div className="flex justify-between text-xs text-ink-3">
                      <span>Row 0</span>
                      <span>Row {last.toLocaleString()}</span>
                    </div>
                    <span className="text-right text-xs font-medium text-ink-3">Missing</span>

                    {cols.map((col) => {
                      const pctTotal = columnFacts[col]?.missing_pct ?? 0;
                      return (
                        <React.Fragment key={col}>
                          <span className="truncate font-mono text-sm" title={col}>
                            {col}
                          </span>
                          <div className="flex h-8 gap-px overflow-hidden rounded-md bg-line" role="img" aria-label={`${col}: ${pctTotal}% missing overall`}>
                            {chunks.map((chunk, idx) => {
                              const pct = chunk.missing_pcts[col] || 0;
                              return (
                                <div
                                  key={idx}
                                  onMouseEnter={() => setMissHover(`${col}, rows ${chunk.row_start}–${chunk.row_end}: ${pct}% missing`)}
                                  onMouseLeave={() => setMissHover('')}
                                  className={`min-w-0 flex-1 ${pct > 50 ? 'bg-bad' : pct > 0 ? 'bg-warn' : 'bg-sunken'}`}
                                />
                              );
                            })}
                          </div>
                          <span className={`text-right font-mono text-sm tabular-nums ${pctTotal > 0 ? 'font-medium text-warn' : 'text-ink-3'}`}>
                            {pctTotal}%
                          </span>
                        </React.Fragment>
                      );
                    })}
                  </div>
                  <p className="mt-4 min-h-[1.375rem] font-mono text-sm text-ink-2" aria-live="polite">
                    {missHover || 'Hover a strip to read the share missing in that slice of rows.'}
                  </p>
                </div>
              );
            })()
) : null}
        </section>
      )}
    </div>
  );
};
