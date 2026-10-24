import React, { useState } from 'react';
import { Play, RotateCcw } from 'lucide-react';
import type { ColumnRecommendation, ColumnFact, RecipeOverride, ProcessRequest, CleaningReport } from '../types';
import { executePreprocessing } from '../services/api';
import { TargetNote } from './TargetNote';
import { Notice, SearchBox, fmtType } from './ui';

interface RecipeCustomizerProps {
  recommendations: Record<string, ColumnRecommendation>;
  columnFacts: Record<string, ColumnFact>;
  customRecipe: Record<string, RecipeOverride>;
  onRecipeChange: (newRecipe: Record<string, RecipeOverride>) => void;
  targetColumn?: string | null;
  onRunSuccess?: (report: CleaningReport) => void;
}

type FilterTab = 'ALL' | 'OVERRIDDEN' | 'DROPS' | 'IMPUTATIONS' | 'ENCODINGS' | 'SCALING';

/** One dropdown cell. Renders a dash when the choice does not apply, so every row keeps the same height. */
const Choice: React.FC<{
  label: string;
  show: boolean;
  why: string;
  value: string;
  hint?: string;
  options: [string, string][];
  onChange: (v: string) => void;
}> = ({ label, show, why, value, hint, options, onChange }) =>
  show ? (
    <select
      aria-label={label}
      title={value === 'auto' && hint ? `Auto: ${hint}` : undefined}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="field w-full"
    >
      {options.map(([v, text]) => (
        <option key={v} value={v}>
          {text}
        </option>
      ))}
    </select>
  ) : (
    <span className="text-ink-3" title={why}>
      —
    </span>
  );

export const RecipeCustomizer: React.FC<RecipeCustomizerProps> = ({
  recommendations,
  columnFacts,
  customRecipe,
  onRecipeChange,
  targetColumn = null,
  onRunSuccess,
}) => {
  const [filter, setFilter] = useState<FilterTab>('ALL');
  const [search, setSearch] = useState('');
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const columns = Object.keys(recommendations);

  const updateColumnOverride = (column: string, field: keyof RecipeOverride, value: any) => {
    const prev = customRecipe[column] || {};
    onRecipeChange({ ...customRecipe, [column]: { ...prev, [field]: value } });
  };

  const resetColumnOverride = (column: string) => {
    const next = { ...customRecipe };
    delete next[column];
    onRecipeChange(next);
  };

  const overriddenCount = Object.keys(customRecipe).length;
  const effectiveDrop = (c: string) => (customRecipe[c]?.drop !== undefined ? customRecipe[c]?.drop : recommendations[c]?.should_drop);

  const filteredColumns = columns.filter((col) => {
    if (search && !col.toLowerCase().includes(search.toLowerCase())) return false;
    const rec = recommendations[col];
    const override = customRecipe[col];
    if (filter === 'OVERRIDDEN') return !!override && Object.keys(override).length > 0;
    if (filter === 'DROPS') return !!effectiveDrop(col);
    if (filter === 'IMPUTATIONS') return rec.missing_pct > 0 || !!override?.imputation;
    if (filter === 'ENCODINGS') return !!rec.encoding || !!override?.encoding;
    if (filter === 'SCALING') return !!columnFacts[col]?.numeric_stats || !!override?.scaling || !!override?.outliers;
    return true;
  });

  const handleExecute = async () => {
    setExecuting(true);
    setError(null);
    try {
      const payload: ProcessRequest = {
        column_overrides: customRecipe,
        drop_duplicates: true,
        ...(targetColumn && { target_column: targetColumn }),
      };
      const report = await executePreprocessing(payload);
      onRunSuccess?.(report);
    } catch (err: any) {
      setError(err.message || 'Custom recipe execution failed');
    } finally {
      setExecuting(false);
    }
  };

  const filters: { id: FilterTab; label: string; count: number }[] = [
    { id: 'ALL', label: 'All', count: columns.length },
    { id: 'OVERRIDDEN', label: 'Edited', count: overriddenCount },
    { id: 'DROPS', label: 'Dropped', count: columns.filter((c) => effectiveDrop(c)).length },
    { id: 'IMPUTATIONS', label: 'Missing values', count: columns.filter((c) => recommendations[c]?.missing_pct > 0).length },
    { id: 'ENCODINGS', label: 'Encoding', count: columns.filter((c) => !!recommendations[c]?.encoding).length },
    { id: 'SCALING', label: 'Scaling and outliers', count: columns.filter((c) => !!columnFacts[c]?.numeric_stats).length },
  ];

  return (
    <div className="space-y-5">
      <section className="panel flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="max-w-2xl">
          <h2 className="panel-title">
            {overriddenCount === 0 ? 'Using the rules’ recommendations' : `${overriddenCount} ${overriddenCount === 1 ? 'column' : 'columns'} edited`}
          </h2>
          <p className="panel-sub">
            Every column starts on “Auto”, which follows the recommended rule. Change a choice only where you know better, then run the recipe.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {overriddenCount > 0 && (
            <button type="button" className="btn" onClick={() => onRecipeChange({})}>
              <RotateCcw className="h-4 w-4" aria-hidden /> Reset all
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={handleExecute} disabled={executing}>
            {executing ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent-ink/40 border-t-accent-ink" /> Running…
              </>
            ) : (
              <>
                <Play className="h-4 w-4" aria-hidden /> Run recipe
              </>
            )}
          </button>
        </div>
      </section>

      <TargetNote target={targetColumn} />
      {error && <Notice tone="bad" title="The recipe did not run">{error}</Notice>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="seg" role="group" aria-label="Filter columns">
          {filters.map((t) => (
            <button key={t.id} type="button" aria-pressed={filter === t.id} onClick={() => setFilter(t.id)}>
              {t.label} <span className="tabular-nums text-ink-3">{t.count}</span>
            </button>
          ))}
        </div>
        <SearchBox value={search} onChange={setSearch} placeholder="Find a column" className="w-full sm:w-64" />
      </div>

      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="tbl min-w-[1000px] table-fixed">
            <colgroup>
              <col className="w-[22%]" />
              <col className="w-[13%]" />
              <col className="w-[16%]" />
              <col className="w-[16%]" />
              <col className="w-[16%]" />
              <col className="w-[17%]" />
            </colgroup>
            <thead>
              <tr>
                <th>Column</th>
                <th>Keep or drop</th>
                <th>Missing values</th>
                <th>Outliers</th>
                <th>Scaling</th>
                <th>Encoding</th>
              </tr>
            </thead>
            <tbody>
              {filteredColumns.map((col) => {
                const rec = recommendations[col];
                const fact = columnFacts[col];
                const override = customRecipe[col] || {};
                const isOverridden = Object.keys(override).length > 0;

                const isNumeric = !!fact?.numeric_stats;
                const isCat = !!(fact?.inferred_type?.includes('categorical') || fact?.is_binary || fact?.inferred_type === 'free_text');
                const hasMissing = (rec?.missing_pct ?? 0) > 0;
                const drop = !!effectiveDrop(col);

                const autoNumeric = rec?.scaling_and_outliers?.map((s) => s.technique).join(', ');
                const subline =
                  drop && rec?.drop_reason
                    ? rec.drop_reason
                    : `${fmtType(fact?.inferred_type || rec?.inferred_type)} · ${(fact?.unique_count ?? rec?.unique_count)?.toLocaleString()} unique${
                        hasMissing ? ` · ${rec.missing_pct}% missing` : ''
                      }`;

                return (
                  <tr key={col} className="h-[4.25rem]">
                    <td style={isOverridden ? { boxShadow: 'inset 3px 0 0 rgb(var(--accent))' } : undefined}>
                      <div className="flex items-center gap-2">
                        <span className="truncate font-mono font-medium" title={col}>
                          {col}
                        </span>
                        {isOverridden && (
                          <button
                            type="button"
                            onClick={() => resetColumnOverride(col)}
                            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-accent-soft px-1.5 py-0.5 text-xs font-medium text-accent hover:underline"
                            title="Edited. Click to go back to the recommendation."
                          >
                            <RotateCcw className="h-3 w-3" aria-hidden /> Reset
                          </button>
                        )}
                      </div>
                      <p className={`truncate text-xs ${drop && rec?.drop_reason ? 'text-bad' : 'text-ink-3'}`} title={subline}>
                        {subline}
                      </p>
                    </td>

                    <td>
                      <div className="seg !p-0.5" role="group" aria-label={`Keep or drop ${col}`}>
                        <button type="button" className="!h-7 !px-2.5" aria-pressed={!drop} onClick={() => updateColumnOverride(col, 'drop', false)}>
                          Keep
                        </button>
                        <button
                          type="button"
                          className={`!h-7 !px-2.5 ${drop ? '!bg-bad-soft !text-bad' : ''}`}
                          aria-pressed={drop}
                          onClick={() => updateColumnOverride(col, 'drop', true)}
                        >
                          Drop
                        </button>
                      </div>
                    </td>

                    <td>
                      <Choice
                        label={`Missing values for ${col}`}
                        show={!drop && hasMissing}
                        why={drop ? 'Column is dropped' : 'No missing values'}
                        value={override.imputation || 'auto'}
                        hint={rec?.imputation?.technique}
                        onChange={(v) => updateColumnOverride(col, 'imputation', v)}
                        options={[
                          ['auto', 'Auto'],
                          ['median', 'Median'],
                          ['mean', 'Mean'],
                          ['mode', 'Most frequent'],
                          ['constant', 'Constant'],
                          ...(isNumeric ? [['knn', 'KNN imputer'] as [string, string]] : []),
                          ['drop_rows', 'Drop rows'],
                          ['none', 'Leave as is'],
                        ]}
                      />
                    </td>

                    <td>
                      <Choice
                        label={`Outlier handling for ${col}`}
                        show={!drop && isNumeric}
                        why={drop ? 'Column is dropped' : 'Numeric columns only'}
                        value={override.outliers || 'auto'}
                        hint={autoNumeric}
                        onChange={(v) => updateColumnOverride(col, 'outliers', v)}
                        options={[
                          ['auto', 'Auto'],
                          ['winsorize', 'Winsorize 1–99%'],
                          ['clip_iqr', 'Clip to 1.5 × IQR'],
                          ['zscore', 'Z-score ±3 SD'],
                          ['none', 'Keep outliers'],
                        ]}
                      />
                    </td>

                    <td>
                      <Choice
                        label={`Scaling for ${col}`}
                        show={!drop && isNumeric}
                        why={drop ? 'Column is dropped' : 'Numeric columns only'}
                        value={override.scaling || 'auto'}
                        hint={autoNumeric}
                        onChange={(v) => updateColumnOverride(col, 'scaling', v)}
                        options={[
                          ['auto', 'Auto'],
                          ['standard', 'Standard'],
                          ['robust', 'Robust'],
                          ['log1p', 'Log1p'],
                          ['none', 'Raw scale'],
                        ]}
                      />
                    </td>

                    <td>
                      <Choice
                        label={`Encoding for ${col}`}
                        show={!drop && isCat}
                        why={drop ? 'Column is dropped' : 'Categorical columns only'}
                        value={override.encoding || 'auto'}
                        hint={rec?.encoding?.technique}
                        onChange={(v) => updateColumnOverride(col, 'encoding', v)}
                        options={[
                          ['auto', 'Auto'],
                          ['onehot', 'One-hot'],
                          ['frequency', 'Frequency'],
                          ['binary', 'Binary 0 or 1'],
                          ['ordinal', 'Ordinal'],
                          ['none', 'Keep raw'],
                        ]}
                      />
                    </td>
                  </tr>
                );
              })}
              {filteredColumns.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-ink-3">
                    No columns match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="border-t border-line px-5 py-3 text-sm text-ink-3">
          Hover a dropdown that says Auto to see which technique the rules picked. A dash means the choice does not apply to that column.
        </p>
      </div>
    </div>
  );
};
