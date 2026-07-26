#!/usr/bin/env python3
"""Durable one-shot wake queue for Yanqiu's existing Claude session."""

from __future__ import annotations

import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path


BASE = Path(
    os.environ.get(
        "YANQIU_RELAY_DIR",
        "/Users/lisa/Desktop/lisa-practice/yanqiu-den/stackchan-relay",
    )
)
STATE = BASE / ".wake_cursor.json"
WATCHDOG_STATE = BASE / ".heartbeat_watchdog.json"
CLAUDE_PROJECT = Path(
    os.environ.get(
        "YANQIU_CLAUDE_PROJECT",
        "/Users/lisa/.claude/projects/-Users-lisa-Desktop-Lisa-phone",
    )
)
SOURCES = {
    "tap": BASE / "inbox.jsonl",
    "voice": BASE / "voice_inbox.jsonl",
    "heartbeat": BASE / "wake_inbox.jsonl",
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
    state = {}
    for name in SOURCES:
        # v1 called the 55-minute heartbeat "hourly". Carry its cursor forward
        # so upgrading never replays an already-consumed wake ticket.
        legacy = raw.get("hourly", 0) if name == "heartbeat" else 0
        state[name] = max(0, int(raw.get(name, legacy)))
    return state


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


def parse_timestamp(value: object) -> int:
    if not isinstance(value, str):
        return 0
    try:
        return int(
            datetime.fromisoformat(value.replace("Z", "+00:00"))
            .astimezone(timezone.utc)
            .timestamp()
            * 1000
        )
    except ValueError:
        return 0


def load_watchdog() -> dict:
    try:
        return json.loads(WATCHDOG_STATE.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return {}


def save_watchdog(state: dict) -> None:
    temp = WATCHDOG_STATE.with_suffix(".tmp")
    temp.write_text(
        json.dumps(state, ensure_ascii=False, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    os.replace(temp, WATCHDOG_STATE)


def recent_jsonl_tail(path: Path, limit: int = 16 * 1024 * 1024) -> list[str]:
    try:
        size = path.stat().st_size
        with path.open("rb") as stream:
            if size > limit:
                stream.seek(size - limit)
                stream.readline()
            return stream.read().decode("utf-8", errors="replace").splitlines()
    except OSError:
        return []


def inspect_claude_activity() -> dict | None:
    """Find the newest Yanqiu ScheduleWakeup and activity in its session."""
    candidates = sorted(
        CLAUDE_PROJECT.glob("*.jsonl"),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )[:8]
    schedules: list[dict] = []
    activity_by_file: dict[str, int] = {}
    for path in candidates:
        latest_activity = 0
        for line in recent_jsonl_tail(path):
            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                continue
            at = parse_timestamp(record.get("timestamp"))
            if at:
                latest_activity = max(latest_activity, at)
            message = record.get("message")
            if not isinstance(message, dict):
                continue
            content = message.get("content")
            if not isinstance(content, list):
                continue
            for block in content:
                if not isinstance(block, dict):
                    continue
                if block.get("type") != "tool_use":
                    continue
                if block.get("name") != "ScheduleWakeup":
                    continue
                details = block.get("input") or {}
                if not isinstance(details, dict):
                    continue
                schedules.append(
                    {
                        "session_file": str(path),
                        "scheduled_at": at,
                        "delay_seconds": max(
                            60, int(details.get("delaySeconds", 3300))
                        ),
                        "prompt": str(details.get("prompt", "")).strip(),
                        "reason": str(details.get("reason", "")).strip(),
                    }
                )
        activity_by_file[str(path)] = latest_activity
    if not schedules:
        return None
    newest = max(schedules, key=lambda item: item["scheduled_at"])
    newest["last_activity"] = activity_by_file.get(newest["session_file"], 0)
    return newest


def watchdog() -> None:
    schedule = inspect_claude_activity()
    if not schedule or not schedule["scheduled_at"]:
        return
    state = load_watchdog()
    activity_anchor = max(schedule["scheduled_at"], schedule["last_activity"])
    due_at = activity_anchor + schedule["delay_seconds"] * 1000
    now = int(time.time() * 1000)
    if now < due_at:
        state.update(schedule)
        state["due_at"] = due_at
        save_watchdog(state)
        return
    rescue_key = f'{schedule["session_file"]}:{activity_anchor}'
    if state.get("last_rescue_key") == rescue_key:
        return
    prompt = schedule["prompt"] or (
        "心跳翻身：先确认真实时间，按最近上下文继续自己的生活。"
    )
    append_record(
        SOURCES["heartbeat"],
        {
            "kind": "heartbeat_rescue",
            "at": now,
            "reason": "native_schedule_wakeup_missing",
            "native_due_at": due_at,
            "prompt": prompt,
            "native_reason": schedule["reason"],
        },
    )
    state.update(schedule)
    state["due_at"] = due_at
    state["last_rescue_key"] = rescue_key
    state["rescued_at"] = now
    save_watchdog(state)


def initialize() -> None:
    # Existing historical events predate this queue and must not all replay.
    save_state({name: line_count(path) for name, path in SOURCES.items()})
    print("wake queue initialized")


def enqueue_heartbeat() -> None:
    now = datetime.now().astimezone()
    path = SOURCES["heartbeat"]
    append_record(
        path,
        {
            "kind": "heartbeat",
            "at": int(time.time() * 1000),
            "reason": "durable_55_minute_cache_heartbeat",
            "prompt": (
                "心跳翻身：先确认真实时间。若 Lisa 有新消息就正常接话。"
                "夜里（23:00～08:00）安静翻身，不干活；"
                "白天醒来若有兴致，就去小窝做点自己喜欢的事，"
                "做不做、做什么、做多久全凭当下心情；"
                "有值得留的就发墙、记判词。额度纪律：每天不超过14%。"
                "处理完后重新挂 python3 wake_queue.py wait。"
            ),
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
    elif command in {"enqueue-heartbeat", "enqueue-hourly"}:
        enqueue_heartbeat()
    elif command == "watchdog":
        watchdog()
    elif command == "wait":
        wait_for_one()
    else:
        raise SystemExit(
            "usage: wake_queue.py [init|enqueue-heartbeat|watchdog|wait]"
        )


if __name__ == "__main__":
    main()
