import unittest
import pandas as pd
import numpy as np
from backend.app.expert_system.fact_extractor import extract_dataset_facts
from backend.app.expert_system.engine import run_expert_inference
from backend.app.preprocessor import execute_preprocessing_pipeline


class TestRecipeCustomizer(unittest.TestCase):

    def setUp(self):
        # Create a sample dataset with missing values, skew, and categories
        self.df = pd.DataFrame({
            "id_col": [f"ID_{i}" for i in range(100)],
            "age": [20.0 + i if i % 5 != 0 else np.nan for i in range(100)],
            "income": [1000.0 * (1.1 ** i) for i in range(100)],
            "city": ["Paris" if i % 2 == 0 else "London" for i in range(100)],
            "category": ["A", "B", "C", "D"] * 25
        })
        self.facts = extract_dataset_facts(self.df)
        self.inference = run_expert_inference(self.facts)

    def test_override_prevent_drop(self):
        # Rule R-FLT-02 would drop id_col. Override to KEEP it.
        overrides = {
            "column_overrides": {
                "id_col": {"drop": False}
            }
        }
        cleaned_df, report = execute_preprocessing_pipeline(
            self.df, self.facts, self.inference, recipe_overrides=overrides
        )
        self.assertIn("id_col", cleaned_df.columns)

    def test_override_force_drop(self):
        # Force drop 'city' which is otherwise healthy
        overrides = {
            "column_overrides": {
                "city": {"drop": True}
            }
        }
        cleaned_df, report = execute_preprocessing_pipeline(
            self.df, self.facts, self.inference, recipe_overrides=overrides
        )
        self.assertNotIn("city", cleaned_df.columns)

    def test_override_imputation_mean_and_constant(self):
        # Override 'age' imputation to mean
        overrides = {
            "column_overrides": {
                "age": {"imputation": "mean"}
            }
        }
        cleaned_df, report = execute_preprocessing_pipeline(
            self.df, self.facts, self.inference, recipe_overrides=overrides
        )
        self.assertEqual(cleaned_df["age"].isna().sum(), 0)
        expected_mean = self.df["age"].mean()
        self.assertAlmostEqual(cleaned_df["age"].mean(), expected_mean, places=1)

    def test_override_outlier_and_scaling(self):
        # Override income outlier mitigation to clip_iqr and scaling to standard
        overrides = {
            "column_overrides": {
                "income": {
                    "outliers": "clip_iqr",
                    "scaling": "standard"
                }
            }
        }
        cleaned_df, report = execute_preprocessing_pipeline(
            self.df, self.facts, self.inference, recipe_overrides=overrides
        )
        self.assertEqual(cleaned_df["income"].isna().sum(), 0)
        # Scaled column should have mean approx 0 and std approx 1
        self.assertAlmostEqual(float(cleaned_df["income"].mean()), 0.0, places=1)

    def test_override_encoding_binary_and_ordinal(self):
        overrides = {
            "column_overrides": {
                "city": {"encoding": "binary"},
                "category": {"encoding": "ordinal"}
            }
        }
        cleaned_df, report = execute_preprocessing_pipeline(
            self.df, self.facts, self.inference, recipe_overrides=overrides
        )
        self.assertTrue(pd.api.types.is_numeric_dtype(cleaned_df["city"]))
        self.assertTrue(pd.api.types.is_numeric_dtype(cleaned_df["category"]))

    def test_override_outlier_clip_iqr_preserves_rule_scaling(self):
        # Override outliers to clip_iqr while leaving scaling as 'auto'
        overrides = {
            "column_overrides": {
                "income": {
                    "outliers": "clip_iqr",
                    "scaling": "auto"
                }
            }
        }
        cleaned_df, report = execute_preprocessing_pipeline(
            self.df, self.facts, self.inference, recipe_overrides=overrides
        )
        # Verify log1p scaling was still applied by the decoupled rule execution
        self.assertTrue(any("Log1p" in step for step in report["steps_executed"]))
        self.assertTrue(any("Clipped IQR outliers" in step for step in report["steps_executed"]))


if __name__ == "__main__":
    unittest.main()
