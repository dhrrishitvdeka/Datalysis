import React from 'react';
import { Database, FileSpreadsheet, RefreshCw, Layers, Table, BarChart2, GitFork, Code2, CheckCircle, LineChart } from 'lucide-react';
import type { AnalysisResponse } from '../types';

interface NavbarProps {
  data: AnalysisResponse | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onReset: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ data, activeTab, setActiveTab, onReset }) => {
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
    { id: 'visualizer', label: 'Visualizer', icon: LineChart },
    { id: 'recommendations', label: 'Feature Recipes', icon: Table },
    { id: 'distributions', label: 'Distributions', icon: BarChart2 },
    { id: 'correlations', label: 'Collinearity', icon: GitFork },
    { id: 'pipeline', label: 'Pipeline Code', icon: Code2 },
    { id: 'cleaned', label: 'Cleaned Data', icon: CheckCircle },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-black/80 backdrop-blur-2xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          {/* Brand */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={onReset}>
            <div className="w-7 h-7 rounded-md bg-zinc-950 border border-white/10 flex items-center justify-center overflow-hidden">
              <img src="/logo.png" alt="Datalysis" className="w-full h-full object-cover" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="font-semibold text-sm tracking-tight text-white">Datalysis</span>
              <span className="text-[10px] uppercase font-mono tracking-widest text-zinc-500 px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800">
                v1.0 • Expert Engine
              </span>
            </div>
          </div>

          {/* Active Dataset Stats Badge */}
          {data && (
            <div className="hidden md:flex items-center space-x-2">
              <div className="flex items-center space-x-2 px-2.5 py-1 rounded-md bg-zinc-950 border border-white/[0.06] text-xs text-zinc-300">
                <FileSpreadsheet className="w-3.5 h-3.5 text-zinc-400" />
                <span className="font-medium max-w-[130px] truncate text-zinc-200">{data.metadata.filename}</span>
                <span className="text-zinc-600">/</span>
                <span className="font-mono text-zinc-400">{data.metadata.rows.toLocaleString()} rows</span>
                <span className="text-zinc-600">×</span>
                <span className="font-mono text-zinc-400">{data.metadata.columns} cols</span>
              </div>

              {health && (
                <div className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-md border text-xs font-mono font-medium ${getGradeBadge(health.grade)}`}>
                  <span>Score {health.overall_score}</span>
                  <span className="text-[10px] px-1 rounded bg-black/40">Grade {health.grade}</span>
                </div>
              )}
            </div>
          )}

          {/* Right Action */}
          <div className="flex items-center space-x-2">
            {data && (
              <button
                onClick={onReset}
                className="flex items-center space-x-1 px-2.5 py-1 rounded-md text-xs font-medium text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 border border-transparent hover:border-zinc-800 transition"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Upload New</span>
              </button>
            )}
          </div>
        </div>

        {/* Minimal Navigation Tabs */}
        {data && (
          <div className="flex space-x-1 overflow-x-auto py-1.5 border-t border-white/[0.04] no-scrollbar">
            {navItems.map((item) => {
              const active = activeTab === item.id;
              const Icon = item.icon;
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
                </button>
              );
            })}
          </div>
        )}
      </div>
    </header>
  );
};
