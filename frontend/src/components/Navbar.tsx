import React from 'react';
import { FileSpreadsheet, RefreshCw, Layers, Table, BarChart2, GitFork, Code2, CheckCircle, LineChart } from 'lucide-react';
import type { AnalysisResponse } from '../types';

interface NavbarProps {
  data: AnalysisResponse | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onReset: () => void;
  tabCounts?: {
    recommendations?: number;
    distributions?: number;
    correlations?: number;
  };
}

export const Navbar: React.FC<NavbarProps> = ({ data, activeTab, setActiveTab, onReset, tabCounts }) => {
  const health = data?.inference.health_score;

  const getGradeBadge = (grade?: string) => {
    switch (grade) {
      case 'A+':
      case 'A':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'B':
        return 'text-sky-400 bg-sky-500/10 border-sky-500/20';
      case 'C':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      default:
        return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
    }
  };

  const navItems = [
    { id: 'overview', label: 'Overview', icon: Layers },
    { id: 'visualizer', label: 'Profiler', icon: LineChart },
    { id: 'recommendations', label: 'Recipes', icon: Table, count: tabCounts?.recommendations },
    { id: 'distributions', label: 'Outliers', icon: BarChart2, count: tabCounts?.distributions },
    { id: 'correlations', label: 'Collinearity', icon: GitFork, count: tabCounts?.correlations },
    { id: 'pipeline', label: 'Pipeline', icon: Code2 },
    { id: 'cleaned', label: 'Cleaned', icon: CheckCircle },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-black/85 backdrop-blur-2xl">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-12">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={onReset}>
            <div className="w-7 h-7 rounded-md bg-zinc-950 border border-white/10 flex items-center justify-center overflow-hidden">
              <img src="/logo.png" alt="Datalysis" className="w-full h-full object-cover" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="font-semibold text-sm tracking-tight text-white">Datalysis</span>
              <span className="hidden sm:inline text-[10px] uppercase font-mono tracking-widest text-zinc-500 px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                v1.0
              </span>
            </div>
          </div>

          {data && (
            <div className="hidden md:flex items-center space-x-2">
              <div className="flex items-center space-x-2 px-2.5 py-1 rounded-md bg-zinc-950 border border-white/[0.06] text-xs text-zinc-300">
                <FileSpreadsheet className="w-3.5 h-3.5 text-zinc-400" />
                <span className="font-medium max-w-[180px] truncate text-zinc-200">{data.metadata.filename}</span>
                <span className="text-zinc-600">/</span>
                <span className="font-mono tabular-nums text-zinc-400">{data.metadata.rows.toLocaleString()} × {data.metadata.columns}</span>
              </div>

              {health && (
                <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md border text-xs font-mono font-medium ${getGradeBadge(health.grade)}`}>
                  <span className="tabular-nums">{health.overall_score}</span>
                  <span className="text-[10px] px-1 rounded bg-black/40">{health.grade}</span>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center space-x-2">
            {data && (
              <button
                onClick={onReset}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 border border-transparent hover:border-zinc-800 transition"
              >
                <RefreshCw className="w-3 h-3" />
                <span>New file</span>
              </button>
            )}
          </div>
        </div>

        {data && (
          <div className="flex space-x-1 overflow-x-auto py-1.5 border-t border-white/[0.04] no-scrollbar">
            {navItems.map((item) => {
              const active = activeTab === item.id;
              const Icon = item.icon;
              const count = item.count ?? 0;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition flex items-center space-x-1.5 ${
                    active
                      ? 'bg-zinc-100 text-zinc-950 shadow-sm'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${active ? 'text-zinc-950' : 'text-zinc-500'}`} />
                  <span>{item.label}</span>
                  {count > 0 && (
                    <span
                      className={`text-[10px] font-mono tabular-nums px-1 rounded ${
                        active ? 'bg-zinc-900 text-zinc-100' : 'bg-zinc-800 text-zinc-300'
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </header>
  );
};
