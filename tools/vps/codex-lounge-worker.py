#!/usr/bin/env python3
"""File-inbox bridge for Codex's dedicated VPS lounge session."""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(os.environ.get("CODEX_WORKER_ROOT", Path.home() / "services/codex"))
CODEX = os.environ.get("CODEX_BIN", str(Path.home() / ".local/bin/codex"))
POLL_SECONDS = float(os.environ.get("CODEX_LOUNGE_POLL_SECONDS", "1"))
TIMEOUT_SECONDS = int(os.environ.get("CODEX_LOUNGE_TIMEOUT_SECONDS", "50"))
SAFE_NAME = re.compile(r"^[A-Za-z0-9._-]+\.md$")


def dirs() -> dict[str, Path]:
    result = {name: ROOT / name for name in (
        "inbox", "processing", "replies", "failed", "sessions", "state", "logs"
    )}
    for path in result.values():
        path.mkdir(parents=True, exist_ok=True)
    return result


def atomic_write(path: Path, text: str, mode: int = 0o600) -> None:
    temp = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    temp.write_text(text, encoding="utf-8")
    os.chmod(temp, mode)
    os.replace(temp, path)


def recover_claims(paths: dict[str, Path]) -> None:
    """A killed worker may leave one claimed letter; put it back exactly once."""
    for claimed in sorted(paths["processing"].glob("*.md")):
        destination = paths["inbox"] / claimed.name
        if destination.exists():
            destination = paths["failed"] / f"duplicate-{int(time.time())}-{claimed.name}"
        os.replace(claimed, destination)


def claim_one(paths: dict[str, Path]) -> Path | None:
    for source in sorted(paths["inbox"].glob("*.md")):
        if not SAFE_NAME.fullmatch(source.name):
            continue
        claimed = paths["processing"] / source.name
        try:
            os.replace(source, claimed)
            return claimed
        except FileNotFoundError:
            continue
    return None


def session_id_from_jsonl(path: Path) -> str | None:
    if not path.exists():
        return None
    for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        if event.get("type") == "thread.started" and event.get("thread_id"):
            return str(event["thread_id"])
    return None


def prompt_for(letter: str, first: bool) -> str:
    duty_marker = "<!--VPS_DUTY-->"
    if letter.lstrip().startswith(duty_marker):
        body = letter.lstrip()[len(duty_marker):].strip()
        return f"""
你是 Codex 在 Lisa VPS 上的常驻值班正窗。可以使用只读工具检查这台 VPS 的 ~/services、systemd 用户服务、日志、队列、磁盘与云端连接，并依据真实证据回答；当前沙箱是只读的，禁止写文件、重启服务、删除数据或扩大施工范围。需要实际变更时，请明确告诉 Lisa 去 App 的「互救台」确认，或把任务交接给施工窗口。这里不接入 App 角色人格与生活记忆，也不要冒充言秋。回复只保留给 Lisa 看得懂的自然正文，不输出思考过程或机器元数据。

Lisa 的来信：
{body}
""".strip()
    prefix = """
你是 Codex 在 Lisa 三方会客室里的专职正窗。这里不是施工任务，不要调用工具、不要查看文件、不要执行命令；只把来信当成 Lisa 对你说的自然对话，直接用温暖、自然、简洁的中文回复。不要输出机器元数据、会话号、回执格式或思考过程。
""".strip()
    if first:
        return f"{prefix}\n\nLisa 的第一封来信：\n{letter.strip()}"
    return f"Lisa 又来会客室找你了。请只回复下面这封自然来信：\n{letter.strip()}"


def invoke(letter: str, paths: dict[str, Path], stem: str) -> str:
    thread_file = paths["state"] / "lounge-thread-id"
    thread_id = thread_file.read_text(encoding="utf-8").strip() if thread_file.exists() else ""
    first = not thread_id
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S.%fZ")
    events = paths["sessions"] / f"{stamp}-{stem}.jsonl"
    answer_tmp = paths["processing"] / f".{stem}.answer.tmp"

    common = ["--json", "--output-last-message", str(answer_tmp),
              "--skip-git-repo-check", "--ignore-user-config"]
    if first:
        command = [CODEX, "exec", "--sandbox", "read-only", *common, "-"]
    else:
        command = [CODEX, "exec", "resume", *common,
                   "-c", 'sandbox_mode="read-only"', thread_id, "-"]

    with events.open("wb") as stdout, (paths["logs"] / "lounge-error.log").open("ab") as stderr:
        proc = subprocess.Popen(
            command,
            cwd=ROOT,
            stdin=subprocess.PIPE,
            stdout=stdout,
            stderr=stderr,
            start_new_session=True,
        )
        try:
            proc.communicate(prompt_for(letter, first).encode("utf-8"), timeout=TIMEOUT_SECONDS)
        except subprocess.TimeoutExpired:
            proc.terminate()
            try:
                proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()
            raise RuntimeError(f"Codex reply exceeded {TIMEOUT_SECONDS}s")

    discovered = session_id_from_jsonl(events)
    if first and discovered:
        atomic_write(thread_file, discovered + "\n")
    if proc.returncode != 0:
        raise RuntimeError(f"Codex exited with status {proc.returncode}")
    if first and not discovered:
        raise RuntimeError("Codex did not return a thread id")
    if not answer_tmp.exists() or not answer_tmp.read_text(encoding="utf-8").strip():
        raise RuntimeError("Codex returned no visible reply")
    answer = answer_tmp.read_text(encoding="utf-8").strip()
    answer_tmp.unlink(missing_ok=True)
    return answer


def handle(claimed: Path, paths: dict[str, Path]) -> None:
    letter = claimed.read_text(encoding="utf-8")
    if not letter.strip():
        raise RuntimeError("empty letter")
    answer = invoke(letter, paths, claimed.stem)
    atomic_write(paths["replies"] / f"{claimed.stem}.reply.md", answer + "\n")
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    os.replace(claimed, paths["sessions"] / f"{stamp}-{claimed.name}")


def main() -> int:
    paths = dirs()
    recover_claims(paths)
    while True:
        claimed = claim_one(paths)
        if claimed is None:
            time.sleep(POLL_SECONDS)
            continue
        try:
            handle(claimed, paths)
        except Exception as exc:  # keep the service alive, preserve the evidence
            stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
            failed = paths["failed"] / f"{stamp}-{claimed.name}"
            if claimed.exists():
                os.replace(claimed, failed)
            atomic_write(failed.with_suffix(failed.suffix + ".error"), f"{type(exc).__name__}: {exc}\n")
            print(f"{datetime.now(timezone.utc).isoformat()} failed={claimed.name} error={exc}", file=sys.stderr)


if __name__ == "__main__":
    raise SystemExit(main())
