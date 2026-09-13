import unittest
import pandas as pd
import numpy as np
from backend.app.expert_system.fact_extractor import extract_dataset_facts
from backend.app.expert_system.engine import run_expert_inference
from backend.app.expert_system.code_generator import generate_python_pipeline_code


class TestCodeGeneratorPassthrough(unittest.TestCase):

    def test_unflagged_healthy_columns_retained_in_generated_code(self):
        # Create dataset with healthy column that requires no transforms
        df = pd.DataFrame({
            "healthy_norm": np.random.normal(0, 1, 100),
            "unflagged_clean": [float(i % 10) for i in range(100)],
            "leaky_id": [f"ID_{i}" for i in range(100)],
        })
        facts = extract_dataset_facts(df)
        inference = run_expert_inference(facts)
        code = generate_python_pipeline_code(facts, inference)

        self.assertIn("PASSTHROUGH_COLUMNS", code)
        self.assertIn("remainder=\"passthrough\"", code)
        self.assertIn("preprocessor.set_output(transform=\"pandas\")", code)

        # Ensure compiling the generated code succeeds
        compiled = compile(code, "<string>", "exec")
        self.assertIsNotNone(compiled)

        # Execute script in isolated namespace
        ns = {}
        exec(compiled, ns)
        self.assertIn("build_preprocessing_pipeline", ns)
        self.assertIn("clean_and_transform", ns)

        # Run clean_and_transform on df
        clean_fn = ns["clean_and_transform"]
        result = clean_fn(df)
        # Should retain healthy columns and not drop everything
        self.assertGreater(result.shape[1], 0)
        self.assertIsInstance(result, pd.DataFrame)
        self.assertTrue(all(isinstance(c, str) for c in result.columns))

    def test_generated_pipeline_on_mixed_types_with_missing_values(self):
        # Mixed types with skewed numeric, missing values, categories, datetimes
        df = pd.DataFrame({
            "skewed_num": [10.0 * (1.1 ** i) if i % 10 != 0 else np.nan for i in range(100)],
            "normal_num": [float(i) for i in range(100)],
            "cat_col": ["A", "B", "C", "D"] * 25,
            "created_at": pd.date_range("2024-01-01 08:00:00", periods=100, freq="h").astype(str),
        })
        facts = extract_dataset_facts(df)
        inference = run_expert_inference(facts)
        code = generate_python_pipeline_code(facts, inference)

        ns = {}
        exec(code, ns)
        clean_fn = ns["clean_and_transform"]
        result = clean_fn(df)

        self.assertIsInstance(result, pd.DataFrame)
        self.assertGreater(result.shape[1], 0)
        # All column names must be strings
        self.assertTrue(all(isinstance(c, str) for c in result.columns))
        # No NaNs in output
        self.assertEqual(int(result.isna().sum().sum()), 0)


if __name__ == "__main__":
    unittest.main()
