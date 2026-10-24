import React from 'react';
import { Target } from 'lucide-react';

interface TargetNoteProps {
  target: string | null;
}

/** Reminds the user that the chosen target is skipped by every cleaning step. */
export const TargetNote: React.FC<TargetNoteProps> = ({ target }) => {
  if (!target) return null;
  return (
    <p className="flex items-start gap-3 rounded-lg bg-accent-soft px-4 py-3 text-sm text-ink-2">
      <Target className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
      <span>
        <strong className="font-mono text-ink">{target}</strong> is your target, so it is never transformed. Rows where it is missing
        are dropped, and it is kept as the last column.
      </span>
    </p>
  );
};
