import io
import os
import subprocess
import sys
import unittest
from pathlib import Path
from unittest import mock

import pandas as pd
from fastapi.testclient import TestClient

from backend.app import main as main_module
from backend.app.main import app
from backend.app.session import session_manager

REPO_ROOT = Path(__file__).resolve().parents[1]


def workbook_bytes(sheets):
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="openpyxl") as writer:
        for name, frame in sheets.items():
            frame.to_excel(writer, sheet_name=name, index=False)
    return buffer.getvalue()


DIRTY_CSV = ("price,flag,src\n" + "".join(
    f"\"${i * 10 + 1:,}\",{'yes' if i % 2 else 'no'},{'web' if i % 3 else '?'}\n" for i in range(1, 41)
)).encode()


class TestUploadLimit(unittest.TestCase):

    def setUp(self):
        self.client = TestClient(app)

    def test_oversized_upload_gets_413_with_clear_message(self):
        with mock.patch.object(main_module, "MAX_UPLOAD_BYTES", 1024 * 1024):
            big = b"a,b\n" + b"1,2\n" * (300 * 1024)  # ~1.2 MB
            res = self.client.post("/api/upload", files={"file": ("big.csv", big)})
        self.assertEqual(res.status_code, 413)
        self.assertIn("1 MB upload limit", res.json()["detail"])

    def test_upload_at_the_limit_is_accepted(self):
        data = b"a,b\n1,2\n3,4\n"
        with mock.patch.object(main_module, "MAX_UPLOAD_BYTES", len(data)):
            res = self.client.post("/api/upload", files={"file": ("ok.csv", data)})
        self.assertEqual(res.status_code, 200)

    def test_limit_can_be_set_with_environment_variable(self):
        env = dict(os.environ, DATALYSIS_MAX_UPLOAD_MB="3")
        out = subprocess.run(
            [sys.executable, "-c", "from backend.app.main import MAX_UPLOAD_BYTES; print(MAX_UPLOAD_BYTES)"],
            cwd=REPO_ROOT, env=dict(env, PYTHONPATH=str(REPO_ROOT)), capture_output=True, text=True, timeout=120,
        )
        self.assertEqual(out.stdout.strip(), str(3 * 1024 * 1024), out.stderr)

    def test_default_limit_is_200_mb(self):
        if "DATALYSIS_MAX_UPLOAD_MB" not in os.environ:
            self.assertEqual(main_module.MAX_UPLOAD_BYTES, 200 * 1024 * 1024)


class TestExcelSheets(unittest.TestCase):

    def setUp(self):
        self.client = TestClient(app)
        self.book = workbook_bytes({
            "First": pd.DataFrame({"a": [1, 2, 3], "b": [4, 5, 6]}),
            "Second": pd.DataFrame({"x": ["p", "q", "r"], "y": [7, 8, 9]}),
        })

    def test_default_is_first_sheet_and_lists_all_sheets(self):
        res = self.client.post("/api/upload", files={"file": ("book.xlsx", self.book)})
        self.assertEqual(res.status_code, 200)
        meta = res.json()["metadata"]
        self.assertEqual(meta["sheet_name"], "First")
        self.assertEqual(meta["all_sheets"], ["First", "Second"])
        self.assertEqual(set(res.json()["facts"]["columns"]), {"a", "b"})

    def test_sheet_parameter_selects_by_name(self):
        res = self.client.post("/api/upload?sheet=Second", files={"file": ("book.xlsx", self.book)})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["metadata"]["sheet_name"], "Second")
        self.assertEqual(set(res.json()["facts"]["columns"]), {"x", "y"})

    def test_unknown_sheet_is_400_and_lists_available_sheets(self):
        res = self.client.post("/api/upload?sheet=Nope", files={"file": ("book.xlsx", self.book)})
        self.assertEqual(res.status_code, 400)
        self.assertIn("Sheet 'Nope' not found", res.json()["detail"])
        self.assertIn("First, Second", res.json()["detail"])

    def test_non_excel_metadata_has_no_sheet_list(self):
        res = self.client.post("/api/upload", files={"file": ("a.csv", b"a,b\n1,2\n3,4\n")})
        self.assertIsNone(res.json()["metadata"]["all_sheets"])


class TestAutoRepairFlag(unittest.TestCase):

    def setUp(self):
        self.client = TestClient(app)

    def upload(self, sid, query=""):
        return self.client.post(f"/api/upload{query}", files={"file": ("dirty.csv", DIRTY_CSV)},
                                headers={"X-Session-ID": sid})

    def test_repairs_applied_by_default(self):
        res = self.upload("repair-default")
        self.assertEqual(res.status_code, 200)
        body = res.json()
        rule_ids = {r["rule_id"] for r in body["repairs"]}
        self.assertTrue({"R-QLT-01", "R-QLT-03", "R-QLT-04"} <= rule_ids)
        columns = body["facts"]["columns"]
        self.assertTrue(columns["price"]["inferred_type"].startswith("numerical"))
        self.assertEqual(columns["flag"]["inferred_type"], "boolean")
        phases = [s["phase"] for s in body["inference"]["reasoning_trace"]]
        self.assertEqual(phases.count("DATA_QUALITY_REPAIR"), len(body["repairs"]))
        health = body["inference"]["health_score"]
        self.assertEqual(health["repairs_applied"], len(body["repairs"]))
        self.assertFalse(any("repairs applied" in c for c in health["critical_issues"]))  # not a critical issue
        for repair in body["repairs"]:
            self.assertEqual(set(repair), {"rule_id", "rule_name", "column", "severity",
                                           "affected_count", "description", "examples", "replay"})

    def test_session_keeps_the_untouched_original(self):
        self.upload("repair-session")
        session = session_manager.get("repair-session")
        self.assertEqual(session.original_df["price"].iloc[0], "$11")        # exactly as parsed
        self.assertEqual(float(session.raw_df["price"].iloc[0]), 11.0)        # repaired copy used downstream
        self.assertEqual(len(session.repairs), 3)

    def test_auto_repair_false_skips_the_sanitizer(self):
        res = self.upload("repair-off", "?auto_repair=false")
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body["repairs"], [])
        self.assertNotIn("numerical", body["facts"]["columns"]["price"]["inferred_type"])
        self.assertFalse(any(s["phase"] == "DATA_QUALITY_REPAIR" for s in body["inference"]["reasoning_trace"]))

    def test_load_sample_accepts_auto_repair(self):
        on = self.client.post("/api/load-sample/titanic", headers={"X-Session-ID": "sample-on"})
        off = self.client.post("/api/load-sample/titanic?auto_repair=false", headers={"X-Session-ID": "sample-off"})
        self.assertEqual(on.status_code, 200)
        self.assertEqual(off.status_code, 200)
        self.assertEqual(off.json()["repairs"], [])
        self.assertIn("repairs", on.json())

    def test_process_and_downloads_work_on_repaired_data(self):
        self.upload("repair-process")
        headers = {"X-Session-ID": "repair-process"}
        proc = self.client.post("/api/process", headers=headers, json={})
        self.assertEqual(proc.status_code, 200)
        self.assertEqual(proc.json()["final_missing_cells"], 0)
        for fmt in ("csv", "excel", "parquet", "sqlite"):
            self.assertEqual(self.client.get(f"/api/download-cleaned?format={fmt}", headers=headers).status_code, 200, fmt)


class TestNewFactsInResponse(unittest.TestCase):

    def test_dataset_rules_are_serialised_in_the_analysis_response(self):
        rows = ["id,a,b,rare,v"]
        for i in range(200):
            a = "" if i in (3, 40) else f"{i}.5"
            b = "" if i in (3, 40) else f"{i}.25"
            rows.append(f"u{i:03d},{a},{b},{'y' if i == 7 else 'x'},{i % 17}")
        # ten rows repeating other rows under a new id (rows 3 and 7 differ in a or rare, so 8 are true duplicates)
        for i in range(10):
            rows.append(f"dup{i:03d},{i}.5,{i}.25,x,{i % 17}")
        csv_bytes = os.linesep.join(rows).encode()
        res = TestClient(app).post("/api/upload", files={"file": ("rules.csv", csv_bytes)})
        self.assertEqual(res.status_code, 200)
        body = res.json()
        logged = {(e["column"], e["rule_id"]) for e in body["inference"]["triggered_rules_log"]}
        self.assertIn(("rare", "R-FLT-04"), logged)
        self.assertIn(("a", "R-IMP-07"), logged)
        self.assertIn(("(dataset)", "R-INT-01"), logged)
        self.assertTrue(body["facts"]["columns"]["rare"]["is_quasi_constant"])
        self.assertGreater(body["facts"]["columns"]["rare"]["dominant_value_pct"], 99)
        self.assertEqual(body["facts"]["dataset_summary"]["hidden_duplicate_rows"], 8)


class TestTargetPipelineDownload(unittest.TestCase):

    def test_pipeline_is_regenerated_when_target_is_chosen(self):
        client = TestClient(app)
        headers = {"X-Session-ID": "pipeline-target"}
        client.post("/api/load-sample/titanic", headers=headers)
        before = client.get("/api/download-pipeline", headers=headers).text
        self.assertIn("TARGET_COLUMN = None", before)
        client.post("/api/supervised/target-analysis?target=Survived", headers=headers)
        after = client.get("/api/download-pipeline", headers=headers).text
        self.assertIn("TARGET_COLUMN = 'Survived'", after)
        self.assertIn("train_test_split", after)
        ns = {}
        exec(compile(after, "<pipeline>", "exec"), ns)
        self.assertIn("clean_and_transform", ns)


if __name__ == "__main__":
    unittest.main()
