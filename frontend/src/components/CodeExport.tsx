import React, { useState } from 'react';
import { Code2, Copy, Check, Download } from 'lucide-react';
import { getPipelineDownloadUrl } from '../services/api';

interface CodeExportProps {
  code: string;
}

export const CodeExport: React.FC<CodeExportProps> = ({ code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="p-5 rounded-xl glass-card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <Code2 className="w-4 h-4 text-zinc-400" />
            <h3 className="text-sm font-semibold text-white font-mono">
              Scikit-Learn Preprocessing Pipeline
            </h3>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-900 text-zinc-400 border border-white/[0.06]">
              pipeline.py
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            Synthesized <code className="text-zinc-200">ColumnTransformer</code> pipeline with median/mean imputation, Winsorization, and encoders.
          </p>
        </div>

        <div className="flex items-center space-x-2 w-full sm:w-auto">
          <button
            onClick={handleCopy}
            className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs font-medium flex items-center justify-center space-x-1.5 border border-white/[0.08] transition"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy Script'}</span>
          </button>

          <a
            href={getPipelineDownloadUrl()}
            download="datalysis_pipeline.py"
            className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold flex items-center justify-center space-x-1.5 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download .py</span>
          </a>
        </div>
      </div>

      {/* Code Area */}
      <div className="rounded-xl glass-card overflow-hidden">
        <div className="px-4 py-2 bg-black border-b border-white/[0.06] flex items-center justify-between text-[11px] text-zinc-500 font-mono">
          <span>pipeline.py</span>
          <span>Python 3.9+</span>
        </div>

        <pre className="p-5 bg-black font-mono text-xs text-zinc-300 overflow-x-auto leading-relaxed max-h-[560px] overflow-y-auto">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
};
