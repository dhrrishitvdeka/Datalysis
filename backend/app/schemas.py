"""
Pydantic v2 Request and Response Schemas for Datalysis API
"""

from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field


class DatasetMetadataModel(BaseModel):
    filename: str
    extension: str
    file_size_kb: float
    detected_encoding: str
    detected_delimiter: Optional[str] = None
    format: str
    rows: int
    columns: int
    sheet_name: Optional[str] = None
    sample_name: Optional[str] = None


class DatasetSummaryModel(BaseModel):
    row_count: int
    col_count: int
    total_cells: int
    total_missing_cells: int
    overall_missing_pct: float
    duplicate_rows: int
    duplicate_pct: float
    memory_mb: float
    type_counts: Dict[str, int]
    columns_with_missing: int
    columns_constant: int
    columns_identifiers: int


class NumericHistogramModel(BaseModel):
    bin_edges: List[float] = Field(default_factory=list)
    counts: List[int] = Field(default_factory=list)


class NumericStatsModel(BaseModel):
    min: float
    max: float
    mean: float
    median: float
    std: float
    q25: float
    q75: float
    iqr: float
    skewness: float
    kurtosis: float
    is_normally_distributed: bool
    zero_count: int
    zero_pct: float
    negative_count: int
    outliers_iqr_count: int
    outliers_iqr_pct: float
    outliers_extreme_count: int
    lower_bound_iqr: float
    upper_bound_iqr: float
    histogram: NumericHistogramModel


class TopCategoryModel(BaseModel):
    category: str
    count: int
    percentage: float


class CategoricalStatsModel(BaseModel):
    top_categories: List[TopCategoryModel] = Field(default_factory=list)
    rare_categories_count: int
    mode_category: Optional[str] = None
    mode_frequency_pct: float
    entropy: float


class DatetimeStatsModel(BaseModel):
    min_date: Optional[str] = None
    max_date: Optional[str] = None
    time_span_days: Optional[float] = None
    has_time: bool = False


class ColumnFactModel(BaseModel):
    name: str
    raw_dtype: str
    inferred_type: str
    non_null_count: int
    missing_count: int
    missing_pct: float
    unique_count: int
    uniqueness_ratio: float
    is_constant: bool
    is_binary: bool
    is_identifier: bool
    ordinal_order: Optional[List[str]] = None
    sample_values: List[str] = Field(default_factory=list)
    numeric_stats: Optional[NumericStatsModel] = None
    categorical_stats: Optional[CategoricalStatsModel] = None
    datetime_stats: Optional[DatetimeStatsModel] = None


class CorrelationPairModel(BaseModel):
    feature_a: str
    feature_b: str
    correlation: float
    abs_correlation: float
    severity: str


class FactsModel(BaseModel):
    dataset_summary: DatasetSummaryModel
    columns: Dict[str, ColumnFactModel]
    high_correlation_pairs: List[CorrelationPairModel] = Field(default_factory=list)
    correlation_matrix: Dict[str, Dict[str, float]] = Field(default_factory=dict)
    missing_corr_pairs: Optional[List[Dict[str, Any]]] = Field(default_factory=list)


class HealthSubScoresModel(BaseModel):
    completeness: float
    distribution: float
    parsimony: float
    encoding_readiness: float


class HealthScoreModel(BaseModel):
    overall_score: float
    grade: str
    sub_scores: HealthSubScoresModel
    executive_diagnosis: str
    critical_issues: List[str] = Field(default_factory=list)


class ReasoningStepModel(BaseModel):
    timestamp: float
    phase: str
    message: str
    details: Optional[Any] = None


class RuleRecommendationModel(BaseModel):
    rule_id: str
    rule_name: str
    category: str
    severity: str
    confidence: float
    action: str
    technique: str
    parameters: Dict[str, Any] = Field(default_factory=dict)
    rationale: str
    impact: str


class ColumnRecommendationModel(BaseModel):
    column: str
    inferred_type: str
    raw_dtype: str
    status: str
    should_drop: bool
    drop_reason: Optional[str] = None
    missing_pct: float
    unique_count: int
    all_rules_triggered: List[RuleRecommendationModel] = Field(default_factory=list)
    imputation: Optional[RuleRecommendationModel] = None
    encoding: Optional[RuleRecommendationModel] = None
    scaling_and_outliers: List[RuleRecommendationModel] = Field(default_factory=list)
    filtering: Optional[RuleRecommendationModel] = None
    datetime_engineering: Optional[RuleRecommendationModel] = None
    sample_values: List[str] = Field(default_factory=list)


class InferenceModel(BaseModel):
    health_score: HealthScoreModel
    reasoning_trace: List[ReasoningStepModel] = Field(default_factory=list)
    triggered_rules_count: int
    column_recommendations: Dict[str, ColumnRecommendationModel]


class AnalysisResponseModel(BaseModel):
    metadata: DatasetMetadataModel
    facts: FactsModel
    inference: InferenceModel
    pipeline_code: str
    preview: List[Dict[str, Any]]
    session_id: Optional[str] = None


class CleaningReportModel(BaseModel):
    initial_shape: List[int]
    final_shape: List[int]
    initial_missing_cells: int
    final_missing_cells: int
    steps_executed: List[str]
    preview: List[Dict[str, Any]]


class RecipeOverrideModel(BaseModel):
    drop: Optional[bool] = None
    imputation: Optional[str] = None  # 'auto', 'median', 'mean', 'mode', 'constant', 'knn', 'drop_rows', 'none'
    impute_value: Optional[Any] = None
    encoding: Optional[str] = None    # 'auto', 'onehot', 'frequency', 'ordinal', 'binary', 'none'
    outliers: Optional[str] = None    # 'auto', 'winsorize', 'clip_iqr', 'zscore', 'none'
    scaling: Optional[str] = None     # 'auto', 'standard', 'robust', 'log1p', 'none'


class ProcessRequestModel(BaseModel):
    column_overrides: Optional[Dict[str, RecipeOverrideModel]] = Field(default_factory=dict)
    drop_duplicates: Optional[bool] = True
    target_variable: Optional[str] = None


class FeatureImportanceModel(BaseModel):
    feature: str
    score: float
    correlation: Optional[float] = None
    leakage_risk: bool = False


class TargetAnalysisResponseModel(BaseModel):
    target: str
    task_type: str  # 'binary_classification', 'multiclass_classification', 'regression'
    unique_count: int
    class_imbalance: Optional[Dict[str, Any]] = None
    feature_importances: List[FeatureImportanceModel] = Field(default_factory=list)
    leakage_warnings: List[str] = Field(default_factory=list)
    recommendation: str


class SampleDatasetInfoModel(BaseModel):
    id: str
    name: str
    description: str


class SampleDatasetListResponseModel(BaseModel):
    samples: List[SampleDatasetInfoModel]
