#!/usr/bin/env python3
"""Durable one-shot wake queue for Yanqiu's existing Claude session."""

from __future__ import annotations

import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path


BASE = Path(
    os.environ.get(
        "YANQIU_RELAY_DIR",
        "/Users/lisa/Desktop/lisa-practice/yanqiu-den/stackchan-relay",
    )
)
STATE = BASE / ".wake_cursor.json"
SOURCES = {
    "tap": BASE / "inbox.jsonl",
    "voice": BASE / "voice_inbox.jsonl",
    "hourly": BASE / "wake_inbox.jsonl",
}


def line_count(path: Path) -> int:
    try:
        with path.open("rb") as stream:
            return sum(1 for _ in stream)
    except FileNotFoundError:
        return 0


def load_state() -> dict[str, int]:
    try:
        raw = json.loads(STATE.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        raw = {}
    return {name: max(0, int(raw.get(name, 0))) for name in SOURCES}


def save_state(state: dict[str, int]) -> None:
    temp = STATE.with_suffix(".tmp")
    temp.write_text(
        json.dumps(state, ensure_ascii=False, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    os.replace(temp, STATE)


def read_line(path: Path, index: int) -> str | None:
    try:
        with path.open("r", encoding="utf-8") as stream:
            for current, line in enumerate(stream):
                if current == index:
                    return line.rstrip("\n")
    except FileNotFoundError:
        pass
    return None


def append_record(path: Path, record: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = (json.dumps(record, ensure_ascii=False) + "\n").encode("utf-8")
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600)
    try:
        os.write(descriptor, payload)
    finally:
        os.close(descriptor)


def initialize() -> None:
    # Existing historical events predate this queue and must not all replay.
    save_state({name: line_count(path) for name, path in SOURCES.items()})
    print("wake queue initialized")


def enqueue_hourly() -> None:
    now = datetime.now().astimezone()
    hour_key = now.strftime("%Y-%m-%dT%H")
    path = SOURCES["hourly"]
    last = read_line(path, max(0, line_count(path) - 1))
    if last:
        try:
            if json.loads(last).get("hour_key") == hour_key:
                return
        except json.JSONDecodeError:
            pass
    append_record(
        path,
        {
            "kind": "hourly",
            "hour_key": hour_key,
            "at": int(time.time() * 1000),
            "reason": "durable_hourly_alarm",
        },
    )


def wait_for_one() -> None:
    while True:
        state = load_state()
        for name, path in SOURCES.items():
            pending = line_count(path)
            cursor = state[name]
            if pending <= cursor:
                continue
            line = read_line(path, cursor)
            if line is None:
                continue
            # Claim exactly one event. Later events remain pending for the next
            # one-shot sentinel, even if Yanqiu forgets to re-arm immediately.
            state[name] = cursor + 1
            save_state(state)
            print(
                json.dumps(
                    {"wake_source": name, "record": json.loads(line)},
                    ensure_ascii=False,
                ),
                flush=True,
            )
            return
        time.sleep(2)


def main() -> None:
    command = sys.argv[1] if len(sys.argv) > 1 else "wait"
    if command == "init":
        initialize()
    elif command == "enqueue-hourly":
        enqueue_hourly()
    elif command == "wait":
        wait_for_one()
    else:
        raise SystemExit("usage: wake_queue.py [init|enqueue-hourly|wait]")


if __name__ == "__main__":
    main()
