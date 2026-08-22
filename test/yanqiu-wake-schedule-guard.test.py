import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


MODULE = Path(__file__).parents[1] / "tools" / "yanqiu-wake" / "wake_queue.py"
SPEC = importlib.util.spec_from_file_location("yanqiu_wake", MODULE)
wake = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(wake)


class ScheduleWakeupGuardTests(unittest.TestCase):
    def test_default_prompt_explicitly_forbids_hand_wound_clock(self):
        self.assertIn("常驻哨兵", wake.DEFAULT_HEARTBEAT_PROMPT)
        self.assertNotIn("ScheduleWakeup", wake.DEFAULT_HEARTBEAT_PROMPT)

    def test_manual_ticket_carries_the_guard(self):
        with tempfile.TemporaryDirectory() as directory:
            inbox = Path(directory) / "wake.jsonl"
            original_sources = wake.SOURCES
            original_shadow = wake.record_desire_shadow
            try:
                wake.SOURCES = {**wake.SOURCES, "heartbeat": inbox}
                wake.record_desire_shadow = lambda *_args, **_kwargs: None
                wake.enqueue_heartbeat()
            finally:
                wake.SOURCES = original_sources
                wake.record_desire_shadow = original_shadow
            row = json.loads(inbox.read_text(encoding="utf-8").strip())
            self.assertEqual(row["prompt"], wake.DEFAULT_HEARTBEAT_PROMPT)
            self.assertIn("常驻哨兵", row["prompt"])
            self.assertNotIn("ScheduleWakeup", row["prompt"])


if __name__ == "__main__":
    unittest.main()
