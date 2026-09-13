import unittest
import io
from fastapi.testclient import TestClient
from backend.app.main import app


class TestAPIEndpoints(unittest.TestCase):

    def setUp(self):
        self.client = TestClient(app)

    def test_healthcheck(self):
        res = self.client.get("/api/health")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["status"], "ok")

    def test_sample_datasets_list(self):
        res = self.client.get("/api/sample-datasets")
        self.assertEqual(res.status_code, 200)
        samples = res.json()["samples"]
        self.assertGreaterEqual(len(samples), 3)

    def test_load_sample_titanic(self):
        res = self.client.post("/api/load-sample/titanic")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("inference", data)
        self.assertIn("facts", data)
        self.assertIn("health_score", data["inference"])
        self.assertEqual(data["metadata"]["filename"], "titanic_sample.csv")

    def test_upload_endpoint(self):
        csv_bytes = b"feature1,feature2,feature3\n1.0,hello,100\n2.5,world,200\n3.1,test,300\n"
        files = {"file": ("test_data.csv", io.BytesIO(csv_bytes), "text/csv")}
        res = self.client.post("/api/upload", files=files)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["metadata"]["filename"], "test_data.csv")
        self.assertEqual(data["facts"]["dataset_summary"]["row_count"], 3)

    def test_preprocessing_and_downloads(self):
        self.client.post("/api/load-sample/telecom")
        # Execute preprocessing with default recipe
        proc_res = self.client.post("/api/process")
        self.assertEqual(proc_res.status_code, 200)
        report = proc_res.json()
        self.assertEqual(report["final_missing_cells"], 0)

        # Test download cleaned CSV
        dl_res = self.client.get("/api/download-cleaned?format=csv")
        self.assertEqual(dl_res.status_code, 200)
        self.assertIn("text/csv", dl_res.headers.get("content-type", ""))

        # Test download cleaned Parquet
        parquet_res = self.client.get("/api/download-cleaned?format=parquet")
        self.assertEqual(parquet_res.status_code, 200)
        self.assertIn("application/octet-stream", parquet_res.headers.get("content-type", ""))

        # Test download cleaned Excel
        excel_res = self.client.get("/api/download-cleaned?format=excel")
        self.assertEqual(excel_res.status_code, 200)
        self.assertIn("spreadsheetml", excel_res.headers.get("content-type", ""))

        # Test download cleaned SQLite
        sqlite_res = self.client.get("/api/download-cleaned?format=sqlite")
        self.assertEqual(sqlite_res.status_code, 200)
        self.assertIn("application/x-sqlite3", sqlite_res.headers.get("content-type", ""))

        # Test download pipeline.py
        pipe_res = self.client.get("/api/download-pipeline")
        self.assertEqual(pipe_res.status_code, 200)
        self.assertIn("ColumnTransformer", pipe_res.text)

        # Test download notebook
        nb_res = self.client.get("/api/export/notebook")
        self.assertEqual(nb_res.status_code, 200)
        self.assertIn("ipynb", nb_res.headers.get("content-type", ""))

        # Test download schema
        schema_res = self.client.get("/api/export/schema")
        self.assertEqual(schema_res.status_code, 200)
        self.assertIn("DataFrameSchema", schema_res.text)

    def test_custom_recipe_processing(self):
        self.client.post("/api/load-sample/titanic")
        payload = {
            "column_overrides": {
                "PassengerId": {"drop": False}
            },
            "drop_duplicates": True
        }
        res = self.client.post("/api/process", json=payload)
        self.assertEqual(res.status_code, 200)
        report = res.json()
        self.assertIn("preview", report)
        self.assertTrue(any("PassengerId" in row for row in report["preview"]))

    def test_supervised_target_mode_endpoint(self):
        self.client.post("/api/load-sample/titanic")
        res = self.client.post("/api/supervised/target-analysis?target=Survived")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["target"], "Survived")
        self.assertEqual(data["task_type"], "binary_classification")
        self.assertIn("feature_importances", data)
        self.assertGreater(len(data["feature_importances"]), 0)

    def test_visualization_endpoints(self):
        # Load sample
        self.client.post("/api/load-sample/titanic")

        # 1. Scatter
        res_scatter = self.client.get("/api/visualize/scatter?x=Age&y=Fare&hue=Sex")
        self.assertEqual(res_scatter.status_code, 200)
        sc_data = res_scatter.json()
        self.assertIn("points", sc_data)
        self.assertIn("stats", sc_data)
        self.assertGreater(len(sc_data["points"]), 0)

        # 2. Grouped
        res_grouped = self.client.get("/api/visualize/grouped?cat=Pclass&num=Fare")
        self.assertEqual(res_grouped.status_code, 200)
        grp_data = res_grouped.json()
        self.assertIn("groups", grp_data)
        self.assertGreater(len(grp_data["groups"]), 0)

        # 3. Missingness matrix
        res_miss = self.client.get("/api/visualize/missingness")
        self.assertEqual(res_miss.status_code, 200)
        miss_data = res_miss.json()
        self.assertIn("chunks", miss_data)
        self.assertIn("columns", miss_data)


if __name__ == "__main__":
    unittest.main()
