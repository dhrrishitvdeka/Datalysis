import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  Code2,
  Download,
  FileJson,
  FileSpreadsheet,
  Laptop,
  Moon,
  RefreshCw,
  Sun,
  Target,
} from 'lucide-react';
import type { AnalysisResponse } from '../types';
import { useTheme } from '../context/ThemeContext';
import type { Theme } from '../context/ThemeContext';
import { getNotebookDownloadUrl, getPipelineDownloadUrl, getReportDownloadUrl } from '../services/api';

interface NavbarProps {
  data: AnalysisResponse | null;
  onReset: () => void;
  onOpenTargetModal: () => void;
  selectedTarget: string | null;
}

const THEMES: { id: Theme; label: string; icon: typeof Sun }[] = [
  { id: 'light', label: 'Light theme', icon: Sun },
  { id: 'system', label: 'Match system theme', icon: Laptop },
  { id: 'dark', label: 'Dark theme', icon: Moon },
];

const ThemeSwitch: React.FC = () => {
  const { theme, setTheme } = useTheme();
  return (
    <div className="seg !p-0.5" role="group" aria-label="Colour theme">
      {THEMES.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          aria-pressed={theme === id}
          aria-label={label}
          title={label}
          className="!h-8 !w-8 !justify-center !px-0"
          onClick={() => setTheme(id)}
        >
          <Icon className="h-4 w-4" aria-hidden />
        </button>
      ))}
    </div>
  );
};

const EXPORTS = [
  {
    icon: FileJson,
    label: 'Audit report',
    detail: 'JSON with every fact and rule that fired',
    href: getReportDownloadUrl(),
    download: undefined,
  },
  {
    icon: Code2,
    label: 'Pipeline script',
    detail: 'scikit-learn ColumnTransformer, .py',
    href: getPipelineDownloadUrl(),
    download: 'datalysis_pipeline.py',
  },
  {
    icon: BookOpen,
    label: 'Notebook',
    detail: 'The same pipeline with explanations, .ipynb',
    href: getNotebookDownloadUrl(),
    download: undefined,
  },
];

const ExportMenu: React.FC = () => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="btn"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
      >
        <Download className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">Export</span>
        <ChevronDown className="h-4 w-4 text-ink-3" aria-hidden />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl bg-surface p-1.5 shadow-pop">
          {EXPORTS.map(({ icon: Icon, label, detail, href, download }) => (
            <a
              key={label}
              href={href}
              download={download ?? true}
              onClick={() => setOpen(false)}
              className="flex items-start gap-3 rounded-lg px-3 py-2.5 hover:bg-sunken"
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" aria-hidden />
              <span>
                <span className="block text-sm font-medium">{label}</span>
                <span className="block text-xs text-ink-3">{detail}</span>
              </span>
            </a>
          ))}
          <p className="px-3 pb-1.5 pt-2 text-xs text-ink-3">
            To download the cleaned data itself, open Clean and export.
          </p>
        </div>
      )}
    </div>
  );
};

export const Navbar: React.FC<NavbarProps> = ({ data, onReset, onOpenTargetModal, selectedTarget }) => (
  <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
    <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
      <button type="button" onClick={onReset} className="flex shrink-0 items-center gap-2.5 rounded-lg pr-2" title="Back to start">
        <img src="/logo.png" alt="" className="h-7 w-7 rounded-md object-cover" />
        <span className="text-lg font-semibold tracking-tight">Datalysis</span>
      </button>

      {data && (
        <div className="hidden min-w-0 items-center gap-2 border-l border-line pl-4 sm:flex">
          <FileSpreadsheet className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />
          <span className="truncate text-sm font-medium" title={data.metadata.filename}>
            {data.metadata.filename}
          </span>
          <span className="shrink-0 text-sm tabular-nums text-ink-3">
            {data.metadata.rows.toLocaleString()} rows × {data.metadata.columns} columns
          </span>
        </div>
      )}

      <div className="ml-auto flex items-center gap-2">
        {data && (
          <>
            <button
              type="button"
              className={`btn ${selectedTarget ? '!border-accent !text-accent' : ''}`}
              onClick={onOpenTargetModal}
              title="Pick the column you want to predict. Datalysis then checks class balance, feature usefulness and leakage."
            >
              <Target className="h-4 w-4" aria-hidden />
              <span className="hidden max-w-[10rem] truncate md:inline">
                {selectedTarget ? `Target: ${selectedTarget}` : 'Set target'}
              </span>
            </button>
            <ExportMenu />
          </>
        )}
        <ThemeSwitch />
        {data && (
          <button type="button" className="btn btn-quiet" onClick={onReset} title="Discard this analysis and load another file">
            <RefreshCw className="h-4 w-4" aria-hidden />
            <span className="hidden lg:inline">New file</span>
          </button>
        )}
      </div>
    </div>
  </header>
);
