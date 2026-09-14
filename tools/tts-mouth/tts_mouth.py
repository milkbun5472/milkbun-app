#!/usr/bin/env python3
# 电台的嗓子：一张跑在书房 Mac 上的嘴。
#
# 为什么要它（她 2026-09-13 实测出来的）：
#   iOS 把「高音质／增强」中文音色留给系统朗读和 Siri，**不交给网页**。
#   所以 app 那头只能拿到 Tingting / Meijia 两把基础音色，念出来一股机器味。
#   这一份用微软在线语音（edge-tts）：免费、不要密钥、气口是正常人。
#
# 跟 voice-live 那对耳朵是对称件：一个听、一个说，同一台机器、同一把门锁。
#
# 装：  pip3 install edge-tts
# 跑：  VOICE_TOKEN=你自己的门锁 python3 tts_mouth.py
# 对外： Tailscale Funnel / frp / cloudflared 随便哪个，把 8848 露出去，
#        然后在 app 的 设置 → API → 电台嗓子 里填地址和门锁。
#
# ⚠️门锁只是挡住路过的人，不是安全边界：别把它当密码用，也别在公网上裸跑。
import asyncio, json, os, sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

TOKEN = os.environ.get("VOICE_TOKEN", "").strip()
PORT = int(os.environ.get("VOICE_PORT", "8848"))
# 默认这把：云希，男声，念旁白和故事都稳。女声可用 zh-CN-XiaoxiaoNeural。
DEFAULT_VOICE = os.environ.get("VOICE_NAME", "zh-CN-YunxiNeural")
MAX_CHARS = 1200


async def synth(text, voice, rate):
    import edge_tts
    kw = {}
    if rate:
        kw["rate"] = rate            # 例如 "-10%"、"+5%"
    out = bytearray()
    async for chunk in edge_tts.Communicate(text, voice or DEFAULT_VOICE, **kw).stream():
        if chunk.get("type") == "audio":
            out.extend(chunk["data"])
    return bytes(out)


class Mouth(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _cors(self):
        # app 是网页，跨域必开；只开这两个方法，别顺手开全套
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")

    def _send(self, code, body, ctype="application/json"):
        data = body if isinstance(body, bytes) else json.dumps(body, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self._cors()
        self.end_headers()
        self.wfile.write(data)

    def _ok_token(self):
        from urllib.parse import urlparse, parse_qs
        q = parse_qs(urlparse(self.path).query)
        return bool(TOKEN) and q.get("k", [""])[0] == TOKEN

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        if self.path.split("?")[0] != "/health":
            return self._send(404, {"ok": False, "error": "没有这条路"})
        if not self._ok_token():
            return self._send(403, {"ok": False, "error": "门锁不对"})
        self._send(200, {"ok": True, "voice": DEFAULT_VOICE})

    def do_POST(self):
        if self.path.split("?")[0] != "/say":
            return self._send(404, {"ok": False, "error": "没有这条路"})
        if not self._ok_token():
            return self._send(403, {"ok": False, "error": "门锁不对"})
        try:
            n = int(self.headers.get("Content-Length") or 0)
            body = json.loads(self.rfile.read(n) or b"{}")
        except Exception as e:
            return self._send(400, {"ok": False, "error": "读不懂这段请求：%s" % e})
        text = str(body.get("text") or "").strip()[:MAX_CHARS]
        if not text:
            return self._send(400, {"ok": False, "error": "没有要念的字"})
        try:
            audio = asyncio.run(synth(text, str(body.get("voice") or "").strip(), str(body.get("rate") or "").strip()))
        except Exception as e:
            # 念不出来就如实说；app 那头会自己退回系统音色，不会哑掉
            return self._send(502, {"ok": False, "error": "合成失败：%s" % e})
        if not audio:
            return self._send(502, {"ok": False, "error": "合成出来是空的"})
        self._send(200, audio, "audio/mpeg")

    def log_message(self, *a):
        pass          # 别把每一句念过的话都打进日志——那是她和他的话


if __name__ == "__main__":
    if not TOKEN:
        print("先设一个门锁：VOICE_TOKEN=xxx python3 tts_mouth.py", file=sys.stderr)
        sys.exit(1)
    print("嗓子在 :%d 上，默认音色 %s" % (PORT, DEFAULT_VOICE))
    ThreadingHTTPServer(("0.0.0.0", PORT), Mouth).serve_forever()
