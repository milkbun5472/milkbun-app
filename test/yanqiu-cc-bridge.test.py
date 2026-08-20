import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


MODULE_PATH = Path(__file__).parents[1] / "tools/yanqiu-cc-bridge/bridge.py"
SPEC = importlib.util.spec_from_file_location("yanqiu_cc_bridge", MODULE_PATH)
bridge = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(bridge)


class BridgeTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.db = Path(self.tmp.name) / "jobs.sqlite3"
        self.wake = Path(self.tmp.name) / "app_tool_inbox.jsonl"
        self.session = "64d0d7a8-de5a-43b3-8c6f-9ebceec8fe17"
        self.pin = patch.object(bridge, "pinned_session", return_value=(self.session, Path("/fixed.jsonl")))
        self.pin.start()

    def tearDown(self):
        self.pin.stop()
        self.tmp.cleanup()

    def test_idempotent_enqueue_and_single_claim(self):
        first = bridge.enqueue("Read", {"file_path": "/tmp/a"}, "app-message:1", purpose="看 Lisa 指定的文件", db_path=self.db, wake_path=self.wake)
        second = bridge.enqueue("Read", {"file_path": "/tmp/a"}, "app-message:1", db_path=self.db, wake_path=self.wake)
        self.assertEqual(first["id"], second["id"])
        self.assertEqual(len(self.wake.read_text().splitlines()), 1)
        claimed = bridge.claim(self.session, db_path=self.db)
        self.assertEqual(claimed["job_id"], first["id"])
        self.assertEqual(claimed["purpose"], "看 Lisa 指定的文件")
        self.assertIsNone(bridge.claim(self.session, db_path=self.db))

    def test_other_window_cannot_claim(self):
        bridge.enqueue("Grep", {"pattern": "x"}, "app-message:2", db_path=self.db, wake_path=self.wake)
        with self.assertRaisesRegex(bridge.BridgeError, "不是固定言秋会话"):
            bridge.claim("00000000-0000-0000-0000-000000000000", db_path=self.db)

    def test_claim_token_required_and_completion_is_idempotent(self):
        job = bridge.enqueue("Glob", {"pattern": "*.md"}, "app-message:3", db_path=self.db, wake_path=self.wake)
        claimed = bridge.claim(self.session, db_path=self.db)
        with self.assertRaisesRegex(bridge.BridgeError, "租约无效"):
            bridge.complete(self.session, job["id"], "wrong", {"files": []}, db_path=self.db)
        done = bridge.complete(self.session, job["id"], claimed["claim_token"], {"files": ["a.md"]}, db_path=self.db)
        self.assertFalse(done["duplicate"])
        repeated = bridge.complete(self.session, job["id"], claimed["claim_token"], {"files": ["a.md"]}, db_path=self.db)
        self.assertTrue(repeated["duplicate"])
        self.assertEqual(bridge.result(job["id"], db_path=self.db)["result"], {"files": ["a.md"]})

    def test_write_tool_is_queued_for_app_approved_execution(self):
        job = bridge.enqueue("Write", {"file_path": "/tmp/a", "content": "x"}, "app-message:4", db_path=self.db, wake_path=self.wake)
        self.assertEqual(job["status"], "queued")

    def test_second_wave_mcp_tools_are_classified(self):
        self.assertIn("list_photos", bridge.READ_ONLY_TOOLS)
        self.assertIn("post_moment", bridge.MUTATING_TOOLS)
        self.assertIn("game_turn", bridge.PASS_THROUGH_TOOLS)
        self.assertNotIn("get_save_key", bridge.ALLOWED_TOOLS)

    def test_game_turn_is_claimed_as_pass_through(self):
        job = bridge.enqueue("game_turn", {"turn_id": "uno-1", "hand": ["R5"]}, "game-turn:uno-1", db_path=self.db, wake_path=self.wake)
        claimed = bridge.claim(self.session, db_path=self.db)
        self.assertEqual(claimed["job_id"], job["id"])
        self.assertTrue(claimed["pass_through"])

    def test_cloud_request_uses_existing_chat_ledger(self):
        remote = {"id": "11111111-1111-1111-1111-111111111111", "char_id": "yanqiu", "source_message_id": "app-msg-1", "metadata": {"bridge_kind": "app_cc_request", "bridge_state": "queued", "tool_name": "Grep", "arguments": {"pattern": "needle"}}}
        calls = []
        def fake(path, method="GET", body=None, prefer=""):
            calls.append((path, method, body, prefer))
            return [remote] if method == "GET" and "bridge_state=eq.queued" in path else None
        with patch.object(bridge, "cloud_yanqiu_scope", return_value=("user-1", "yanqiu")), patch.object(bridge, "cloud_request", side_effect=fake):
            out = bridge.sync_cloud_once(db_path=self.db, wake_path=self.wake)
        self.assertEqual(out["relayed"], 1)
        self.assertTrue(any("/rest/v1/chat_messages" in path and method == "PATCH" for path, method, _, _ in calls))
        self.assertFalse(any("app_cc_tool_jobs" in path for path, _, _, _ in calls))

    def test_completed_cloud_job_publishes_hidden_ledger_result(self):
        remote_id = "22222222-2222-2222-2222-222222222222"
        job = bridge.enqueue("Glob", {"pattern": "*.md"}, "cloud:" + remote_id, db_path=self.db, wake_path=self.wake)
        claimed = bridge.claim(self.session, db_path=self.db)
        bridge.complete(self.session, job["id"], claimed["claim_token"], {"files": ["README.md"]}, db_path=self.db)
        calls = []
        def fake(path, method="GET", body=None, prefer=""):
            calls.append((path, method, body, prefer))
            return [] if method == "GET" else None
        with patch.object(bridge, "cloud_yanqiu_scope", return_value=("user-1", "yanqiu")), patch.object(bridge, "cloud_request", side_effect=fake):
            out = bridge.sync_cloud_once(db_path=self.db, wake_path=self.wake)
        self.assertEqual(out["results_synced"], 1)
        published = next(body for _, method, body, _ in calls if method == "POST")
        self.assertEqual(published["message_key"], "appcc:result:" + remote_id)
        self.assertEqual(published["metadata"]["bridge_kind"], "app_cc_result")


if __name__ == "__main__":
    unittest.main()
