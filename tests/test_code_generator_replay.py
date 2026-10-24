import io
import unittest

import numpy as np
import pandas as pd
from fastapi.testclient import TestClient

from backend.app.expert_system.code_generator import generate_python_pipeline_code
from backend.app.expert_system.engine import run_expert_inference
from backend.app.expert_system.fact_extractor import extract_dataset_facts
from backend.app.expert_system.sanitizer import sanitize_dataframe
from backend.app.main import app


def dirty_frame(n=120, price_name="price"):
    """A raw frame that triggers every R-QLT rule family the generated script has to replay."""
    rng = np.random.default_rng(7)
    return pd.DataFrame({
        price_name: [f"${int(v):,}" for v in rng.integers(100, 9000, n)],          # R-QLT-03 (and thousands)
        "city": rng.choice(["Paris", "paris ", "Rome", "ROME", "?", "Oslo"], n),   # R-QLT-07, 01, 05
        "flag": rng.choice(["Yes", " no", "YES", "No"], n),                        # R-QLT-04
        "age": np.where(rng.random(n) < 0.1, -999, rng.normal(40, 8, n).round(1)),  # R-QLT-02
        "ratio": np.where(rng.random(n) < 0.05, np.inf, rng.normal(1, 0.2, n)),    # R-QLT-06
        "score": rng.normal(0, 1, n),
    })


def build_script(raw, target=None):
    """Profile the repaired frame exactly like main.analyze_and_cache, then generate and exec the script."""
    repaired, repairs = sanitize_dataframe(raw)
    facts = extract_dataset_facts(repaired)
    inference = run_expert_inference(facts, repairs=repairs)
    code = generate_python_pipeline_code(facts, inference, target_col=target, repairs=repairs)
    namespace = {}
    exec(compile(code, "<generated>", "exec"), namespace)
    return code, namespace, repaired, repairs


class TestPipelineReplaysRepairs(unittest.TestCase):

    def test_script_runs_on_the_raw_dirty_frame(self):
        raw = dirty_frame()
        _, ns, _, repairs = build_script(raw)
        self.assertTrue({"R-QLT-01", "R-QLT-02", "R-QLT-03", "R-QLT-04", "R-QLT-05", "R-QLT-06", "R-QLT-07"}
                        <= {r["rule_id"] for r in repairs})
        result = ns["clean_and_transform"](raw)  # used to fail: could not convert string to float: '$3,282'
        self.assertIsInstance(result, pd.DataFrame)
        self.assertEqual(int(result.isna().sum().sum()), 0)
        self.assertTrue(all(isinstance(c, str) for c in result.columns))

    def test_replay_gives_the_same_frame_as_the_sanitizer(self):
        raw = dirty_frame()
        _, ns, repaired, _ = build_script(raw)
        replayed = ns["repair_data_quality"](raw)
        pd.testing.assert_frame_equal(replayed, repaired)  # values and dtypes
        pd.testing.assert_frame_equal(raw, dirty_frame())  # the input frame is not modified

    def test_replay_matches_on_edge_dtypes(self):
        """Accounting negatives, percent signs, missing cells, plain int sentinels and object columns."""
        n = 60
        raw = pd.DataFrame({
            "balance": (["(1,250.50)", "$99", "7%", None, "3.5"] * 12),
            "level": ([-1, -999, 4, 5, 6, 7] * 10),
            "code": (["x", " X", "y", None, "Y", "n/a"] * 10),
        })
        self.assertEqual(len(raw), n)
        _, ns, repaired, repairs = build_script(raw)
        self.assertTrue(repairs)
        pd.testing.assert_frame_equal(ns["repair_data_quality"](raw), repaired)

    def test_with_target_the_train_test_path_works_on_raw_data(self):
        raw = dirty_frame()
        code, ns, _, _ = build_script(raw, target="flag")
        self.assertIn("TARGET_COLUMN = 'flag'", code)
        X_train, X_test, y_train, y_test = ns["clean_and_transform"](raw)
        self.assertEqual(len(X_train) + len(X_test), 120)
        self.assertEqual(X_train.shape[1], X_test.shape[1])
        self.assertEqual(int(X_train.isna().sum().sum()) + int(X_test.isna().sum().sum()), 0)
        self.assertEqual(set(y_train.unique()) | set(y_test.unique()), {0, 1})  # target repaired too: yes/no -> 1/0
        self.assertNotIn("flag", " ".join(X_train.columns))

    def test_no_repairs_means_a_noop_function(self):
        clean = pd.DataFrame({"a": np.arange(40.0), "b": np.arange(40.0) ** 2})
        code, ns, _, repairs = build_script(clean)
        self.assertEqual(repairs, [])
        self.assertEqual(ns["DATA_QUALITY_REPAIRS"], [])
        self.assertIs(ns["repair_data_quality"](clean), clean)
        self.assertNotIn("replay_numeric_text", code)  # no unused helper code
        self.assertEqual(ns["clean_and_transform"](clean).shape[0], 40)

    def test_repairs_argument_is_optional(self):
        raw = dirty_frame()
        repaired, repairs = sanitize_dataframe(raw)
        facts = extract_dataset_facts(repaired)
        inference = run_expert_inference(facts, repairs=repairs)
        code = generate_python_pipeline_code(facts, inference)  # old call style
        ns = {}
        exec(compile(code, "<generated>", "exec"), ns)
        self.assertEqual(ns["DATA_QUALITY_REPAIRS"], [])
        self.assertEqual(ns["clean_and_transform"](repaired).shape[0], 120)

    def test_columns_missing_from_the_incoming_frame_are_skipped(self):
        raw = dirty_frame()
        _, ns, _, _ = build_script(raw)
        partial = raw.drop(columns=["price", "age"])
        replayed = ns["repair_data_quality"](partial)
        self.assertEqual(list(replayed.columns), list(partial.columns))
        self.assertEqual(replayed["flag"].dtype, "int64")

    def test_quotes_backslashes_and_unicode_in_names_and_values_stay_valid_python(self):
        name = 'price "q" \\ \'x\' ₹名前'
        raw = dirty_frame(price_name=name)
        raw["city"] = raw["city"].replace({"Oslo": 'O"s\\lo\'é'})
        code, ns, repaired, _ = build_script(raw)
        compile(code, "<generated>", "exec")
        self.assertIn(name, [r["column"] for r in ns["DATA_QUALITY_REPAIRS"]])
        pd.testing.assert_frame_equal(ns["repair_data_quality"](raw), repaired)
        self.assertEqual(int(ns["clean_and_transform"](raw).isna().sum().sum()), 0)


class TestReplayThroughTheApi(unittest.TestCase):

    def setUp(self):
        self.client = TestClient(app)
        self.raw = dirty_frame()
        csv = self.raw.to_csv(index=False).encode()
        self.headers = {"X-Session-ID": "replay-api"}
        res = self.client.post("/api/upload", files={"file": ("dirty.csv", csv)}, headers=self.headers)
        self.assertEqual(res.status_code, 200)

    def run_downloaded_script(self):
        res = self.client.get("/api/download-pipeline", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        namespace = {}
        exec(compile(res.text, "<downloaded>", "exec"), namespace)
        return res.text, namespace

    def test_downloaded_script_runs_on_the_raw_csv(self):
        code, ns = self.run_downloaded_script()
        self.assertIn("DATA_QUALITY_REPAIRS", code)
        raw_from_disk = pd.read_csv(io.StringIO(self.raw.to_csv(index=False)))
        result = ns["clean_and_transform"](raw_from_disk)
        self.assertEqual(int(result.isna().sum().sum()), 0)

    def test_setting_a_target_keeps_the_repairs_in_the_script(self):
        res = self.client.post("/api/supervised/target-analysis?target=flag", headers=self.headers)
        self.assertEqual(res.status_code, 200, res.text)
        code, ns = self.run_downloaded_script()
        self.assertIn("TARGET_COLUMN = 'flag'", code)
        self.assertTrue(ns["DATA_QUALITY_REPAIRS"])
        raw_from_disk = pd.read_csv(io.StringIO(self.raw.to_csv(index=False)))
        X_train, X_test, _, _ = ns["clean_and_transform"](raw_from_disk)
        self.assertEqual(len(X_train) + len(X_test), 120)


if __name__ == "__main__":
    unittest.main()
