import React from 'react';
import { ArrowRight, CheckCircle2, Wrench } from 'lucide-react';
import type { DataRepair } from '../types';
import { Badge, EmptyState } from './ui';
import type { Tone } from './ui';

interface DataRepairsProps {
  repairs: DataRepair[];
  autoRepairOn: boolean; // false when the file was loaded with auto-repair switched off
}

const SEVERITY: Record<DataRepair['severity'], { tone: Tone; label: string }> = {
  CRITICAL: { tone: 'bad', label: 'Critical' },
  WARNING: { tone: 'warn', label: 'Warning' },
  INFO: { tone: 'info', label: 'Info' },
};

export const DataRepairs: React.FC<DataRepairsProps> = ({ repairs, autoRepairOn }) => {
  if (repairs.length === 0) {
    return (
      <EmptyState icon={CheckCircle2} title="No repairs were needed">
        {autoRepairOn
          ? 'Placeholders, numbers stored as text and inconsistent spellings were all checked, and none were found.'
          : 'Auto-repair was off for this file. Load it again with the option ticked to fix placeholder values, numbers stored as text and similar issues.'}
      </EmptyState>
    );
  }

  const totalCells = repairs.reduce((sum, r) => sum + r.affected_count, 0);

  return (
    <div className="space-y-5">
      <p className="flex items-start gap-3 text-ink-2">
        <Wrench className="mt-1 h-4 w-4 shrink-0 text-ink-3" aria-hidden />
        <span>
          <strong className="text-ink">
            {repairs.length} {repairs.length > 1 ? 'repairs' : 'repair'}, {totalCells.toLocaleString()} cells changed.
          </strong>{' '}
          These ran before profiling, so every statistic and recommendation in the app already reflects the repaired data.
        </span>
      </p>

      {repairs.map((repair, idx) => {
        const sev = SEVERITY[repair.severity] ?? SEVERITY.INFO;
        return (
          <article key={`${repair.rule_id}-${repair.column}-${idx}`} className="panel overflow-hidden">
            <div className="panel-head">
              <div className="min-w-0">
                <h2 className="panel-title">{repair.rule_name}</h2>
                <p className="panel-sub">
                  Column <span className="font-mono text-ink">{repair.column}</span> · rule {repair.rule_id}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone={sev.tone}>{sev.label}</Badge>
                <span className="text-sm tabular-nums text-ink-2">
                  {repair.affected_count.toLocaleString()} {repair.affected_count === 1 ? 'cell' : 'cells'}
                </span>
              </div>
            </div>
            <div className="space-y-4 p-5">
              <p className="max-w-3xl text-ink-2">{repair.description}</p>

              {repair.examples.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-line">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Before</th>
                        <th className="w-10" aria-hidden />
                        <th>After</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono text-[0.8125rem]">
                      {repair.examples.map((ex, i) => (
                        <tr key={i}>
                          <td className="whitespace-pre text-bad">{ex.before}</td>
                          <td className="text-ink-3">
                            <ArrowRight className="h-4 w-4" aria-label="becomes" />
                          </td>
                          <td className="whitespace-pre text-good">{ex.after}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
};
