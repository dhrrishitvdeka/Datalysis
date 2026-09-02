import React, { useState, useRef } from 'react';
import { UploadCloud, Database, ArrowRight, ShieldCheck, Cpu, Terminal, Binary } from 'lucide-react';
import type { SampleDatasetInfo } from '../types';

interface UploadZoneProps {
  onFileUpload: (file: File) => void;
  onSampleSelect: (sampleId: string) => void;
  sampleDatasets: SampleDatasetInfo[];
  isLoading: boolean;
}

export const UploadZone: React.FC<UploadZoneProps> = ({
  onFileUpload,
  onSampleSelect,
  sampleDatasets,
  isLoading,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileUpload(e.target.files[0]);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 sm:px-6">
      {/* Hero Section */}
      <div className="text-center space-y-3 mb-10 flex flex-col items-center">
        <div className="w-14 h-14 rounded-2xl overflow-hidden border border-white/15 shadow-2xl mb-1 bg-zinc-950 flex items-center justify-center">
          <img src="/logo.png" alt="Datalysis Logo" className="w-full h-full object-cover" />
        </div>

        <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded-full bg-zinc-900 border border-white/[0.08] text-zinc-400 text-xs font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>Deterministic Expert System • 100% Local Intelligence</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">
          Data Preprocessing & Imputation Diagnostics
        </h1>
        <p className="text-sm text-zinc-400 max-w-xl mx-auto leading-relaxed">
          Upload any spreadsheet, CSV, TSV, or tabular file. Evaluates statistical facts, missingness mechanisms, and distribution anomalies using production rules.
        </p>
      </div>

      {/* Upload Drag & Drop Container */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative cursor-pointer rounded-xl p-10 text-center transition-all duration-200 glass-card ${
          isDragOver
            ? 'border-white/40 bg-zinc-900/90'
            : 'border-white/[0.08] hover:border-white/20 hover:bg-zinc-900/40'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".csv,.tsv,.txt,.tab,.xlsx,.xls,.json,.jsonl,.parquet,.pqt,.feather"
          className="hidden"
        />

        {isLoading ? (
          <div className="py-8 space-y-3">
            <div className="w-10 h-10 mx-auto border-2 border-zinc-700 border-t-white rounded-full animate-spin" />
            <div className="space-y-1">
              <h3 className="text-sm font-medium text-white font-mono">Running Rule Inferences...</h3>
              <p className="text-xs text-zinc-500 font-mono">Extracting statistical facts • Evaluating rules</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="w-12 h-12 mx-auto rounded-lg bg-zinc-900 border border-white/10 flex items-center justify-center text-zinc-300">
              <UploadCloud className="w-6 h-6" />
            </div>

            <div>
              <p className="text-sm font-medium text-zinc-200">
                Drop your dataset here, or <span className="text-white underline underline-offset-4">browse</span>
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                Auto-detects delimiters (comma, tab, semicolon, pipe) and UTF-8/Latin-1 encodings
              </p>
            </div>

            {/* Supported formats */}
            <div className="flex flex-wrap justify-center gap-1.5 pt-1">
              {['CSV', 'TSV', 'Excel (.xlsx)', 'JSON', 'Parquet'].map((fmt) => (
                <span
                  key={fmt}
                  className="px-2 py-0.5 rounded bg-zinc-900 border border-white/[0.06] text-[11px] font-mono text-zinc-400"
                >
                  {fmt}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Feature Specs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6">
        <div className="p-4 rounded-xl glass-card space-y-1.5">
          <div className="flex items-center space-x-2 text-zinc-300">
            <Cpu className="w-3.5 h-3.5 text-zinc-400" />
            <h4 className="text-xs font-semibold uppercase tracking-wider">Zero LLM Dependencies</h4>
          </div>
          <p className="text-xs text-zinc-500 leading-relaxed">
            100% deterministic rule base using Tukey's IQR, skewness tests, and Little's MCAR heuristics.
          </p>
        </div>

        <div className="p-4 rounded-xl glass-card space-y-1.5">
          <div className="flex items-center space-x-2 text-zinc-300">
            <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
            <h4 className="text-xs font-semibold uppercase tracking-wider">Imputation & Outlier Recipes</h4>
          </div>
          <p className="text-xs text-zinc-500 leading-relaxed">
            Per-feature recommendations: median/mean, MICE multivariate, Winsorization, and power transforms.
          </p>
        </div>

        <div className="p-4 rounded-xl glass-card space-y-1.5">
          <div className="flex items-center space-x-2 text-zinc-300">
            <Terminal className="w-3.5 h-3.5 text-zinc-400" />
            <h4 className="text-xs font-semibold uppercase tracking-wider">Pipeline Synthesis</h4>
          </div>
          <p className="text-xs text-zinc-500 leading-relaxed">
            One-click Scikit-Learn `ColumnTransformer` script generation and cleaned dataset export.
          </p>
        </div>
      </div>

      {/* Sample Datasets */}
      <div className="mt-10 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Or Test With Sample Datasets
          </span>
          <span className="text-[11px] text-zinc-600 font-mono">1-click instant audit</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {sampleDatasets.map((s) => (
            <div
              key={s.id}
              onClick={() => onSampleSelect(s.id)}
              className="p-4 rounded-xl glass-card hover:bg-zinc-900/60 cursor-pointer transition group flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-white/[0.06]">
                    {s.id.toUpperCase()}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-200 group-hover:translate-x-0.5 transition" />
                </div>
                <h4 className="text-xs font-semibold text-zinc-200 mt-2 group-hover:text-white transition">
                  {s.name}
                </h4>
                <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                  {s.description}
                </p>
              </div>

              <div className="pt-2 border-t border-white/[0.04] text-[11px] text-zinc-400 font-mono flex items-center justify-between">
                <span>Auto-Diagnose</span>
                <span className="text-zinc-300">Load & Audit →</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
