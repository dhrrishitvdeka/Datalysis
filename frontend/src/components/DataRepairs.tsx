import React from 'react';
import { Wrench, CheckCircle2, ArrowRight } from 'lucide-react';
import type { DataRepair } from '../types';

interface DataRepairsProps {
  repairs: DataRepair[];
  autoRepairOn: boolean; // false when the file was loaded with auto-repair switched off
}

// Same severity colours used elsewhere in the app (rose = critical, amber = warning, sky = info)
const SEVERITY_STYLE: Record<DataRepair['severity'], string> = {
  CRITICAL: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
  WARNING: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  INFO: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
};

export const DataRepairs: React.FC<DataRepairsProps> = ({ repairs, autoRepairOn }) => {
  if (repairs.length === 0) {
    return (
      <div className="p-12 text-center rounded-xl glass-card space-y-2">
        <CheckCircle2 className="w-6 h-6 mx-auto text-emerald-400" />
        <h4 className="text-sm font-semibold text-zinc-200 font-mono">
          No data-quality repairs were needed.
        </h4>
        {!autoRepairOn && (
          <p className="text-xs text-zinc-500 max-w-md mx-auto">
            Auto-repair was switched off for this file. Re-upload with the toggle on to let the R-QLT rules fix
            disguised missing values, numbers stored as text and similar issues.
          </p>
        )}
      </div>
    );
  }

  const totalCells = repairs.reduce((sum, r) => sum + r.affected_count, 0);

  return (
    <div className="space-y-3">
      <div className="p-4 rounded-xl glass-card flex items-start gap-2.5">
        <Wrench className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
        <div>
          <h3 className="text-sm font-semibold text-white font-mono">
            {repairs.length} repair{repairs.length > 1 ? 's' : ''} applied · {totalCells.toLocaleString()} cells changed
          </h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            These fixes ran automatically before profiling, so every statistic and recommendation below is computed on
            the repaired data. Your original file is not modified.
          </p>
        </div>
      </div>

      {repairs.map((repair, idx) => (
        <div key={`${repair.rule_id}-${repair.column}-${idx}`} className="p-4 rounded-xl glass-card space-y-3">
          <div className="flex flex-wrap items-center gap-2 font-mono">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-300 border border-white/[0.08]">
              {repair.rule_id}
            </span>
            <span className="text-xs font-semibold text-zinc-100">{repair.rule_name}</span>
            <span className="text-[11px] text-zinc-500">
              column <span className="text-zinc-300">{repair.column}</span>
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${SEVERITY_STYLE[repair.severity] ?? SEVERITY_STYLE.INFO}`}>
              {repair.severity}
            </span>
            <span className="ml-auto text-[11px] text-zinc-400 tabular-nums">
              {repair.affected_count.toLocaleString()} cell{repair.affected_count === 1 ? '' : 's'}
            </span>
          </div>

          <p className="text-xs text-zinc-400 leading-relaxed">{repair.description}</p>

          {repair.examples.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-white/[0.06]">
              <table className="w-full text-left text-[11px] font-mono">
                <thead>
                  <tr className="bg-zinc-950 text-zinc-500 text-[10px] uppercase tracking-wider">
                    <th className="py-1.5 px-3 font-normal">Before</th>
                    <th className="py-1.5 px-1 w-6" />
                    <th className="py-1.5 px-3 font-normal">After</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04] text-zinc-300">
                  {repair.examples.map((ex, i) => (
                    <tr key={i}>
                      <td className="py-1 px-3 text-rose-300/90 whitespace-pre">{ex.before}</td>
                      <td className="py-1 px-1 text-zinc-600">
                        <ArrowRight className="w-3 h-3" />
                      </td>
                      <td className="py-1 px-3 text-emerald-300 whitespace-pre">{ex.after}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
