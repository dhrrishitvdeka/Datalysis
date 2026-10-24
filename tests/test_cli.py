import contextlib
import io
import json
import os
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import pandas as pd

from backend.app import cli
from backend.app.sample_data import generate_messy_titanic

REPO_ROOT = Path(__file__).resolve().parents[1]

DIRTY_CSV = (
    "price,flag,city,名前\n"
    + "".join(
        f"\"${i * 10 + 1:,}\",{'yes' if i % 2 else 'no'},{'Paris' if i % 3 else '?'},{i}\n"
        for i in range(1, 41)
    )
)


def run_cli(*argv):
    """Runs cli.main() in-process; returns (exit_code, stdout)."""
    out = io.StringIO()
    code = 0
    with mock.patch.object(sys, "argv", ["datalysis", *argv]), contextlib.redirect_stdout(out):
        try:
            cli.main()
        except SystemExit as e:
            code = e.code or 0
    return code, out.getvalue()


class TestCleanCommand(unittest.TestCase):

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.dir = Path(self.tmp.name)
        self.titanic = self.dir / "titanic.csv"
        self.titanic_rows = len(generate_messy_titanic(n_rows=150))
        generate_messy_titanic(n_rows=150).to_csv(self.titanic, index=False)
        self.dirty = self.dir / "dirty.csv"
        self.dirty.write_text(DIRTY_CSV, encoding="utf-8")

    def tearDown(self):
        self.tmp.cleanup()

    def test_clean_without_target(self):
        out_path = self.dir / "clean.csv"
        code, text = run_cli("clean", str(self.titanic), "-o", str(out_path))
        self.assertEqual(code, 0, text)
        cleaned = pd.read_csv(out_path)
        self.assertGreater(len(cleaned), 0)
        self.assertEqual(int(cleaned.isna().sum().sum()), 0)
        self.assertNotIn("PassengerId", cleaned.columns)
        self.assertIn(f"Shape before: {self.titanic_rows} rows", text)
        self.assertIn(f"Shape after:  {len(cleaned)} rows x {cleaned.shape[1]} cols", text)
        self.assertIn("Steps executed:", text)

    def test_clean_with_target_keeps_labels_and_puts_target_last(self):
        out_path = self.dir / "clean_target.csv"
        code, text = run_cli("clean", str(self.titanic), "-o", str(out_path), "--target", "Survived")
        self.assertEqual(code, 0, text)
        cleaned = pd.read_csv(out_path)
        self.assertEqual(cleaned.columns[-1], "Survived")
        self.assertTrue(set(cleaned["Survived"].unique()) <= {0, 1})
        self.assertIn("Target: Survived (binary_classification)", text)

    def test_repairs_are_printed_and_applied(self):
        out_path = self.dir / "dirty_clean.csv"
        code, text = run_cli("clean", str(self.dirty), "-o", str(out_path))
        self.assertEqual(code, 0, text)
        self.assertIn("Data-quality repairs: 3", text)
        self.assertIn("R-QLT-03", text)
        cleaned = pd.read_csv(out_path)
        self.assertTrue(pd.api.types.is_numeric_dtype(cleaned["price"]))

    def test_no_repair_flag(self):
        out_path = self.dir / "dirty_raw.csv"
        code, text = run_cli("clean", str(self.dirty), "-o", str(out_path), "--no-repair")
        self.assertEqual(code, 0, text)
        self.assertIn("skipped (--no-repair)", text)
        self.assertNotIn("R-QLT", text)

    def test_format_is_inferred_from_extension(self):
        for name, check in (
            ("out.parquet", lambda p: pd.read_parquet(p)),
            ("out.xlsx", lambda p: pd.read_excel(p, sheet_name="Cleaned_Data")),
            ("out.db", self.read_sqlite),
        ):
            path = self.dir / name
            code, text = run_cli("clean", str(self.dirty), "-o", str(path))
            self.assertEqual(code, 0, text)
            self.assertGreater(len(check(path)), 0, name)

    @staticmethod
    def read_sqlite(path):
        conn = sqlite3.connect(path)
        try:
            return pd.read_sql("SELECT * FROM cleaned_data", conn)
        finally:
            conn.close()

    def test_explicit_format_overrides_extension(self):
        path = self.dir / "weird.out"
        code, _ = run_cli("clean", str(self.dirty), "-o", str(path), "--format", "parquet")
        self.assertEqual(code, 0)
        self.assertGreater(len(pd.read_parquet(path)), 0)

    def test_unknown_extension_without_format_is_an_error(self):
        code, _ = run_cli("clean", str(self.dirty), "-o", str(self.dir / "weird.out"))
        self.assertEqual(code, 2)

    def test_missing_file_and_unknown_target_exit_nonzero(self):
        code, _ = run_cli("clean", str(self.dir / "nope.csv"), "-o", str(self.dir / "o.csv"))
        self.assertEqual(code, 1)
        code, _ = run_cli("clean", str(self.titanic), "-o", str(self.dir / "o.csv"), "--target", "NoSuchColumn")
        self.assertEqual(code, 1)

    def test_audit_prints_repairs(self):
        report = self.dir / "report.json"
        code, text = run_cli("audit", str(self.dirty), "-o", str(report))
        self.assertEqual(code, 0, text)
        self.assertIn("Data-quality repairs: 3", text)
        self.assertTrue(report.exists())
        self.assertIn("R-QLT-03", report.read_text(encoding="utf-8"))

    def test_audit_no_repair_skips_the_sanitizer(self):
        report = self.dir / "report_raw.json"
        code, text = run_cli("audit", str(self.dirty), "-o", str(report), "--no-repair")
        self.assertEqual(code, 0, text)
        self.assertIn("skipped (--no-repair)", text)
        self.assertNotIn("R-QLT", text)
        saved = json.loads(report.read_text(encoding="utf-8"))
        self.assertEqual(saved["repairs"], [])
        self.assertNotIn("numerical", saved["facts"]["columns"]["price"]["inferred_type"])  # still text, as parsed

    def test_output_is_pure_ascii_on_a_cp1252_console(self):
        """Emojis (and non-latin column names) used to crash Windows consoles with UnicodeEncodeError."""
        out_path = self.dir / "sub_clean.csv"
        env = dict(os.environ, PYTHONIOENCODING="cp1252", PYTHONPATH=str(REPO_ROOT))
        for command in (
            ["clean", str(self.dirty), "-o", str(out_path)],
            ["audit", str(self.dirty)],
        ):
            result = subprocess.run(
                [sys.executable, "-m", "backend.app.cli", *command],
                cwd=REPO_ROOT, env=env, capture_output=True, timeout=300,
            )
            self.assertEqual(result.returncode, 0, result.stderr.decode("cp1252", errors="replace"))
            result.stdout.decode("ascii")  # raises if any non-ASCII character slipped through
            self.assertNotIn(b"Traceback", result.stderr)


if __name__ == "__main__":
    unittest.main()
