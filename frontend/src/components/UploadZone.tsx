import React, { useRef, useState } from 'react';
import { FileUp, ShieldCheck } from 'lucide-react';
import type { SampleDatasetInfo } from '../types';
import { StatusBadge } from './ui';

interface UploadZoneProps {
  onFileUpload: (file: File) => void;
  onSampleSelect: (sampleId: string) => void;
  sampleDatasets: SampleDatasetInfo[];
  isLoading: boolean;
  autoRepair: boolean;
  onAutoRepairChange: (value: boolean) => void;
}

const OUTPUTS = [
  ['A dictionary of every column', 'Type, missing values, spread and the odd values that deserve a second look.'],
  ['A recipe for each column', 'Which imputation, scaling and encoding to use, with the rule that says why.'],
  ['A pipeline you can run', 'A scikit-learn script and notebook, plus the cleaned data as CSV, Excel or Parquet.'],
];

// Static illustration of the Overview page, so a first-time visitor sees what the tool produces
const EXAMPLE_ROWS = [
  { column: 'PassengerId', meta: 'identifier · 250 unique', missing: '0%', status: 'DROP_RECOMMENDED', note: 'An ID that leaks the target' },
  { column: 'Cabin', meta: 'categorical · 4 unique', missing: '78%', status: 'DROP_RECOMMENDED', note: 'Too sparse to fill in' },
  { column: 'Age', meta: 'numeric · 163 unique', missing: '21%', status: 'REQUIRES_TRANSFORMATION', note: 'Median, plus a missing flag' },
  { column: 'Fare', meta: 'numeric · skew 4.7', missing: '0%', status: 'REQUIRES_TRANSFORMATION', note: 'Log transform for the long tail' },
  { column: 'Embarked', meta: 'categorical · 3 unique', missing: '2%', status: 'READY_WITH_PREPROCESSING', note: 'Most frequent, then one-hot' },
];

/** "Messy Titanic Passengers (Classification)" -> "Titanic Passengers", for a compact button. */
const shortName = (name: string) => name.replace(/^Messy\s+/i, '').replace(/\s*\(.*\)\s*$/, '');

export const UploadZone: React.FC<UploadZoneProps> = ({
  onFileUpload,
  onSampleSelect,
  sampleDatasets,
  isLoading,
  autoRepair,
  onAutoRepairChange,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pick = () => {
    if (!isLoading) fileInputRef.current?.click();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (isLoading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) onFileUpload(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileUpload(file);
    e.target.value = ''; // lets the same file be chosen twice in a row
  };

  return (
    <div className="mx-auto max-w-[1280px] px-4 sm:px-8">
      {/* The whole first screen: promise, the file drop and a sample, with the proof beside it. No scrolling needed to start. */}
      <section className="grid items-center gap-x-16 gap-y-10 py-10 lg:min-h-[calc(100vh-3.5rem)] lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:py-8">
        <div>
          <h1 className="max-w-[22ch] text-balance text-4xl font-semibold leading-[1.08] tracking-tight sm:text-[2.875rem]">
            Find out what’s wrong with your data before you train on it
          </h1>
          <p className="mt-4 max-w-xl text-lg text-ink-2">
            Datalysis profiles every column, flags missing values and outliers, then writes the scikit-learn pipeline that fixes them.
          </p>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            className={`mt-7 rounded-2xl border-2 border-dashed p-5 transition-colors ${
              isDragOver ? 'border-accent bg-accent-soft' : 'border-line-strong bg-surface'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".csv,.tsv,.txt,.tab,.xlsx,.xls,.json,.jsonl,.parquet,.pqt,.feather"
              className="hidden"
              tabIndex={-1}
            />

            {isLoading ? (
              <div role="status" aria-live="polite" className="flex items-center gap-4 py-2">
                <span className="h-9 w-9 shrink-0 animate-spin rounded-full border-[3px] border-line-strong border-t-accent" />
                <div>
                  <p className="text-lg font-semibold">Profiling your data…</p>
                  <p className="text-sm text-ink-3">Reading the file, computing statistics, applying rules.</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-x-5 gap-y-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-sunken text-ink-2">
                  <FileUp className="h-6 w-6" aria-hidden />
                </span>
                <div className="min-w-0 flex-1 basis-56">
                  <p className="text-lg font-semibold">Drop a file here</p>
                  <p className="text-sm text-ink-3">CSV, TSV, Excel, JSON or Parquet. Delimiter and encoding are detected for you.</p>
                </div>
                <button type="button" onClick={pick} className="btn btn-primary !h-11 !px-6 !text-base">
                  Choose a file
                </button>
              </div>
            )}
          </div>

          <label className="mt-4 flex max-w-xl cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={autoRepair}
              onChange={(e) => onAutoRepairChange(e.target.checked)}
              disabled={isLoading}
              className="mt-1 h-4 w-4 shrink-0 accent-[rgb(var(--accent))]"
            />
            <span className="text-sm text-ink-2">
              <span className="font-semibold text-ink">Repair obvious data-entry problems first</span> (“N/A”, −999, “$1,200” stored as
              text). Each fix is listed under Data repairs.
            </span>
          </label>

          <div className="mt-6 border-t border-line pt-5">
            <p className="mb-3 text-sm font-medium text-ink-2">No file handy? Open a sample dataset</p>
            {sampleDatasets.length === 0 && <p className="text-sm text-ink-3">Samples load once the backend is running.</p>}
            <ul className="grid gap-3 sm:grid-cols-3">
              {sampleDatasets.map((s) => (
                <li key={s.id} className="flex">
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => onSampleSelect(s.id)}
                    title={`${s.name}. ${s.description}`}
                    className="group flex w-full flex-col rounded-xl border border-line bg-surface p-3.5 text-left transition-colors hover:border-accent hover:bg-sunken disabled:opacity-50"
                  >
                    <span className="text-sm font-semibold leading-snug">{shortName(s.name)}</span>
                    <span className="mt-1 line-clamp-2 text-xs text-ink-3 [@media(max-height:720px)]:hidden">{s.description}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <figure className="panel overflow-hidden" aria-label="Example of the column recommendations Datalysis produces">
          <div className="border-b border-line px-5 py-3.5">
            <p className="font-semibold">What you get for every column</p>
            <p className="text-sm text-ink-3">An example from the Titanic sample, not your data.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Column</th>
                  <th className="text-right">Missing</th>
                  <th>Recommendation</th>
                </tr>
              </thead>
              <tbody>
                {EXAMPLE_ROWS.map((r) => (
                  <tr key={r.column} className="h-[3.75rem]">
                    <td className="!py-2">
                      <span className="block font-mono font-medium">{r.column}</span>
                      <span className="block text-xs text-ink-3">{r.meta}</span>
                    </td>
                    <td className={`!py-2 text-right font-mono tabular-nums ${r.missing !== '0%' ? 'font-medium text-warn' : 'text-ink-3'}`}>
                      {r.missing}
                    </td>
                    <td className="!py-2">
                      <StatusBadge status={r.status} />
                      <span className="mt-0.5 block text-xs text-ink-3">{r.note}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="grid grid-cols-3 gap-4 border-t border-line bg-sunken/60 px-5 py-3.5">
            {[
              ['Health score', '72 / 100'],
              ['Cells missing', '9.2%'],
              ['Fixes suggested', '5 of 11 columns'],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-sm text-ink-3">{k}</dt>
                <dd className="font-mono text-base font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </figure>
      </section>

      {/* Below the fold: reference only, nothing needed to get started */}
      <section aria-labelledby="outputs-heading" className="border-t border-line py-12">
        <h2 id="outputs-heading" className="mb-6 text-xl">
          What you get back
        </h2>
        <dl className="grid gap-x-10 gap-y-6 md:grid-cols-3">
          {OUTPUTS.map(([term, detail]) => (
            <div key={term}>
              <dt className="font-semibold">{term}</dt>
              <dd className="mt-1 text-ink-3">{detail}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-10 flex items-start gap-3 rounded-xl bg-sunken px-5 py-4 text-ink-2">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-good" aria-hidden />
          <span>
            Everything runs on this computer. No data is uploaded and no language model is involved: every recommendation comes
            from a fixed statistical rule that you can read in the rule log.
          </span>
        </p>
      </section>
    </div>
  );
};
