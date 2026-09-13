import React, { useState } from 'react';
import {
  Target,
  AlertTriangle,
  Sparkles,
  BarChart3,
  CheckCircle2,
  X,
  TrendingUp,
  ShieldAlert,
} from 'lucide-react';
import type { TargetAnalysisResponse } from '../types';
import { analyzeTarget } from '../services/api';

interface SupervisedTargetModalProps {
  columns: string[];
  initialTarget?: string | null;
  onClose: () => void;
  onTargetSelect?: (target: string) => void;
}

export const SupervisedTargetModal: React.FC<SupervisedTargetModalProps> = ({
  columns,
  initialTarget,
  onClose,
  onTargetSelect,
}) => {
  const [selectedCol, setSelectedCol] = useState<string>(initialTarget || (columns[0] || ''));
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<TargetAnalysisResponse | null>(null);

  const handleAnalyze = async (col: string) => {
    setSelectedCol(col);
    setLoading(true);
    setError(null);
    try {
      const res = await analyzeTarget(col);
      setAnalysis(res);
      if (onTargetSelect) {
        onTargetSelect(col);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to analyze target variable');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-zinc-950 border border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-white/[0.08] flex items-center justify-between bg-zinc-900/60">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold font-mono text-white">
                Supervised Target Mode
              </h2>
              <p className="text-xs text-zinc-400">
                Designate a target feature to evaluate problem type, class imbalance, feature utility, and leakage risks.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          {/* Target Selection Strip */}
          <div className="p-4 rounded-xl glass-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <label className="text-xs font-mono uppercase tracking-wider text-zinc-400">
                Select Prediction Target Feature:
              </label>
              <div className="flex items-center space-x-2">
                <select
                  value={selectedCol}
                  onChange={(e) => handleAnalyze(e.target.value)}
                  className="bg-zinc-900 border border-white/[0.15] text-zinc-100 rounded-lg px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-emerald-400 transition min-w-[220px]"
                >
                  {columns.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handleAnalyze(selectedCol)}
                  disabled={loading}
                  className="px-3.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs font-mono flex items-center space-x-1.5 transition disabled:opacity-40"
                >
                  {loading ? (
                    <span className="w-3.5 h-3.5 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Run Analysis</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {analysis && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1 rounded-md text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold">
                  {analysis.task_type.replace('_', ' ').toUpperCase()}
                </span>
                <span className="px-2.5 py-1 rounded-md text-xs font-mono bg-zinc-800 text-zinc-300 border border-white/[0.08]">
                  {analysis.unique_count} Unique Values
                </span>
              </div>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs font-mono">
              {error}
            </div>
          )}

          {/* Analysis Results Display */}
          {analysis && (
            <div className="space-y-4">
              {/* Executive Recommendation Banner */}
              <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-white/[0.08] flex items-start space-x-3 text-xs">
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-semibold text-zinc-200">Analytical Recommendation</span>
                  <p className="text-zinc-400">{analysis.recommendation}</p>
                </div>
              </div>

              {/* Data Leakage Warning Alert */}
              {analysis.leakage_warnings.length > 0 && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 space-y-1.5">
                  <div className="flex items-center space-x-2 text-rose-400 text-xs font-semibold font-mono">
                    <ShieldAlert className="w-4 h-4" />
                    <span>Potential Target Leakage Detected ({analysis.leakage_warnings.length} features)</span>
                  </div>
                  <ul className="text-xs text-rose-300/90 list-disc list-inside space-y-0.5 font-mono">
                    {analysis.leakage_warnings.map((warn, i) => (
                      <li key={i}>{warn}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Class Imbalance Breakdown for Classification */}
              {analysis.class_imbalance && (
                <div className="p-4 rounded-xl glass-card space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-300 flex items-center space-x-2">
                      <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
                      <span>Class Imbalance & Entropy Evaluation</span>
                    </h4>
                    {analysis.class_imbalance.imbalance_severity !== 'NONE' && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold">
                        {analysis.class_imbalance.imbalance_severity} Imbalance
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                    <div className="p-2.5 rounded-lg bg-zinc-950/60 border border-white/[0.05]">
                      <span className="text-zinc-500 text-[10px]">Minority Share</span>
                      <div className="text-sm font-bold text-zinc-200">
                        {analysis.class_imbalance.minority_percentage}%
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-zinc-950/60 border border-white/[0.05]">
                      <span className="text-zinc-500 text-[10px]">Gini Impurity</span>
                      <div className="text-sm font-bold text-zinc-200">
                        {analysis.class_imbalance.gini_impurity}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-zinc-950/60 border border-white/[0.05]">
                      <span className="text-zinc-500 text-[10px]">Shannon Entropy</span>
                      <div className="text-sm font-bold text-zinc-200">
                        {analysis.class_imbalance.entropy}
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-zinc-950/60 border border-white/[0.05]">
                      <span className="text-zinc-500 text-[10px]">Evaluation Metric</span>
                      <div className="text-sm font-bold text-emerald-400">
                        {analysis.class_imbalance.minority_percentage < 15 ? 'PR-AUC / F1' : 'ROC-AUC / Acc'}
                      </div>
                    </div>
                  </div>

                  {/* Class Distribution Bar */}
                  <div className="space-y-1.5 pt-1">
                    <div className="h-3 w-full rounded-full bg-zinc-900 overflow-hidden flex">
                      {Object.entries(analysis.class_imbalance.distribution).map(([cat, info], idx) => {
                        const colors = ['bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-amber-500', 'bg-rose-500'];
                        const color = colors[idx % colors.length];
                        return (
                          <div
                            key={cat}
                            style={{ width: `${info.percentage}%` }}
                            className={`${color} h-full transition-all`}
                            title={`${cat}: ${info.count} (${info.percentage}%)`}
                          />
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-zinc-400">
                      {Object.entries(analysis.class_imbalance.distribution).map(([cat, info], idx) => {
                        const dotColors = ['bg-emerald-400', 'bg-blue-400', 'bg-purple-400', 'bg-amber-400', 'bg-rose-400'];
                        return (
                          <div key={cat} className="flex items-center space-x-1.5">
                            <span className={`w-2 h-2 rounded-full ${dotColors[idx % dotColors.length]}`} />
                            <span className="text-zinc-300 font-semibold">{cat}:</span>
                            <span>{info.count} ({info.percentage}%)</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Feature Utility & Mutual Information Ranking */}
              <div className="p-4 rounded-xl glass-card space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-300 flex items-center space-x-2">
                    <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Predictive Feature Ranking (Mutual Information & Correlation)</span>
                  </h4>
                  <span className="text-[11px] font-mono text-zinc-500">
                    {analysis.feature_importances.length} Features Evaluated
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono border-collapse">
                    <thead>
                      <tr className="border-b border-white/[0.08] text-zinc-400 text-[10px] uppercase">
                        <th className="py-2 px-2.5 w-10">Rank</th>
                        <th className="py-2 px-2.5">Feature Name</th>
                        <th className="py-2 px-2.5">Predictive Utility</th>
                        <th className="py-2 px-2.5">Score</th>
                        <th className="py-2 px-2.5">Correlation</th>
                        <th className="py-2 px-2.5 text-right">Leakage Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {analysis.feature_importances.map((f, idx) => {
                        const maxScore = analysis.feature_importances[0]?.score || 1;
                        const pct = Math.min(100, Math.round((f.score / (maxScore || 1)) * 100));

                        return (
                          <tr key={f.feature} className="hover:bg-white/[0.02]">
                            <td className="py-2 px-2.5 text-zinc-600 font-bold">#{idx + 1}</td>
                            <td className="py-2 px-2.5 text-zinc-200 font-semibold">{f.feature}</td>
                            <td className="py-2 px-2.5 w-48">
                              <div className="h-2 w-full rounded-full bg-zinc-900 overflow-hidden">
                                <div
                                  style={{ width: `${pct}%` }}
                                  className={`h-full ${
                                    f.leakage_risk ? 'bg-rose-500' : 'bg-emerald-400'
                                  }`}
                                />
                              </div>
                            </td>
                            <td className="py-2 px-2.5 text-zinc-300">{f.score.toFixed(4)}</td>
                            <td className="py-2 px-2.5 text-zinc-400">
                              {f.correlation !== null && f.correlation !== undefined
                                ? (f.correlation > 0 ? `+${f.correlation.toFixed(3)}` : f.correlation.toFixed(3))
                                : '—'}
                            </td>
                            <td className="py-2 px-2.5 text-right">
                              {f.leakage_risk ? (
                                <span className="inline-flex items-center space-x-1 text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  <span>Leakage Risk</span>
                                </span>
                              ) : (
                                <span className="text-[10px] text-emerald-400 font-mono">Safe</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
