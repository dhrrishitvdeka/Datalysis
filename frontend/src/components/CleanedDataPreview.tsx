import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, ChevronDown, Code2, Database, Download, FileCheck, FileSpreadsheet, Play } from 'lucide-react';
import type { CleaningReport, ProcessRequest, RecipeOverride } from '../types';
import { executePreprocessing, getCleanedDownloadUrl, getNotebookDownloadUrl, getSchemaDownloadUrl } from '../services/api';
import { DataDiffViewer } from './DataDiffViewer';
import { TargetNote } from './TargetNote';
import { Badge, EmptyState, Notice } from './ui';

interface CleanedDataPreviewProps {
  initialReport: CleaningReport | null;
  rawPreview?: Record<string, any>[];
  customRecipe?: Record<string, RecipeOverride>;
  targetColumn?: string | null;
  onReportChange?: (report: CleaningReport) => void;
}

const DOWNLOADS = [
  { icon: Download, label: 'CSV', detail: '.csv', href: () => getCleanedDownloadUrl('csv') },
  { icon: FileSpreadsheet, label: 'Excel', detail: '.xlsx, multi-sheet', href: () => getCleanedDownloadUrl('excel') },
  { icon: Database, label: 'Parquet', detail: '.parquet', href: () => getCleanedDownloadUrl('parquet') },
  { icon: Database, label: 'SQLite database', detail: '.db', href: () => getCleanedDownloadUrl('sqlite') },
  { icon: BookOpen, label: 'Jupyter notebook', detail: '.ipynb, the pipeline explained', href: () => getNotebookDownloadUrl() },
  { icon: Code2, label: 'Pandera schema', detail: '.py, validates future data', href: () => getSchemaDownloadUrl() },
];

export const CleanedDataPreview: React.FC<CleanedDataPreviewProps> = ({
  initialReport,
  rawPreview = [],
  customRecipe = {},
  targetColumn = null,
  onReportChange,
}) => {
  const [report, setReport] = useState<CleaningReport | null>(initialReport);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const overrides = Object.keys(customRecipe).length;

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const handleRunPreprocessing = async () => {
    setLoading(true);
    setError(null);
    try {
      // The target lets the backend protect it; with no overrides and no target the body stays empty
      const payload: ProcessRequest | undefined =
        overrides > 0 || targetColumn
          ? {
              ...(overrides > 0 && { column_overrides: customRecipe }),
              ...(targetColumn && { target_column: targetColumn }),
            }
          : undefined;
      const res = await executePreprocessing(payload);
      setReport(res);
      onReportChange?.(res);
    } catch (err: any) {
      setError(err.message || 'Preprocessing execution failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="panel flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="max-w-2xl">
          <h2 className="panel-title flex flex-wrap items-center gap-2">
            {report ? 'Cleaning finished' : 'Ready to clean'}
            {overrides > 0 && <Badge tone="accent">Your recipe: {overrides} edited</Badge>}
          </h2>
          <p className="panel-sub">
            Drops columns, fills gaps, treats outliers, scales and encodes, following {overrides > 0 ? 'your edited recipe' : 'the recommended recipe'}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-primary" onClick={handleRunPreprocessing} disabled={loading}>
            {loading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-accent-ink/40 border-t-accent-ink" /> Cleaning…
              </>
            ) : (
              <>
                <Play className="h-4 w-4" aria-hidden /> {report ? 'Run again' : 'Run cleaning'}
              </>
            )}
          </button>

          {report && (
            <div className="relative" ref={menuRef}>
              <button type="button" className="btn" aria-expanded={menuOpen} aria-haspopup="true" onClick={() => setMenuOpen((o) => !o)}>
                <Download className="h-4 w-4" aria-hidden /> Download
                <ChevronDown className="h-4 w-4 text-ink-3" aria-hidden />
              </button>
              {menuOpen && (
                <div className="absolute right-0 z-30 mt-2 w-72 rounded-xl bg-surface p-1.5 shadow-pop">
                  {DOWNLOADS.map(({ icon: Icon, label, detail, href }, i) => (
                    <React.Fragment key={label}>
                      {i === 4 && <div className="my-1 h-px bg-line" />}
                      <a
                        href={href()}
                        download
                        onClick={() => setMenuOpen(false)}
                        className="flex items-start gap-3 rounded-lg px-3 py-2 hover:bg-sunken"
                      >
                        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" aria-hidden />
                        <span>
                          <span className="block text-sm font-medium">{label}</span>
                          <span className="block text-xs text-ink-3">{detail}</span>
                        </span>
                      </a>
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <TargetNote target={targetColumn} />
      {error && (
        <Notice tone="bad" title="Cleaning failed">
          {error}
        </Notice>
      )}

      {report ? (
        <>
          <DataDiffViewer rawPreview={rawPreview} cleanedPreview={report.preview} report={report} />

          <section className="panel overflow-hidden">
            <div className="panel-head">
              <h3 className="panel-title">Steps that ran ({report.steps_executed.length})</h3>
            </div>
            <ol className="max-h-72 divide-y divide-line overflow-y-auto">
              {report.steps_executed.map((step, idx) => (
                <li key={idx} className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-3 px-5 py-2.5 text-sm">
                  <span className="text-right font-mono tabular-nums text-ink-3">{idx + 1}</span>
                  <span className="text-ink-2">{step}</span>
                </li>
              ))}
            </ol>
          </section>
        </>
      ) : (
        <EmptyState icon={FileCheck} title="Nothing has been cleaned yet">
          Choose “Run cleaning” to apply the recipe. You will see the data before and after, side by side, and can then download it.
        </EmptyState>
      )}
    </div>
  );
};
