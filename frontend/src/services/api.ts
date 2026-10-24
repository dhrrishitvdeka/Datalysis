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

/** Options shared by upload and sample loading. */
export interface LoadOptions {
  autoRepair?: boolean; // apply the R-QLT data-quality repairs (backend default: true)
  sheet?: string; // Excel sheet name (uploads only)
}

/** Builds "?auto_repair=...&sheet=..." from the options, or "" when none are set. */
function loadQuery(opts?: LoadOptions): string {
  const params = new URLSearchParams();
  if (opts?.autoRepair !== undefined) params.set('auto_repair', String(opts.autoRepair));
  if (opts?.sheet) params.set('sheet', opts.sheet);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

/**
 * Reads the backend's error message. FastAPI sends {"detail": "text"} for
 * HTTPException (400, 413, ...) and {"detail": [{msg: ...}]} for 422 validation errors.
 */
async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body.detail === 'string') return body.detail;
    if (Array.isArray(body.detail) && body.detail.length > 0) {
      return body.detail.map((d: { msg?: string }) => d.msg ?? '').filter(Boolean).join('; ') || fallback;
    }
  } catch {
    // body was not JSON (e.g. a proxy error page)
  }
  return `${fallback} (HTTP ${res.status})`;
}

export async function fetchSampleDatasets(): Promise<SampleDatasetInfo[]> {
  const res = await fetch(`${API_BASE}/sample-datasets`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to load sample datasets");
  const data = await res.json();
  return data.samples;
}

export async function loadSampleDataset(sampleId: string, opts?: LoadOptions): Promise<AnalysisResponse> {
  const res = await fetch(`${API_BASE}/load-sample/${sampleId}${loadQuery(opts)}`, {
    method: 'POST',
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error(await readError(res, 'Failed to load sample'));
  const data: AnalysisResponse = await res.json();
  if (data.session_id) {
    currentSessionId = data.session_id;
  }
  return data;
}

export async function uploadDatasetFile(file: File, opts?: LoadOptions): Promise<AnalysisResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/upload${loadQuery(opts)}`, {
    method: 'POST',
    headers: getHeaders(),
    body: formData,
  });

  if (!res.ok) throw new Error(await readError(res, 'Failed to parse and analyze file'));

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
  if (!res.ok) throw new Error(await readError(res, 'Preprocessing execution failed'));
  return res.json();
}

export async function analyzeTarget(targetCol: string): Promise<TargetAnalysisResponse> {
  const params = new URLSearchParams({ target: targetCol });
  const res = await fetch(`${API_BASE}/supervised/target-analysis?${params.toString()}`, {
    method: 'POST',
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error(await readError(res, 'Target analysis failed'));
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
