import unittest
import numpy as np
import pandas as pd

from backend.app.expert_system.engine import run_expert_inference
from backend.app.expert_system.fact_extractor import extract_dataset_facts
from backend.app.preprocessor import execute_preprocessing_pipeline


def analyze(df, repairs=None):
    facts = extract_dataset_facts(df)
    return facts, run_expert_inference(facts, repairs=repairs)


def rules_fired(inference, column):
    return {entry["rule_id"] for entry in inference["triggered_rules_log"] if entry["column"] == column}


class TestQuasiConstantRule(unittest.TestCase):

    def test_r_flt_04_flags_but_does_not_drop(self):
        df = pd.DataFrame({"rare": ["a"] * 199 + ["b"], "x": np.arange(200.0)})
        facts, inference = analyze(df)
        self.assertTrue(facts["columns"]["rare"]["is_quasi_constant"])
        self.assertFalse(facts["columns"]["rare"]["is_constant"])
        rec = inference["column_recommendations"]["rare"]
        self.assertIn("R-FLT-04", rules_fired(inference, "rare"))
        self.assertFalse(rec["should_drop"])
        self.assertEqual(rec["status"], "REQUIRES_TRANSFORMATION")
        self.assertIn("variance", [r for r in rec["all_rules_triggered"] if r["rule_id"] == "R-FLT-04"][0]["rationale"])

    def test_not_fired_below_threshold_or_when_constant(self):
        df = pd.DataFrame({
            "mostly": ["a"] * 98 + ["b"] * 2,   # 98%: not quasi-constant
            "const": ["z"] * 100,
            "x": np.arange(100.0),
        })
        facts, inference = analyze(df)
        self.assertNotIn("R-FLT-04", rules_fired(inference, "mostly"))
        self.assertNotIn("R-FLT-04", rules_fired(inference, "const"))
        self.assertTrue(inference["column_recommendations"]["const"]["should_drop"])

    def test_preprocessor_keeps_quasi_constant_column(self):
        df = pd.DataFrame({"rare": ["a"] * 199 + ["b"], "x": np.arange(200.0)})
        facts, inference = analyze(df)
        out, _ = execute_preprocessing_pipeline(df, facts, inference)
        self.assertIn("rare", out.columns)


class TestHiddenDuplicatesRule(unittest.TestCase):

    def make_frame(self):
        rng = np.random.default_rng(2)
        base = pd.DataFrame({
            "city": rng.choice(["Paris", "Rome", "Oslo", "Lima"], 20),
            "score": rng.normal(50, 5, 20).round(2),
        })
        copies = base.iloc[:10].copy()  # same measurements, new ids
        data = pd.concat([base, copies], ignore_index=True)
        data.insert(0, "user_id", [f"u{i:03d}" for i in range(len(data))])
        return data

    def test_r_int_01_counts_rows_hidden_by_ids(self):
        df = self.make_frame()
        facts, inference = analyze(df)
        self.assertEqual(facts["dataset_summary"]["duplicate_rows"], 0)
        self.assertEqual(facts["dataset_summary"]["hidden_duplicate_rows"], 10)
        self.assertIn("10 rows are duplicates once ID columns are ignored", inference["health_score"]["critical_issues"])
        self.assertTrue(any(e["rule_id"] == "R-INT-01" for e in inference["triggered_rules_log"]))
        self.assertTrue(any("R-INT-01" in s["message"] for s in inference["reasoning_trace"]))

    def test_exact_duplicates_are_not_double_counted(self):
        df = self.make_frame()
        df = pd.concat([df, df.iloc[[0, 1]]], ignore_index=True)  # two exact copies, same ids
        facts, _ = analyze(df)
        self.assertEqual(facts["dataset_summary"]["duplicate_rows"], 2)
        self.assertEqual(facts["dataset_summary"]["hidden_duplicate_rows"], 10)

    def test_no_identifier_means_no_hidden_duplicates(self):
        df = pd.DataFrame({"a": ["x", "y"] * 10, "b": [1.0, 2.0] * 10})
        facts, inference = analyze(df)
        self.assertEqual(facts["dataset_summary"]["hidden_duplicate_rows"], 0)
        self.assertFalse(any(e["rule_id"] == "R-INT-01" for e in inference["triggered_rules_log"]))

    def test_preprocessor_deduplicates_ignoring_ids_and_logs_it(self):
        df = self.make_frame()
        facts, inference = analyze(df)
        out, report = execute_preprocessing_pipeline(df, facts, inference)
        self.assertEqual(len(out), 20)
        self.assertNotIn("user_id", out.columns)
        self.assertTrue(any("ID columns cannot hide duplicates" in s for s in report["steps_executed"]))

    def test_drop_duplicates_false_keeps_all_rows(self):
        df = self.make_frame()
        facts, inference = analyze(df)
        out, _ = execute_preprocessing_pipeline(df, facts, inference, recipe_overrides={"drop_duplicates": False})
        self.assertEqual(len(out), 30)


class TestStructuredMissingnessRule(unittest.TestCase):

    def make_frame(self):
        rng = np.random.default_rng(4)
        n = 100
        df = pd.DataFrame({
            "a": rng.normal(10, 1, n),
            "b": rng.normal(20, 1, n),
            "c": rng.normal(30, 1, n),
            "d": rng.normal(40, 1, n),
        })
        df.loc[[3, 40], ["a", "b"]] = np.nan   # a and b vanish together (2% each: below the usual indicator threshold)
        df.loc[[70, 71, 72, 73, 74, 75], "c"] = np.nan  # c is missing independently
        return df

    def test_r_imp_07_on_co_missing_columns_only(self):
        facts, inference = analyze(self.make_frame())
        self.assertTrue(facts["missing_corr_pairs"])
        self.assertIn("R-IMP-07", rules_fired(inference, "a"))
        self.assertIn("R-IMP-07", rules_fired(inference, "b"))
        self.assertNotIn("R-IMP-07", rules_fired(inference, "c"))
        self.assertNotIn("R-IMP-07", rules_fired(inference, "d"))

    def test_indicator_flag_is_set_on_imputation_parameters(self):
        _, inference = analyze(self.make_frame())
        self.assertTrue(inference["column_recommendations"]["a"]["imputation"]["parameters"]["add_indicator"])
        self.assertTrue(inference["column_recommendations"]["b"]["imputation"]["parameters"]["add_indicator"])
        # c: 6% missing -> indicator by the ordinary >= 3% rule; d has nothing missing
        self.assertIsNone(inference["column_recommendations"]["d"]["imputation"])

    def test_preprocessor_creates_was_missing_columns(self):
        df = self.make_frame()
        facts, inference = analyze(df)
        out, _ = execute_preprocessing_pipeline(df, facts, inference)
        self.assertIn("a_was_missing", out.columns)
        self.assertIn("b_was_missing", out.columns)
        self.assertEqual(int(out["a_was_missing"].sum()), 2)

    def test_without_co_missingness_low_missing_gets_no_indicator(self):
        rng = np.random.default_rng(9)
        df = pd.DataFrame({"a": rng.normal(10, 1, 100), "b": rng.normal(20, 1, 100)})
        df.loc[[3, 40], "a"] = np.nan
        df.loc[[10, 11, 12], "b"] = np.nan  # b goes missing in different rows
        _, inference = analyze(df)
        self.assertNotIn("R-IMP-07", rules_fired(inference, "a"))
        self.assertFalse(inference["column_recommendations"]["a"]["imputation"]["parameters"]["add_indicator"])


class TestRepairsInInference(unittest.TestCase):

    def test_repairs_are_traced_and_counted_but_do_not_change_score(self):
        df = pd.DataFrame({"a": np.arange(30.0), "b": ["x", "y", "z"] * 10})
        repairs = [
            {"rule_id": "R-QLT-01", "rule_name": "Disguised Missing Values", "column": "b",
             "severity": "WARNING", "affected_count": 3, "description": "d", "examples": []},
            {"rule_id": "R-QLT-03", "rule_name": "Numeric Stored as Text", "column": "a",
             "severity": "WARNING", "affected_count": 30, "description": "d", "examples": []},
        ]
        facts = extract_dataset_facts(df)
        plain = run_expert_inference(facts)
        repaired = run_expert_inference(facts, repairs=repairs)
        steps = [s for s in repaired["reasoning_trace"] if s["phase"] == "DATA_QUALITY_REPAIR"]
        self.assertEqual(len(steps), 2)
        self.assertIn("R-QLT-01", steps[0]["message"])
        self.assertEqual(repaired["health_score"]["repairs_applied"], 2)
        self.assertEqual(plain["health_score"]["repairs_applied"], 0)
        self.assertEqual(repaired["health_score"]["critical_issues"], plain["health_score"]["critical_issues"])
        self.assertEqual(plain["health_score"]["overall_score"], repaired["health_score"]["overall_score"])
        self.assertEqual(plain["health_score"]["sub_scores"], repaired["health_score"]["sub_scores"])

    def test_no_repairs_means_no_trace_steps(self):
        facts = extract_dataset_facts(pd.DataFrame({"a": np.arange(30.0)}))
        inference = run_expert_inference(facts)
        self.assertFalse(any(s["phase"] == "DATA_QUALITY_REPAIR" for s in inference["reasoning_trace"]))


if __name__ == "__main__":
    unittest.main()
