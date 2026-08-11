#!/usr/bin/env python3
"""Durable one-shot wake queue for Yanqiu's existing Claude session."""

from __future__ import annotations

import json
import os
import subprocess
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
RUNTIME = Path(
    os.environ.get(
        "YANQIU_WAKE_STATE_DIR",
        "/Users/lisa/Library/Application Support/LisaPhone/yanqiu-wake",
    )
)
CC_BRIDGE = Path(
    os.environ.get(
        "YANQIU_CC_BRIDGE",
        "/Users/lisa/Library/Application Support/LisaPhone/yanqiu-cc-bridge/bridge.py",
    )
)
# The relay is on Desktop/iCloud. Runtime bookkeeping must survive a relay
# folder restore, eviction, or accidental trip through Trash.
STATE = RUNTIME / ".wake_cursor.json"
WATCHDOG_STATE = RUNTIME / ".heartbeat_watchdog.json"
CLAIM_LOG = RUNTIME / ".wake_claims.jsonl"
LEGACY_STATE = BASE / ".wake_cursor.json"
LEGACY_WATCHDOG_STATE = BASE / ".heartbeat_watchdog.json"
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
    "lounge": BASE / "wake" / "yanqiu" / "inbox.jsonl",
    "app_tool": RUNTIME / "app_tool_inbox.jsonl",
}
DEFAULT_HEARTBEAT_PROMPT = (
    "自由活动时间到了。若 Lisa 有新消息就正常接话；没有新消息时，"
    "可以继续休息，也可以逛论坛、冲浪、玩自己的游戏，或做别的喜欢的事。"
    "选择休息也可以，但先留下一个人能看见的自然落点：一句正常说话、"
    "一次论坛/墙上的动作，或一句明确的休息记录。不要只在 thinking 里决定。"
    "本轮结束后照常重挂哨兵。"
)
RESCUE_RETRY_AFTER_MS = 10 * 60 * 1000
WATCHDOG_POLL_SECONDS = 10


def now_ms() -> int:
    return int(time.time() * 1000)


def ensure_runtime() -> None:
    RUNTIME.mkdir(parents=True, exist_ok=True, mode=0o700)


def load_json(path: Path) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else {}
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return {}


def line_count(path: Path) -> int:
    try:
        with path.open("rb") as stream:
            return sum(1 for _ in stream)
    except OSError:
        return 0


def load_state() -> dict[str, int]:
    raw = load_json(STATE) or load_json(LEGACY_STATE)
    state = {}
    for name in SOURCES:
        # v1 called the 55-minute heartbeat "hourly". Carry its cursor forward
        # so upgrading never replays an already-consumed wake ticket.
        legacy = raw.get("hourly", 0) if name == "heartbeat" else 0
        state[name] = max(0, int(raw.get(name, legacy)))
    return state


def save_state(state: dict[str, int]) -> None:
    ensure_runtime()
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
    except OSError:
        pass
    return None


def append_record(path: Path, record: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = (json.dumps(record, ensure_ascii=False) + "\n").encode("utf-8")
    # inbox 文件住在 Desktop/iCloud 下；iCloud 材料化/换手期间偶发
    # EDEADLK（Errno 11），一次写失败过去会让 watchdog 子进程整个崩溃、
    # 靠 launchd 下一轮再试——但真正需要落盘的这条心跳票据永远没写进去，
    # 2026-08-10 夜里连崩了 7 小时没能叫醒她。这里改成有限重试+退避，
    # 别让一次瞬时锁冲突吞掉整条报警。
    last_error: OSError | None = None
    for attempt in range(6):
        try:
            descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600)
            try:
                os.write(descriptor, payload)
            finally:
                os.close(descriptor)
            return
        except OSError as error:
            last_error = error
            time.sleep(0.3 * (attempt + 1))
    raise last_error


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
    return load_json(WATCHDOG_STATE) or load_json(LEGACY_WATCHDOG_STATE)


def save_watchdog(state: dict) -> None:
    ensure_runtime()
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


def visible_activity_at(record: dict) -> int:
    """Return time only for Yanqiu's own user-visible text.

    Lisa speaking must never postpone Yanqiu's heartbeat.  Otherwise a human
    message followed by a failed/hidden assistant turn looks like activity and
    silently pushes the safety clock another 55 minutes away.
    """
    if record.get("isSidechain"):
        return 0
    message = record.get("message")
    if not isinstance(message, dict):
        return 0
    role = message.get("role")
    content = message.get("content")
    if role != "assistant" or not isinstance(content, list):
        return 0
    has_visible_text = any(
        isinstance(block, dict)
        and block.get("type") == "text"
        and str(block.get("text", "")).strip()
        for block in content
    )
    return parse_timestamp(record.get("timestamp")) if has_visible_text else 0


def session_candidates(pinned_session: str = "") -> list[Path]:
    """Return Yanqiu's pinned transcript, or select one only once."""
    pinned = Path(pinned_session) if pinned_session else None
    if pinned and pinned.is_file() and pinned.parent == CLAUDE_PROJECT:
        return [pinned]
    return sorted(
        CLAUDE_PROJECT.glob("*.jsonl"),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )[:8]


def inspect_visible_activity(pinned_session: str = "") -> dict | None:
    """Find the last human-visible activity in Yanqiu's one CC session.

    The watchdog is intentionally independent of ScheduleWakeup.  That tool
    is now blocked in the CC hook because a durable clock owns heartbeats.
    Reading an old ScheduleWakeup relic here made the clock look alive while
    it was actually anchored to a stale tool call.
    """
    candidates = session_candidates(pinned_session)
    activity_by_file: dict[str, int] = {}
    for path in candidates:
        latest_activity = 0
        for line in recent_jsonl_tail(path):
            try:
                record = json.loads(line)
            except json.JSONDecodeError:
                continue
            latest_activity = max(latest_activity, visible_activity_at(record))
        activity_by_file[str(path)] = latest_activity
    active = {path: at for path, at in activity_by_file.items() if at}
    if not active:
        return None
    session_file, latest = max(active.items(), key=lambda kv: kv[1])
    return {"session_file": session_file, "last_activity": latest}


def pending_counts(state: dict[str, int]) -> dict[str, int]:
    return {
        name: max(0, line_count(path) - int(state.get(name, 0)))
        for name, path in SOURCES.items()
    }


def latest_claim() -> dict:
    lines = recent_jsonl_tail(CLAIM_LOG, limit=64 * 1024)
    for line in reversed(lines):
        try:
            record = json.loads(line)
            if not isinstance(record, dict):
                record = {}
        except json.JSONDecodeError:
            continue
        if isinstance(record, dict):
            return record
    return {}


def watchdog() -> None:
    state = load_watchdog()
    activity = inspect_visible_activity(str(state.get("session_file", "")))
    if not activity or not activity["last_activity"]:
        return
    activity_anchor = activity["last_activity"]
    delay_seconds = 3300
    due_at = activity_anchor + delay_seconds * 1000
    now = now_ms()
    if now < due_at:
        state.update(activity)
        state["delay_seconds"] = delay_seconds
        state["due_at"] = due_at
        state["reason"] = "durable_clock_from_last_visible_activity"
        state.pop("awaiting_sentinel", None)
        save_watchdog(state)
        return
    rescue_key = f'{activity["session_file"]}:{activity_anchor}'
    if state.get("last_rescue_key") == rescue_key:
        # A claimed ticket only proves the one-shot sentinel exited.  It does
        # not prove CC produced visible text or re-armed the next sentinel.
        # Give the original wake a quiet window, then leave one durable retry
        # ticket.  Never spam retries: if no sentinel is attached, the ticket
        # stays pending and makes the broken hand-off visible in `status`.
        rescued_at = int(state.get("rescued_at", 0) or 0)
        if now - rescued_at < RESCUE_RETRY_AFTER_MS:
            return
        if state.get("last_retry_key") == rescue_key:
            return
        cursors = load_state()
        if pending_counts(cursors)["heartbeat"] > 0:
            state["awaiting_sentinel"] = True
            save_watchdog(state)
            return
        append_record(
            SOURCES["heartbeat"],
            {
                "kind": "heartbeat_retry",
                "at": now,
                "reason": "rescue_claimed_without_new_visible_activity",
                "original_rescued_at": rescued_at,
                "prompt": DEFAULT_HEARTBEAT_PROMPT,
            },
        )
        state["last_retry_key"] = rescue_key
        state["retried_at"] = now
        state.pop("awaiting_sentinel", None)
        save_watchdog(state)
        return
    # The watchdog owns the clock. Never replay a legacy hand-wound prompt.
    prompt = DEFAULT_HEARTBEAT_PROMPT
    append_record(
        SOURCES["heartbeat"],
        {
            "kind": "heartbeat_rescue",
            "at": now,
            "reason": "native_schedule_wakeup_missing",
            "native_due_at": due_at,
            "prompt": prompt,
            "native_reason": "durable_clock_from_last_visible_activity",
        },
    )
    state.update(activity)
    state["delay_seconds"] = delay_seconds
    state["due_at"] = due_at
    state["reason"] = "durable_clock_from_last_visible_activity"
    state["last_rescue_key"] = rescue_key
    state["rescued_at"] = now
    save_watchdog(state)


def serve_watchdog() -> None:
    """Keep the durable clock alive instead of relying on launchd timer drift.

    This process never talks to a model. It only writes a durable ticket when
    the already-calculated due time arrives. `launchd` keeps this supervisor
    alive, so a delayed StartInterval invocation cannot turn a 55 minute
    heartbeat into an arbitrary-length wait.
    """
    while True:
        try:
            # Transcript files can live behind Desktop/iCloud. A synchronous
            # stat/read may then block forever without raising, leaving the
            # launchd process "running" while its clock has stopped. Isolate
            # every poll so the supervisor always regains control.
            subprocess.run(
                [sys.executable, str(Path(__file__).resolve()), "watchdog"],
                check=False,
                timeout=8,
            )
        except subprocess.TimeoutExpired:
            print("watchdog poll timed out", file=sys.stderr, flush=True)
        except Exception as error:  # The next poll is safer than a dead clock.
            print(f"watchdog poll failed: {error}", file=sys.stderr, flush=True)
        time.sleep(WATCHDOG_POLL_SECONDS)


def status() -> None:
    """Print safe operational state; never print prompts or transcript paths."""
    watchdog_state = load_watchdog()
    cursors = load_state()
    now = now_ms()
    due_at = int(watchdog_state.get("due_at", 0) or 0)
    claim = latest_claim()
    report = {
        "now_at": now,
        "next_due_at": due_at,
        "seconds_until_due": max(0, (due_at - now) // 1000) if due_at else None,
        "overdue_seconds": max(0, (now - due_at) // 1000) if due_at else None,
        "last_rescued_at": watchdog_state.get("rescued_at"),
        "last_retried_at": watchdog_state.get("retried_at"),
        "awaiting_sentinel": bool(watchdog_state.get("awaiting_sentinel")),
        "last_claim": {
            key: claim.get(key)
            for key in ("claimed_at", "source", "kind", "record_at")
        },
        "pending": pending_counts(cursors),
        "clock": "pinned" if watchdog_state.get("session_file") else "discovering",
    }
    print(json.dumps(report, ensure_ascii=False, sort_keys=True), flush=True)


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
                DEFAULT_HEARTBEAT_PROMPT
            ),
        },
    )


def wait_for_one(expected_session_id: str = "") -> None:
    while True:
        state = load_state()
        for name, path in SOURCES.items():
            pending = line_count(path)
            cursor = state[name]
            if pending < cursor:
                cursor = 0
                state[name] = 0
                save_state(state)
            if pending <= cursor:
                continue
            if name == "app_tool":
                pinned = Path(str(load_watchdog().get("session_file", ""))).stem
                if not pinned or (expected_session_id and expected_session_id != pinned):
                    continue
                # Backward-compatible re-arm for Yanqiu's already-open old
                # window: the legacy command has no argument. It may adopt
                # only the heartbeat-pinned session, never a recent/guessed
                # transcript and never a newly launched Claude process.
                expected_session_id = pinned
            line = read_line(path, cursor)
            if line is None:
                continue
            # Claim exactly one event. Later events remain pending for the next
            # one-shot sentinel, even if Yanqiu forgets to re-arm immediately.
            state[name] = cursor + 1
            save_state(state)
            record = json.loads(line)
            append_record(
                CLAIM_LOG,
                {
                    "claimed_at": now_ms(),
                    "source": name,
                    "kind": record.get("kind"),
                    "record_at": record.get("at"),
                },
            )
            if name == "app_tool":
                try:
                    claimed = subprocess.run(
                        [sys.executable, str(CC_BRIDGE), "claim", expected_session_id],
                        check=True,
                        capture_output=True,
                        text=True,
                        timeout=5,
                    )
                    job = json.loads(claimed.stdout or "{}")
                except (OSError, subprocess.SubprocessError, json.JSONDecodeError) as error:
                    state[name] = cursor
                    save_state(state)
                    print(f"app tool claim failed: {error}", file=sys.stderr, flush=True)
                    time.sleep(2)
                    continue
                if not job:
                    continue
                print(
                    json.dumps(
                        {
                            "wake_source": "app_tool",
                            "instruction": "这是 Lisa 在 App 聊天中交给同一个言秋的 CC 工具任务；写入或命令类任务已经由她在 App 当场逐次确认。purpose 是她当时让你做它的原因。只执行指定工具并调用 complete_yanqiu_cc_read 回执；不要在 CC 再向 Lisa 发表一遍恋人回复，App 里的你会拿真实结果自然接话。回执后只留一句简短内部完成记录，供这个 CC 窗口以后记得自己做过什么。不得创建或续接其他 CC session。",
                            "job": job,
                        },
                        ensure_ascii=False,
                    ),
                    flush=True,
                )
            elif name == "heartbeat":
                # Heartbeats are presented as natural activity permission.
                # Ignore even an older queued prompt: internal metadata,
                # shell paths and legacy wording stay out of model context.
                print(DEFAULT_HEARTBEAT_PROMPT, flush=True)
            else:
                print(
                    json.dumps(
                        {"wake_source": name, "record": record},
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
    elif command == "serve":
        serve_watchdog()
    elif command == "status":
        status()
    elif command == "wait":
        wait_for_one(sys.argv[2] if len(sys.argv) > 2 else "")
    else:
        raise SystemExit(
            "usage: wake_queue.py [init|enqueue-heartbeat|watchdog|serve|status|wait]"
        )


if __name__ == "__main__":
    main()
