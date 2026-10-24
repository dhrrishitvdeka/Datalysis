import React from 'react';
import { Target } from 'lucide-react';

interface TargetNoteProps {
  target: string | null;
}

/** Reminds the user that the chosen target is skipped by every cleaning step. */
export const TargetNote: React.FC<TargetNoteProps> = ({ target }) => {
  if (!target) return null;
  return (
    <div className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-mono flex items-center gap-2">
      <Target className="w-3.5 h-3.5 shrink-0" />
      <span>
        Target '{target}' is protected: never transformed, rows with a missing target are dropped, and it is kept as the last column.
      </span>
    </div>
  );
};
