export interface DatasetMetadata {
  filename: string;
  extension: string;
  file_size_kb: number;
  detected_encoding: string;
  detected_delimiter: string | null;
  format: string;
  rows: number;
  columns: number;
  sheet_name?: string;
  sample_name?: string;
}

export interface DatasetSummary {
  row_count: number;
  col_count: number;
  total_cells: number;
  total_missing_cells: number;
  overall_missing_pct: number;
  duplicate_rows: number;
  duplicate_pct: number;
  memory_mb: number;
  type_counts: Record<string, number>;
  columns_with_missing: number;
  columns_constant: number;
  columns_identifiers: number;
}

export interface NumericStats {
  min: number;
  max: number;
  mean: number;
  median: number;
  std: number;
  q25: number;
  q75: number;
  iqr: number;
  skewness: number;
  kurtosis: number;
  is_normally_distributed: boolean;
  zero_count: number;
  zero_pct: number;
  negative_count: number;
  outliers_iqr_count: number;
  outliers_iqr_pct: number;
  outliers_extreme_count: number;
  lower_bound_iqr: number;
  upper_bound_iqr: number;
  histogram: {
    bin_edges: number[];
    counts: number[];
  };
}

export interface CategoricalStats {
  top_categories: { category: string; count: number; percentage: number }[];
  rare_categories_count: number;
  mode_category: string | null;
  mode_frequency_pct: number;
  entropy: number;
}

export interface ColumnFact {
  name: string;
  raw_dtype: string;
  inferred_type: string;
  non_null_count: number;
  missing_count: number;
  missing_pct: number;
  unique_count: number;
  uniqueness_ratio: number;
  is_constant: boolean;
  is_binary: boolean;
  is_identifier: boolean;
  ordinal_order: string[] | null;
  sample_values: string[];
  numeric_stats: NumericStats | null;
  categorical_stats: CategoricalStats | null;
  datetime_stats?: {
    min_date: string;
    max_date: string;
    time_span_days: number;
    has_time: boolean;
  } | null;
}

export interface CorrelationPair {
  feature_a: string;
  feature_b: string;
  correlation: number;
  abs_correlation: number;
  severity: "CRITICAL" | "WARNING";
}

export interface HealthScore {
  overall_score: number;
  grade: "A+" | "A" | "B" | "C" | "D" | "F";
  sub_scores: {
    completeness: number;
    distribution: number;
    parsimony: number;
    encoding_readiness: number;
  };
  executive_diagnosis: string;
  critical_issues: string[];
}

export interface ReasoningStep {
  timestamp: number;
  phase: string;
  message: string;
  details?: any;
}

export interface RuleRecommendation {
  rule_id: string;
  rule_name: string;
  category: string;
  severity: string;
  confidence: number;
  action: string;
  technique: string;
  parameters: Record<string, any>;
  rationale: string;
  impact: string;
}

export interface ColumnRecommendation {
  column: string;
  inferred_type: string;
  raw_dtype: string;
  status: "HEALTHY" | "DROP_RECOMMENDED" | "CRITICAL_ATTENTION" | "REQUIRES_TRANSFORMATION" | "READY_WITH_PREPROCESSING";
  should_drop: boolean;
  drop_reason: string | null;
  missing_pct: number;
  unique_count: number;
  all_rules_triggered: RuleRecommendation[];
  imputation: RuleRecommendation | null;
  encoding: RuleRecommendation | null;
  scaling_and_outliers: RuleRecommendation[];
  filtering: RuleRecommendation | null;
  datetime_engineering: RuleRecommendation | null;
  sample_values: string[];
}

export interface AnalysisResponse {
  metadata: DatasetMetadata;
  facts: {
    dataset_summary: DatasetSummary;
    columns: Record<string, ColumnFact>;
    high_correlation_pairs: CorrelationPair[];
    correlation_matrix: Record<string, Record<string, number>>;
  };
  inference: {
    health_score: HealthScore;
    reasoning_trace: ReasoningStep[];
    triggered_rules_count: number;
    column_recommendations: Record<string, ColumnRecommendation>;
  };
  pipeline_code: string;
  preview: Record<string, any>[];
}

export interface CleaningReport {
  initial_shape: [number, number];
  final_shape: [number, number];
  initial_missing_cells: number;
  final_missing_cells: number;
  steps_executed: string[];
  preview: Record<string, any>[];
}

export interface SampleDatasetInfo {
  id: string;
  name: string;
  description: string;
}
