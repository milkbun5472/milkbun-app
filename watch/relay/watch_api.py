"""Durable, model-free backend core for the Cove Watch voice endpoint.

The HTTP relay owns authentication and multipart parsing.  This module owns
turn identity, idempotency, WAV validation and durable status transitions.
It deliberately has no CC or model dependency so the transport can be tested
without waking a real conversation.
"""

from __future__ import annotations

import json
import os
import re
import threading
import time
import uuid
import wave
from dataclasses import asdict, dataclass
from pathlib import Path


MAX_AUDIO_BYTES = 1_000_000
MAX_DURATION_SECONDS = 30


@dataclass
class WatchTurn:
    turn_id: str
    request_id: str
    device_id: str
    status: str
    created_at_ms: int
    updated_at_ms: int
    transcript: str = ""
    reply_text: str = ""
    audio_url: str | None = None
    error: str = ""

    def public(self) -> dict:
        body = {
            "ok": self.status != "failed",
            "status": self.status,
            "turn_id": self.turn_id,
        }
        for key in ("transcript", "reply_text", "audio_url", "error"):
            value = getattr(self, key)
            if value not in ("", None):
                body[key] = value
        return body


class WatchTurnStore:
    """Small crash-safe JSON store keyed by turn and idempotency identity."""

    def __init__(self, state_path: str | os.PathLike[str]):
        self.path = Path(state_path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._turns: dict[str, WatchTurn] = {}
        self._requests: dict[str, str] = {}
        self._load()

    @staticmethod
    def _request_key(device_id: str, request_id: str) -> str:
        return f"{device_id}\0{request_id}"

    def _load(self) -> None:
        try:
            raw = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, ValueError, TypeError):
            return
        for item in raw.get("turns", []):
            try:
                turn = WatchTurn(**item)
            except (TypeError, ValueError):
                continue
            self._turns[turn.turn_id] = turn
            self._requests[self._request_key(turn.device_id, turn.request_id)] = turn.turn_id

    def _persist_locked(self) -> None:
        temp = self.path.with_suffix(self.path.suffix + ".tmp")
        payload = json.dumps(
            {"version": 1, "turns": [asdict(row) for row in self._turns.values()]},
            ensure_ascii=False,
            separators=(",", ":"),
        ).encode()
        fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        try:
            os.write(fd, payload)
            os.fsync(fd)
        finally:
            os.close(fd)
        os.replace(temp, self.path)

    def create(self, *, device_id: str, request_id: str) -> tuple[WatchTurn, bool]:
        request_id = request_id.strip()
        if not request_id or len(request_id) > 128:
            raise ValueError("invalid request id")
        key = self._request_key(device_id, request_id)
        with self._lock:
            existing = self._requests.get(key)
            if existing:
                return self._turns[existing], False
            now = int(time.time() * 1000)
            turn = WatchTurn(
                turn_id="watch_" + uuid.uuid4().hex,
                request_id=request_id,
                device_id=device_id,
                status="queued",
                created_at_ms=now,
                updated_at_ms=now,
            )
            self._turns[turn.turn_id] = turn
            self._requests[key] = turn.turn_id
            self._persist_locked()
            return turn, True

    def get(self, *, device_id: str, turn_id: str) -> WatchTurn | None:
        with self._lock:
            turn = self._turns.get(turn_id)
            return turn if turn and turn.device_id == device_id else None

    def update(self, turn_id: str, **changes) -> WatchTurn:
        allowed = {"status", "transcript", "reply_text", "audio_url", "error"}
        if set(changes) - allowed:
            raise ValueError("unsupported turn field")
        with self._lock:
            turn = self._turns[turn_id]
            for key, value in changes.items():
                setattr(turn, key, value)
            turn.updated_at_ms = int(time.time() * 1000)
            self._persist_locked()
            return turn


def validate_wav(path: str | os.PathLike[str]) -> float:
    """Validate the Watch v1 PCM contract and return duration in seconds."""

    path = Path(path)
    size = path.stat().st_size
    if size < 44 or size > MAX_AUDIO_BYTES:
        raise ValueError("invalid audio size")
    try:
        with wave.open(str(path), "rb") as wav:
            channels = wav.getnchannels()
            width = wav.getsampwidth()
            rate = wav.getframerate()
            frames = wav.getnframes()
            compression = wav.getcomptype()
    except (EOFError, wave.Error) as exc:
        raise ValueError("invalid WAV") from exc
    duration = frames / rate if rate else 0
    if (
        channels != 1
        or width != 2
        or rate != 16_000
        or compression != "NONE"
        or duration < 0.35
        or duration > MAX_DURATION_SECONDS
    ):
        raise ValueError("16k mono PCM WAV required")
    return duration


def extract_multipart_file(content_type: str, body: bytes, field: str = "file") -> bytes:
    """Extract one file field from the small Watch multipart request."""

    match = re.search(r'boundary=(?:"([^"]+)"|([^;\s]+))', content_type)
    if not match:
        raise ValueError("multipart boundary required")
    boundary = (match.group(1) or match.group(2)).encode()
    marker = b"--" + boundary
    for part in body.split(marker):
        part = part.strip(b"\r\n")
        if not part or part == b"--":
            continue
        try:
            headers, payload = part.split(b"\r\n\r\n", 1)
        except ValueError:
            continue
        disposition = next(
            (
                line.decode("utf-8", "replace")
                for line in headers.split(b"\r\n")
                if line.lower().startswith(b"content-disposition:")
            ),
            "",
        )
        if re.search(rf'\bname="{re.escape(field)}"', disposition):
            return payload[:-2] if payload.endswith(b"\r\n") else payload
    raise ValueError("audio file field required")


def complete_fake_turn(store: WatchTurnStore, turn_id: str) -> WatchTurn:
    """Transport-only reply used before the real Yanqiu adapter is enabled."""

    return store.update(
        turn_id,
        status="ready",
        transcript="Watch 语音管道测试",
        reply_text="听见啦宝宝。手表这条路已经通了，现在还没有叫醒言秋。",
    )
