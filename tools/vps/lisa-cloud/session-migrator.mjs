#!/usr/bin/env node
import http from "node:http";

const required = ["OLD_SUPABASE_URL", "OLD_SUPABASE_ANON_KEY", "NEW_AUTH_URL", "NEW_ANON_KEY", "NEW_SERVICE_ROLE_KEY"];
for (const key of required) if (!process.env[key]) throw new Error(`missing ${key}`);
const port = Number(process.env.PORT || 8081);
const attempts = new Map();
const headers = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, authorization, apikey",
  "content-type": "application/json",
  "cache-control": "no-store"
};
const send = (res, status, body) => {
  res.writeHead(status, headers);
  res.end(JSON.stringify(body));
};
const readJson = async (req) => {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 16 * 1024) throw new Error("body_too_large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
};
const serviceHeaders = {
  apikey: process.env.NEW_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${process.env.NEW_SERVICE_ROLE_KEY}`,
  "content-type": "application/json"
};

http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204, {});
  if (req.method !== "POST" || req.url !== "/session") return send(res, 404, { error: "not_found" });
  const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").split(",")[0];
  const now = Date.now();
  const recent = (attempts.get(ip) || []).filter((ts) => now - ts < 60_000);
  if (recent.length >= 10) return send(res, 429, { error: "rate_limited" });
  recent.push(now);
  attempts.set(ip, recent);
  try {
    const body = await readJson(req);
    const oldToken = String(body.access_token || "");
    if (!oldToken) return send(res, 400, { error: "missing_access_token" });

    const oldUserResponse = await fetch(`${process.env.OLD_SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: process.env.OLD_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${oldToken}`
      }
    });
    if (!oldUserResponse.ok) return send(res, 401, { error: "legacy_session_invalid" });
    const oldUser = await oldUserResponse.json();
    if (!oldUser?.id || !oldUser?.email) return send(res, 403, { error: "legacy_user_incomplete" });

    const localUser = await fetch(`${process.env.NEW_AUTH_URL}/admin/users/${encodeURIComponent(oldUser.id)}`, {
      headers: serviceHeaders
    });
    if (!localUser.ok) return send(res, 409, { error: "user_not_preimported" });

    const linkResponse = await fetch(`${process.env.NEW_AUTH_URL}/admin/generate_link`, {
      method: "POST",
      headers: serviceHeaders,
      body: JSON.stringify({ type: "magiclink", email: oldUser.email })
    });
    const link = await linkResponse.json();
    if (!linkResponse.ok || !link.hashed_token) return send(res, 502, { error: "session_ticket_failed" });

    const verifyResponse = await fetch(`${process.env.NEW_AUTH_URL}/verify`, {
      method: "POST",
      headers: { apikey: process.env.NEW_ANON_KEY, "content-type": "application/json" },
      body: JSON.stringify({ type: "magiclink", token_hash: link.hashed_token })
    });
    const session = await verifyResponse.json();
    if (!verifyResponse.ok || !session.access_token || !session.refresh_token) {
      return send(res, 502, { error: "session_exchange_failed" });
    }
    if (session.user?.id !== oldUser.id) return send(res, 500, { error: "identity_mismatch" });
    return send(res, 200, {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_in: session.expires_in,
      token_type: session.token_type,
      user: { id: session.user.id, email: session.user.email }
    });
  } catch (error) {
    return send(res, 400, { error: error?.message === "body_too_large" ? "body_too_large" : "bad_request" });
  }
}).listen(port, "0.0.0.0", () => console.log(JSON.stringify({ ready: true, port })));
