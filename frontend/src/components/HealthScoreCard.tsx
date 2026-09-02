import React from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { HealthScore, DatasetSummary } from '../types';

interface HealthScoreCardProps {
  health: HealthScore;
  summary: DatasetSummary;
}

export const HealthScoreCard: React.FC<HealthScoreCardProps> = ({ health, summary }) => {
  const getGradeTheme = (grade: string) => {
    switch (grade) {
      case 'A+':
      case 'A':
        return { stroke: '#10B981', text: 'text-emerald-400', badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
      case 'B':
        return { stroke: '#38BDF8', text: 'text-sky-400', badge: 'bg-sky-500/10 text-sky-400 border-sky-500/20' };
      case 'C':
        return { stroke: '#F59E0B', text: 'text-amber-400', badge: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
      default:
        return { stroke: '#F43F5E', text: 'text-rose-400', badge: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
    }
  };

  const theme = getGradeTheme(health.grade);
  const strokeDashoffset = 251 - (251 * health.overall_score) / 100;
  const subs = [
    { label: 'Complete', value: health.sub_scores.completeness },
    { label: 'Distribution', value: health.sub_scores.distribution },
    { label: 'Parsimony', value: health.sub_scores.parsimony },
    { label: 'Encoding', value: health.sub_scores.encoding_readiness },
  ];

  return (
    <div className="flex-1 p-3 rounded-xl glass-card flex flex-col xl:flex-row xl:items-center gap-3 min-w-0">
      <div className="flex items-center gap-3 shrink-0">
        <div className="relative w-14 h-14">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" fill="transparent" stroke="#18181B" strokeWidth="8" />
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="transparent"
              stroke={theme.stroke}
              strokeWidth="8"
              strokeDasharray="251"
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-sm font-bold font-mono tabular-nums text-white leading-none">{health.overall_score}</span>
          </div>
        </div>
        <div>
          <div className={`inline-flex items-center px-1.5 py-0.5 rounded border text-[10px] font-mono ${theme.badge}`}>
            Grade {health.grade}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1 font-mono tabular-nums">
            {summary.row_count.toLocaleString()} × {summary.col_count} · {summary.overall_missing_pct}% missing
          </p>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-2 min-w-0">
        {subs.map((s) => (
          <div key={s.label} className="min-w-0">
            <div className="flex justify-between text-[10px] mb-0.5 font-mono">
              <span className="text-zinc-500 truncate">{s.label}</span>
              <span className="tabular-nums text-zinc-300">{s.value}</span>
            </div>
            <div className="w-full h-1 rounded-full bg-zinc-900 overflow-hidden">
              <div className="h-full rounded-full bg-zinc-400" style={{ width: `${s.value}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="xl:max-w-sm w-full xl:w-auto min-w-0">
        {health.critical_issues.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {health.critical_issues.map((issue, idx) => (
              <span
                key={idx}
                title={issue}
                className="inline-flex items-center gap-1 max-w-full px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-[10px] text-rose-300"
              >
                <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                <span className="truncate">{issue}</span>
              </span>
            ))}
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 text-[11px] text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            No critical issues
          </div>
        )}
      </div>
    </div>
  );
};
