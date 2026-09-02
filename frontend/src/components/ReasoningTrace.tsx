import React, { useState } from 'react';
import { Terminal, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import type { ReasoningStep } from '../types';

interface ReasoningTraceProps {
  trace: ReasoningStep[];
  rulesCount: number;
}

export const ReasoningTrace: React.FC<ReasoningTraceProps> = ({ trace, rulesCount }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = trace.map(t => `[${t.phase}] ${t.message}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl glass-card overflow-hidden">
      {/* Header bar */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-2.5 flex items-center justify-between bg-zinc-950/80 cursor-pointer hover:bg-zinc-900/60 transition"
      >
        <div className="flex items-center space-x-2.5">
          <Terminal className="w-4 h-4 text-zinc-400" />
          <div className="flex items-center space-x-2">
            <span className="text-xs font-medium text-zinc-300">
              Expert Rule Inference Stream
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-900 text-zinc-400 border border-white/[0.06]">
              {rulesCount} Rules Evaluated
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCopy();
            }}
            className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
            title="Copy audit log"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          {isOpen ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
        </div>
      </div>

      {/* Expandable Body */}
      {isOpen && (
        <div className="p-3 bg-black/90 font-mono text-xs space-y-1.5 max-h-64 overflow-y-auto border-t border-white/[0.04]">
          {trace.map((step, idx) => (
            <div key={idx} className="flex items-start space-x-2 py-0.5 border-b border-zinc-900 last:border-0">
              <span className="text-zinc-600 select-none text-[10px] mt-0.5">{(idx + 1).toString().padStart(2, '0')}</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-900 text-zinc-400 border border-zinc-800 uppercase tracking-wider font-mono">
                {step.phase}
              </span>
              <span className="text-zinc-300 leading-relaxed font-sans text-xs flex-1">
                {step.message}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
