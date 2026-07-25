#!/usr/bin/env python3
"""Create the ignored CoreS3 config without exposing secrets in shell history."""

from __future__ import annotations

import getpass
import hashlib
import json
from pathlib import Path
from urllib.request import urlopen


PROJECT = Path(__file__).resolve().parents[1]
OUTPUT = PROJECT / "include" / "config.local.h"
RELAY_ENV = Path(
    "/Users/lisa/Desktop/lisa-practice/yanqiu-den/stackchan-relay/.env"
)
ROOT_CA_URL = "https://letsencrypt.org/certs/isrgrootx1.pem"
ROOT_CA_SHA256 = "22b557a27055b33606b6559f37703928d3e4ad79f110b407d04986e1843543d1"


def read_env(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip("\"'")
    return values


def ask_network(label: str, optional: bool = False) -> tuple[str, str] | None:
    suffix = "（没有就直接回车）" if optional else ""
    ssid = input(f"{label} Wi-Fi 名称{suffix}: ").strip()
    if not ssid:
        if optional:
            return None
        raise SystemExit("主 Wi-Fi 名称不能为空。")
    password = getpass.getpass(f"{label} Wi-Fi 密码（输入时不显示）: ")
    if not password:
        raise SystemExit(f"{label} Wi-Fi 密码不能为空。")
    return ssid, password


def cpp_string(value: str) -> str:
    return json.dumps(value, ensure_ascii=False)


def main() -> None:
    env = read_env(RELAY_ENV)
    token = env.get("DEVICE_TOKEN", "")
    device_id = env.get("DEVICE_ID", "stackchan-core-s3-01")
    if not token:
        raise SystemExit(f"{RELAY_ENV} 里没有 DEVICE_TOKEN，停止。")

    print("密码只写进被 Git 忽略的 config.local.h，不会显示或上传。")
    networks = [ask_network("家里")]
    hotspot = ask_network("手机热点", optional=True)
    if hotspot:
        networks.append(hotspot)

    with urlopen(ROOT_CA_URL, timeout=15) as response:
        root_ca = response.read()
    if hashlib.sha256(root_ca).hexdigest() != ROOT_CA_SHA256:
        raise SystemExit("根证书校验失败，停止写配置。")
    pem = root_ca.decode("ascii").strip()

    network_rows = "\n".join(
        f"  {{{cpp_string(ssid)}, {cpp_string(password)}}},"
        for ssid, password in networks
        if ssid is not None
    )
    text = f"""#pragma once

struct WifiCredential {{
  const char* ssid;
  const char* password;
}};

static const WifiCredential WIFI_NETWORKS[] = {{
{network_rows}
}};

static constexpr char DEVICE_ID[] = {cpp_string(device_id)};
static constexpr char RELAY_BASE_URL[] =
  "https://lisamacbook-air.tail542792.ts.net/stackchan";
static constexpr char DEVICE_BEARER_TOKEN[] = {cpp_string(token)};
static constexpr char RELAY_ROOT_CA[] = R"PEM(
{pem}
)PEM";

static constexpr unsigned long POLL_INTERVAL_MS = 1500;
static constexpr unsigned long WIFI_RETRY_MS = 10000;
static constexpr size_t MAX_AUDIO_BYTES = 1536 * 1024;

// First flash is intentionally motionless. Enable only after smoke tests and
// after recording the factory servo calibration.
static constexpr bool SERVOS_ENABLED = false;
static constexpr int SERVO_YAW_MIN = 45;
static constexpr int SERVO_YAW_MAX = 135;
static constexpr int SERVO_PITCH_MIN = 60;
static constexpr int SERVO_PITCH_MAX = 120;
"""
    OUTPUT.write_text(text, encoding="utf-8")
    OUTPUT.chmod(0o600)
    print(f"✓ 已安全写入 {OUTPUT}")
    print("✓ 舵机保持关闭；下一步可以编译并刷第一版。")


if __name__ == "__main__":
    main()
