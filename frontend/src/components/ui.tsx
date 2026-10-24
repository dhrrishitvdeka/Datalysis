import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, Search, Trash2, Wand2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ColumnRecommendation } from '../types';

export type Tone = 'neutral' | 'bad' | 'warn' | 'good' | 'info' | 'accent';

/** Column types arrive as snake_case ("categorical_nominal"); show them as words. */
export const fmtType = (t: string | undefined | null) => (t ?? '').replace(/_/g, ' ');

export const Badge: React.FC<{
  tone?: Tone;
  icon?: LucideIcon;
  title?: string;
  children: React.ReactNode;
}> = ({ tone = 'neutral', icon: Icon, title, children }) => (
  <span className={`badge badge-${tone}`} title={title}>
    {Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />}
    {children}
  </span>
);

const STATUS_META: Record<ColumnRecommendation['status'], { label: string; tone: Tone; icon: LucideIcon }> = {
  DROP_RECOMMENDED: { label: 'Drop', tone: 'bad', icon: Trash2 },
  CRITICAL_ATTENTION: { label: 'Critical', tone: 'bad', icon: AlertTriangle },
  REQUIRES_TRANSFORMATION: { label: 'Transform', tone: 'warn', icon: Wand2 },
  READY_WITH_PREPROCESSING: { label: 'Encode', tone: 'info', icon: Info },
  HEALTHY: { label: 'Healthy', tone: 'good', icon: CheckCircle2 },
};

export const StatusBadge: React.FC<{ status?: string }> = ({ status }) => {
  const meta = STATUS_META[status as ColumnRecommendation['status']] ?? STATUS_META.HEALTHY;
  return (
    <Badge tone={meta.tone} icon={meta.icon}>
      {meta.label}
    </Badge>
  );
};

/** Sort order for statuses, worst first. */
export const STATUS_RANK: Record<string, number> = {
  DROP_RECOMMENDED: 0,
  CRITICAL_ATTENTION: 1,
  REQUIRES_TRANSFORMATION: 2,
  READY_WITH_PREPROCESSING: 3,
  HEALTHY: 4,
};

const NOTICE_ICON: Record<'bad' | 'warn' | 'good' | 'info', LucideIcon> = {
  bad: AlertTriangle,
  warn: AlertTriangle,
  good: CheckCircle2,
  info: Info,
};

export const Notice: React.FC<{
  tone?: 'bad' | 'warn' | 'good' | 'info';
  title?: string;
  children?: React.ReactNode;
}> = ({ tone = 'info', title, children }) => {
  const Icon = NOTICE_ICON[tone];
  return (
    <div
      role={tone === 'bad' ? 'alert' : 'note'}
      className={`flex items-start gap-3 rounded-lg px-4 py-3 text-sm badge-${tone} !h-auto !whitespace-normal`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-0.5 text-ink-2' : ''}>{children}</div>}
      </div>
    </div>
  );
};

export const SearchBox: React.FC<{
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
}> = ({ value, onChange, placeholder, className = '' }) => (
  <label className={`relative block ${className}`}>
    <span className="sr-only">{placeholder}</span>
    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="field w-full pl-9"
    />
  </label>
);

export const EmptyState: React.FC<{
  icon?: LucideIcon;
  title: string;
  children?: React.ReactNode;
}> = ({ icon: Icon, title, children }) => (
  <div className="panel flex flex-col items-center px-6 py-14 text-center">
    {Icon && <Icon className="mb-3 h-7 w-7 text-ink-3" aria-hidden />}
    <h3 className="text-base font-semibold">{title}</h3>
    {children && <p className="mt-1 max-w-md text-sm text-ink-3">{children}</p>}
  </div>
);

/** A thin horizontal bar. Tone is chosen by the caller so it always agrees with the printed number. */
export const MeterBar: React.FC<{ value: number; tone?: Tone; className?: string }> = ({
  value,
  tone = 'accent',
  className = '',
}) => {
  const fill: Record<Tone, string> = {
    neutral: 'bg-ink-3',
    bad: 'bg-bad',
    warn: 'bg-warn',
    good: 'bg-good',
    info: 'bg-info',
    accent: 'bg-accent',
  };
  return (
    <div className={`h-1.5 overflow-hidden rounded-full bg-sunken ${className}`} aria-hidden>
      <div className={`h-full rounded-full ${fill[tone]}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
};

export interface PickerItem {
  name: string;
  meta?: string;
  flag?: { label: string; tone: Tone } | null;
}

/** Searchable list used wherever one column has to be chosen out of many. */
export const ColumnPicker: React.FC<{
  items: PickerItem[];
  selected: string | null;
  onSelect: (name: string) => void;
  heading?: string;
  maxHeight?: string;
}> = ({ items, selected, onSelect, heading = 'Columns', maxHeight = 'max-h-[560px]' }) => {
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? items.filter((i) => i.name.toLowerCase().includes(needle)) : items;
  }, [items, q]);

  return (
    <div className="panel flex min-h-0 flex-col overflow-hidden">
      <div className="space-y-2 border-b border-line p-3">
        <p className="px-1 text-sm font-semibold">
          {heading} <span className="font-normal text-ink-3">({items.length})</span>
        </p>
        {items.length > 8 && <SearchBox value={q} onChange={setQ} placeholder="Find a column" />}
      </div>
      <ul className={`min-h-0 flex-1 overflow-y-auto p-1.5 ${maxHeight}`}>
        {shown.map((item) => {
          const active = item.name === selected;
          return (
            <li key={item.name}>
              <button
                type="button"
                onClick={() => onSelect(item.name)}
                aria-current={active ? 'true' : undefined}
                className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left transition-colors ${
                  active ? 'bg-accent-soft text-accent' : 'hover:bg-sunken'
                }`}
              >
                <span className="min-w-0">
                  <span className={`block truncate font-mono text-sm ${active ? 'font-medium' : 'text-ink'}`}>
                    {item.name}
                  </span>
                  {item.meta && (
                    <span className={`block truncate text-xs ${active ? 'text-accent' : 'text-ink-3'}`}>{item.meta}</span>
                  )}
                </span>
                {item.flag && <Badge tone={item.flag.tone}>{item.flag.label}</Badge>}
              </button>
            </li>
          );
        })}
        {shown.length === 0 && <li className="px-3 py-6 text-center text-sm text-ink-3">No column matches “{q}”.</li>}
      </ul>
    </div>
  );
};

/** Label above a value, the standard way to show a single measurement. */
export const Measure: React.FC<{
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: 'default' | 'bad' | 'warn' | 'good';
}> = ({ label, value, hint, tone = 'default' }) => {
  const color = { default: 'text-ink', bad: 'text-bad', warn: 'text-warn', good: 'text-good' }[tone];
  return (
    <div className="min-w-0">
      <p className="text-sm text-ink-3">{label}</p>
      <p className={`break-words font-mono text-lg font-medium tabular-nums ${color}`}>{value}</p>
      {hint && <p className="truncate text-xs text-ink-3">{hint}</p>}
    </div>
  );
};

/** Compact number formatting for chart axes. */
export function fmtNum(v: number): string {
  if (!Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a !== 0 && (a >= 1e6 || a < 1e-3)) return v.toExponential(1);
  if (a >= 1000) return v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (a >= 100) return v.toFixed(0);
  if (a >= 1) return String(Math.round(v * 100) / 100);
  return String(Math.round(v * 1000) / 1000);
}
