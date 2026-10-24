import React from 'react';
import {
  BarChart2,
  Code2,
  FileCheck,
  GitFork,
  LayoutDashboard,
  LineChart,
  ScrollText,
  SlidersHorizontal,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type ViewId =
  | 'overview'
  | 'repairs'
  | 'visualizer'
  | 'trace'
  | 'recommendations'
  | 'distributions'
  | 'correlations'
  | 'pipeline'
  | 'cleaned';

export interface ViewDef {
  id: ViewId;
  label: string;
  icon: LucideIcon;
  group: 'Understand' | 'Decide' | 'Deliver';
  title: string;
  blurb: string;
}

export const VIEWS: ViewDef[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, group: 'Understand', title: 'Overview', blurb: 'How healthy the data is, how big it is, and what every column contains.' },
  { id: 'repairs', label: 'Data repairs', icon: Wrench, group: 'Understand', title: 'Data repairs', blurb: 'Problems fixed automatically before profiling. Your original file is never changed.' },
  { id: 'visualizer', label: 'Profiler', icon: LineChart, group: 'Understand', title: 'Profiler', blurb: 'Inspect one column, compare two, or see where values are missing.' },
  { id: 'trace', label: 'Rule log', icon: ScrollText, group: 'Understand', title: 'Rule log', blurb: 'Each step the expert system took to reach its recommendations, in order.' },
  { id: 'recommendations', label: 'Recipe', icon: SlidersHorizontal, group: 'Decide', title: 'Recipe', blurb: 'Decide what happens to each column. Defaults are the rules’ recommendations.' },
  { id: 'distributions', label: 'Outliers', icon: BarChart2, group: 'Decide', title: 'Outliers', blurb: 'Values beyond Tukey’s 1.5 × IQR fences, and the suggested treatment.' },
  { id: 'correlations', label: 'Collinearity', icon: GitFork, group: 'Decide', title: 'Collinearity', blurb: 'Numeric features that carry nearly the same information.' },
  { id: 'pipeline', label: 'Pipeline code', icon: Code2, group: 'Deliver', title: 'Pipeline code', blurb: 'A scikit-learn script that applies this recipe to new data.' },
  { id: 'cleaned', label: 'Clean and export', icon: FileCheck, group: 'Deliver', title: 'Clean and export', blurb: 'Run the recipe, compare before and after, then download the result.' },
];

const GROUPS: ViewDef['group'][] = ['Understand', 'Decide', 'Deliver'];

interface SideNavProps {
  active: ViewId;
  onSelect: (id: ViewId) => void;
  counts: Partial<Record<ViewId, number>>;
}

const Count: React.FC<{ n?: number }> = ({ n }) =>
  n && n > 0 ? (
    <span className="ml-auto rounded-md bg-sunken px-1.5 text-xs font-medium tabular-nums text-ink-2">{n}</span>
  ) : null;

export const SideNav: React.FC<SideNavProps> = ({ active, onSelect, counts }) => (
  <>
    {/* Wide screens: grouped rail */}
    <nav aria-label="Analysis sections" className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 overflow-y-auto border-r border-line bg-surface px-3 py-5 lg:block">
      {GROUPS.map((group) => (
        <div key={group} className="mb-6">
          <p className="mb-1.5 px-3 text-sm font-semibold text-ink-3">{group}</p>
          <ul className="space-y-0.5">
            {VIEWS.filter((v) => v.group === group).map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  className="nav-item"
                  aria-current={active === v.id ? 'page' : undefined}
                  onClick={() => onSelect(v.id)}
                >
                  <v.icon className="h-4 w-4 shrink-0" aria-hidden />
                  <span>{v.label}</span>
                  <Count n={counts[v.id]} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>

    {/* Narrow screens: one scrolling row under the header */}
    <nav aria-label="Analysis sections" className="no-scrollbar sticky top-14 z-30 flex gap-1 overflow-x-auto border-b border-line bg-surface px-3 py-2 lg:hidden">
      {VIEWS.map((v) => (
        <button
          key={v.id}
          type="button"
          className="nav-item !w-auto shrink-0 whitespace-nowrap"
          aria-current={active === v.id ? 'page' : undefined}
          onClick={() => onSelect(v.id)}
        >
          <v.icon className="h-4 w-4 shrink-0" aria-hidden />
          <span>{v.label}</span>
          <Count n={counts[v.id]} />
        </button>
      ))}
    </nav>
  </>
);
