#!/usr/bin/env python3
"""Lightweight watchdog for Codex/ChatGPT process and disk leaks.

The watchdog is deliberately diagnostic-only: it records evidence and emits a
local notification, but never kills or restarts an application.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import time
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path


STATE_ROOT = Path.home() / "Library/Application Support/LisaPhone/codex-watchdog"
STATE_FILE = STATE_ROOT / "state.json"
STATUS_FILE = STATE_ROOT / "status.json"
INCIDENT_ROOT = STATE_ROOT / "incidents"
LOG_FILE = STATE_ROOT / "watchdog.log"

SAMPLE_SECONDS = 30
HIGH_CPU_PERCENT = 90.0
HIGH_CPU_STREAK = 6  # About three minutes at the default sample interval.
LOW_DISK_BYTES = 3 * 1024**3
CRITICAL_DISK_BYTES = 1024**3
FAST_DROP_BYTES = 1024**3
FAST_DROP_WINDOW_SECONDS = 10 * 60
FAST_DROP_WARN_FREE_BYTES = 20 * 1024**3
SUSTAINED_DROP_BYTES = 5 * 1024**3
SUSTAINED_DROP_WINDOW_SECONDS = 30 * 60
PROCESS_FLOOR = 24
PROCESS_GROWTH_LIMIT = 12
TRANSIENT_PROCESS_SECONDS = 30 * 60
INCIDENT_COOLDOWN_SECONDS = 15 * 60

PROCESS_MARKERS = (
    "/Applications/ChatGPT.app/",
    "/Applications/Codex.app/",
    "/Contents/Resources/codex",
    "codex-code-mode-host",
    "Codex Computer Use.app",
    "cua_node/bin/node_repl",
)


@dataclass
class ProcessInfo:
    pid: int
    ppid: int
    cpu: float
    mem: float
    state: str
    elapsed_seconds: int
    command: str


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def run(command: list[str], timeout: float = 8.0) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        check=False,
        capture_output=True,
        text=True,
        timeout=timeout,
    )


def parse_elapsed(value: str) -> int:
    # ps etime is [[dd-]hh:]mm:ss.
    days = 0
    if "-" in value:
        day_text, value = value.split("-", 1)
        days = int(day_text)
    parts = [int(part) for part in value.split(":")]
    if len(parts) == 3:
        hours, minutes, seconds = parts
    elif len(parts) == 2:
        hours, (minutes, seconds) = 0, parts
    else:
        hours, minutes, seconds = 0, 0, parts[0]
    return days * 86400 + hours * 3600 + minutes * 60 + seconds


def list_codex_processes() -> list[ProcessInfo]:
    result = run(
        ["ps", "axo", "pid=,ppid=,%cpu=,%mem=,state=,etime=,command="],
        timeout=10,
    )
    processes: list[ProcessInfo] = []
    for line in result.stdout.splitlines():
        if not any(marker in line for marker in PROCESS_MARKERS):
            continue
        fields = line.strip().split(None, 6)
        if len(fields) != 7:
            continue
        try:
            processes.append(
                ProcessInfo(
                    pid=int(fields[0]),
                    ppid=int(fields[1]),
                    cpu=float(fields[2]),
                    mem=float(fields[3]),
                    state=fields[4],
                    elapsed_seconds=parse_elapsed(fields[5]),
                    command=fields[6],
                )
            )
        except (TypeError, ValueError):
            continue
    return processes


def is_transient_tool_process(item: ProcessInfo) -> bool:
    """Ignore young per-call tool runners when measuring resident growth.

    Code-mode creates a short-lived node_repl for ordinary tool calls. Counting
    those alongside the desktop app's resident renderers caused false alarms
    during active maintenance. A runner that survives half an hour is no longer
    treated as transient and will still contribute to a leak warning.
    """
    return (
        "/Contents/Resources/cua_node/bin/node_repl" in item.command
        and item.elapsed_seconds < TRANSIENT_PROCESS_SECONDS
    )


def disk_drop_reason(
    *, free_bytes: int, fast_drop_bytes: int, sustained_drop_bytes: int
) -> str | None:
    """Return a user-facing reason only for a risky or sustained disk fall.

    Xcode device support and application updaters routinely move several GiB
    in a few minutes. That activity is worth recording in status diagnostics,
    but it should not wake Lisa while ample free space remains. A short fall
    becomes actionable near 20 GiB; a sustained 30-minute fall of 5 GiB still
    warns at any free-space level so a real runaway writer is caught early.
    """
    if sustained_drop_bytes >= SUSTAINED_DROP_BYTES:
        return f"disk fell {sustained_drop_bytes / 1024**3:.2f} GiB within thirty minutes"
    if free_bytes < FAST_DROP_WARN_FREE_BYTES and fast_drop_bytes >= FAST_DROP_BYTES:
        return (
            f"disk fell {fast_drop_bytes / 1024**3:.2f} GiB within ten minutes "
            f"with only {free_bytes / 1024**3:.2f} GiB free"
        )
    return None


def load_state() -> dict:
    try:
        value = json.loads(STATE_FILE.read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else {}
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        return {}


def atomic_json_write(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(temporary, path)


def append_log(message: str) -> None:
    STATE_ROOT.mkdir(parents=True, exist_ok=True)
    with LOG_FILE.open("a", encoding="utf-8") as handle:
        handle.write(f"{utc_now()} {message}\n")
    try:
        os.chmod(LOG_FILE, 0o600)
    except OSError:
        pass


def notify(title: str, message: str) -> None:
    safe_title = title.replace('"', "'")
    safe_message = message.replace('"', "'")
    try:
        run(
            [
                "/usr/bin/osascript",
                "-e",
                f'display notification "{safe_message}" with title "{safe_title}"',
            ],
            timeout=5,
        )
    except (OSError, subprocess.TimeoutExpired):
        pass


def capture_incident(reasons: list[str], snapshot: dict, processes: list[ProcessInfo]) -> Path:
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    incident_dir = INCIDENT_ROOT / stamp
    incident_dir.mkdir(parents=True, exist_ok=True)
    atomic_json_write(
        incident_dir / "summary.json",
        {"captured_at": utc_now(), "reasons": reasons, "snapshot": snapshot},
    )
    process_text = "\n".join(
        f"{item.pid:>7} {item.ppid:>7} {item.cpu:>6.1f} {item.mem:>5.1f} "
        f"{item.state:<5} {item.elapsed_seconds:>8} {item.command}"
        for item in processes
    )
    (incident_dir / "processes.txt").write_text(process_text + "\n", encoding="utf-8")

    # Only inspect suspicious Codex PIDs. A whole-system lsof +L1 can itself
    # become expensive on a sick machine.
    suspicious = sorted(
        processes,
        key=lambda item: (item.cpu, item.elapsed_seconds),
        reverse=True,
    )[:8]
    lsof_sections: list[str] = []
    for item in suspicious:
        try:
            result = run(["lsof", "-nP", "+L1", "-p", str(item.pid)], timeout=3)
        except (OSError, subprocess.TimeoutExpired):
            lsof_sections.append(f"## PID {item.pid}\n<lsof timed out>\n")
            continue
        lines = [line for line in result.stdout.splitlines() if line]
        if len(lines) > 1:
            lsof_sections.append(f"## PID {item.pid}\n" + "\n".join(lines) + "\n")
    (incident_dir / "deleted-open-files.txt").write_text(
        "\n".join(lsof_sections) or "No deleted open files found.\n",
        encoding="utf-8",
    )
    return incident_dir


def sample(*, allow_incident: bool = True) -> dict:
    STATE_ROOT.mkdir(parents=True, exist_ok=True)
    os.chmod(STATE_ROOT, 0o700)
    now = time.time()
    state = load_state()
    processes = list_codex_processes()
    free_bytes = shutil.disk_usage("/").free
    resident_processes = [item for item in processes if not is_transient_tool_process(item)]
    process_count = len(resident_processes)
    observed_process_count = len(processes)

    baseline = int(state.get("baseline_process_count") or 0)
    samples_seen = int(state.get("samples_seen") or 0)
    if samples_seen < 10:
        baseline = max(baseline, process_count)
    elif baseline <= 0:
        baseline = process_count

    previous_cpu = state.get("high_cpu_streaks") or {}
    current_cpu: dict[str, int] = {}
    for item in processes:
        key = str(item.pid)
        current_cpu[key] = int(previous_cpu.get(key, 0)) + 1 if item.cpu >= HIGH_CPU_PERCENT else 0

    disk_history = state.get("disk_history") or []
    disk_history = [
        point
        for point in disk_history
        if isinstance(point, list)
        and len(point) == 2
        and now - float(point[0]) <= SUSTAINED_DROP_WINDOW_SECONDS
    ]
    disk_history.append([now, free_bytes])
    fast_history = [
        point for point in disk_history if now - float(point[0]) <= FAST_DROP_WINDOW_SECONDS
    ]
    fast_oldest_free = int(fast_history[0][1]) if fast_history else free_bytes
    sustained_oldest_free = int(disk_history[0][1]) if disk_history else free_bytes
    fast_disk_drop = max(0, fast_oldest_free - free_bytes)
    sustained_disk_drop = max(0, sustained_oldest_free - free_bytes)

    reasons: list[str] = []
    process_limit = max(PROCESS_FLOOR, baseline + PROCESS_GROWTH_LIMIT)
    if process_count > process_limit:
        reasons.append(f"Codex resident process count {process_count} exceeded limit {process_limit}")
    hot = [item for item in processes if current_cpu.get(str(item.pid), 0) >= HIGH_CPU_STREAK]
    if hot:
        reasons.append(
            "sustained high CPU: " + ", ".join(f"PID {item.pid} {item.cpu:.1f}%" for item in hot)
        )
    if free_bytes < LOW_DISK_BYTES:
        reasons.append(f"low disk: {free_bytes / 1024**3:.2f} GiB free")
    drop_reason = disk_drop_reason(
        free_bytes=free_bytes,
        fast_drop_bytes=fast_disk_drop,
        sustained_drop_bytes=sustained_disk_drop,
    )
    if drop_reason:
        reasons.append(drop_reason)

    level = "critical" if free_bytes < CRITICAL_DISK_BYTES or len(hot) > 0 else ("warning" if reasons else "healthy")
    snapshot = {
        "sampled_at": utc_now(),
        "level": level,
        "reasons": reasons,
        "free_bytes": free_bytes,
        "free_gib": round(free_bytes / 1024**3, 2),
        "fast_disk_drop_gib": round(fast_disk_drop / 1024**3, 2),
        "sustained_disk_drop_gib": round(sustained_disk_drop / 1024**3, 2),
        "process_count": process_count,
        "observed_process_count": observed_process_count,
        "transient_tool_process_count": observed_process_count - process_count,
        "process_limit": process_limit,
        "baseline_process_count": baseline,
        "max_cpu_percent": max((item.cpu for item in processes), default=0.0),
        "processes": [asdict(item) for item in processes],
        "last_incident_dir": state.get("last_incident_dir"),
    }

    last_incident_at = float(state.get("last_incident_at") or 0)
    if allow_incident and reasons and now - last_incident_at >= INCIDENT_COOLDOWN_SECONDS:
        incident_dir = capture_incident(reasons, snapshot, processes)
        snapshot["last_incident_dir"] = str(incident_dir)
        last_incident_at = now
        append_log("INCIDENT " + " | ".join(reasons) + f" -> {incident_dir}")
        notify("Codex 看门狗报警", "；".join(reasons) + "。已保存病理包，不会自动杀进程。")

    atomic_json_write(STATUS_FILE, snapshot)
    atomic_json_write(
        STATE_FILE,
        {
            "baseline_process_count": baseline,
            "samples_seen": samples_seen + 1,
            "high_cpu_streaks": current_cpu,
            "disk_history": disk_history,
            "last_incident_at": last_incident_at,
            "last_incident_dir": snapshot.get("last_incident_dir"),
        },
    )
    return snapshot


def print_status() -> int:
    try:
        status = json.loads(STATUS_FILE.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError, OSError):
        status = sample(allow_incident=False)
    print(json.dumps(status, ensure_ascii=False, indent=2))
    return 0


def serve() -> int:
    append_log("watchdog started (diagnostic-only; automatic restart disabled)")
    while True:
        try:
            sample()
        except Exception as error:  # Keep monitoring even if one probe fails.
            append_log(f"sample failed: {type(error).__name__}: {error}")
        time.sleep(SAMPLE_SECONDS)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("once", "serve", "status"), nargs="?", default="status")
    args = parser.parse_args()
    if args.command == "once":
        print(json.dumps(sample(), ensure_ascii=False, indent=2))
        return 0
    if args.command == "serve":
        return serve()
    return print_status()


if __name__ == "__main__":
    raise SystemExit(main())
