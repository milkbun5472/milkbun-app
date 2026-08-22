import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


MODULE = Path(__file__).parents[1] / "tools" / "yanqiu-desires" / "desire_shadow.py"
SPEC = importlib.util.spec_from_file_location("desire_shadow", MODULE)
desire = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(desire)


class DesireShadowTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.home = Path(self.temp.name)
        self.catalog = {
            "schema_version": 1,
            "owner": "yanqiu",
            "phase": "p0_draft_p1_shadow",
            "revision": 1,
            "cards": [
                {"id": "a", "title": "A", "kind": "play", "source": "self", "status": "draft", "interest": .9, "urge": .8, "satisfaction": 0, "fatigue": 0, "time_window": "any"},
                {"id": "b", "title": "B", "kind": "play", "source": "lisa", "status": "draft", "interest": .2, "urge": .1, "satisfaction": .8, "fatigue": .8, "time_window": "any"},
            ],
        }
        desire.atomic_json(self.home / "catalog.json", self.catalog)

    def tearDown(self):
        self.temp.cleanup()

    def test_shadow_is_deterministic_and_non_injecting(self):
        first = desire.shadow(self.home, 1_800_000_000_000, "heartbeat")
        second = desire.shadow(self.home, 1_800_000_000_000, "heartbeat")
        self.assertEqual(first["top"], second["top"])
        self.assertEqual(first["top"][0]["id"], "a")
        self.assertFalse(first["injected"])
        self.assertFalse(first["memory_written"])
        self.assertFalse(first["persona_written"])
        unchanged = json.loads((self.home / "catalog.json").read_text())
        self.assertEqual(unchanged, self.catalog)

    def test_compression_marker_has_no_transcript_data(self):
        row = desire.mark_compression(self.home, 1_800_000_000_001)
        self.assertEqual(row["kind"], "compression_marker")
        self.assertNotIn("session", row)
        self.assertNotIn("transcript", row)

    def test_recognition_is_explicit_and_atomic(self):
        desire.recognize(self.home, "a", "accept", "本人确认的进度")
        saved = json.loads((self.home / "catalog.json").read_text())
        card = saved["cards"][0]
        self.assertEqual(card["status"], "active")
        self.assertEqual(card["recognized_by"], "yanqiu")
        self.assertTrue(card["checkpoint_confirmed"])
        self.assertEqual(card["checkpoint"], "本人确认的进度")

    def test_existing_catalog_is_not_overwritten(self):
        original = (self.home / "catalog.json").read_text()
        with self.assertRaises(SystemExit):
            desire.initialize(self.home, MODULE.parent / "catalog.p0.json")
        self.assertEqual((self.home / "catalog.json").read_text(), original)

    def test_new_catalog_rejects_duplicate_ids(self):
        fresh = self.home / "fresh"
        template = self.home / "duplicate.json"
        duplicate = dict(self.catalog)
        duplicate["cards"] = [self.catalog["cards"][0], self.catalog["cards"][0]]
        template.write_text(json.dumps(duplicate), encoding="utf-8")
        with self.assertRaises(SystemExit):
            desire.initialize(fresh, template)
        self.assertFalse((fresh / "catalog.json").exists())


if __name__ == "__main__":
    unittest.main()
