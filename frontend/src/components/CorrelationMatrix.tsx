import React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { CorrelationPair } from '../types';
import { Badge } from './ui';

interface CorrelationMatrixProps {
  pairs: CorrelationPair[];
  matrix: Record<string, Record<string, number>>;
  missingPairs?: { feature_a: string; feature_b: string; correlation: number }[];
}

/** Diverging fill: blue for positive, orange for negative, strength shown by opacity. */
function heatStyle(v: number): React.CSSProperties {
  const strength = Math.min(1, Math.abs(v));
  const channel = v >= 0 ? '--heat-pos' : '--heat-neg';
  return {
    backgroundColor: `rgb(var(${channel}) / ${(strength * 0.9).toFixed(2)})`,
    color: strength > 0.6 ? 'rgb(var(--on-heat))' : 'rgb(var(--ink))',
  };
}

// Up to this many columns the matrix gets large cells and sits beside the explanations
const COMPACT_MAX = 8;

export const CorrelationMatrix: React.FC<CorrelationMatrixProps> = ({ pairs, matrix, missingPairs = [] }) => {
  const columns = Object.keys(matrix);
  const compact = columns.length <= COMPACT_MAX;
  const longest = Math.max(...columns.map((c) => c.length), 1);
  // Rotated headers only need as much height as the longest name (about 0.6rem per character)
  const headerHeight = `${Math.min(9, Math.max(3.5, longest * 0.62 + 0.5))}rem`;

  const pairsPanel = (
    <section className="panel overflow-hidden">
      <div className="panel-head">
        <div>
          <h2 className="panel-title">Highly correlated pairs</h2>
          <p className="panel-sub">Pairs with |r| of 0.75 or more: {pairs.length} found.</p>
        </div>
      </div>
      {pairs.length > 0 ? (
        <ul className="divide-y divide-line">
          {pairs.map((p, idx) => (
            <li key={idx} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-5 py-3">
              <span className="flex min-w-0 items-center gap-2.5">
                <AlertTriangle className={`h-4 w-4 shrink-0 ${p.severity === 'CRITICAL' ? 'text-bad' : 'text-warn'}`} aria-hidden />
                <span className="font-mono font-medium">{p.feature_a}</span>
                <span className="text-ink-3" aria-label="and">
                  &amp;
                </span>
                <span className="font-mono font-medium">{p.feature_b}</span>
              </span>
              <span className="flex items-center gap-3">
                <span className="font-mono tabular-nums">r = {p.correlation}</span>
                <Badge tone={p.severity === 'CRITICAL' ? 'bad' : 'warn'}>{p.severity === 'CRITICAL' ? 'Critical' : 'High'}</Badge>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-3 px-5 py-5">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-good" aria-hidden /> No pair of numeric columns reaches |r| 0.75.
        </p>
      )}
    </section>
  );

  const notePanel = (
    <section className="panel p-5">
      <h2 className="panel-title">How to read this</h2>
      <p className="mt-2 text-ink-2">
        When two features move together (|r| ≥ 0.85), linear models cannot tell their effects apart and coefficients become unstable. Drop one, combine them, or use regularisation.
      </p>
      <p className="mt-2 text-sm text-ink-3">This is Pearson correlation, not a full variance inflation factor table.</p>
      {missingPairs.length > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <h3 className="text-base">Missing together</h3>
          <p className="text-sm text-ink-3">These columns tend to be empty on the same rows, which suggests the gaps are not random.</p>
          <ul className="mt-2 space-y-1 text-sm">
            {missingPairs.map((p, i) => (
              <li key={i}>
                <span className="font-mono">{p.feature_a}</span> &amp; <span className="font-mono">{p.feature_b}</span>{' '}
                <span className="text-ink-3">(r = {p.correlation})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );

  const matrixPanel =
    columns.length >= 2 ? (
      <section className="panel min-w-0 overflow-hidden">
        <div className="panel-head">
          <div>
            <h2 className="panel-title">Pearson correlation matrix</h2>
            <p className="panel-sub">{columns.length} numeric columns.</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-ink-2" aria-label="Colour scale">
            <span>−1</span>
            <span
              className="h-3 w-32 rounded-sm ring-1 ring-line-strong"
              style={{
                background:
                  'linear-gradient(to right, rgb(var(--heat-neg) / 0.9), rgb(var(--heat-neg) / 0) 50%, rgb(var(--heat-pos) / 0) 50%, rgb(var(--heat-pos) / 0.9))',
              }}
              aria-hidden
            />
            <span>+1</span>
          </div>
        </div>
        <div className="max-h-[75vh] overflow-auto p-5">
          <table className={`border-separate border-spacing-1 ${compact ? 'mx-auto' : ''}`}>
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-20 bg-surface" />
                {columns.map((col) => (
                  <th key={col} className="sticky top-0 z-10 bg-surface align-bottom font-normal" title={col}>
                    <div
                      className="mx-auto w-6 overflow-hidden whitespace-nowrap font-mono text-xs text-ink-2"
                      style={{ height: headerHeight, writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
                    >
                      {col}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {columns.map((rCol) => (
                <tr key={rCol}>
                  <th scope="row" className="sticky left-0 z-10 whitespace-nowrap bg-surface pr-3 text-right font-mono text-xs font-normal text-ink-2">
                    {rCol}
                  </th>
                  {columns.map((cCol) => {
                    const val = matrix[rCol]?.[cCol] ?? 0;
                    return (
                      <td
                        key={cCol}
                        className={`rounded-md text-center font-mono tabular-nums ${
                          compact ? 'h-16 min-w-[4.5rem] text-sm' : 'h-9 min-w-[3.25rem] text-[0.8125rem]'
                        }`}
                        style={rCol === cCol ? { backgroundColor: 'rgb(var(--sunken))', color: 'rgb(var(--ink-3))' } : heatStyle(val)}
                        title={`${rCol} and ${cCol}: ${val}`}
                      >
                        {val.toFixed(2)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    ) : null;

  if (compact && matrixPanel) {
    return (
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {matrixPanel}
        <div className="space-y-5">
          {pairsPanel}
          {notePanel}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {pairsPanel}
        {notePanel}
      </div>
      {matrixPanel}
    </div>
  );
};
