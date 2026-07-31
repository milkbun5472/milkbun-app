import math
import tempfile
import unittest
import wave
from pathlib import Path

from voice_prosody import ProsodyShadow, analyze_wav


def write_tone(path, *, hz=220, amplitude=0.25, seconds=1.2, rate=16_000):
    frames = bytearray()
    for index in range(int(seconds * rate)):
        value = int(32767 * amplitude * math.sin(2 * math.pi * hz * index / rate))
        frames.extend(value.to_bytes(2, "little", signed=True))
    with wave.open(str(path), "wb") as target:
        target.setnchannels(1)
        target.setsampwidth(2)
        target.setframerate(rate)
        target.writeframes(frames)


class VoiceProsodyTests(unittest.TestCase):
    def test_pitch_energy_and_duration_are_measured(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "voice.wav"
            write_tone(path)
            result = analyze_wav(path)
            self.assertAlmostEqual(1.2, result["duration_sec"], places=1)
            self.assertGreater(result["energy_peak"], 0.1)
            self.assertAlmostEqual(220, result["pitch_hz"]["median"], delta=12)

    def test_shadow_builds_baseline_without_injection(self):
        with tempfile.TemporaryDirectory() as tmp:
            tmp = Path(tmp)
            path = tmp / "voice.wav"
            write_tone(path)
            shadow = ProsodyShadow(tmp / "baseline.json", tmp / "shadow.jsonl")
            rows = [
                shadow.record(
                    job_id=f"job-{index}",
                    device_id="stack-1",
                    source="stackchan",
                    wav_path=path,
                )
                for index in range(9)
            ]
            self.assertEqual(9, rows[-1]["baseline_count"])
            self.assertTrue(rows[-1]["baseline_ready"])
            self.assertFalse(rows[-1]["injected"])
            self.assertEqual([], rows[-1]["observations"])
            self.assertEqual(9, len((tmp / "shadow.jsonl").read_text().splitlines()))

    def test_rejects_non_pcm_contract(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "stereo.wav"
            with wave.open(str(path), "wb") as target:
                target.setnchannels(2)
                target.setsampwidth(2)
                target.setframerate(16_000)
                target.writeframes(b"\0\0\0\0" * 100)
            with self.assertRaises(ValueError):
                analyze_wav(path)


if __name__ == "__main__":
    unittest.main()
