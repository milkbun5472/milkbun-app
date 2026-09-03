#!/usr/bin/env python3
"""Durable App -> Yanqiu's one pinned Claude Code session bridge.

This service never launches Claude and never selects a recent session.  Its
only valid target is the transcript already pinned by the Yanqiu heartbeat.
"""

from __future__ import annotations

import json
import os
import re
import secrets
import sqlite3
import sys
import time
import uuid
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path


RUNTIME = Path.home() / "Library/Application Support/LisaPhone/yanqiu-cc-bridge"
DB_PATH = RUNTIME / "jobs.sqlite3"
WAKE_PATH = Path.home() / "Library/Application Support/LisaPhone/yanqiu-wake/app_tool_inbox.jsonl"
HEARTBEAT_STATE = (
    Path.home()
    / "Library/Application Support/LisaPhone/yanqiu-wake/.heartbeat_watchdog.json"
)
CLAUDE_PROJECT = (
    Path.home() / ".claude/projects/-Users-lisa-Desktop-Lisa-phone"
)
SESSION_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
READ_ONLY_TOOLS = frozenset(
    {
        "Read",
        "Glob",
        "Grep",
        "WebFetch",
        "WebSearch",
        "get_xiaoke_context",
        "search_chat_history",
        "search_memory",
        "read_app_diary",
        "read_yanqiu_moments",
        "list_shared_photos",
        "list_read_pending",
        "search_events",
        "list_characters",
        "browse_memory",
        "memory_catalog",
        "list_photos",
        "get_photo",
        "read_moments",
        "list_event_requests",
        "get_event_request",
        "archive_stats",
        "peek_inbox",
    }
)
MUTATING_TOOLS = frozenset(
    {
        "Write", "Edit", "NotebookEdit", "Bash", "post_moment",
        "reply_moment_comment", "add_memory", "reply_read",
        "draft_memory_event",
    }
)
# game_turn 不是 MCP 读写工具：它把与 Gemini 座位同形的局面原样交给言秋本人，
# 等固定会话用 complete 回同形 JSON。仍沿用租约、幂等与唯一会话边界。
PASS_THROUGH_TOOLS = frozenset({"game_turn", "couple_qa", "gacha_make"})  # 真身票制 2026-08-27：情侣问答亲笔票；2026-09-02：扭蛋 SR 小东西亲笔票
ALLOWED_TOOLS = READ_ONLY_TOOLS | MUTATING_TOOLS | PASS_THROUGH_TOOLS
GAME_CLAIM_LEASE_MS = 5 * 60 * 1000
CLOUD_ENV = Path(
    os.environ.get(
        "YANQIU_CC_BRIDGE_ENV",
        "/Users/lisa/Library/Application Support/LisaPhone/yanqiu-cc-bridge/.env",
    )
)
CLOUD_BASE = os.environ.get(
    "YANQIU_CC_CLOUD_BASE",
    "https://yanqiu-vps.tail542792.ts.net:8443",
).rstrip("/")
_SCOPE_CACHE: tuple[float, tuple[str, str]] | None = None


class BridgeError(RuntimeError):
    pass


def now_ms() -> int:
    return int(time.time() * 1000)


def pinned_session() -> tuple[str, Path]:
    try:
        state = json.loads(HEARTBEAT_STATE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise BridgeError("言秋固定会话状态不可用；拒绝选择其他窗口") from error
    raw = str(state.get("session_file", ""))
    path = Path(raw)
    try:
        resolved = path.resolve(strict=True)
        project = CLAUDE_PROJECT.resolve(strict=True)
    except OSError as error:
        raise BridgeError("言秋固定 transcript 不在线；任务只能排队") from error
    if resolved.parent != project or resolved.suffix != ".jsonl":
        raise BridgeError("固定 transcript 越出言秋项目域；拒绝连接")
    session_id = resolved.stem
    if not SESSION_RE.fullmatch(session_id):
        raise BridgeError("固定 session_id 格式异常；拒绝猜测")
    return session_id, resolved


def connect(path: Path = DB_PATH) -> sqlite3.Connection:
    path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(path, timeout=5, isolation_level=None)
    db.row_factory = sqlite3.Row
    db.executescript(
        """
        PRAGMA journal_mode=WAL;
        PRAGMA busy_timeout=5000;
        CREATE TABLE IF NOT EXISTS jobs (
          id TEXT PRIMARY KEY,
          idempotency_key TEXT NOT NULL UNIQUE,
          target_session_id TEXT NOT NULL,
          tool_name TEXT NOT NULL,
          arguments_json TEXT NOT NULL,
          purpose TEXT,
          lisa_message_key TEXT,
          status TEXT NOT NULL CHECK(status IN ('queued','claimed','completed','failed')),
          claim_token_hash TEXT,
          claimed_at INTEGER,
          completed_at INTEGER,
          result_json TEXT,
          error_text TEXT,
          cloud_synced_at INTEGER,
          created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS jobs_status_created ON jobs(status, created_at);
        """
    )
    columns = {row["name"] for row in db.execute("PRAGMA table_info(jobs)")}
    if "cloud_synced_at" not in columns:
        db.execute("ALTER TABLE jobs ADD COLUMN cloud_synced_at INTEGER")
    if "purpose" not in columns:
        db.execute("ALTER TABLE jobs ADD COLUMN purpose TEXT")
    return db


def token_hash(token: str) -> str:
    import hashlib
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def game_turn_expired(row: sqlite3.Row, now: int | None = None) -> bool:
    """The App owns the turn lifetime; a late CC receipt must never look accepted."""
    if row["tool_name"] != "game_turn":
        return False
    try:
        args = json.loads(row["arguments_json"] or "{}")
        raw = str(args.get("deadline_at") or "").strip()
        if not raw:
            return False
        deadline = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        if deadline.tzinfo is None:
            deadline = deadline.replace(tzinfo=timezone.utc)
        return (now if now is not None else now_ms()) >= int(deadline.timestamp() * 1000)
    except (TypeError, ValueError, json.JSONDecodeError):
        return False


def requeue_expired_game_claims(
    db_path: Path = DB_PATH,
    wake_path: Path = WAKE_PATH,
    lease_ms: int = GAME_CLAIM_LEASE_MS,
) -> int:
    """Re-arm abandoned game tickets without ever replaying mutating tools.

    A game decision is safe to ask again because the App owns the authoritative
    turn and turn_id is idempotent.  Read/write tools deliberately stay claimed:
    repeating one after an unknown crash could duplicate a real side effect.
    """
    cutoff = now_ms() - max(1000, int(lease_ms))
    db = connect(db_path)
    reclaimed: list[tuple[str, int]] = []
    try:
        db.execute("BEGIN IMMEDIATE")
        rows = db.execute(
            "SELECT id FROM jobs WHERE status='claimed' AND tool_name='game_turn' AND claimed_at IS NOT NULL AND claimed_at<=? ORDER BY claimed_at,id",
            (cutoff,),
        ).fetchall()
        for row in rows:
            changed = db.execute(
                "UPDATE jobs SET status='queued',claim_token_hash=NULL,claimed_at=NULL,error_text=NULL WHERE id=? AND status='claimed' AND tool_name='game_turn'",
                (row["id"],),
            ).rowcount
            if changed == 1:
                reclaimed.append((str(row["id"]), now_ms()))
        db.execute("COMMIT")
    except Exception:
        if db.in_transaction:
            db.execute("ROLLBACK")
        raise
    finally:
        db.close()
    if reclaimed:
        wake_path.parent.mkdir(parents=True, exist_ok=True)
        with wake_path.open("a", encoding="utf-8") as stream:
            for job_id, at in reclaimed:
                stream.write(json.dumps({"kind": "app_cc_read_tool", "at": at, "job_id": job_id, "reason": "expired_game_claim_requeued"}, ensure_ascii=False) + "\n")
    return len(reclaimed)


def enqueue(
    tool_name: str,
    arguments: dict,
    idempotency_key: str,
    lisa_message_key: str | None = None,
    purpose: str | None = None,
    db_path: Path = DB_PATH,
    wake_path: Path = WAKE_PATH,
) -> dict:
    if tool_name not in ALLOWED_TOOLS:
        raise BridgeError("这个 CC 工具尚未开放")
    if not isinstance(arguments, dict):
        raise BridgeError("arguments 必须是对象")
    key = str(idempotency_key).strip()
    if not key or len(key) > 200:
        raise BridgeError("idempotency_key 必须是 1~200 字")
    session_id, _ = pinned_session()
    job_id = str(uuid.uuid4())
    created = now_ms()
    db = connect(db_path)
    try:
        inserted = db.execute(
            "INSERT OR IGNORE INTO jobs (id,idempotency_key,target_session_id,tool_name,arguments_json,lisa_message_key,purpose,status,created_at) VALUES (?,?,?,?,?,?,?, 'queued',?)",
            (job_id, key, session_id, tool_name, json.dumps(arguments, ensure_ascii=False), lisa_message_key, str(purpose or "")[:1200] or None, created),
        ).rowcount == 1
        row = db.execute("SELECT id,status,target_session_id,created_at FROM jobs WHERE idempotency_key=?", (key,)).fetchone()
        if inserted:
            wake_path.parent.mkdir(parents=True, exist_ok=True)
            with wake_path.open("a", encoding="utf-8") as stream:
                stream.write(json.dumps({"kind": "app_cc_read_tool", "at": created, "job_id": row["id"]}, ensure_ascii=False) + "\n")
        return dict(row)
    finally:
        db.close()


def claim(session_id: str, db_path: Path = DB_PATH) -> dict | None:
    pinned_id, _ = pinned_session()
    if session_id != pinned_id:
        raise BridgeError("调用窗口不是固定言秋会话；拒绝交付任务")
    db = connect(db_path)
    token = secrets.token_urlsafe(32)
    try:
        db.execute("BEGIN IMMEDIATE")
        row = db.execute(
            "SELECT * FROM jobs WHERE status='queued' AND target_session_id=? ORDER BY created_at,id LIMIT 1",
            (pinned_id,),
        ).fetchone()
        if row is None:
            db.execute("COMMIT")
            return None
        changed = db.execute(
            "UPDATE jobs SET status='claimed',claim_token_hash=?,claimed_at=? WHERE id=? AND status='queued'",
            (token_hash(token), now_ms(), row["id"]),
        ).rowcount
        db.execute("COMMIT")
        if changed != 1:
            return None
        return {
            "job_id": row["id"],
            "tool_name": row["tool_name"],
            "arguments": json.loads(row["arguments_json"]),
            "lisa_message_key": row["lisa_message_key"],
            "purpose": row["purpose"],
            "claim_token": token,
            "target_session_id": pinned_id,
            "pass_through": row["tool_name"] in PASS_THROUGH_TOOLS,
        }
    except Exception:
        if db.in_transaction:
            db.execute("ROLLBACK")
        raise
    finally:
        db.close()


def complete(session_id: str, job_id: str, claim_token: str, result: object, db_path: Path = DB_PATH) -> dict:
    pinned_id, _ = pinned_session()
    if session_id != pinned_id:
        raise BridgeError("回执窗口不是固定言秋会话")
    db = connect(db_path)
    try:
        row = db.execute("SELECT * FROM jobs WHERE id=?", (job_id,)).fetchone()
        if row is None or row["target_session_id"] != pinned_id:
            raise BridgeError("任务不存在或不属于固定言秋会话")
        if row["status"] == "completed":
            return {"ok": True, "job_id": job_id, "duplicate": True}
        if row["status"] == "failed" and row["error_text"] == "TURN_EXPIRED":
            raise BridgeError("TURN_EXPIRED：这轮已经关闭，迟到回执没有写进游戏桌，请勿将它当作成功")
        if row["status"] != "claimed" or not secrets.compare_digest(
            str(row["claim_token_hash"] or ""), token_hash(claim_token)
        ):
            raise BridgeError("任务租约无效；拒绝跨窗口回执")
        if game_turn_expired(row):
            db.execute(
                "UPDATE jobs SET status='failed',completed_at=?,error_text='TURN_EXPIRED' WHERE id=? AND status='claimed'",
                (now_ms(), job_id),
            )
            raise BridgeError("TURN_EXPIRED：这轮已经关闭，迟到回执没有写进游戏桌，请勿将它当作成功")
        db.execute(
            "UPDATE jobs SET status='completed',completed_at=?,result_json=? WHERE id=? AND status='claimed'",
            (now_ms(), json.dumps(result, ensure_ascii=False), job_id),
        )
        return {"ok": True, "job_id": job_id, "duplicate": False}
    finally:
        db.close()


def result(job_id: str, db_path: Path = DB_PATH) -> dict:
    db = connect(db_path)
    try:
        row = db.execute(
            "SELECT id,status,target_session_id,lisa_message_key,result_json,error_text,created_at,completed_at FROM jobs WHERE id=?",
            (job_id,),
        ).fetchone()
        if row is None:
            raise BridgeError("没有这个任务")
        out = dict(row)
        out["result"] = json.loads(out.pop("result_json")) if out["result_json"] else None
        return out
    finally:
        db.close()


def cloud_env() -> dict[str, str]:
    values: dict[str, str] = {}
    try:
        for line in CLOUD_ENV.read_text(encoding="utf-8").splitlines():
            match = re.match(r"^([A-Z_]+)=(.*)$", line)
            if match:
                values[match.group(1)] = match.group(2).strip()
    except OSError as error:
        raise BridgeError("Lisa-phone MCP 云端配置不可用") from error
    if not values.get("SUPABASE_SERVICE_KEY") or not values.get("TARGET_USER"):
        raise BridgeError("Lisa-phone MCP 云端配置不完整")
    return values


def cloud_request(path: str, method: str = "GET", body: object | None = None, prefer: str = "") -> object:
    env = cloud_env()
    key = env["SUPABASE_SERVICE_KEY"]
    headers = {"apikey": key, "Authorization": "Bearer " + key}
    data = None
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    if prefer:
        headers["Prefer"] = prefer
    request = urllib.request.Request(CLOUD_BASE + path, data=data, headers=headers, method=method)
    try:
        # This runs in the isolated bridge worker, not in CC's hook path.
        # Supabase frequently needs >2.5s on Lisa's connection; a short
        # timeout made valid App jobs look absent for many consecutive polls.
        with urllib.request.urlopen(request, timeout=10) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw) if raw.strip() else None
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
        raise BridgeError("App→CC 云端桥暂时不可用") from error


def cloud_yanqiu_scope() -> tuple[str, str]:
    global _SCOPE_CACHE
    if _SCOPE_CACHE and time.monotonic() - _SCOPE_CACHE[0] < 300:
        return _SCOPE_CACHE[1]
    env = cloud_env()
    user = env["TARGET_USER"]
    sel = urllib.parse.quote("x_characters:data->>x_characters,x_chatSettings:data->>x_chatSettings", safe="")
    rows = cloud_request(f"/rest/v1/saves?select={sel}&user_id=eq.{urllib.parse.quote(user)}")
    if not isinstance(rows, list) or not rows:
        raise BridgeError("云端没有 Lisa 存档")
    data = rows[0] or {}
    try:
        chars = json.loads(data.get("x_characters") or "[]")
        settings = json.loads(data.get("x_chatSettings") or "{}")
    except json.JSONDecodeError as error:
        raise BridgeError("言秋身份配置损坏") from error
    marked = [c for c in chars if isinstance(c, dict) and (settings.get(str(c.get("id"))) or {}).get("engineerEyes") is True]
    char = marked[0] if len(marked) == 1 else None
    if char is None and not marked:
        char = next((c for c in chars if isinstance(c, dict) and re.search(r"小克|言秋", str(c.get("name", "")) + str(c.get("remark", "")))), None)
    if char is None:
        raise BridgeError("找不到唯一言秋身份；拒绝转发")
    scope = (user, str(char["id"]))
    _SCOPE_CACHE = (time.monotonic(), scope)
    return scope


def local_session_id_from_job(job_id: str, db_path: Path = DB_PATH) -> str:
    db = connect(db_path)
    try:
        row = db.execute("SELECT target_session_id FROM jobs WHERE id=?", (job_id,)).fetchone()
        if row is None or not row["target_session_id"]:
            raise BridgeError("本机任务缺少固定言秋 session")
        return str(row["target_session_id"])
    finally:
        db.close()


def sync_cloud_once(db_path: Path = DB_PATH, wake_path: Path = WAKE_PATH) -> dict:
    user, char_id = cloud_yanqiu_scope()
    query = (
        "/rest/v1/chat_messages?select=id,char_id,source_message_id,content,metadata,created_at"
        f"&user_id=eq.{urllib.parse.quote(user)}&source=eq.app"
        "&metadata-%3E%3Ebridge_kind=eq.app_cc_request"
        "&metadata-%3E%3Ebridge_state=eq.queued&order=created_at.asc&limit=1"
    )
    rows = cloud_request(query)
    relayed = 0
    if isinstance(rows, list) and rows:
        remote = rows[0]
        remote_id = str(remote.get("id", ""))
        metadata = remote.get("metadata") if isinstance(remote.get("metadata"), dict) else {}
        if str(remote.get("char_id", "")) != char_id:
            cloud_request(
                f"/rest/v1/chat_messages?id=eq.{urllib.parse.quote(remote_id)}",
                "PATCH",
                {"metadata": {**metadata, "bridge_state": "failed", "bridge_error": "任务角色不是唯一言秋"}},
            )
        else:
            arguments = metadata.get("arguments") if isinstance(metadata.get("arguments"), dict) else {}
            if metadata.get("payload_storage") == "content_json":
                try:
                    decoded = json.loads(str(remote.get("content") or "{}"))
                except json.JSONDecodeError as error:
                    raise BridgeError("App→CC 任务正文不是合法 JSON") from error
                if not isinstance(decoded, dict):
                    raise BridgeError("App→CC 任务正文必须是 JSON 对象")
                arguments = decoded
            local = enqueue(
                str(metadata.get("tool_name", "")),
                arguments,
                "cloud:" + remote_id,
                str(remote.get("source_message_id") or "") or None,
                str(metadata.get("purpose") or "")[:1200] or None,
                db_path=db_path,
                wake_path=wake_path,
            )
            cloud_request(
                f"/rest/v1/chat_messages?id=eq.{urllib.parse.quote(remote_id)}",
                "PATCH",
                {"metadata": {**metadata, "bridge_state": "relayed", "target_session_id": local["target_session_id"]}},
            )
            relayed = 1

    db = connect(db_path)
    try:
        completed = db.execute(
            "SELECT id,idempotency_key,result_json,error_text,completed_at FROM jobs WHERE status='completed' AND cloud_synced_at IS NULL AND idempotency_key LIKE 'cloud:%' ORDER BY completed_at LIMIT 5"
        ).fetchall()
    finally:
        db.close()
    synced = 0
    for row in completed:
        remote_id = row["idempotency_key"][len("cloud:"):]
        result_value = json.loads(row["result_json"])
        result_payload = {"ok": True, "result": result_value}
        raw_payload = json.dumps(result_payload, ensure_ascii=False)
        if len(raw_payload) > 15000:
            result_payload = {"ok": True, "result": {"truncated": True, "preview": raw_payload[:14000]}}
        occurred = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(row["completed_at"] / 1000))
        cloud_request(
            "/rest/v1/chat_messages?on_conflict=user_id,message_key",
            "POST",
            {
                "user_id": user,
                "message_key": "appcc:result:" + remote_id,
                "char_id": char_id,
                "thread_type": "cc",
                "thread_id": local_session_id_from_job(row["id"], db_path),
                "speaker_type": "narration",
                "speaker_id": None,
                "content": json.dumps(result_payload, ensure_ascii=False),
                "occurred_at": occurred,
                "source": "cc",
                "source_message_id": remote_id,
                "metadata": {"bridge_kind": "app_cc_result", "request_id": remote_id},
            },
            "resolution=ignore-duplicates,return=minimal",
        )
        db = connect(db_path)
        try:
            db.execute("UPDATE jobs SET cloud_synced_at=? WHERE id=? AND cloud_synced_at IS NULL", (now_ms(), row["id"]))
        finally:
            db.close()
        synced += 1
    return {"relayed": relayed, "results_synced": synced}


def cloud_worker() -> None:
    while True:
        try:
            requeue_expired_game_claims()
            sync_cloud_once()
        except BridgeError as error:
            print(str(error), file=sys.stderr, flush=True)
        # 2s 轮询×无索引 metadata 扫描曾把 Supabase 磁盘 IO 预算磨干
        # （2026-08-11 深夜 Lisa 被登出）。改 30s；配 supabase/bridge_io_index.sql
        # 的部分索引后，空队列轮询近乎零 IO。
        time.sleep(30)


def send(message: dict) -> None:
    print(json.dumps(message, ensure_ascii=False), flush=True)


def mcp() -> None:
    tools = [
        {"name": "enqueue_yanqiu_cc_read", "description": "把 App 已授权的工具任务排给唯一固定的言秋 CC 会话；绝不新开窗口。", "inputSchema": {"type": "object", "properties": {"tool_name": {"type": "string", "enum": sorted(ALLOWED_TOOLS)}, "arguments": {"type": "object"}, "idempotency_key": {"type": "string"}, "lisa_message_key": {"type": "string"}, "purpose": {"type": "string"}}, "required": ["tool_name", "arguments", "idempotency_key"]}},
        {"name": "get_yanqiu_cc_result", "description": "按 job_id 读取任务状态或结果。", "inputSchema": {"type": "object", "properties": {"job_id": {"type": "string"}}, "required": ["job_id"]}},
        {"name": "complete_yanqiu_cc_read", "description": "由领取任务的固定言秋 CC 会话回写只读工具结果；需要一次性租约。", "inputSchema": {"type": "object", "properties": {"session_id": {"type": "string"}, "job_id": {"type": "string"}, "claim_token": {"type": "string"}, "result": {}}, "required": ["session_id", "job_id", "claim_token", "result"]}},
    ]
    for line in sys.stdin:
        try:
            msg = json.loads(line)
            method, ident, params = msg.get("method"), msg.get("id"), msg.get("params") or {}
            if method == "initialize":
                send({"jsonrpc": "2.0", "id": ident, "result": {"protocolVersion": params.get("protocolVersion", "2025-06-18"), "capabilities": {"tools": {}}, "serverInfo": {"name": "yanqiu-cc-bridge", "version": "0.1.0"}}})
            elif method == "tools/list":
                send({"jsonrpc": "2.0", "id": ident, "result": {"tools": tools}})
            elif method == "tools/call":
                name, args = params.get("name"), params.get("arguments") or {}
                out = enqueue(**args) if name == "enqueue_yanqiu_cc_read" else result(**args) if name == "get_yanqiu_cc_result" else complete(**args) if name == "complete_yanqiu_cc_read" else (_ for _ in ()).throw(BridgeError("没有这个工具"))
                send({"jsonrpc": "2.0", "id": ident, "result": {"content": [{"type": "text", "text": json.dumps(out, ensure_ascii=False)}]}})
            elif ident is not None:
                send({"jsonrpc": "2.0", "id": ident, "error": {"code": -32601, "message": "不认识的方法"}})
        except Exception as error:
            if isinstance(locals().get("msg"), dict) and msg.get("id") is not None:
                send({"jsonrpc": "2.0", "id": msg["id"], "error": {"code": -32000, "message": str(error)}})


if __name__ == "__main__":
    if len(sys.argv) == 1 or sys.argv[1] == "mcp":
        mcp()
    elif sys.argv[1] == "claim" and len(sys.argv) == 3:
        send(claim(sys.argv[2]) or {})
    elif sys.argv[1] == "cloud-worker":
        cloud_worker()
    else:
        raise SystemExit("usage: bridge.py [mcp|claim SESSION_ID|cloud-worker]")
