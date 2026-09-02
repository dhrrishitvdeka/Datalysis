import type { AnalysisResponse, SampleDatasetInfo, CleaningReport } from '../types';

const API_BASE = '/api';

export async function fetchSampleDatasets(): Promise<SampleDatasetInfo[]> {
  const res = await fetch(`${API_BASE}/sample-datasets`);
  if (!res.ok) throw new Error("Failed to load sample datasets");
  const data = await res.json();
  return data.samples;
}

export async function loadSampleDataset(sampleId: string): Promise<AnalysisResponse> {
  const res = await fetch(`${API_BASE}/load-sample/${sampleId}`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to load sample' }));
    throw new Error(err.detail || 'Failed to load sample');
  }
  return res.json();
}

export async function uploadDatasetFile(file: File): Promise<AnalysisResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to parse and analyze file' }));
    throw new Error(err.detail || 'Upload failed');
  }

  return res.json();
}

export async function sendChatMessage(query: string): Promise<{ answer: string; suggested_followups: string[] }> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Chat error' }));
    throw new Error(err.detail || 'Chat query failed');
  }

  return res.json();
}

export async function executePreprocessing(): Promise<CleaningReport> {
  const res = await fetch(`${API_BASE}/process`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Preprocessing execution failed' }));
    throw new Error(err.detail || 'Execution failed');
  }
  return res.json();
}

export function getCleanedDownloadUrl(): string {
  return `${API_BASE}/download-cleaned`;
}

export function getPipelineDownloadUrl(): string {
  return `${API_BASE}/download-pipeline`;
}

export function getReportDownloadUrl(): string {
  return `${API_BASE}/download-report`;
}

export async function fetchScatterData(x: string, y: string, hue?: string): Promise<{
  points: { x: number; y: number; hue?: string | null }[];
  stats?: { slope: number; intercept: number; r_value: number; r_squared: number; total_points: number } | null;
}> {
  const params = new URLSearchParams({ x, y });
  if (hue) params.append('hue', hue);
  const res = await fetch(`${API_BASE}/visualize/scatter?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to load scatter data");
  return res.json();
}

export async function fetchGroupedData(cat: string, num: string): Promise<{
  groups: { category: string; count: number; mean: number; median: number; q25: number; q75: number; min: number; max: number }[];
}> {
  const params = new URLSearchParams({ cat, num });
  const res = await fetch(`${API_BASE}/visualize/grouped?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to load grouped metric data");
  return res.json();
}

export async function fetchMissingnessMatrix(): Promise<{
  columns: string[];
  total_rows: number;
  chunks: { row_start: number; row_end: number; missing_pcts: Record<string, number> }[];
}> {
  const res = await fetch(`${API_BASE}/visualize/missingness`);
  if (!res.ok) throw new Error("Failed to load missingness matrix");
  return res.json();
}
