import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import type { TargetAnalysisResponse } from '../types';
import { analyzeTarget } from '../services/api';
import { Badge, MeterBar, Measure, Notice } from './ui';

interface SupervisedTargetModalProps {
  columns: string[];
  initialTarget?: string | null;
  onClose: () => void;
  onTargetSelect?: (target: string) => void;
}

const CLASS_COLORS = ['#3B82F6', '#E69F00', '#1FA37A', '#D4559C', '#9A7BE0', '#E5533D', '#17A2B8', '#8A94A6'];

export const SupervisedTargetModal: React.FC<SupervisedTargetModalProps> = ({ columns, initialTarget, onClose, onTargetSelect }) => {
  const [selectedCol, setSelectedCol] = useState<string>(initialTarget || columns[0] || '');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<TargetAnalysisResponse | null>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    selectRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const handleAnalyze = async (col: string) => {
    setSelectedCol(col);
    setLoading(true);
    setError(null);
    try {
      const res = await analyzeTarget(col);
      setAnalysis(res);
      onTargetSelect?.(col);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze target variable');
    } finally {
      setLoading(false);
    }
  };

  const ci = analysis?.class_imbalance;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:items-center"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="target-title" className="my-auto w-full max-w-4xl overflow-hidden rounded-2xl bg-surface shadow-pop">
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div>
            <h2 id="target-title" className="text-xl">
              Choose a target column
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-ink-3">
              The target is what you want a model to predict. Datalysis will work out the problem type, check class balance, rank the other columns by how useful they look, and warn about leakage.
            </p>
          </div>
          <button type="button" onClick={onClose} className="btn btn-quiet btn-icon -mr-2 -mt-1" aria-label="Close">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="space-y-6 p-6">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="target-select" className="field-label">
                Target column
              </label>
              <select
                id="target-select"
                ref={selectRef}
                value={selectedCol}
                onChange={(e) => setSelectedCol(e.target.value)}
                className="field min-w-[240px] font-mono"
              >
                {columns.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className="btn btn-primary" onClick={() => handleAnalyze(selectedCol)} disabled={loading}>
              {loading ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent-ink/40 border-t-accent-ink" /> Analysing…
                </>
              ) : (
                'Analyse target'
              )}
            </button>
            {analysis && (
              <div className="flex flex-wrap items-center gap-2 pb-1.5">
                <Badge tone="accent">{analysis.task_type.replace(/_/g, ' ')}</Badge>
                <Badge>{analysis.unique_count} distinct values</Badge>
              </div>
            )}
          </div>

          {error && (
            <Notice tone="bad" title="Analysis failed">
              {error}
            </Notice>
          )}

          {analysis && (
            <div className="space-y-6">
              <Notice tone="info" title="Recommendation">
                {analysis.recommendation}
              </Notice>

              {analysis.leakage_warnings.length > 0 && (
                <Notice tone="bad" title={`Possible target leakage in ${analysis.leakage_warnings.length} ${analysis.leakage_warnings.length === 1 ? 'feature' : 'features'}`}>
                  <ul className="mt-1 list-inside list-disc space-y-0.5">
                    {analysis.leakage_warnings.map((warn, i) => (
                      <li key={i}>{warn}</li>
                    ))}
                  </ul>
                </Notice>
              )}

              {ci && (
                <section className="rounded-xl border border-line p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-base">Class balance</h3>
                    {ci.imbalance_severity !== 'NONE' && <Badge tone="warn">{ci.imbalance_severity.toLowerCase()} imbalance</Badge>}
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
                    <Measure label="Smallest class" value={`${ci.minority_percentage}%`} />
                    <Measure label="Gini impurity" value={ci.gini_impurity} />
                    <Measure label="Shannon entropy" value={ci.entropy} />
                    <Measure label="Suggested metric" value={ci.minority_percentage < 15 ? 'PR-AUC or F1' : 'ROC-AUC or accuracy'} />
                  </div>

                  <div className="mt-5 flex h-4 w-full overflow-hidden rounded-full bg-sunken" role="img" aria-label="Class distribution">
                    {Object.entries(ci.distribution).map(([cat, info], idx) => (
                      <div
                        key={cat}
                        style={{ width: `${info.percentage}%`, background: CLASS_COLORS[idx % CLASS_COLORS.length] }}
                        title={`${cat}: ${info.count} (${info.percentage}%)`}
                      />
                    ))}
                  </div>
                  <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
                    {Object.entries(ci.distribution).map(([cat, info], idx) => (
                      <li key={cat} className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: CLASS_COLORS[idx % CLASS_COLORS.length] }} aria-hidden />
                        <span className="font-medium">{cat}</span>
                        <span className="text-ink-3">
                          {info.count.toLocaleString()} ({info.percentage}%)
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section className="overflow-hidden rounded-xl border border-line">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3.5">
                  <h3 className="text-base">Features ranked by usefulness</h3>
                  <span className="text-sm text-ink-3">
                    {analysis.feature_importances.length} features · mutual information and correlation
                  </span>
                </div>
                <div className="max-h-[360px] overflow-auto">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th className="w-12 text-right">Rank</th>
                        <th>Feature</th>
                        <th className="min-w-[160px]">Relative usefulness</th>
                        <th className="text-right">Score</th>
                        <th className="text-right">Correlation</th>
                        <th>Leakage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.feature_importances.map((f, idx) => {
                        const maxScore = analysis.feature_importances[0]?.score || 1;
                        const pct = Math.min(100, Math.round((f.score / (maxScore || 1)) * 100));
                        return (
                          <tr key={f.feature}>
                            <td className="text-right text-ink-3">{idx + 1}</td>
                            <td className="font-mono font-medium">{f.feature}</td>
                            <td>
                              <MeterBar value={pct} tone={f.leakage_risk ? 'bad' : 'accent'} />
                            </td>
                            <td className="text-right font-mono">{f.score.toFixed(4)}</td>
                            <td className="text-right font-mono text-ink-2">
                              {f.correlation !== null && f.correlation !== undefined ? (f.correlation > 0 ? `+${f.correlation.toFixed(3)}` : f.correlation.toFixed(3)) : '—'}
                            </td>
                            <td>
                              {f.leakage_risk ? (
                                <Badge tone="bad" icon={AlertTriangle}>
                                  Risk
                                </Badge>
                              ) : (
                                <span className="text-ink-3">None found</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
