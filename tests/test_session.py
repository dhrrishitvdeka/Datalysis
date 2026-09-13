import unittest
import time
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.session import SessionStore, DatasetSession


class TestSessionManager(unittest.TestCase):

    def test_session_creation_and_isolation(self):
        store = SessionStore(ttl_seconds=3600.0, max_sessions=10)
        sess_a = store.get_or_create("user-session-a")
        sess_b = store.get_or_create("user-session-b")

        sess_a.metadata = {"dataset": "dataset_A"}
        sess_b.metadata = {"dataset": "dataset_B"}

        self.assertNotEqual(sess_a.session_id, sess_b.session_id)
        self.assertEqual(store.get("user-session-a").metadata["dataset"], "dataset_A")
        self.assertEqual(store.get("user-session-b").metadata["dataset"], "dataset_B")

    def test_lru_eviction(self):
        store = SessionStore(ttl_seconds=3600.0, max_sessions=3)
        store.get_or_create("s1")
        time.sleep(0.01)
        store.get_or_create("s2")
        time.sleep(0.01)
        store.get_or_create("s3")
        time.sleep(0.01)
        
        # Access s1 to touch it
        store.get("s1")
        time.sleep(0.01)
        
        # Adding s4 should evict s2 (least recently accessed)
        store.get_or_create("s4")
        self.assertIsNotNone(store.get("s1"))
        self.assertIsNone(store.get("s2"))
        self.assertIsNotNone(store.get("s3"))
        self.assertIsNotNone(store.get("s4"))

    def test_session_expiration(self):
        store = SessionStore(ttl_seconds=0.05, max_sessions=10)
        sess = store.get_or_create("temp-session")
        self.assertIsNotNone(store.get("temp-session"))
        time.sleep(0.08)
        self.assertIsNone(store.get("temp-session"))

    def test_api_multi_session_header_isolation(self):
        client = TestClient(app)

        # Load titanic into session 1
        headers_1 = {"X-Session-ID": "session-1001"}
        res1 = client.post("/api/load-sample/titanic", headers=headers_1)
        self.assertEqual(res1.status_code, 200)
        self.assertEqual(res1.headers.get("x-session-id"), "session-1001")

        # Load sensor telemetry into session 2
        headers_2 = {"X-Session-ID": "session-1002"}
        res2 = client.post("/api/load-sample/sensors", headers=headers_2)
        self.assertEqual(res2.status_code, 200)
        self.assertEqual(res2.headers.get("x-session-id"), "session-1002")

        # Verify session 1 still has Titanic data
        res_scatter_1 = client.get("/api/visualize/scatter?x=Age&y=Fare", headers=headers_1)
        self.assertEqual(res_scatter_1.status_code, 200)
        self.assertIn("points", res_scatter_1.json())

        # Verify session 2 has Sensor columns
        res_scatter_2 = client.get("/api/visualize/scatter?x=Temperature_C&y=Humidity_Pct", headers=headers_2)
        self.assertEqual(res_scatter_2.status_code, 200)
        self.assertIn("points", res_scatter_2.json())

    def test_unauthenticated_clients_receive_distinct_isolated_sessions(self):
        # Client 1 loads Titanic without explicit session headers
        client1 = TestClient(app)
        res1 = client1.post("/api/load-sample/titanic")
        self.assertEqual(res1.status_code, 200)
        sid_1 = res1.json().get("session_id")
        self.assertIsNotNone(sid_1)

        # Client 2 connects without session headers or cookies
        client2 = TestClient(app)
        res2 = client2.get("/api/visualize/scatter?x=Age&y=Fare")
        # Must be rejected because Client 2 has not loaded any dataset (strict isolation)
        self.assertEqual(res2.status_code, 400)
        self.assertEqual(res2.json().get("detail"), "No dataset loaded.")

        # Client 2 loads telecom sample
        res2_load = client2.post("/api/load-sample/telecom")
        self.assertEqual(res2_load.status_code, 200)
        sid_2 = res2_load.json().get("session_id")
        self.assertNotEqual(sid_1, sid_2)


if __name__ == "__main__":
    unittest.main()
