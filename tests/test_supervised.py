import unittest
import pandas as pd
import numpy as np
from backend.app.supervised import analyze_target_variable


class TestSupervisedMode(unittest.TestCase):

    def test_binary_classification_and_imbalance(self):
        df = pd.DataFrame({
            "target": [1] * 90 + [0] * 10,
            "feature1": np.random.normal(0, 1, 100),
            "feature2": np.random.normal(5, 2, 100)
        })
        res = analyze_target_variable(df, "target")
        self.assertEqual(res["task_type"], "binary_classification")
        self.assertEqual(res["unique_count"], 2)
        self.assertIsNotNone(res["class_imbalance"])
        self.assertIn(res["class_imbalance"]["imbalance_severity"], ["MODERATE", "SEVERE"])
        self.assertEqual(len(res["feature_importances"]), 2)

    def test_continuous_regression(self):
        df = pd.DataFrame({
            "continuous_y": np.linspace(10.0, 500.0, 100) + np.random.normal(0, 1, 100),
            "feature_x": np.linspace(1.0, 50.0, 100)
        })
        res = analyze_target_variable(df, "continuous_y")
        self.assertEqual(res["task_type"], "regression")
        self.assertGreater(res["unique_count"], 20)

    def test_target_leakage_detection(self):
        y = np.linspace(1.0, 100.0, 50)
        df = pd.DataFrame({
            "target": y,
            "leaky_col": y * 1.0001,  # near perfect correlation
            "random_col": np.random.normal(0, 1, 50)
        })
        res = analyze_target_variable(df, "target")
        self.assertTrue(any(f["leakage_risk"] for f in res["feature_importances"]))
        self.assertGreater(len(res["leakage_warnings"]), 0)

    def test_categorical_target_leakage_detection(self):
        # Test binary classification with a categorical duplicate feature
        df = pd.DataFrame({
            "target": ["churn", "stay"] * 50,
            "duplicate_cat_target": ["churn", "stay"] * 50,
            "noise_feature": np.random.normal(0, 1, 100)
        })
        res = analyze_target_variable(df, "target")
        self.assertEqual(res["task_type"], "binary_classification")
        leak_feats = [f for f in res["feature_importances"] if f["feature"] == "duplicate_cat_target"]
        self.assertEqual(len(leak_feats), 1)
        self.assertTrue(leak_feats[0]["leakage_risk"])
        self.assertTrue(any("duplicate_cat_target" in w for w in res["leakage_warnings"]))


if __name__ == "__main__":
    unittest.main()
