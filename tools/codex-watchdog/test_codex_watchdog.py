import importlib.util
import sys
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).with_name("codex_watchdog.py")
SPEC = importlib.util.spec_from_file_location("codex_watchdog", MODULE_PATH)
watchdog = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules[SPEC.name] = watchdog
SPEC.loader.exec_module(watchdog)


class CodexWatchdogTests(unittest.TestCase):
    def test_parse_elapsed(self):
        self.assertEqual(watchdog.parse_elapsed("02:03"), 123)
        self.assertEqual(watchdog.parse_elapsed("01:02:03"), 3723)
        self.assertEqual(watchdog.parse_elapsed("2-01:02:03"), 176523)

    def test_process_markers_do_not_include_generic_node(self):
        self.assertNotIn("node", watchdog.PROCESS_MARKERS)
        self.assertIn("codex-code-mode-host", watchdog.PROCESS_MARKERS)

    def test_thresholds_require_persistence(self):
        self.assertGreaterEqual(watchdog.HIGH_CPU_STREAK * watchdog.SAMPLE_SECONDS, 180)
        self.assertGreaterEqual(watchdog.PROCESS_FLOOR, 20)

    def test_fast_disk_drop_is_diagnostic_only_when_space_is_ample(self):
        gib = 1024**3
        self.assertIsNone(
            watchdog.disk_drop_reason(
                free_bytes=50 * gib,
                fast_drop_bytes=3 * gib,
                sustained_drop_bytes=3 * gib,
            )
        )

    def test_fast_disk_drop_warns_when_free_space_is_getting_low(self):
        gib = 1024**3
        reason = watchdog.disk_drop_reason(
            free_bytes=15 * gib,
            fast_drop_bytes=2 * gib,
            sustained_drop_bytes=2 * gib,
        )
        self.assertIn("within ten minutes", reason or "")
        self.assertIn("15.00 GiB free", reason or "")

    def test_sustained_disk_drop_warns_even_when_space_is_ample(self):
        gib = 1024**3
        reason = watchdog.disk_drop_reason(
            free_bytes=50 * gib,
            fast_drop_bytes=2 * gib,
            sustained_drop_bytes=6 * gib,
        )
        self.assertIn("within thirty minutes", reason or "")


if __name__ == "__main__":
    unittest.main()
