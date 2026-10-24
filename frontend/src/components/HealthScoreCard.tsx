import React from 'react';
import { AlertTriangle, CheckCircle2, Wrench } from 'lucide-react';
import type { HealthScore } from '../types';
import { Badge, MeterBar } from './ui';
import type { Tone } from './ui';

interface HealthScoreCardProps {
  health: HealthScore;
  onOpenRepairs: () => void;
}

const scoreTone = (score: number): Tone => (score >= 80 ? 'good' : score >= 60 ? 'warn' : 'bad');
const TEXT_TONE: Record<string, string> = { good: 'text-good', warn: 'text-warn', bad: 'text-bad' };

export const HealthScoreCard: React.FC<HealthScoreCardProps> = ({ health, onOpenRepairs }) => {
  const tone = scoreTone(health.overall_score);
  const subs = [
    { label: 'Completeness', hint: 'how little is missing', value: health.sub_scores.completeness },
    { label: 'Distribution', hint: 'outliers and skew', value: health.sub_scores.distribution },
    { label: 'Parsimony', hint: 'no redundant columns', value: health.sub_scores.parsimony },
    { label: 'Encoding readiness', hint: 'categories a model can use', value: health.sub_scores.encoding_readiness },
  ];
  const repairs = health.repairs_applied ?? 0;

  return (
    <section className="panel grid gap-x-10 gap-y-6 p-6 lg:grid-cols-[200px_minmax(0,1fr)_minmax(0,1fr)]" aria-label="Data health">
      <div>
        <p className="text-sm font-medium text-ink-3">Health score</p>
        <p className={`mt-1 flex items-baseline gap-1 ${TEXT_TONE[tone]}`}>
          <span className="text-[3.5rem] font-semibold leading-none tabular-nums">{Math.round(health.overall_score)}</span>
          <span className="text-lg text-ink-3">/ 100</span>
        </p>
        <div className="mt-3">
          <Badge tone={tone}>Grade {health.grade}</Badge>
        </div>
      </div>

      <div>
        <p className="mb-3 text-sm font-medium text-ink-3">What the score is made of</p>
        <ul className="space-y-3.5">
          {subs.map((s) => (
            <li key={s.label}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium">
                  {s.label} <span className="font-normal text-ink-3">· {s.hint}</span>
                </span>
                <span className="font-mono text-sm tabular-nums">{Math.round(s.value)}</span>
              </div>
              <MeterBar value={s.value} tone={scoreTone(s.value)} className="mt-1.5" />
            </li>
          ))}
        </ul>
      </div>

      <div>
        <p className="mb-3 text-sm font-medium text-ink-3">Needs attention</p>
        {health.critical_issues.length > 0 ? (
          <ul className="space-y-2">
            {health.critical_issues.map((issue, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-bad" aria-hidden />
                <span>{issue}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="flex items-center gap-2.5 text-sm">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-good" aria-hidden />
            No critical issues found.
          </p>
        )}
        {repairs > 0 && (
          <button type="button" onClick={onOpenRepairs} className="btn btn-sm mt-4">
            <Wrench className="h-4 w-4" aria-hidden />
            {repairs} automatic {repairs === 1 ? 'repair' : 'repairs'} applied
          </button>
        )}
      </div>
    </section>
  );
};
