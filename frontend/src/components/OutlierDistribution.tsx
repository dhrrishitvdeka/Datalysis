import React, { useState } from 'react';
import type { ColumnFact, ColumnRecommendation } from '../types';
import { Badge, ColumnPicker, EmptyState, Measure } from './ui';
import { Histogram } from './Histogram';

interface OutlierDistributionProps {
  columnFacts: Record<string, ColumnFact>;
  recommendations: Record<string, ColumnRecommendation>;
}

export const OutlierDistribution: React.FC<OutlierDistributionProps> = ({ columnFacts, recommendations }) => {
  const numericCols = Object.entries(columnFacts)
    .filter(([, fact]) => fact.numeric_stats !== null)
    .map(([name, fact]) => ({ name, fact, rec: recommendations[name] }))
    // columns with outliers first, most affected at the top
    .sort((a, b) => (b.fact.numeric_stats?.outliers_iqr_pct ?? 0) - (a.fact.numeric_stats?.outliers_iqr_pct ?? 0));

  const [selectedCol, setSelectedCol] = useState<string>(numericCols[0]?.name || '');

  if (numericCols.length === 0) {
    return <EmptyState title="No numeric columns">Outliers are measured on numeric columns, and this dataset has none.</EmptyState>;
  }

  const active = numericCols.find((c) => c.name === selectedCol) || numericCols[0];
  const ns = active.fact.numeric_stats!;
  const rec = active.rec;

  const items = numericCols.map((c) => {
    const n = c.fact.numeric_stats?.outliers_iqr_count ?? 0;
    return {
      name: c.name,
      meta: n > 0 ? `${n} outliers` : 'No outliers',
      flag: n > 0 ? { label: `${c.fact.numeric_stats?.outliers_iqr_pct}%`, tone: 'bad' as const } : null,
    };
  });

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
      <ColumnPicker items={items} selected={active.name} onSelect={setSelectedCol} heading="Numeric columns" />

      <div className="min-w-0 space-y-5">
        <section className="panel overflow-hidden">
          <div className="panel-head">
            <div className="min-w-0">
              <h2 className="truncate font-mono text-lg font-semibold">{active.name}</h2>
              <p className="panel-sub">
                Rows per value range. A bar is flagged when it reaches past {ns.lower_bound_iqr} or {ns.upper_bound_iqr}.
              </p>
            </div>
            <div className="flex gap-2">
              <Badge>Skew {ns.skewness}</Badge>
              <Badge>Kurtosis {ns.kurtosis}</Badge>
            </div>
          </div>
          <div className="p-5">
            <Histogram stats={ns} />
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line p-5 sm:grid-cols-5">
            <Measure label="Minimum" value={ns.min} />
            <Measure label="25th percentile" value={ns.q25} />
            <Measure label="Median" value={ns.median} />
            <Measure label="75th percentile" value={ns.q75} />
            <Measure label="Maximum" value={ns.max} />
          </div>
        </section>

        <div className="grid gap-5 md:grid-cols-2">
          <section className="panel p-5">
            <h3 className="panel-title mb-3">Outlier count</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 md:grid-cols-1 xl:grid-cols-3">
              <Measure label="Outliers" value={ns.outliers_iqr_count} hint={`${ns.outliers_iqr_pct}% of values`} tone={ns.outliers_iqr_count > 0 ? 'bad' : 'default'} />
              <Measure label="Lower fence" value={ns.lower_bound_iqr} />
              <Measure label="Upper fence" value={ns.upper_bound_iqr} />
            </div>
            <p className="mt-4 text-sm text-ink-3">Fences sit 1.5 × IQR below the 25th and above the 75th percentile (Tukey’s rule).</p>
          </section>

          <section className="panel p-5">
            <h3 className="panel-title mb-3">Suggested treatment</h3>
            {rec?.scaling_and_outliers.length ? (
              <ul className="space-y-3">
                {rec.scaling_and_outliers.map((step, idx) => (
                  <li key={idx}>
                    <p className="font-medium">
                      {step.technique} <span className="font-mono text-xs font-normal text-ink-3">{step.rule_id}</span>
                    </p>
                    <p className="text-sm text-ink-2">{step.rationale}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-ink-2">The distribution is well behaved. Standard scaling without clipping is enough.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
