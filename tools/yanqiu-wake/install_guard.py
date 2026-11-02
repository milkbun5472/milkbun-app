#!/usr/bin/env python3
"""Install the local guardian with backups; queue/clock data are never copied."""

import argparse
import hashlib
import json
import os
import plistlib
import shutil
import subprocess
import time
import tempfile
from pathlib import Path


SOURCE = Path(__file__).resolve().parent
LISA_ROOT = Path.home() / "Library/Application Support/LisaPhone"
RUNTIME = LISA_ROOT / "yanqiu-wake"
FILES = ("wake_queue.py", "remote_control_guard.py", "sentinel_guard.py", "rearm.applescript", "native_runner.applescript", "ax_page.swift")
APP_NAME = "言秋复活守护.app"
ENTRYPOINTS = (
    LISA_ROOT / "stackchan-relay/wake_queue.py",
    Path.home() / "yanqiu-den/stackchan-relay/wake_queue.py",
)


def atomic_write(path: Path, data: bytes, mode=0o700) -> None:
    temp = path.with_name(path.name + ".install-tmp")
    temp.write_bytes(data)
    temp.chmod(mode)
    os.replace(temp, path)


def build_native(directory: Path) -> Path:
    source = directory / "native.applescript"
    source.write_bytes((SOURCE / "native_runner.applescript").read_bytes() + b'\n' + (SOURCE / "rearm.applescript").read_bytes())
    app = directory / APP_NAME
    subprocess.run(["/usr/bin/osacompile", "-o", str(app), str(source)], check=True, capture_output=True, timeout=20)
    info_file = app / "Contents/Info.plist"
    info = plistlib.loads(info_file.read_bytes())
    info.update({
        "CFBundleIdentifier": "com.lisa.yanqiu-sentinel-guardian.native",
        "CFBundleName": "言秋复活守护", "LSUIElement": True,
        "NSAppleEventsUsageDescription": "仅在言秋固定原窗口发送一次署名复活通知，并恢复该原窗已授权的手机远控连接。",
    })
    info_file.write_bytes(plistlib.dumps(info))
    bridge = app / "Contents/MacOS/ax-page"
    subprocess.run(["/usr/bin/xcrun", "swiftc", "-module-cache-path", str(directory / "swift-cache"),
                    str(SOURCE / "ax_page.swift"), "-o", str(bridge)], check=True, capture_output=True, timeout=60)
    subprocess.run(["/usr/bin/codesign", "--force", "--sign", "-", str(bridge)], check=True, capture_output=True, timeout=20)
    subprocess.run(["/usr/bin/codesign", "--force", "--sign", "-", str(app)], check=True, capture_output=True, timeout=20)
    return app


def install(dry_run=False) -> dict:
    payloads = {name: (SOURCE / name).read_bytes() for name in FILES}
    # Python resolves the entrypoint symlink before setting its import path.
    # Both legacy callers and the deployment byte check see the canonical file.
    writes = {RUNTIME / name: data for name, data in payloads.items()}
    links = {path: RUNTIME / "wake_queue.py" for path in ENTRYPOINTS if path.parent.is_dir()}
    if not (RUNTIME / APP_NAME).exists():
        # Fresh installations monitor/alarm immediately, but native delivery
        # stays disabled until the human grants access and a probe succeeds.
        writes[RUNTIME / ".sentinel_native_disabled"] = b"awaiting manual permission\n"
    report = {"files": len(writes) + len(links), "native_app": APP_NAME, "sha256": {
        path.name: hashlib.sha256(data).hexdigest() for path, data in writes.items() if path.parent == RUNTIME
    }}
    if dry_run:
        return {**report, "installed": False}
    with tempfile.TemporaryDirectory(prefix="yanqiu-native-build-") as directory:
        native = build_native(Path(directory))
        return install_payloads(writes, links, native, report)


def install_payloads(writes: dict, links: dict, native: Path, report: dict) -> dict:
    RUNTIME.mkdir(parents=True, exist_ok=True, mode=0o700)
    backup = LISA_ROOT / "backups" / ("sentinel-guard-" + time.strftime("%Y%m%d-%H%M%S"))
    backup.mkdir(parents=True, mode=0o700)
    originals = {}
    for index, path in enumerate([*writes, *links]):
        if path.is_symlink():
            originals[str(path)] = {"symlink": os.readlink(path)}
        elif path.exists():
            saved = backup / str(index)
            shutil.copy2(path, saved)
            saved.chmod(0o600)
            originals[str(path)] = str(saved)
        else:
            originals[str(path)] = None
    native_app = RUNTIME / APP_NAME
    if native_app.exists():
        saved = backup / "native-app"
        shutil.copytree(native_app, saved)
        originals[str(native_app)] = str(saved)
    else:
        originals[str(native_app)] = None
    atomic_write(backup / "manifest.json", (json.dumps(originals, indent=2) + '\n').encode(), 0o600)
    try:
        for path, data in writes.items():
            atomic_write(path, data)
        for path, target in links.items():
            temp = path.with_name(path.name + ".install-tmp")
            temp.unlink(missing_ok=True)
            temp.symlink_to(target)
            os.replace(temp, path)
        if native_app.exists():
            shutil.rmtree(native_app)
        shutil.copytree(native, native_app)
        subprocess.run(
            ["launchctl", "kickstart", "-k", f"gui/{os.getuid()}/com.lisa.yanqiu-heartbeat"],
            check=True, capture_output=True, timeout=10,
        )
    except Exception:
        for path, saved in originals.items():
            if Path(path).is_dir():
                shutil.rmtree(path)
            if isinstance(saved, dict):
                Path(path).unlink(missing_ok=True)
                Path(path).symlink_to(saved["symlink"])
            elif saved and Path(saved).is_dir():
                shutil.copytree(saved, path)
            elif saved:
                atomic_write(Path(path), Path(saved).read_bytes())
            else:
                Path(path).unlink(missing_ok=True)
        raise
    return {**report, "installed": True, "backup": str(backup)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    print(json.dumps(install(args.dry_run), sort_keys=True))
