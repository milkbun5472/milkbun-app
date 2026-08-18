#!/usr/bin/env python3
"""Idempotently submit one lounge letter and wait for its reply."""

from __future__ import annotations

import os
import re
import sys
import time
from pathlib import Path


ROOT = Path(os.environ.get("CODEX_WORKER_ROOT", Path.home() / "services/codex"))
SAFE_ID = re.compile(r"^[A-Za-z0-9._-]{1,120}$")
MAX_BYTES = 32 * 1024
WAIT_SECONDS = int(os.environ.get("CODEX_LOUNGE_SUBMIT_TIMEOUT", "75"))


def main() -> int:
    if len(sys.argv) != 2 or not SAFE_ID.fullmatch(sys.argv[1]):
        print("invalid dispatch id", file=sys.stderr)
        return 2
    dispatch_id = sys.argv[1]
    body = sys.stdin.buffer.read(MAX_BYTES + 1)
    if len(body) > MAX_BYTES or not body.strip():
        print("invalid letter", file=sys.stderr)
        return 2

    inbox = ROOT / "inbox"
    processing = ROOT / "processing"
    replies = ROOT / "replies"
    failed = ROOT / "failed"
    sessions = ROOT / "sessions"
    for directory in (inbox, processing, replies, failed, sessions):
        directory.mkdir(parents=True, exist_ok=True)

    reply = replies / f"{dispatch_id}.reply.md"
    ticket = sessions / f"submit-{dispatch_id}.ticket"
    try:
        fd = os.open(ticket, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        fd = None
    if fd is not None:
        with os.fdopen(fd, "wb") as stream:
            stream.write(f"submitted_at={int(time.time())}\n".encode())
        temp = inbox / f".{dispatch_id}.{os.getpid()}.tmp"
        temp.write_bytes(body)
        os.chmod(temp, 0o600)
        os.replace(temp, inbox / f"{dispatch_id}.md")

    deadline = time.monotonic() + WAIT_SECONDS
    while time.monotonic() < deadline:
        if reply.exists() and reply.stat().st_size:
            sys.stdout.write(reply.read_text(encoding="utf-8"))
            return 0
        if any(failed.glob(f"*-{dispatch_id}.md.error")):
            print("lounge worker failed this dispatch", file=sys.stderr)
            return 3
        time.sleep(0.5)
    print("lounge reply timeout", file=sys.stderr)
    return 4


if __name__ == "__main__":
    raise SystemExit(main())
