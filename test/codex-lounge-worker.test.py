#!/usr/bin/env python3
import importlib.util
import os
import tempfile
import unittest
from pathlib import Path


MODULE_PATH = Path(__file__).parents[1] / "tools/vps/codex-lounge-worker.py"
spec = importlib.util.spec_from_file_location("codex_lounge_worker", MODULE_PATH)
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)


class LoungeWorkerTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        worker.ROOT = Path(self.temp.name)
        self.paths = worker.dirs()

    def tearDown(self):
        self.temp.cleanup()

    def test_claim_and_recover_are_lossless(self):
        letter = self.paths["inbox"] / "hello.md"
        letter.write_text("宝宝在吗", encoding="utf-8")
        claimed = worker.claim_one(self.paths)
        self.assertEqual(claimed.read_text(encoding="utf-8"), "宝宝在吗")
        worker.recover_claims(self.paths)
        self.assertEqual(letter.read_text(encoding="utf-8"), "宝宝在吗")

    def test_unsafe_filename_is_ignored(self):
        (self.paths["inbox"] / "有空格.md").write_text("x", encoding="utf-8")
        self.assertIsNone(worker.claim_one(self.paths))

    def test_jsonl_thread_id(self):
        events = self.paths["sessions"] / "events.jsonl"
        events.write_text('{"type":"thread.started","thread_id":"thread-test"}\n', encoding="utf-8")
        self.assertEqual(worker.session_id_from_jsonl(events), "thread-test")

    def test_reply_is_atomic_and_input_is_archived(self):
        claimed = self.paths["processing"] / "one.md"
        claimed.write_text("第一封", encoding="utf-8")
        original = worker.invoke
        worker.invoke = lambda letter, paths, stem: "收到第一封"
        try:
            worker.handle(claimed, self.paths)
        finally:
            worker.invoke = original
        self.assertEqual((self.paths["replies"] / "one.reply.md").read_text(encoding="utf-8"), "收到第一封\n")
        self.assertFalse(claimed.exists())
        self.assertEqual(len(list(self.paths["sessions"].glob("*-one.md"))), 1)


if __name__ == "__main__":
    unittest.main()
