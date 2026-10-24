import React, { useMemo, useState } from 'react';
import { AlertTriangle, Check, Copy, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReasoningStep } from '../types';
import { Badge } from './ui';
import type { Tone } from './ui';

interface ReasoningTraceProps {
  trace: ReasoningStep[];
  rulesCount: number;
}

// Phases that deserve attention get a tone and an icon; every other phase stays neutral
const PHASE_STYLE: Record<string, { icon: LucideIcon; tone: Tone }> = {
  DATA_QUALITY_REPAIR: { icon: Wrench, tone: 'good' },
  DATASET_WARNING: { icon: AlertTriangle, tone: 'warn' },
};

const phaseLabel = (p: string) => {
  const words = p.toLowerCase().replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

export const ReasoningTrace: React.FC<ReasoningTraceProps> = ({ trace, rulesCount }) => {
  const [copied, setCopied] = useState(false);
  const [phase, setPhase] = useState<string | null>(null);

  const phases = useMemo(() => Array.from(new Set(trace.map((t) => t.phase))), [trace]);
  const shown = useMemo(
    () => trace.map((step, i) => ({ step, n: i + 1 })).filter(({ step }) => !phase || step.phase === phase),
    [trace, phase]
  );

  const handleCopy = () => {
    const text = trace.map((t) => `[${t.phase}] ${t.message}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="panel overflow-hidden" aria-label="Rule log">
      <div className="panel-head">
        <div>
          <h2 className="panel-title">{trace.length} steps, {rulesCount} rules evaluated</h2>
          <p className="panel-sub">Filter by phase to follow one part of the analysis.</p>
        </div>
        <button type="button" className="btn btn-sm" onClick={handleCopy}>
          {copied ? <Check className="h-4 w-4 text-good" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
          {copied ? 'Copied' : 'Copy log'}
        </button>
      </div>

      {phases.length > 1 && (
        <div className="border-b border-line px-5 py-3">
          <div className="seg" role="group" aria-label="Filter by phase">
            <button type="button" aria-pressed={phase === null} onClick={() => setPhase(null)}>
              All phases
            </button>
            {phases.map((p) => (
              <button key={p} type="button" aria-pressed={phase === p} onClick={() => setPhase(phase === p ? null : p)}>
                {phaseLabel(p)}
              </button>
            ))}
          </div>
        </div>
      )}

      <ol className="max-h-[70vh] divide-y divide-line overflow-y-auto">
        {shown.map(({ step, n }) => {
          const style = PHASE_STYLE[step.phase];
          return (
            <li key={n} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-3 gap-y-1 px-5 py-3 sm:grid-cols-[2.5rem_11rem_minmax(0,1fr)]">
              <span className="pt-0.5 text-right font-mono text-sm tabular-nums text-ink-3">{n}</span>
              <span className="pt-0.5">
                <Badge tone={style?.tone ?? 'neutral'} icon={style?.icon}>
                  {phaseLabel(step.phase)}
                </Badge>
              </span>
              <p className="col-start-2 text-ink-2 sm:col-start-3">{step.message}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
};
