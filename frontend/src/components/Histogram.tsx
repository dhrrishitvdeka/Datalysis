import React, { useState } from 'react';
import type { NumericStats } from '../types';
import { fmtNum } from './ui';

/**
 * Distribution of one numeric column. Bars that reach past Tukey's fences are drawn in the "bad" colour,
 * and the hovered or focused bar is spelled out in words underneath instead of a floating tooltip.
 */
export const Histogram: React.FC<{ stats: NumericStats; height?: number }> = ({ stats, height = 220 }) => {
  const [active, setActive] = useState<number | null>(null);
  const { counts, bin_edges: edges } = stats.histogram;
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  const maxCount = Math.max(1, ...counts);
  const outside = (i: number) => edges[i] < stats.lower_bound_iqr || edges[i + 1] > stats.upper_bound_iqr;

  const readout =
    active === null
      ? 'Hover or tab to a bar to read its range and row count.'
      : `${fmtNum(edges[active])} to ${fmtNum(edges[active + 1])}: ${counts[active].toLocaleString()} rows (${(
          (counts[active] / total) *
          100
        ).toFixed(1)}%)${outside(active) ? ', reaches past the outlier fences' : ''}`;

  return (
    <figure>
      <div className="flex" style={{ height }}>
        <div className="flex w-12 shrink-0 flex-col justify-between pr-2 text-right font-mono text-xs text-ink-3" aria-hidden>
          <span>{maxCount.toLocaleString()}</span>
          <span>0</span>
        </div>
        <div className="flex flex-1 items-end gap-px border-b border-l border-line-strong">
          {counts.map((cnt, i) => (
            <button
              key={i}
              type="button"
              aria-label={`${fmtNum(edges[i])} to ${fmtNum(edges[i + 1])}: ${cnt} rows`}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className="flex h-full min-w-0 flex-1 items-end !rounded-none"
            >
              <span
                className={`block w-full rounded-t-sm transition-colors ${
                  outside(i) ? 'bg-bad' : 'bg-accent'
                } ${active === i ? 'opacity-100' : 'opacity-80'}`}
                style={{ height: `${Math.max(cnt > 0 ? 2 : 0, (cnt / maxCount) * 100)}%` }}
              />
            </button>
          ))}
        </div>
      </div>
      <div className="ml-12 mt-1.5 flex justify-between font-mono text-xs text-ink-3" aria-hidden>
        <span>{fmtNum(edges[0])}</span>
        <span>{fmtNum((edges[0] + edges[edges.length - 1]) / 2)}</span>
        <span>{fmtNum(edges[edges.length - 1])}</span>
      </div>
      <figcaption className="ml-12 mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 text-sm">
        <span className="min-h-[1.375rem] text-ink-2" aria-live="polite">
          {readout}
        </span>
        <span className="flex items-center gap-4 text-ink-3">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-accent" aria-hidden /> Within fences
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-bad" aria-hidden /> Past 1.5 × IQR fences
          </span>
        </span>
      </figcaption>
    </figure>
  );
};
