import React from 'react';
import { Activity, Layers, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { HealthScore, DatasetSummary } from '../types';

interface HealthScoreCardProps {
  health: HealthScore;
  summary: DatasetSummary;
}

export const HealthScoreCard: React.FC<HealthScoreCardProps> = ({ health }) => {
  const getGradeTheme = (grade: string) => {
    switch (grade) {
      case 'A+':
      case 'A':
        return {
          stroke: '#10B981',
          text: 'text-emerald-400',
          badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          label: 'Production Ready'
        };
      case 'B':
        return {
          stroke: '#38BDF8',
          text: 'text-sky-400',
          badge: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
          label: 'Requires Standard Preprocessing'
        };
      case 'C':
        return {
          stroke: '#F59E0B',
          text: 'text-amber-400',
          badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
          label: 'Imputation & Scaling Needed'
        };
      default:
        return {
          stroke: '#F43F5E',
          text: 'text-rose-400',
          badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
          label: 'Critical Flaws & Leakage'
        };
    }
  };

  const theme = getGradeTheme(health.grade);
  const strokeDashoffset = 251 - (251 * health.overall_score) / 100;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      {/* Score Gauge */}
      <div className="p-5 rounded-xl glass-card flex flex-col items-center justify-center text-center relative">
        <div className="absolute top-3 left-4 flex items-center space-x-1.5 text-xs text-zinc-500">
          <Activity className="w-3.5 h-3.5 text-zinc-400" />
          <span className="font-mono text-[10px] uppercase tracking-wider">Health Index</span>
        </div>

        {/* Circular Metric */}
        <div className="relative w-28 h-28 mt-4">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="transparent"
              stroke="#18181B"
              strokeWidth="6"
            />
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="transparent"
              stroke={theme.stroke}
              strokeWidth="6"
              strokeDasharray="251"
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold font-mono text-white tracking-tight">{health.overall_score}</span>
            <span className="text-[10px] text-zinc-500 font-mono">/100</span>
          </div>
        </div>

        <div className="mt-3">
          <div className={`inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full border text-xs font-mono font-medium ${theme.badge}`}>
            <span>Grade {health.grade}</span>
            <span className="text-zinc-600">•</span>
            <span className="text-[11px] font-sans font-normal text-zinc-300">{theme.label}</span>
          </div>
        </div>
      </div>

      {/* Sub-scores */}
      <div className="p-5 rounded-xl glass-card flex flex-col justify-between space-y-3">
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <div className="flex items-center space-x-1.5">
            <Layers className="w-3.5 h-3.5 text-zinc-400" />
            <span className="font-mono text-[10px] uppercase tracking-wider">Subscores</span>
          </div>
          <span className="font-mono text-[10px]">Heuristic Weighting</span>
        </div>

        <div className="space-y-2.5">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-zinc-400 text-[11px]">Completeness</span>
              <span className="font-mono text-xs text-zinc-200">{health.sub_scores.completeness}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-zinc-900 overflow-hidden">
              <div
                className="h-full rounded-full bg-zinc-300 transition-all duration-500"
                style={{ width: `${health.sub_scores.completeness}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-zinc-400 text-[11px]">Distribution (Skew & Outliers)</span>
              <span className="font-mono text-xs text-zinc-200">{health.sub_scores.distribution}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-zinc-900 overflow-hidden">
              <div
                className="h-full rounded-full bg-zinc-300 transition-all duration-500"
                style={{ width: `${health.sub_scores.distribution}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-zinc-400 text-[11px]">Parsimony & Cleanliness</span>
              <span className="font-mono text-xs text-zinc-200">{health.sub_scores.parsimony}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-zinc-900 overflow-hidden">
              <div
                className="h-full rounded-full bg-zinc-300 transition-all duration-500"
                style={{ width: `${health.sub_scores.parsimony}%` }}
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="text-zinc-400 text-[11px]">Encoding Readiness</span>
              <span className="font-mono text-xs text-zinc-200">{health.sub_scores.encoding_readiness}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-zinc-900 overflow-hidden">
              <div
                className="h-full rounded-full bg-zinc-300 transition-all duration-500"
                style={{ width: `${health.sub_scores.encoding_readiness}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Diagnosis & Critical Issues */}
      <div className="p-5 rounded-xl glass-card flex flex-col justify-between space-y-3">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 block mb-1.5">
            Executive Diagnosis
          </span>
          <p className="text-xs text-zinc-300 leading-relaxed bg-black/40 p-3 rounded-lg border border-white/[0.04] font-sans">
            {health.executive_diagnosis}
          </p>
        </div>

        {health.critical_issues.length > 0 ? (
          <div className="space-y-1">
            <span className="text-[10px] font-mono text-rose-400 uppercase tracking-wider">
              Targets ({health.critical_issues.length})
            </span>
            <div className="space-y-1">
              {health.critical_issues.slice(0, 2).map((issue, idx) => (
                <div key={idx} className="flex items-center space-x-2 text-[11px] text-rose-300 bg-rose-500/10 px-2 py-1 rounded border border-rose-500/20">
                  <AlertTriangle className="w-3 h-3 flex-shrink-0 text-rose-400" />
                  <span className="truncate">{issue}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center space-x-2 text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1.5 rounded border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Zero critical vulnerabilities detected.</span>
          </div>
        )}
      </div>
    </div>
  );
};
