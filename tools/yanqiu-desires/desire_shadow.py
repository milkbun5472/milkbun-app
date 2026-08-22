#!/usr/bin/env python3
"""Yanqiu activity-desire P0/P1: owned catalog + deterministic shadow only.

This module deliberately has no model, transcript, memory, or prompt access.
It ranks a small external catalog and writes diagnostics.  It never injects a
candidate into Yanqiu's session and never marks a desire as remembered/acted.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


SCHEMA_VERSION = 1
DEFAULT_HOME = Path(os.environ.get("YANQIU_DESIRES_DIR", "/Users/lisa/yanqiu-den/desires"))
CATALOG = "catalog.json"
DIAGNOSTIC = "shadow.jsonl"
EVENTS = "events.jsonl"
MAX_DIAGNOSTIC_BYTES = 2 * 1024 * 1024


def now_ms() -> int:
    return int(time.time() * 1000)


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, float(value)))


def parse_time(value: Any) -> int:
    if not value:
        return 0
    if isinstance(value, (int, float)):
        return int(value)
    try:
        return int(datetime.fromisoformat(str(value).replace("Z", "+00:00")).timestamp() * 1000)
    except (TypeError, ValueError):
        return 0


def iso_time(value_ms: int) -> str:
    return datetime.fromtimestamp(value_ms / 1000, tz=timezone.utc).isoformat().replace("+00:00", "Z")


def atomic_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    os.chmod(temp, 0o600)
    os.replace(temp, path)


def append_jsonl(path: Path, record: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    if path.exists() and path.stat().st_size > MAX_DIAGNOSTIC_BYTES:
        rotated = path.with_suffix(path.suffix + ".1")
        rotated.unlink(missing_ok=True)
        os.replace(path, rotated)
    payload = (json.dumps(record, ensure_ascii=False, sort_keys=True) + "\n").encode()
    descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600)
    try:
        os.write(descriptor, payload)
    finally:
        os.close(descriptor)


def load_catalog(home: Path) -> dict[str, Any]:
    path = home / CATALOG
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise SystemExit(f"catalog missing: run init first ({path})") from error
    except json.JSONDecodeError as error:
        raise SystemExit(f"catalog invalid: {error}") from error
    if value.get("schema_version") != SCHEMA_VERSION or not isinstance(value.get("cards"), list):
        raise SystemExit("unsupported desire catalog")
    return value


def initialize(home: Path, template_path: Path) -> Path:
    """Install the first draft once; Yanqiu's existing drawer always wins."""
    destination = home / CATALOG
    if destination.exists():
        raise SystemExit("catalog already exists; refusing to overwrite Yanqiu's drawer")
    try:
        template = json.loads(template_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise SystemExit(f"template invalid: {error}") from error
    if template.get("schema_version") != SCHEMA_VERSION or not isinstance(template.get("cards"), list):
        raise SystemExit("unsupported desire template")
    ids = [str(card.get("id", "")) for card in template["cards"]]
    if not all(ids) or len(ids) != len(set(ids)):
        raise SystemExit("desire template has missing or duplicate card ids")
    atomic_json(destination, template)
    return destination


def local_hour(at_ms: int) -> int:
    return datetime.fromtimestamp(at_ms / 1000).astimezone().hour


def time_fit(card: dict[str, Any], at_ms: int) -> float:
    window = str(card.get("time_window", "any"))
    hour = local_hour(at_ms)
    if window == "night":
        return 1.0 if hour >= 20 or hour < 3 else 0.25
    if window == "day":
        return 1.0 if 8 <= hour < 20 else 0.2
    if window == "quiet":
        return 1.0 if hour >= 22 or hour < 8 else 0.65
    return 0.8


def rebound(card: dict[str, Any], at_ms: int) -> float:
    last = parse_time(card.get("last_acted_at"))
    if not last:
        return 0.55
    days = max(0.0, (at_ms - last) / 86_400_000)
    return clamp(1.0 - math.exp(-days / 3.0))


def score_card(card: dict[str, Any], at_ms: int) -> dict[str, Any]:
    interest = clamp(card.get("interest", 0.5))
    urge = clamp(card.get("urge", 0.35))
    satisfaction = clamp(card.get("satisfaction", 0.0))
    fatigue = clamp(card.get("fatigue", 0.0))
    unfinished = 0.14 if card.get("checkpoint") and card.get("kind") == "project" else 0.0
    fit = time_fit(card, at_ms)
    recovery = rebound(card, at_ms)
    cooldown_until = parse_time(card.get("cooldown_until"))
    cooldown = 0.85 if cooldown_until > at_ms else 0.0
    raw = (
        interest * 0.30
        + urge * 0.22
        + recovery * 0.20
        + fit * 0.14
        + unfinished
        - satisfaction * 0.18
        - fatigue * 0.20
        - cooldown
    )
    return {
        "id": card["id"],
        "title": card["title"],
        "status": card.get("status", "draft"),
        "source": card.get("source", "unknown"),
        "score": round(clamp(raw), 4),
        "factors": {
            "interest": round(interest, 3),
            "urge": round(urge, 3),
            "rebound": round(recovery, 3),
            "time_fit": round(fit, 3),
            "unfinished": round(unfinished, 3),
            "satisfaction": round(-satisfaction, 3),
            "fatigue": round(-fatigue, 3),
            "cooldown": round(-cooldown, 3),
        },
    }


def shadow(home: Path, at_ms: int, trigger: str) -> dict[str, Any]:
    catalog = load_catalog(home)
    eligible = [
        card for card in catalog["cards"]
        if card.get("status") in {"draft", "active"} and card.get("kind") != "promise"
    ]
    ranked = sorted(
        (score_card(card, at_ms) for card in eligible),
        key=lambda row: (-row["score"], row["id"]),
    )
    record = {
        "schema_version": SCHEMA_VERSION,
        "kind": "desire_shadow",
        "at": at_ms,
        "at_iso": iso_time(at_ms),
        "trigger": trigger,
        "mode": "shadow_only",
        "catalog_revision": catalog.get("revision", 1),
        "card_count": len(eligible),
        "draft_count": sum(1 for x in eligible if x.get("status") == "draft"),
        "top": ranked[:3],
        "injected": False,
        "memory_written": False,
        "persona_written": False,
    }
    append_jsonl(home / DIAGNOSTIC, record)
    return record


def mark_compression(home: Path, at_ms: int) -> dict[str, Any]:
    record = {
        "schema_version": SCHEMA_VERSION,
        "kind": "compression_marker",
        "at": at_ms,
        "at_iso": iso_time(at_ms),
        "mode": "shadow_only",
    }
    append_jsonl(home / DIAGNOSTIC, record)
    return record


def review(home: Path) -> None:
    catalog = load_catalog(home)
    for card in catalog["cards"]:
        print(json.dumps({
            "id": card["id"],
            "title": card["title"],
            "kind": card["kind"],
            "proposed_source": card.get("source"),
            "status": card.get("status"),
            "checkpoint": card.get("checkpoint"),
            "checkpoint_confirmed": bool(card.get("checkpoint_confirmed")),
            "evidence_refs": card.get("evidence_refs", []),
        }, ensure_ascii=False))


def recognize(home: Path, card_id: str, decision: str, checkpoint: str | None) -> None:
    catalog = load_catalog(home)
    match = next((card for card in catalog["cards"] if card.get("id") == card_id), None)
    if not match:
        raise SystemExit(f"unknown card: {card_id}")
    match["status"] = "active" if decision == "accept" else "rejected"
    match["recognized_by"] = "yanqiu"
    match["recognized_at"] = iso_time(now_ms())
    if checkpoint is not None:
        match["checkpoint"] = checkpoint.strip()
        match["checkpoint_confirmed"] = True
    elif decision == "accept":
        match["checkpoint_confirmed"] = False
    catalog["revision"] = int(catalog.get("revision", 1)) + 1
    atomic_json(home / CATALOG, catalog)
    append_jsonl(home / EVENTS, {
        "kind": "p0_recognition",
        "at": now_ms(),
        "card_id": card_id,
        "decision": decision,
        "checkpoint_changed": checkpoint is not None,
    })


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--home", type=Path, default=DEFAULT_HOME)
    sub = parser.add_subparsers(dest="command", required=True)
    init = sub.add_parser("init")
    init.add_argument("--template", type=Path, required=True)
    tick = sub.add_parser("shadow")
    tick.add_argument("--at-ms", type=int, default=0)
    tick.add_argument("--trigger", default="manual")
    marker = sub.add_parser("mark-compression")
    marker.add_argument("--at-ms", type=int, default=0)
    sub.add_parser("review")
    recognition = sub.add_parser("recognize")
    recognition.add_argument("card_id")
    recognition.add_argument("decision", choices=("accept", "reject"))
    recognition.add_argument("--checkpoint")
    args = parser.parse_args()

    if args.command == "init":
        print(initialize(args.home, args.template))
    elif args.command == "shadow":
        print(json.dumps(shadow(args.home, args.at_ms or now_ms(), args.trigger), ensure_ascii=False))
    elif args.command == "mark-compression":
        print(json.dumps(mark_compression(args.home, args.at_ms or now_ms()), ensure_ascii=False))
    elif args.command == "review":
        review(args.home)
    elif args.command == "recognize":
        recognize(args.home, args.card_id, args.decision, args.checkpoint)


if __name__ == "__main__":
    main()
