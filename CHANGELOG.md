# Changelog

All notable changes to this project are documented in this file.

## [1.1.0] - 2026-10-24

### Added
- **Data Quality Repair family (`R-QLT-01` to `R-QLT-07`)** in `expert_system/sanitizer.py`, applied before fact extraction: disguised missing values, numeric sentinel codes, numbers stored as text, yes/no text, category label case/spacing variants, infinite values, and surrounding whitespace.
- `R-FLT-04`: advisory flag for quasi-constant columns (one value covers at least 99% of non-null rows). New per-column facts `dominant_value_pct` and `is_quasi_constant`.
- `R-IMP-07`: structured (co-occurring) missingness; keeps a `<col>_was_missing` indicator for columns that go missing together.
- `R-INT-01`: duplicates hidden by identifier columns; new `hidden_duplicate_rows` dataset fact.
- `datalysis clean <file> -o <out>` command with `--target`, `--format csv|excel|parquet|sqlite`, and `--no-repair`; `datalysis audit` now prints the applied repairs.
- `auto_repair` query parameter on `/api/upload` and `/api/load-sample/{id}` to switch the repair layer off.
- `sheet` query parameter on `/api/upload` for Excel workbooks; `metadata.all_sheets` lists the sheets.
- Upload size limit (200 MB by default, `DATALYSIS_MAX_UPLOAD_MB` to change it); larger files return HTTP 413 with a message.
- `repairs` list in the analysis response, a `DATA_QUALITY_REPAIR` reasoning-trace phase, and a `DATASET_WARNING` phase for datasets with fewer than 2 rows.
- `inference.triggered_rules_log` in the response: every rule that fired, with column, rule, category, severity, confidence, and action type.
- `target_column` in the `/api/process` request body.
- The generated pipeline script replays the R-QLT repairs (`repair_data_quality` with a `DATA_QUALITY_REPAIRS` list) first, so it runs on the raw file. Each repair now carries a `replay` dict with the exact parameters needed to repeat it, and `generate_python_pipeline_code` takes a `repairs` argument.
- `repairs_applied` (count) in `inference.health_score`; the UI shows it as a neutral note instead of a red chip.
- `datalysis audit --no-repair`, matching `datalysis clean --no-repair`.
- Frontend: Data Repairs tab with a count badge, "Auto-repair data quality issues" toggle on the upload screen, Excel sheet selector, hidden-duplicate figure and quasi-constant tag in the overview, a note that the target is protected during cleaning, and icons and colours for the new reasoning-trace phases. API errors (400, 413) now show the backend's message.

### Fixed
- Cramér's V for categorical association never ran because `scipy.stats` was not imported in `fact_extractor.py`; it now works.
- Ordinal encoding used the order of first appearance; it now follows the detected semantic order (for example low, medium, high).
- Binary encoding was not deterministic; a yes/no style pair now always maps positive to 1, and any other pair is sorted.
- SQLite export failed on column names that differ only by case and on frames with no columns.
- Nested JSON objects and list cells were rejected with an "unhashable type" error; objects are flattened and lists are stored as JSON text.
- One-row and all-NaN datasets lost every column during preprocessing; a single row is no longer called constant and pruning never removes every column.
- The supervised target was not protected by `/api/process` or the generated script; it is now never dropped, imputed, encoded, or scaled.
- The generated pipeline fitted imputers, scalers, and encoders on the full data, leaking test statistics; with a target it now splits train/test first and fits on the training rows only.
- Pandas deprecation of `dt.dayofweek`; the code now uses `dt.day_of_week`.
- Day-first dates such as `13/01/2020` are now detected and parsed day-first.
- Infinite values broke statistics and imputation; they are treated as missing.
- The generated pipeline failed on raw files (for example `could not convert string to float: '$3,282'`) because the data-quality repairs were not replayed.
- The number of data-quality repairs was listed under `critical_issues`, so the UI showed an informational fact as a critical issue.
- After choosing a different target, the Cleaned view kept the cleaning report made for the previous target; it is now cleared.

### Changed
- De-duplication runs after identifier columns are pruned, so rows that differ only by an ID are now caught.
- CLI output is plain ASCII, so it no longer fails on Windows consoles that use cp1252.
- README documents the R-QLT family, the analysis pipeline order, the full CLI, the REST parameters, and known limitations.
- Version bumped to 1.1.0.
