#!/usr/bin/env node
import http from "node:http";
import crypto from "node:crypto";

const port = Number(process.env.PORT || 8099);
const token = process.env.WATCH_TOKEN || "local-watch-test-token";
const turns = new Map();

function json(res, status, body) {
  const data = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": data.length,
    "cache-control": "no-store",
  });
  res.end(data);
}

function authorized(req) {
  return req.headers.authorization === `Bearer ${token}`;
}

const server = http.createServer((req, res) => {
  if (!authorized(req)) return json(res, 403, { ok: false, error: "forbidden" });

  if (req.method === "POST" && req.url === "/watch/voice") {
    const requestID = String(req.headers["idempotency-key"] || "");
    if (!requestID) return json(res, 400, { ok: false, error: "missing request id" });
    let size = 0;
    req.on("data", chunk => {
      size += chunk.length;
      if (size > 1_000_000) req.destroy();
    });
    req.on("end", () => {
      const existing = turns.get(requestID);
      if (existing) return json(res, 200, existing.upload);
      const turnID = crypto.randomUUID();
      const upload = {
        ok: true,
        queued: true,
        turn_id: turnID,
        transcript: "本地测试语音",
      };
      turns.set(requestID, { turnID, upload, polls: 0 });
      json(res, 202, upload);
    });
    return;
  }

  const match = req.method === "GET" && req.url?.match(/^\/watch\/turn\/([^/?]+)$/);
  if (match) {
    const row = [...turns.values()].find(item => item.turnID === match[1]);
    if (!row) return json(res, 404, { ok: false, error: "turn not found" });
    row.polls += 1;
    if (row.polls < 2) {
      return json(res, 200, {
        ok: true,
        status: "replying",
        transcript: "本地测试语音",
      });
    }
    return json(res, 200, {
      ok: true,
      status: "ready",
      transcript: "本地测试语音",
      reply_text: "听见啦宝宝。这里是假后端回声，还没有叫醒言秋。",
      audio_url: null,
    });
  }

  json(res, 404, { ok: false, error: "not found" });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Cove Watch mock listening on http://127.0.0.1:${port}`);
});

