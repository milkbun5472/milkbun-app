"""Local, model-free voice prosody shadow for Lisa's voice entrances.

Inspired by hmh323/mubai-ears (MIT): the useful boundary is the same—turn a
waveform into pitch, energy and pause evidence—but this deployment module uses
only Python's standard library.  It stays small enough for the existing relay,
never uploads audio, never labels an emotion, and never injects its result into
a character prompt while shadow mode is active.
"""

from __future__ import annotations

import array
import json
import math
import os
import statistics
import time
import wave
from pathlib import Path


VERSION = 1
BASELINE_TARGET = 8
MAX_SAMPLES = 40


def _median(values):
    clean = [float(value) for value in values if math.isfinite(float(value))]
    return statistics.median(clean) if clean else None


def _mad(values):
    middle = _median(values)
    return (
        _median([abs(float(value) - middle) for value in values])
        if middle is not None
        else None
    )


def _pitch(samples, rate, *, fmin=65.0, fmax=500.0):
    """Estimate one frame's fundamental using normalized autocorrelation."""

    if not samples:
        return None
    mean = sum(samples) / len(samples)
    centered = [sample - mean for sample in samples]
    energy = sum(sample * sample for sample in centered)
    if energy < 1e-5:
        return None
    min_lag = max(1, int(rate / fmax))
    max_lag = min(len(centered) - 2, int(rate / fmin))
    scores = []
    # A stride of four is accurate enough for speech and keeps an M2 relay
    # comfortably ahead of real time without NumPy/librosa.
    for lag in range(min_lag, max_lag + 1):
        dot = left = right = 0.0
        for index in range(0, len(centered) - lag, 4):
            first, second = centered[index], centered[index + lag]
            dot += first * second
            left += first * first
            right += second * second
        score = dot / math.sqrt(left * right) if left and right else 0.0
        scores.append((lag, score))
    best_score = max((score for _, score in scores), default=0.0)
    if best_score < 0.58:
        return None
    # Periodic signals also peak at 2×/3× the true period.  Prefer the first
    # near-best peak so a clean 220 Hz voice does not collapse to 110/73 Hz.
    best_lag = next(
        lag for lag, score in scores if score >= max(0.58, best_score * 0.97)
    )
    return rate / best_lag


def _pause_runs(active, hop_seconds, minimum=0.3):
    pauses = []
    start = None
    for index, is_active in enumerate(active + [True]):
        if not is_active and start is None:
            start = index
        elif is_active and start is not None:
            begin, end = start * hop_seconds, index * hop_seconds
            if end - begin >= minimum:
                pauses.append([round(begin, 2), round(end, 2)])
            start = None
    return pauses


def analyze_wav(path):
    """Return compact acoustic evidence from mono 16-bit PCM WAV."""

    with wave.open(str(path), "rb") as source:
        if (
            source.getnchannels() != 1
            or source.getsampwidth() != 2
            or source.getcomptype() != "NONE"
        ):
            raise ValueError("mono 16-bit PCM WAV required")
        rate = source.getframerate()
        frames = source.getnframes()
        raw = source.readframes(frames)
    if not rate or not frames:
        raise ValueError("empty WAV")
    values = array.array("h")
    values.frombytes(raw)
    if os.sys.byteorder != "little":
        values.byteswap()
    samples = [value / 32768.0 for value in values]
    duration = frames / rate
    hop = max(1, int(rate * 0.05))
    window = max(hop, int(rate * 0.10))
    rms = []
    chunks = []
    for start in range(0, max(1, len(samples) - window + 1), hop):
        chunk = samples[start : start + window]
        if not chunk:
            continue
        chunks.append(chunk)
        rms.append(math.sqrt(sum(value * value for value in chunk) / len(chunk)))
    peak = max(rms, default=0.0)
    threshold = max(peak * 0.15, 0.004)
    active = [value > threshold for value in rms]
    pitches = [
        pitch
        for chunk, is_active in zip(chunks, active)
        if is_active and (pitch := _pitch(chunk, rate)) is not None
    ]
    pauses = _pause_runs(active, hop / rate)
    starts = sum(
        1
        for index, value in enumerate(active)
        if value and (index == 0 or not active[index - 1])
    )
    pitch_median = _median(pitches)
    return {
        "version": VERSION,
        "duration_sec": round(duration, 2),
        "speech_ratio": round(sum(active) / len(active), 3) if active else 0.0,
        "pause_count": len(pauses),
        "pause_positions": pauses,
        "pitch_hz": {
            "min": round(min(pitches), 1) if pitches else None,
            "max": round(max(pitches), 1) if pitches else None,
            "median": round(pitch_median, 1) if pitch_median else None,
        },
        "pitch_spread": (
            round((_mad(pitches) or 0.0) / pitch_median, 4)
            if pitch_median and len(pitches) > 2
            else 0.0
        ),
        "energy_mean": round(_median([v for v, on in zip(rms, active) if on]) or 0.0, 6),
        "energy_peak": round(peak, 6),
        "phrase_rate": round(starts / duration, 3) if duration else 0.0,
    }


def compare_to_baseline(features, samples):
    rules = (
        ("energy_mean", "声音比平时更有力", "声音比平时更轻"),
        ("pitch_median", "音高比平时偏高", "音高比平时偏低"),
        ("pitch_spread", "语调起伏比平时更多", "语调比平时更平稳"),
        ("pause_ratio", "停顿比平时更多", "停顿比平时更少"),
        ("phrase_rate", "话语起落比平时更密", "话语起落比平时更疏"),
    )
    current = {
        "energy_mean": features["energy_mean"],
        "pitch_median": features["pitch_hz"]["median"],
        "pitch_spread": features["pitch_spread"],
        "pause_ratio": 1.0 - features["speech_ratio"],
        "phrase_rate": features["phrase_rate"],
    }
    observations = []
    for key, high, low in rules:
        value = current[key]
        history = [sample.get(key) for sample in samples]
        history = [item for item in history if item is not None]
        middle, spread = _median(history), _mad(history)
        if value is None or middle is None:
            continue
        floor = max(abs(middle) * 0.12, 0.00001)
        threshold = max((spread or 0.0) * 2.5, floor)
        if value > middle + threshold:
            observations.append(high)
        elif value < middle - threshold:
            observations.append(low)
    return observations[:3]


def _baseline_sample(features):
    return {
        "energy_mean": features["energy_mean"],
        "pitch_median": features["pitch_hz"]["median"],
        "pitch_spread": features["pitch_spread"],
        "pause_ratio": round(1.0 - features["speech_ratio"], 4),
        "phrase_rate": features["phrase_rate"],
    }


class ProsodyShadow:
    def __init__(self, baseline_path, log_path):
        self.baseline_path = Path(baseline_path)
        self.log_path = Path(log_path)

    def _load(self):
        try:
            value = json.loads(self.baseline_path.read_text(encoding="utf-8"))
            return value if isinstance(value, dict) else {"version": VERSION, "devices": {}}
        except (OSError, ValueError):
            return {"version": VERSION, "devices": {}}

    def _save(self, value):
        self.baseline_path.parent.mkdir(parents=True, exist_ok=True)
        temp = self.baseline_path.with_suffix(".tmp")
        temp.write_text(
            json.dumps(value, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
        os.chmod(temp, 0o600)
        os.replace(temp, self.baseline_path)

    def record(self, *, job_id, device_id, source, wav_path):
        features = analyze_wav(wav_path)
        state = self._load()
        samples = state.setdefault("devices", {}).setdefault(device_id, [])
        ready_before = len(samples) >= BASELINE_TARGET
        observations = compare_to_baseline(features, samples) if ready_before else []
        valid = (
            features["duration_sec"] >= 0.8
            and features["speech_ratio"] >= 0.08
            and features["energy_peak"] >= 0.004
        )
        if valid:
            samples.append(_baseline_sample(features))
            del samples[:-MAX_SAMPLES]
            self._save(state)
        record = {
            "at": int(time.time() * 1000),
            "kind": "voice_prosody_shadow",
            "job_id": job_id,
            "device_id": device_id,
            "source": source,
            "valid": valid,
            "baseline_count": len(samples),
            "baseline_ready": ready_before,
            "observations": observations,
            "features": features,
            "injected": False,
        }
        append_jsonl(self.log_path, record)
        return record


def append_jsonl(path, record):
    destination = Path(path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    payload = (json.dumps(record, ensure_ascii=False) + "\n").encode("utf-8")
    descriptor = os.open(
        destination,
        os.O_WRONLY | os.O_CREAT | os.O_APPEND,
        0o600,
    )
    try:
        os.write(descriptor, payload)
        os.fsync(descriptor)
    finally:
        os.close(descriptor)
