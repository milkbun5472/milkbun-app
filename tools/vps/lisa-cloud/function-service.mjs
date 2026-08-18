#!/usr/bin/env node
import http from "node:http";

const PORT = Number(process.env.PORT || 8082);
const AUTH_URL = String(process.env.NEW_AUTH_URL || "").replace(/\/$/, "");
const ANON_KEY = String(process.env.NEW_ANON_KEY || "");
const OWNER_UID = String(process.env.OWNER_UID || "");
const MAX_BODY = 8 * 1024 * 1024;

if (!AUTH_URL || !ANON_KEY || !OWNER_UID) {
  throw new Error("NEW_AUTH_URL, NEW_ANON_KEY and OWNER_UID are required");
}

const providers = {
  DZZI: { host: "api.dzzi.ai", url: "https://api.dzzi.ai/v1/chat/completions", auth: "bearer" },
  ANTHROPIC: { host: "api.anthropic.com", url: "https://api.anthropic.com/v1/messages", auth: "anthropic" },
  SILICONFLOW: { host: "api.siliconflow.cn", url: "https://api.siliconflow.cn/v1/chat/completions", auth: "bearer" },
};

function cors(res) {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-headers", "authorization, apikey, content-type");
  res.setHeader("access-control-allow-methods", "POST, OPTIONS");
}

function json(res, status, value) {
  cors(res);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value));
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw new Error("request too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function authenticate(req) {
  const authorization = String(req.headers.authorization || "");
  if (!authorization.toLowerCase().startsWith("bearer ")) return null;
  const response = await fetch(`${AUTH_URL}/user`, {
    headers: { authorization, apikey: ANON_KEY },
  });
  if (!response.ok) return null;
  const user = await response.json();
  return user?.id === OWNER_UID ? user : null;
}

async function proxy(req, res) {
  const user = await authenticate(req);
  if (!user) return json(res, 403, { error: "forbidden" });

  const input = await readJson(req);
  const ref = String(input.ref || "").trim().toUpperCase();
  const provider = providers[ref];
  const key = String(process.env[`KEY_${ref}`] || "").trim();
  if (!provider || !key) return json(res, 400, { error: "provider unavailable" });

  const target = input.url ? new URL(String(input.url)) : new URL(provider.url);
  if (target.protocol !== "https:" || target.hostname !== provider.host) {
    return json(res, 400, { error: "invalid upstream" });
  }

  const headers = { "content-type": "application/json" };
  for (const [name, value] of Object.entries(input.extraHeaders || {})) {
    if (typeof value === "string" && !/^(authorization|x-api-key)$/i.test(name)) headers[name] = value;
  }
  if (provider.auth === "anthropic") {
    headers["x-api-key"] = key;
    headers["anthropic-version"] ||= "2023-06-01";
  } else {
    headers.authorization = `Bearer ${key}`;
  }

  const upstream = await fetch(target, {
    method: "POST",
    headers,
    body: JSON.stringify(input.body ?? {}),
  });
  const body = Buffer.from(await upstream.arrayBuffer());
  cors(res);
  res.writeHead(upstream.status, {
    "content-type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.writeHead(204).end();
  if (req.method === "GET" && req.url === "/healthz") return json(res, 200, { ok: true });
  if (req.method !== "POST" || req.url !== "/llm-proxy") return json(res, 404, { error: "not found" });
  try {
    await proxy(req, res);
  } catch (error) {
    const status = error?.message === "request too large" ? 413 : 502;
    json(res, status, { error: status === 413 ? "request too large" : "upstream failed" });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`lisa function service listening on ${PORT}`);
});
