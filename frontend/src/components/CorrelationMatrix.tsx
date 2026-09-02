import React from 'react';
import { GitFork, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { CorrelationPair } from '../types';

interface CorrelationMatrixProps {
  pairs: CorrelationPair[];
  matrix: Record<string, Record<string, number>>;
}

export const CorrelationMatrix: React.FC<CorrelationMatrixProps> = ({ pairs, matrix }) => {
  const columns = Object.keys(matrix);

  const getHeatmapColor = (val: number) => {
    if (val === 1) return 'bg-zinc-800 text-white font-semibold';
    if (val >= 0.85) return 'bg-rose-500/30 text-rose-200 font-semibold border border-rose-500/40';
    if (val >= 0.7) return 'bg-amber-500/20 text-amber-200';
    if (val >= 0.3) return 'bg-zinc-800/60 text-zinc-300';
    if (val >= -0.3) return 'bg-black text-zinc-600';
    if (val >= -0.7) return 'bg-sky-500/20 text-sky-200';
    return 'bg-blue-600/30 text-blue-200';
  };

  return (
    <div className="space-y-4">
      {/* Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 p-5 rounded-xl glass-card space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <GitFork className="w-4 h-4 text-zinc-400" />
              <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-zinc-300">
                Collinearity & Redundancy Warnings
              </h3>
            </div>
            <span className="text-[10px] font-mono text-zinc-500">
              {pairs.length} Pair(s) with |r| ≥ 0.75
            </span>
          </div>

          {pairs.length > 0 ? (
            <div className="space-y-1.5">
              {pairs.map((p, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border flex items-center justify-between text-xs font-mono ${
                    p.severity === 'CRITICAL'
                      ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                      : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                  }`}
                >
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    <div>
                      <span className="font-semibold text-white">{p.feature_a}</span>
                      <span className="text-zinc-500 mx-1.5">⇄</span>
                      <span className="font-semibold text-white">{p.feature_b}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="font-bold">r = {p.correlation}</span>
                    <span className="text-[10px] text-zinc-500 ml-2 uppercase">({p.severity})</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
              <span>No severe multicollinearity detected (|r| &lt; 0.75 across all dimensions).</span>
            </div>
          )}
        </div>

        {/* Guidance */}
        <div className="p-5 rounded-xl glass-card space-y-2 text-xs text-zinc-400">
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block">
            Variance Inflation Note
          </span>
          <p className="leading-relaxed font-sans">
            Features with correlation $|r| \ge 0.85$ inflate standard errors of regression coefficients (VIF penalty). Pruning one redundant feature stabilizes estimator weights.
          </p>
        </div>
      </div>

      {/* Correlation Matrix Table */}
      {columns.length >= 2 && (
        <div className="p-5 rounded-xl glass-card space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono uppercase tracking-wider font-semibold text-zinc-300">
              Pearson Cross-Correlation Matrix
            </h3>
            <span className="text-[10px] font-mono text-zinc-500">{columns.length} Dimensions</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse text-xs">
              <thead>
                <tr>
                  <th className="p-2 text-left text-[10px] text-zinc-600 uppercase font-mono"></th>
                  {columns.map((col) => (
                    <th key={col} className="p-2 text-[10px] font-mono text-zinc-400 max-w-[90px] truncate">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {columns.map((rCol) => (
                  <tr key={rCol}>
                    <td className="p-2 text-left font-mono font-medium text-zinc-300 whitespace-nowrap text-[11px] border-r border-white/[0.04]">
                      {rCol}
                    </td>
                    {columns.map((cCol) => {
                      const val = matrix[rCol]?.[cCol] ?? 0;
                      return (
                        <td key={cCol} className="p-0.5">
                          <div
                            className={`py-1 px-1.5 rounded font-mono text-[10px] transition ${getHeatmapColor(val)}`}
                            title={`${rCol} vs ${cCol}: ${val}`}
                          >
                            {val.toFixed(2)}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
