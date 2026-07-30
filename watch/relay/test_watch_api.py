import tempfile
import unittest
import wave
from pathlib import Path

from watch_api import (
    WatchTurnStore,
    complete_fake_turn,
    extract_multipart_file,
    normalize_watch_text,
    validate_wav,
)


def write_wav(path: Path, *, seconds=1.0, rate=16_000, channels=1):
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(channels)
        wav.setsampwidth(2)
        wav.setframerate(rate)
        wav.writeframes(b"\0\0" * int(seconds * rate) * channels)


class WatchAPIStoreTests(unittest.TestCase):
    def test_idempotency_survives_restart(self):
        with tempfile.TemporaryDirectory() as tmp:
            state = Path(tmp) / "turns.json"
            first, created = WatchTurnStore(state).create(
                device_id="watch-1", request_id="same-request"
            )
            second, created_again = WatchTurnStore(state).create(
                device_id="watch-1", request_id="same-request"
            )
            self.assertTrue(created)
            self.assertFalse(created_again)
            self.assertEqual(first.turn_id, second.turn_id)

    def test_turn_is_private_to_device(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = WatchTurnStore(Path(tmp) / "turns.json")
            turn, _ = store.create(device_id="watch-1", request_id="request")
            self.assertIsNotNone(store.get(device_id="watch-1", turn_id=turn.turn_id))
            self.assertIsNone(store.get(device_id="watch-2", turn_id=turn.turn_id))

    def test_fake_completion_is_durable(self):
        with tempfile.TemporaryDirectory() as tmp:
            state = Path(tmp) / "turns.json"
            store = WatchTurnStore(state)
            turn, _ = store.create(device_id="watch-1", request_id="request")
            complete_fake_turn(store, turn.turn_id)
            restored = WatchTurnStore(state).get(
                device_id="watch-1", turn_id=turn.turn_id
            )
            self.assertEqual("ready", restored.status)
            self.assertIn("还没有叫醒言秋", restored.reply_text)

    def test_accepts_contract_wav(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "voice.wav"
            write_wav(path, seconds=1.25)
            self.assertAlmostEqual(1.25, validate_wav(path), places=2)

    def test_rejects_wrong_sample_rate_and_long_audio(self):
        with tempfile.TemporaryDirectory() as tmp:
            wrong_rate = Path(tmp) / "wrong.wav"
            long_audio = Path(tmp) / "long.wav"
            write_wav(wrong_rate, rate=8_000)
            write_wav(long_audio, seconds=31)
            with self.assertRaises(ValueError):
                validate_wav(wrong_rate)
            with self.assertRaises(ValueError):
                validate_wav(long_audio)

    def test_extracts_watch_multipart_audio(self):
        boundary = "Cove-test"
        body = (
            b"--Cove-test\r\n"
            b'Content-Disposition: form-data; name="request_id"\r\n\r\n'
            b"request-1\r\n"
            b"--Cove-test\r\n"
            b'Content-Disposition: form-data; name="file"; filename="voice.wav"\r\n'
            b"Content-Type: audio/wav\r\n\r\n"
            b"RIFF-audio-bytes\r\n"
            b"--Cove-test--\r\n"
        )
        self.assertEqual(
            b"RIFF-audio-bytes",
            extract_multipart_file(
                f"multipart/form-data; boundary={boundary}", body
            ),
        )

    def test_normalizes_dictation_without_rewriting_words(self):
        self.assertEqual("宝宝 你在吗", normalize_watch_text("  宝宝\n你在吗  "))
        with self.assertRaises(ValueError):
            normalize_watch_text(" ")
        with self.assertRaises(ValueError):
            normalize_watch_text("字" * 501)

    def test_fake_text_turn_keeps_original_dictation(self):
        with tempfile.TemporaryDirectory() as tmp:
            store = WatchTurnStore(Path(tmp) / "turns.json")
            turn, _ = store.create(device_id="watch-1", request_id="request")
            completed = complete_fake_turn(
                store,
                turn.turn_id,
                transcript="宝宝，听得到吗？",
            )
            self.assertEqual("宝宝，听得到吗？", completed.transcript)


if __name__ == "__main__":
    unittest.main()
