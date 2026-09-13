import unittest
import io
import json
import sqlite3
import pandas as pd
from backend.app.exporter import export_dataframe, generate_jupyter_notebook, generate_pandera_schema
from backend.app.sample_data import generate_messy_titanic
from backend.app.expert_system.fact_extractor import extract_dataset_facts
from backend.app.expert_system.engine import run_expert_inference
from backend.app.expert_system.code_generator import generate_python_pipeline_code


class TestExporter(unittest.TestCase):

    def setUp(self):
        self.df = pd.DataFrame({
            "num_a": [1.0, 2.5, 3.7, 4.2],
            "text_b": ["apple", "banana", "cherry", "date"],
            "flag_c": [0, 1, 1, 0]
        })

    def test_export_csv(self):
        data, mime, fname = export_dataframe(self.df, "csv", "test_data.csv")
        self.assertEqual(mime, "text/csv")
        self.assertTrue(fname.endswith(".csv"))
        loaded = pd.read_csv(io.BytesIO(data))
        self.assertEqual(len(loaded), 4)
        self.assertEqual(list(loaded.columns), list(self.df.columns))

    def test_export_excel(self):
        data, mime, fname = export_dataframe(self.df, "excel", "test_data.csv")
        self.assertIn("spreadsheetml", mime)
        self.assertTrue(fname.endswith(".xlsx"))
        excel_file = pd.ExcelFile(io.BytesIO(data))
        self.assertIn("Cleaned_Data", excel_file.sheet_names)
        self.assertIn("Summary_Overview", excel_file.sheet_names)

    def test_export_parquet(self):
        data, mime, fname = export_dataframe(self.df, "parquet", "test_data.csv")
        self.assertTrue(fname.endswith(".parquet"))
        loaded = pd.read_parquet(io.BytesIO(data))
        self.assertEqual(len(loaded), 4)

    def test_export_sqlite(self):
        data, mime, fname = export_dataframe(self.df, "sqlite", "test_data.csv")
        self.assertTrue(fname.endswith(".db"))
        self.assertGreater(len(data), 0)

    def test_export_sqlite_with_special_characters_and_duplicate_sanitized_names(self):
        df_special = pd.DataFrame({
            "col 1!": [1, 2, 3],
            "col_1": [4, 5, 6],
            "col-1?": [7, 8, 9],
            "123 numeric": [10, 20, 30]
        })
        data, mime, fname = export_dataframe(df_special, "sqlite", "test_special.csv")
        self.assertTrue(fname.endswith(".db"))
        self.assertGreater(len(data), 0)

    def test_generate_jupyter_notebook(self):
        df_titanic = generate_messy_titanic(n_rows=50)
        facts = extract_dataset_facts(df_titanic)
        inference = run_expert_inference(facts)
        pipeline_code = generate_python_pipeline_code(facts, inference)

        nb_str = generate_jupyter_notebook(
            metadata={"filename": "titanic.csv"},
            facts=facts,
            inference=inference,
            pipeline_code=pipeline_code,
            target_col="Survived"
        )
        nb_json = json.loads(nb_str)
        self.assertEqual(nb_json["nbformat"], 4)
        self.assertIn("cells", nb_json)
        self.assertGreaterEqual(len(nb_json["cells"]), 6)

    def test_generate_pandera_schema(self):
        df_titanic = generate_messy_titanic(n_rows=50)
        facts = extract_dataset_facts(df_titanic)
        schema_code = generate_pandera_schema(df_titanic, facts)
        self.assertIn("DataFrameSchema", schema_code)
        self.assertIn("schema = DataFrameSchema(", schema_code)


if __name__ == "__main__":
    unittest.main()
