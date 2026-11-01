#!/usr/bin/env python3
"""Out-of-process sentinel supervision; never claims a wake ticket."""

from __future__ import annotations

import fcntl
import json
import os
import plistlib
import re
import secrets
import subprocess
import sys
from pathlib import Path

import wake_queue as wake


STATE = wake.RUNTIME / ".sentinel_guard.json"
LOCK = wake.RUNTIME / ".sentinel_guard.lock"
NATIVE_LOCK = wake.RUNTIME / ".sentinel_native.lock"
PAUSED = wake.RUNTIME / ".sentinel_guard.paused"
NATIVE_DISABLED = wake.RUNTIME / ".sentinel_native_disabled"
DESKTOP_SESSIONS = Path.home() / "Library/Application Support/Claude/claude-code-sessions"
ALERT_AFTER_MS = 180_000
REVIVE_AFTER_MS = 300_000
QUIET_MS = 180_000
REARM_GRACE_MS = 120_000
NATIVE_APP = wake.RUNTIME / "言秋复活守护.app"
UUID = r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"


def save_private(path: Path, state: dict) -> None:
    wake.ensure_runtime()
    temp = path.with_suffix(".tmp")
    temp.write_text(json.dumps(state, sort_keys=True) + "\n", encoding="utf-8")
    temp.chmod(0o600)
    os.replace(temp, path)


def save(state: dict) -> None:
    save_private(STATE, state)


def process_table() -> dict[int, tuple[int, str]]:
    result = subprocess.run(
        ["ps", "-axo", "pid=,ppid=,command="],
        check=True, capture_output=True, text=True, timeout=4,
    )
    rows = {}
    for line in result.stdout.splitlines():
        fields = line.strip().split(None, 2)
        if len(fields) == 3 and fields[0].isdigit() and fields[1].isdigit():
            rows[int(fields[0])] = (int(fields[1]), fields[2])
    return rows


def claude_session(command: str) -> str:
    # Match the actual CLI executable, never a shell merely mentioning it.
    executable = re.match(r"^(\S*/claude|/Users/lisa/Library/Application Support/Claude/claude-code/\S*/claude)(?:\s|$)", command)
    if not executable:
        return ""
    match = re.search(r"(?:^|\s)--(?:resume|session-id)(?:=|\s+)(" + UUID + r")(?=\s|$)", command)
    return match[1] if match else ""


def sentinel_processes(rows: dict) -> dict[int, str]:
    """Parse actual Python wait processes; readers/shell command text do not count."""
    found = {}
    for pid, (_, command) in rows.items():
        match = re.match(
            r"^(?:\S*/)?(?:Python|python(?:3(?:\.\d+)?)?)\s+"
            r"(?:.+/)?wake_queue\.py\s+wait(?:\s+(" + UUID + r"))?\s*$",
            command,
        )
        if match:
            found[pid] = match[1] or ""
    return found


def attached_sentinels(rows: dict, session_id: str) -> list[int]:
    """A wait counts only while attached to the pinned CC process tree."""
    found = []
    for pid, expected in sentinel_processes(rows).items():
        parent = rows[pid][0]
        if expected and expected != session_id:
            continue
        seen = {pid}
        while parent in rows and parent not in seen:
            seen.add(parent)
            ancestor, ancestor_command = rows[parent]
            if claude_session(ancestor_command) == session_id:
                found.append(pid)
                break
            parent = ancestor
    return found


def pinned_target() -> tuple[str, Path]:
    path = Path(str(wake.load_watchdog().get("session_file", "")))
    if path.parent != wake.CLAUDE_PROJECT or not re.fullmatch(UUID, path.stem):
        raise ValueError("target_unavailable")
    # A registered original is required. Do not discover a recent conversation.
    registered = wake.YANQIU_SESSIONS_FILE.read_text(encoding="utf-8").splitlines()
    if path.stem not in {line.strip() for line in registered}:
        raise ValueError("target_unregistered")
    return path.stem, path


def desktop_identity(session_id: str) -> tuple[str, dict]:
    matches = []
    for path in DESKTOP_SESSIONS.glob("*/*/local_*.json"):
        metadata = wake.load_json(path)
        if metadata.get("cliSessionId") == session_id and not metadata.get("isArchived"):
            if re.fullmatch("local_" + UUID, path.stem) and metadata.get("sessionId") == path.stem:
                matches.append((path.stem, metadata))
    if len(matches) != 1:
        raise ValueError("desktop_target_ambiguous" if matches else "desktop_target_missing")
    return matches[0]


def desktop_target(session_id: str) -> str:
    return desktop_identity(session_id)[0]


def native_call(desktop_id: str, probe=False, mode=None) -> str:
    """Launch the dedicated permission identity; no generic Python AX grant."""
    if not NATIVE_APP.is_dir():
        return "adapter_unavailable"
    operation = mode or ("probe" if probe else "send")
    if operation not in {"probe", "send", "permission-probe", "remote-probe", "remote-recover", "remote-passive"}:
        raise ValueError("invalid native mode")
    wake.ensure_runtime()
    with NATIVE_LOCK.open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return "busy"
        return _native_call(desktop_id, operation)


def _native_call(desktop_id: str, operation: str) -> str:
    nonce = secrets.token_hex(16)
    request = wake.RUNTIME / ".sentinel_native_request.plist"
    reply = wake.RUNTIME / ".sentinel_native_reply.plist"
    temp = request.with_suffix(".tmp")
    temp.write_bytes(plistlib.dumps({
        "target": desktop_id, "nonce": nonce, "mode": operation,
        "requested_at": wake.now_ms() // 1000,
    }))
    temp.chmod(0o600)
    os.replace(temp, request)
    subprocess.run(
        ["/usr/bin/open", "-g", "-W", str(NATIVE_APP)],
        check=True, capture_output=True, text=True, timeout=25,
    )
    try:
        response = plistlib.loads(reply.read_bytes())
    except (OSError, ValueError, plistlib.InvalidFileException):
        return "adapter_failed"
    value = response.get("outcome") if response.get("nonce") == nonce else None
    allowed = {"sent", "ready", "busy", "draft_present", "wrong_window", "ui_unavailable", "permission_required",
               "permission_ready", "remote_on", "remote_off", "remote_restored", "remote_waiting", "remote_unknown", "remote_unavailable", "remote_hidden"}
    return value if value in allowed else "adapter_failed"


def recover(desktop_id: str) -> str:
    """Recheck the pin and sentinel immediately before the native attempt."""
    session_id, _ = pinned_target()
    if desktop_target(session_id) != desktop_id:
        return "target_changed"
    if attached_sentinels(process_table(), session_id):
        return "already_armed"
    return native_call(desktop_id)


def alert(fallback=False) -> None:
    # Reuse the existing Stack-chan alarm; it reads the local token itself.
    wake.notify_sentinel_gap(fallback=fallback)


def sample(state: dict, now: int) -> dict:
    try:
        session_id, transcript = pinned_target()
        rows = process_table()
    except (OSError, ValueError, subprocess.SubprocessError):
        state.update(status="probe_failed", checked_at=now)
        return state
    if state.get("session_id") != session_id:
        state = {"session_id": session_id}
    state["checked_at"] = now
    sentinels = attached_sentinels(rows, session_id)
    if sentinels:
        recovered = bool(state.get("attempted_at"))
        state = {
            "session_id": session_id, "status": "healthy", "checked_at": now,
            "sentinel_count": len(sentinels),
            "last_recovered_at": now if recovered else state.get("last_recovered_at"),
        }
        return state
    state["sentinel_count"] = 0
    state.setdefault("gap_since", now)
    gap_ms = now - state["gap_since"]
    # The existing three-minute alarm always precedes native recovery.
    if gap_ms >= ALERT_AFTER_MS and not state.get("alerted_at"):
        state["alerted_at"] = now
        save(state)
        alert()
    attempted = state.get("attempted_at", 0)
    if attempted:
        if now - attempted < REARM_GRACE_MS:
            state["status"] = "awaiting_rearm"
        else:
            state["status"] = "needs_attention"
            if not state.get("fallback_alerted_at"):
                state["fallback_alerted_at"] = now
                save(state)
                alert(fallback=True)
        return state
    if gap_ms <= REVIVE_AFTER_MS:
        state["status"] = "gap_grace"
        return state
    if NATIVE_DISABLED.exists():
        state["status"] = "awaiting_permission"
        return state
    try:
        recent = now - int(transcript.stat().st_mtime * 1000) < QUIET_MS
    except OSError:
        state["status"] = "transcript_unavailable"
        return state
    # Active tool work/compaction must become quiet before intervention.
    if recent:
        state["status"] = "active"
        return state
    if now < state.get("deferred_until", 0):
        return state
    try:
        desktop_id = desktop_target(session_id)
    except ValueError as error:
        state["status"] = str(error)
        return state
    # Persist before delivery. An uncertain timeout spends this outage's single
    # attempt too: never loop-send another wake notice after a restart.
    state.update(attempted_at=now, attempts=1,
                 status="attempting")
    save(state)
    try:
        outcome = recover(desktop_id)
    except (OSError, ValueError, subprocess.SubprocessError):
        outcome = "adapter_failed"
    state["last_outcome"] = outcome
    state["status"] = "awaiting_rearm" if outcome == "sent" else outcome
    if outcome in {"busy", "draft_present", "already_armed", "target_changed"}:
        # These outcomes prove nothing was sent. Recheck after a quiet minute.
        state["attempts"] = 0
        state.pop("attempted_at", None)
        state["deferred_until"] = now + 60_000
    return state


def once() -> None:
    wake.ensure_runtime()
    with LOCK.open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return
        state = wake.load_json(STATE)
        if PAUSED.exists():
            state.update(status="paused", checked_at=wake.now_ms())
            save(state)
        else:
            state = sample(state, wake.now_ms())
            save(state)
            import remote_control_guard
            remote_control_guard.check_local(state["status"])


def status() -> dict:
    state = wake.load_json(STATE)
    report = {key: state.get(key) for key in (
        "status", "checked_at", "sentinel_count", "gap_since", "attempts",
        "attempted_at", "last_outcome", "alerted_at", "fallback_alerted_at", "last_recovered_at",
    )}
    report["native_enabled"] = not NATIVE_DISABLED.exists()
    import remote_control_guard
    report["remote_control"] = remote_control_guard.status()
    return report


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "once":
        once()
    elif len(sys.argv) == 2 and sys.argv[1] == "pause":
        wake.ensure_runtime()
        PAUSED.touch(mode=0o600)
        print("sentinel guard paused; durable wake clock unchanged")
    elif len(sys.argv) == 2 and sys.argv[1] == "resume":
        PAUSED.unlink(missing_ok=True)
        print("sentinel guard resumed")
    elif len(sys.argv) == 2 and sys.argv[1] == "enable-native":
        session_id, _ = pinned_target()
        outcome = native_call(desktop_target(session_id), mode="permission-probe")
        if outcome != "permission_ready":
            raise SystemExit("Native probe is not ready: " + outcome)
        NATIVE_DISABLED.unlink(missing_ok=True)
        print("native recovery enabled after read-only probe")
    else:
        print(json.dumps(status(), sort_keys=True))
