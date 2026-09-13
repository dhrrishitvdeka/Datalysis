import type {
  AnalysisResponse,
  SampleDatasetInfo,
  CleaningReport,
  ProcessRequest,
  TargetAnalysisResponse,
} from '../types';

const API_BASE = '/api';

// Maintain user session token across requests
let currentSessionId: string | null = null;

export function getSessionId(): string | null {
  return currentSessionId;
}

export function setSessionId(sid: string | null): void {
  currentSessionId = sid;
}

function getHeaders(extra?: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  if (currentSessionId) {
    headers['X-Session-ID'] = currentSessionId;
  }
  return headers;
}

export async function fetchSampleDatasets(): Promise<SampleDatasetInfo[]> {
  const res = await fetch(`${API_BASE}/sample-datasets`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to load sample datasets");
  const data = await res.json();
  return data.samples;
}

export async function loadSampleDataset(sampleId: string): Promise<AnalysisResponse> {
  const res = await fetch(`${API_BASE}/load-sample/${sampleId}`, {
    method: 'POST',
    headers: getHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to load sample' }));
    throw new Error(err.detail || 'Failed to load sample');
  }
  const data: AnalysisResponse = await res.json();
  if (data.session_id) {
    currentSessionId = data.session_id;
  }
  return data;
}

export async function uploadDatasetFile(file: File): Promise<AnalysisResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    headers: getHeaders(),
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Failed to parse and analyze file' }));
    throw new Error(err.detail || 'Upload failed');
  }

  const data: AnalysisResponse = await res.json();
  if (data.session_id) {
    currentSessionId = data.session_id;
  }
  return data;
}

export async function executePreprocessing(recipePayload?: ProcessRequest): Promise<CleaningReport> {
  const options: RequestInit = {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
  };
  if (recipePayload) {
    options.body = JSON.stringify(recipePayload);
  }

  const res = await fetch(`${API_BASE}/process`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Preprocessing execution failed' }));
    throw new Error(err.detail || 'Execution failed');
  }
  return res.json();
}

export async function analyzeTarget(targetCol: string): Promise<TargetAnalysisResponse> {
  const params = new URLSearchParams({ target: targetCol });
  const res = await fetch(`${API_BASE}/supervised/target-analysis?${params.toString()}`, {
    method: 'POST',
    headers: getHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Target analysis failed' }));
    throw new Error(err.detail || 'Target analysis failed');
  }
  return res.json();
}

export function getCleanedDownloadUrl(format: string = 'csv'): string {
  const params = new URLSearchParams({ format });
  if (currentSessionId) params.append('session_id', currentSessionId);
  return `${API_BASE}/download-cleaned?${params.toString()}`;
}

export function getPipelineDownloadUrl(): string {
  if (currentSessionId) {
    return `${API_BASE}/download-pipeline?session_id=${encodeURIComponent(currentSessionId)}`;
  }
  return `${API_BASE}/download-pipeline`;
}

export function getReportDownloadUrl(): string {
  if (currentSessionId) {
    return `${API_BASE}/download-report?session_id=${encodeURIComponent(currentSessionId)}`;
  }
  return `${API_BASE}/download-report`;
}

export function getNotebookDownloadUrl(): string {
  if (currentSessionId) {
    return `${API_BASE}/export/notebook?session_id=${encodeURIComponent(currentSessionId)}`;
  }
  return `${API_BASE}/export/notebook`;
}

export function getSchemaDownloadUrl(): string {
  if (currentSessionId) {
    return `${API_BASE}/export/schema?session_id=${encodeURIComponent(currentSessionId)}`;
  }
  return `${API_BASE}/export/schema`;
}

export async function fetchScatterData(x: string, y: string, hue?: string): Promise<{
  points: { x: number; y: number; hue?: string | null }[];
  stats?: { slope: number; intercept: number; r_value: number; r_squared: number; total_points: number } | null;
}> {
  const params = new URLSearchParams({ x, y });
  if (hue) params.append('hue', hue);
  const res = await fetch(`${API_BASE}/visualize/scatter?${params.toString()}`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to load scatter data");
  return res.json();
}

export async function fetchGroupedData(cat: string, num: string): Promise<{
  groups: { category: string; count: number; mean: number; median: number; q25: number; q75: number; min: number; max: number }[];
}> {
  const params = new URLSearchParams({ cat, num });
  const res = await fetch(`${API_BASE}/visualize/grouped?${params.toString()}`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to load grouped metric data");
  return res.json();
}

export async function fetchMissingnessMatrix(): Promise<{
  columns: string[];
  total_rows: number;
  chunks: { row_start: number; row_end: number; missing_pcts: Record<string, number> }[];
}> {
  const res = await fetch(`${API_BASE}/visualize/missingness`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to load missingness matrix");
  return res.json();
}
