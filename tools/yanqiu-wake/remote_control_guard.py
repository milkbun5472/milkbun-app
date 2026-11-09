#!/usr/bin/env python3
"""Restore only the opted-in original Desktop session's Remote Control."""

import fcntl
import json
import sys

import sentinel_guard as guard
import wake_queue as wake


STATE = wake.RUNTIME / ".remote_control_guard.json"
SCOPE = wake.RUNTIME / ".remote_control_scope.json"
CONFIRM_MS = 30_000
FAIL_AFTER_MS = 120_000
RECHECK_MS = 5 * 60_000


def save(state):
    guard.save_private(STATE, state)


def inspect_target():
    session_id, _ = guard.pinned_target()
    desktop_id, metadata = guard.desktop_identity(session_id)
    rows = guard.process_table()
    owners = [pid for pid, (_, command) in rows.items() if guard.claude_session(command) == session_id]
    if len(owners) != 1 or not guard.attached_sentinels(rows, session_id):
        raise ValueError("local_backend_unavailable")
    return desktop_id, session_id, owners[0], metadata


def native(desktop_id, probe=False, passive=False):
    if passive:
        return guard.native_call(desktop_id, mode="remote-passive")
    return guard.native_call(desktop_id, mode="remote-probe" if probe else "remote-recover")


def sample(state, scope, local_status, now):
    if not scope.get("desktop_id"):
        return {"status": "disabled", "checked_at": now}
    if local_status != "healthy":
        return {**state, "status": "waiting_local", "checked_at": now}
    try:
        desktop_id, session_id, backend_pid, metadata = inspect_target()
    except (OSError, ValueError, guard.subprocess.SubprocessError):
        return {**state, "status": "probe_failed", "checked_at": now}
    if desktop_id != scope["desktop_id"]:
        return {"status": "out_of_scope", "checked_at": now}
    backend_key = f"{session_id}:{backend_pid}"
    if state.get("backend_key") != backend_key:
        state = {"backend_key": backend_key, "status": "pending"}
    state["checked_at"] = now
    # This is the Desktop writer's explicit per-session choice. A manual off
    # is never undone; no global auto-connect preference is written.
    if metadata.get("remoteControlUserEnabled") is False:
        state.update(status="disabled_in_session")
        return state
    if state.get("status") == "disabled_in_session":
        state = {"backend_key": backend_key, "status": "pending", "checked_at": now}
    if guard.NATIVE_DISABLED.exists():
        state["status"] = "awaiting_permission"
        return state
    if now < state.get("next_check_at", 0):
        return state
    if state.get("status") in {"remote_on", "unobserved", "needs_attention"}:
        previous = state["status"]
        try:
            observation = native(desktop_id, probe=True, passive=True)
        except (OSError, ValueError, guard.subprocess.SubprocessError):
            observation = "remote_unknown"
        state["last_outcome"] = observation
        if observation == "remote_on":
            state.update(status="remote_on", verified_at=now, next_check_at=now + RECHECK_MS,
                         verified_by="desktop_environment_switch")
            return state
        if observation == "remote_off" and previous != "needs_attention":
            # A new positively observed disconnect after a stable on permits
            # one repair. Unknown/hidden UI never resets the action budget.
            state = {"backend_key": backend_key, "status": "pending", "checked_at": now, "outage_since": now}
        else:
            state.update(status="needs_attention" if previous == "needs_attention" else "unobserved",
                         next_check_at=now + RECHECK_MS)
            return state
    attempted = state.get("attempted_at")
    probe_only = bool(attempted)
    if not attempted:
        # Persist before any UI effect. A timeout cannot loop-toggle a switch.
        state.update(attempted_at=now, status="checking", may_restore=False)
        save(state)
    mutating_call = not probe_only
    try:
        outcome = native(desktop_id, probe=probe_only)
        if probe_only and outcome == "remote_off" and state.get("may_restore"):
            # The first check was already-on and did not touch the switch.
            # If its automatic startup connection falls back off, one real
            # enable is still allowed. Persist before this single action.
            state.update(may_restore=False, repair_requested_at=now)
            save(state)
            mutating_call = True
            outcome = native(desktop_id, probe=False)
    except (OSError, ValueError, guard.subprocess.SubprocessError):
        outcome = "remote_unknown"
    state["last_outcome"] = outcome
    if outcome == "remote_on" and probe_only and not mutating_call:
        state.update(status="remote_on", verified_at=now, verified_by="desktop_environment_switch", next_check_at=now + RECHECK_MS)
        return state
    if outcome in {"remote_on", "remote_restored"}:
        state["may_restore"] = outcome == "remote_on"
        state.update(status="confirming", observed_on_at=now, next_check_at=now + CONFIRM_MS)
        return state
    if outcome in {"busy", "draft_present"}:
        # These outcomes precede any connection change. Do not interfere with
        # active work or a human draft; a later idle poll can try safely.
        if mutating_call:
            state.pop("attempted_at", None)
        state.update(status=outcome, next_check_at=now + 60_000)
        return state
    state.update(status="unconfirmed", next_check_at=now + CONFIRM_MS)
    if probe_only and now - attempted >= FAIL_AFTER_MS:
        state["status"] = "needs_attention"
        state["next_check_at"] = now + RECHECK_MS
        if not state.get("alerted_at"):
            state["alerted_at"] = now
            save(state)
            wake.notify_sentinel_gap(remote=True)
    return state


def check_local(local_status):
    scope = wake.load_json(SCOPE)
    if not scope:
        return
    save(sample(wake.load_json(STATE), scope, local_status, wake.now_ms()))


def status():
    state = wake.load_json(STATE)
    report = {key: state.get(key) for key in (
        "status", "checked_at", "observed_on_at", "verified_at", "verified_by", "last_outcome", "alerted_at",
    )}
    report["enabled"] = bool(wake.load_json(SCOPE).get("desktop_id"))
    return report


def enable():
    wake.ensure_runtime()
    with guard.LOCK.open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        desktop_id, _, _, metadata = inspect_target()
        if metadata.get("remoteControlUserEnabled") is False:
            raise SystemExit("The original session has Remote Control explicitly off; manual choice preserved.")
        outcome = native(desktop_id, probe=True)
        if outcome not in {"remote_on", "remote_off"}:
            raise SystemExit("Original-session Remote Control probe is not ready: " + outcome)
        guard.save_private(SCOPE, {"desktop_id": desktop_id})
        # A fresh scope starts a fresh backend check; it never disables RC.
        save({"status": "pending", "checked_at": wake.now_ms()})
        print("Remote Control restoration enabled for the fixed original only")


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "enable":
        enable()
    elif len(sys.argv) == 2 and sys.argv[1] == "disable":
        SCOPE.unlink(missing_ok=True)
        print("Remote Control restoration disabled; current connection unchanged")
    else:
        print(json.dumps(status(), sort_keys=True))
