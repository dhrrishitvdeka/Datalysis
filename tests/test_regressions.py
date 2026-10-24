"""Regression tests for the bugs fixed in the data-quality / supervised-safety upgrade."""

import io
import sqlite3
import tempfile
import unittest
import warnings
from pathlib import Path

import numpy as np
import pandas as pd
from fastapi.testclient import TestClient

from backend.app.exporter import export_dataframe
from backend.app.expert_system.code_generator import generate_python_pipeline_code
from backend.app.expert_system.encoding import binary_mapping, ordinal_mapping
from backend.app.expert_system.engine import run_expert_inference
from backend.app.expert_system.fact_extractor import extract_dataset_facts, parse_dates
from backend.app.main import app
from backend.app.parser import load_file_to_dataframe
from backend.app.preprocessor import execute_preprocessing_pipeline


def analyze(df):
    facts = extract_dataset_facts(df)
    return facts, run_expert_inference(facts)


class TestCramersV(unittest.TestCase):

    def test_perfectly_associated_categoricals_are_reported(self):
        a = ["x", "y", "z"] * 12
        b = [{"x": "p", "y": "q", "z": "r"}[v] for v in a]
        facts = extract_dataset_facts(pd.DataFrame({"a": a, "b": b}))
        pairs = facts["high_correlation_pairs"]
        self.assertEqual(len(pairs), 1)
        self.assertEqual({pairs[0]["feature_a"], pairs[0]["feature_b"]}, {"a", "b"})
        self.assertGreaterEqual(pairs[0]["abs_correlation"], 0.99)


class TestDeterministicEncoding(unittest.TestCase):

    def ordinal_frame(self, levels):
        rng = np.random.default_rng(1)
        return pd.DataFrame({"level": levels, "x": rng.normal(size=len(levels))})

    def test_ordinal_follows_detected_order_not_row_order(self):
        for levels in (["high", "low", "medium"] * 10, ["medium", "high", "low"] * 10, ["Low ", "HIGH", "Medium"] * 10):
            df = self.ordinal_frame(levels)
            facts, inference = analyze(df)
            self.assertEqual(inference["column_recommendations"]["level"]["encoding"]["action"], "encode_ordinal")
            out, _ = execute_preprocessing_pipeline(df, facts, inference)
            expected = df["level"].str.strip().str.lower().map({"low": 0, "medium": 1, "high": 2})
            self.assertEqual(out["level"].tolist(), expected.tolist())

    def test_ordinal_without_detected_order_falls_back_to_sorted(self):
        self.assertEqual(ordinal_mapping(["b", "c", "a"]), {"a": 0, "b": 1, "c": 2})

    def test_binary_positive_token_maps_to_one_regardless_of_row_order(self):
        for values in (["no", "yes"] * 20, ["yes", "no"] * 20):
            df = pd.DataFrame({"flag": values, "x": range(40)})
            facts, inference = analyze(df)
            out, _ = execute_preprocessing_pipeline(df, facts, inference)
            self.assertEqual(out["flag"].tolist(), [1 if v == "yes" else 0 for v in values])

    def test_binary_non_semantic_pair_is_sorted(self):
        self.assertEqual(binary_mapping(["b", "a", "b"]), {"a": 0, "b": 1})
        self.assertEqual(binary_mapping(["Male", "Female"]), {"Female": 0, "Male": 1})
        self.assertEqual(binary_mapping([1.0, 0.0]), {1.0: 1, 0.0: 0})
        self.assertEqual(binary_mapping(["pass", "fail"])["pass"], 1)

    def test_rule_recommendation_mapping_matches_what_runs(self):
        df = pd.DataFrame({"flag": ["no", "yes"] * 20, "x": range(40)})
        facts, inference = analyze(df)
        mapping = inference["column_recommendations"]["flag"]["encoding"]["parameters"]["mapping"]
        self.assertEqual(mapping, {"yes": 1, "no": 0})

    def test_forced_binary_on_many_values_does_not_collapse(self):
        df = pd.DataFrame({"c": ["a", "b", "c", "d"] * 10, "x": range(40)})
        facts, inference = analyze(df)
        recipe = {"column_overrides": {"c": {"encoding": "binary"}}}
        out, report = execute_preprocessing_pipeline(df, facts, inference, recipe_overrides=recipe)
        self.assertEqual(sorted(out["c"].unique().tolist()), [0, 1, 2, 3])
        self.assertTrue(any("requested for 'c'" in step for step in report["steps_executed"]))


class TestSqliteExport(unittest.TestCase):

    def test_case_insensitive_duplicate_column_names(self):
        df = pd.DataFrame({"flag_yes": [1, 0], "flag_Yes": [0, 1], "FLAG_YES": [1, 1]})
        data, mime, name = export_dataframe(df, "sqlite", "t.csv")
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "out.db"
            path.write_bytes(data)
            conn = sqlite3.connect(path)
            columns = [row[1] for row in conn.execute("PRAGMA table_info(cleaned_data)")]
            conn.close()
        self.assertEqual(columns, ["flag_yes", "flag_Yes_2", "FLAG_YES_3"])

    def test_zero_columns_raises_clear_error(self):
        empty = pd.DataFrame(index=range(3))
        for fmt in ("sqlite", "csv", "excel", "parquet"):
            with self.assertRaises(ValueError) as ctx:
                export_dataframe(empty, fmt, "t.csv")
            self.assertIn("nothing to export", str(ctx.exception))


class TestJsonAndCorruptFiles(unittest.TestCase):

    def test_nested_objects_are_flattened(self):
        df, _ = load_file_to_dataframe(b'[{"a":1,"b":{"x":1,"y":{"z":5}}},{"a":2,"b":{"x":2,"y":{"z":6}}}]', "n.json")
        self.assertEqual(list(df.columns), ["a", "b.x", "b.y.z"])
        self.assertEqual(df["b.y.z"].tolist(), [5, 6])

    def test_list_cells_become_json_strings(self):
        df, _ = load_file_to_dataframe(b'[{"a":1,"t":[1,2]},{"a":2,"t":[3]}]', "l.json")
        self.assertEqual(df["t"].tolist(), ["[1, 2]", "[3]"])
        self.assertEqual(int(df.duplicated().sum()), 0)  # hashable now

    def test_json_lines_with_nesting(self):
        df, _ = load_file_to_dataframe(b'{"a":1,"b":{"x":1}}\n{"a":2,"b":{"x":2}}\n', "l.jsonl")
        self.assertEqual(list(df.columns), ["a", "b.x"])

    def test_invalid_json_message_is_human_readable(self):
        with self.assertRaises(ValueError) as ctx:
            load_file_to_dataframe(b"{not json", "bad.json")
        self.assertIn("File 'bad.json' is not valid JSON", str(ctx.exception))

    def test_corrupt_excel_message_is_human_readable(self):
        with self.assertRaises(ValueError) as ctx:
            load_file_to_dataframe(b"notanexcel", "x.xlsx")
        self.assertEqual(str(ctx.exception), "File 'x.xlsx' is not a valid Excel workbook.")

    def test_api_returns_200_for_nested_json_and_400_for_garbage(self):
        client = TestClient(app)
        ok = client.post("/api/upload", files={"file": ("n.json", b'[{"a":1,"b":{"x":1}},{"a":2,"b":{"x":2}}]')})
        self.assertEqual(ok.status_code, 200)
        bad = client.post("/api/upload", files={"file": ("x.xlsx", b"junk")})
        self.assertEqual(bad.status_code, 400)
        self.assertIn("not a valid Excel workbook", bad.json()["detail"])


class TestDestructiveEdgeCases(unittest.TestCase):

    def test_one_row_file_keeps_its_columns(self):
        df, _ = load_file_to_dataframe(b"a,b\n1,x\n", "one.csv")
        facts, inference = analyze(df)
        self.assertFalse(any(f["is_constant"] for f in facts["columns"].values()))
        out, _ = execute_preprocessing_pipeline(df, facts, inference)
        self.assertEqual(out.shape[1], 2)
        self.assertTrue(any(s["phase"] == "DATASET_WARNING" for s in inference["reasoning_trace"]))

    def test_all_nan_file_keeps_its_columns(self):
        df, _ = load_file_to_dataframe(b"a,b\n,\n,\n,\n", "nan.csv")
        facts, inference = analyze(df)
        out, report = execute_preprocessing_pipeline(df, facts, inference)
        self.assertEqual(out.shape[1], 2)
        self.assertTrue(any("Skipped pruning" in s for s in report["steps_executed"]))

    def test_all_constant_columns_are_kept_instead_of_emptying_the_frame(self):
        df = pd.DataFrame({"a": [1] * 5, "b": ["x"] * 5})
        facts, inference = analyze(df)
        self.assertTrue(all(r["should_drop"] for r in inference["column_recommendations"].values()))
        out, report = execute_preprocessing_pipeline(df, facts, inference)
        self.assertEqual(out.shape[1], 2)
        self.assertTrue(any("Skipped pruning" in s for s in report["steps_executed"]))

    def test_zero_row_upload_still_400(self):
        client = TestClient(app)
        res = client.post("/api/upload", files={"file": ("h.csv", b"a,b,c\n")})
        self.assertEqual(res.status_code, 400)
        self.assertIn("Could not extract any rows", res.json()["detail"])


class TestSupervisedTargetProtection(unittest.TestCase):

    def make_frame(self):
        rng = np.random.default_rng(3)
        n = 150
        y = rng.lognormal(3, 1, n)  # skewed + outliers: would normally be log1p'ed / winsorized
        y_series = pd.Series(y)
        y_series.iloc[[4, 9]] = np.nan
        return pd.DataFrame({
            "x1": rng.normal(10, 2, n),
            "cat": rng.choice(["red", "green", "blue"], n),
            "label": rng.choice(["spam", "ham"], n),
            "y": y_series,
        })

    def test_numeric_target_is_untouched_and_last(self):
        df = self.make_frame()
        facts, inference = analyze(df)
        out, report = execute_preprocessing_pipeline(df, facts, inference, target_col="y")
        self.assertEqual(out.columns[-1], "y")
        self.assertEqual(int(out["y"].isna().sum()), 0)
        self.assertEqual(len(out), len(df) - 2)  # the two rows without a target were dropped
        self.assertTrue(any("missing target 'y'" in s for s in report["steps_executed"]))
        expected = df["y"].dropna().reset_index(drop=True)
        np.testing.assert_allclose(out["y"].to_numpy(), expected.to_numpy())

    def test_string_label_target_is_not_encoded(self):
        df = self.make_frame()
        facts, inference = analyze(df)
        self.assertEqual(inference["column_recommendations"]["label"]["encoding"]["action"], "encode_binary")
        out, _ = execute_preprocessing_pipeline(df, facts, inference, target_col="label")
        self.assertEqual(set(out["label"].unique()), {"spam", "ham"})
        self.assertEqual(out.columns[-1], "label")

    def test_target_is_never_dropped_even_if_flagged(self):
        df = pd.DataFrame({"id": [f"row-{i}" for i in range(60)], "x": np.arange(60.0), "z": np.arange(60.0) ** 2})
        facts, inference = analyze(df)
        self.assertTrue(inference["column_recommendations"]["id"]["should_drop"])
        out, _ = execute_preprocessing_pipeline(df, facts, inference, target_col="id")
        self.assertIn("id", out.columns)

    def test_unknown_target_raises(self):
        df = self.make_frame()
        facts, inference = analyze(df)
        with self.assertRaises(ValueError):
            execute_preprocessing_pipeline(df, facts, inference, target_col="nope")

    def test_api_process_protects_target_after_target_analysis(self):
        client = TestClient(app)
        headers = {"X-Session-ID": "regress-target-1"}
        client.post("/api/load-sample/titanic", headers=headers)
        res = client.post("/api/supervised/target-analysis?target=Survived", headers=headers)
        self.assertEqual(res.status_code, 200)
        proc = client.post("/api/process", headers=headers, json={})
        self.assertEqual(proc.status_code, 200)
        preview = proc.json()["preview"]
        self.assertEqual(list(preview[0])[-1], "Survived")
        self.assertTrue(all(row["Survived"] in (0, 1) for row in preview))

    def test_api_process_body_target_wins_and_updates_pipeline(self):
        client = TestClient(app)
        headers = {"X-Session-ID": "regress-target-2"}
        client.post("/api/load-sample/titanic", headers=headers)
        client.post("/api/supervised/target-analysis?target=Survived", headers=headers)
        proc = client.post("/api/process", headers=headers, json={"target_column": "Fare"})
        self.assertEqual(proc.status_code, 200)
        self.assertEqual(list(proc.json()["preview"][0])[-1], "Fare")
        script = client.get("/api/download-pipeline", headers=headers).text
        self.assertIn("TARGET_COLUMN = 'Fare'", script)

    def test_api_process_rejects_unknown_target(self):
        client = TestClient(app)
        headers = {"X-Session-ID": "regress-target-3"}
        client.post("/api/load-sample/titanic", headers=headers)
        res = client.post("/api/process", headers=headers, json={"target_column": "NoSuchColumn"})
        self.assertEqual(res.status_code, 400)


class TestGeneratedPipelineLeakage(unittest.TestCase):

    def make_frame(self, n=100):
        rng = np.random.default_rng(5)
        return pd.DataFrame({
            "num": rng.normal(50, 10, n),
            "skewed": rng.lognormal(2, 1, n),
            "cat": rng.choice(["a", "b", "c"], n),
            "when": pd.date_range("2024-01-01", periods=n, freq="D").astype(str),
            "label": rng.choice(["yes", "no"], n),
        })

    def run_script(self, df, target):
        facts, inference = analyze(df)
        code = generate_python_pipeline_code(facts, inference, target_col=target)
        namespace = {}
        exec(compile(code, "<generated>", "exec"), namespace)
        return code, namespace

    def test_with_target_splits_before_fitting(self):
        df = self.make_frame(100)
        code, ns = self.run_script(df, "label")
        self.assertIn("TARGET_COLUMN = 'label'", code)
        self.assertIn("train_test_split", code)
        self.assertIn("fit_transform(X_train)", code)
        self.assertIn("preprocessor.transform(X_test)", code)
        X_train, X_test, y_train, y_test = ns["clean_and_transform"](df)
        self.assertEqual(len(X_train), 80)
        self.assertEqual(len(X_test), 20)
        self.assertEqual(len(y_train), 80)
        self.assertEqual(len(y_test), 20)
        self.assertEqual(X_train.shape[1], X_test.shape[1])
        self.assertNotIn("label", " ".join(X_train.columns))  # target never becomes a feature
        self.assertEqual(set(y_train.unique()) | set(y_test.unique()), {"yes", "no"})  # labels left as strings
        self.assertEqual(set(X_train.index) & set(X_test.index), set())
        self.assertEqual(int(X_train.isna().sum().sum()) + int(X_test.isna().sum().sum()), 0)

    def test_train_statistics_are_not_computed_from_test_rows(self):
        df = self.make_frame(100)
        _, ns = self.run_script(df, "label")
        X_train, X_test, _, _ = ns["clean_and_transform"](df)
        # A scaler fitted on X_train centres the TRAIN rows exactly; the test rows are only close
        col = [c for c in X_train.columns if c.endswith("__num")][0]
        self.assertAlmostEqual(float(X_train[col].mean()), 0.0, places=6)
        self.assertNotAlmostEqual(float(X_test[col].mean()), 0.0, places=6)

    def test_stratified_split_keeps_class_balance(self):
        df = self.make_frame(100)
        df["label"] = ["rare"] * 10 + ["common"] * 90
        _, ns = self.run_script(df, "label")
        _, _, y_train, y_test = ns["clean_and_transform"](df)
        self.assertEqual(int((y_test == "rare").sum()), 2)
        self.assertEqual(int((y_train == "rare").sum()), 8)

    def test_class_with_single_member_falls_back_to_unstratified(self):
        df = self.make_frame(100)
        df["label"] = ["lonely"] + ["a"] * 50 + ["b"] * 49
        _, ns = self.run_script(df, "label")
        X_train, X_test, _, _ = ns["clean_and_transform"](df)  # must not raise
        self.assertEqual(len(X_train) + len(X_test), 100)

    def test_without_target_documents_leakage_and_fits_given_frame(self):
        df = self.make_frame(60).drop(columns=["label"])
        code, ns = self.run_script(df, None)
        self.assertIn("TARGET_COLUMN = None", code)
        self.assertIn("LEAKAGE WARNING", code)
        self.assertIn("build_preprocessing_pipeline", ns)
        result = ns["clean_and_transform"](df)
        self.assertIsInstance(result, pd.DataFrame)
        self.assertEqual(len(result), 60)

    def test_generated_code_has_no_deprecated_dayofweek(self):
        facts, inference = analyze(self.make_frame(60))
        code = generate_python_pipeline_code(facts, inference)
        self.assertNotIn(".dt.dayofweek", code)
        self.assertIn(".dt.day_of_week", code)


class TestDatesAndInfinity(unittest.TestCase):

    def test_day_first_is_detected_when_a_day_exceeds_twelve(self):
        parsed = parse_dates(pd.Series(["13/01/2020", "05/02/2020", "14/03/2021"]))
        self.assertEqual(parsed.dt.month.tolist(), [1, 2, 3])
        self.assertEqual(parsed.dt.day.tolist(), [13, 5, 14])

    def test_iso_dates_are_not_swapped_in_a_day_first_column(self):
        parsed = parse_dates(pd.Series(["13/01/2020", "2020-03-04"]))
        self.assertEqual((parsed.dt.month.tolist()), [1, 3])
        self.assertEqual((parsed.dt.day.tolist()), [13, 4])

    def test_unparseable_dates_become_nat(self):
        parsed = parse_dates(pd.Series(["2020-01-02", "garbage", None]))
        self.assertEqual(int(parsed.isna().sum()), 2)

    def test_mixed_timezone_offsets_do_not_crash(self):
        parsed = parse_dates(pd.Series(["2020-01-02T10:00:00+02:00", "2020-03-04T10:00:00+05:00"]))
        self.assertEqual(int(parsed.notna().sum()), 2)

    def test_day_first_file_end_to_end_without_deprecation_warnings(self):
        csv = ("d,v\n" + "".join(f"{(i % 27) + 1:02d}/{(i % 12) + 1:02d}/2020,{i}\n" for i in range(60))).encode()
        df, _ = load_file_to_dataframe(csv, "dmy.csv")
        facts, inference = analyze(df)
        self.assertEqual(facts["columns"]["d"]["inferred_type"], "datetime")
        with warnings.catch_warnings():
            warnings.simplefilter("error")  # any pandas deprecation from our code fails the test
            out, _ = execute_preprocessing_pipeline(df, facts, inference)
        self.assertEqual(out["d_day"].tolist()[:3], [1, 2, 3])
        self.assertEqual(out["d_month"].tolist()[:3], [1, 2, 3])

    def test_unparseable_date_values_are_imputed_not_fatal(self):
        values = [f"2020-01-{(i % 28) + 1:02d}" for i in range(40)]
        values[5] = "not a date"
        df = pd.DataFrame({"d": values, "v": range(40)})
        facts, inference = analyze(df)
        self.assertEqual(facts["columns"]["d"]["inferred_type"], "datetime")
        out, _ = execute_preprocessing_pipeline(df, facts, inference)
        self.assertEqual(int(out.isna().sum().sum()), 0)

    def test_infinite_values_count_as_missing_in_profiling_and_cleaning(self):
        values = [1.0, 2.0, 3.0, np.inf, 5.0, -np.inf, 7.0, 8.0, 9.0, 10.0] * 3
        df = pd.DataFrame({"a": values, "b": range(30)})
        facts = extract_dataset_facts(df)
        self.assertEqual(facts["columns"]["a"]["missing_count"], 6)
        self.assertTrue(np.isfinite(facts["columns"]["a"]["numeric_stats"]["max"]))
        inference = run_expert_inference(facts)
        out, report = execute_preprocessing_pipeline(df, facts, inference)
        self.assertTrue(np.isfinite(out.to_numpy(dtype=float)).all())
        self.assertTrue(any("infinite" in s for s in report["steps_executed"]))


if __name__ == "__main__":
    unittest.main()
