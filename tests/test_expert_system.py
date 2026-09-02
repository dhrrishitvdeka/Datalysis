import unittest
import pandas as pd
import numpy as np

from backend.app.expert_system.fact_extractor import extract_dataset_facts
from backend.app.expert_system.engine import run_expert_inference
from backend.app.expert_system.code_generator import generate_python_pipeline_code
from backend.app.sample_data import generate_messy_titanic, generate_messy_telecom_churn, generate_sensor_telemetry
from backend.app.preprocessor import execute_preprocessing_pipeline

class TestExpertSystem(unittest.TestCase):

    def test_titanic_expert_analysis(self):
        df = generate_messy_titanic(n_rows=150)
        facts = extract_dataset_facts(df)
        
        # Check fact extraction
        self.assertIn("dataset_summary", facts)
        self.assertIn("columns", facts)
        self.assertGreater(facts["dataset_summary"]["duplicate_rows"], 0)
        self.assertTrue(facts["columns"]["PassengerId"]["is_identifier"])
        self.assertGreater(facts["columns"]["Cabin"]["missing_pct"], 70.0)

        # Run inference
        inference = run_expert_inference(facts)
        col_recs = inference["column_recommendations"]
        health = inference["health_score"]

        # Verification of production rules
        # R-FLT-02: PassengerId must be recommended to drop
        self.assertTrue(col_recs["PassengerId"]["should_drop"])
        
        # R-IMP-01: Cabin must be recommended to drop (>70% missing)
        self.assertTrue(col_recs["Cabin"]["should_drop"])

        # R-FLT-01: Manifest_Source is constant and should be dropped
        self.assertTrue(col_recs["Manifest_Source"]["should_drop"])

        # R-IMP-02: Age has missing values and should be median imputed
        self.assertFalse(col_recs["Age"]["should_drop"])
        self.assertIsNotNone(col_recs["Age"]["imputation"])
        self.assertEqual(col_recs["Age"]["imputation"]["action"], "impute_median")

        # Health score must be valid
        self.assertGreaterEqual(health["overall_score"], 0)
        self.assertLessEqual(health["overall_score"], 100)
        self.assertIn(health["grade"], ["A+", "A", "B", "C", "D", "F"])

        # Preprocessing execution
        cleaned_df, report = execute_preprocessing_pipeline(df, facts, inference)
        self.assertEqual(report["final_missing_cells"], 0)
        self.assertNotIn("PassengerId", cleaned_df.columns)
        self.assertNotIn("Cabin", cleaned_df.columns)

    def test_telecom_churn_collinearity_and_pipeline(self):
        df = generate_messy_telecom_churn(n_rows=150)
        facts = extract_dataset_facts(df)
        inference = run_expert_inference(facts)

        # Check collinearity detection
        self.assertIn("correlation_matrix", facts)
        self.assertIn("high_correlation_pairs", facts)

        # Test pipeline code generation
        code = generate_python_pipeline_code(facts, inference)
        self.assertIn("ColumnTransformer", code)
        self.assertIn("Pipeline", code)

    def test_sensor_telemetry_datetime(self):
        df = generate_sensor_telemetry(n_rows=100)
        facts = extract_dataset_facts(df)
        inference = run_expert_inference(facts)
        
        # Timestamp must be identified as datetime
        self.assertEqual(facts["columns"]["Timestamp"]["inferred_type"], "datetime")
        
        # Cleaned dataset must decompose datetime
        cleaned_df, report = execute_preprocessing_pipeline(df, facts, inference)
        self.assertIn("Timestamp_month", cleaned_df.columns)
        self.assertIn("Timestamp_sin_month", cleaned_df.columns)
        self.assertEqual(report["final_missing_cells"], 0)

if __name__ == "__main__":
    unittest.main()
