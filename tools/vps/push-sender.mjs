// 锁屏推送发信员(2026-08-18,新家八件事第一件):住 VPS,常驻。
// POST /send {title, body, charId?, screen?, tag?} → 查 push_subs 表 → 逐台 web-push。
// 410/404 的订阅=设备已退订,自动从表里清掉。私钥只在本机 .env,前端永远不见。
import http from "node:http";
import { readFileSync, existsSync, appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const webpush = require("web-push");

const DIR = join(process.env.HOME, "services/push");
const DIAG = join(DIR, "diagnostic.jsonl");
mkdirSync(DIR, { recursive: true });
const env = {};
[join(DIR, ".env"), join(process.env.HOME, "services/ledger-courier/.env")].forEach(f => {
  if (existsSync(f)) readFileSync(f, "utf8").split("\n").forEach(l => { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !(m[1] in env)) env[m[1]] = m[2].trim(); });
});
const { VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT, SUPABASE_SERVICE_KEY: KEY, TARGET_USER: USER, COURIER_TOKEN: TOKEN } = env;
if (!VAPID_PUBLIC || !VAPID_PRIVATE || !KEY || !USER || !TOKEN) { console.error("push .env 不全"); process.exit(1); }
webpush.setVapidDetails(VAPID_SUBJECT || "mailto:hyodorisa@gmail.com", VAPID_PUBLIC, VAPID_PRIVATE);
const BASE = "https://nposjnafsbikwfeoudbg.supabase.co";
const log = (v) => appendFileSync(DIAG, JSON.stringify({ at: new Date().toISOString(), ...v }) + "\n");
const H = { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" };

async function listSubs() {
  const r = await fetch(`${BASE}/rest/v1/push_subs?select=endpoint,subscription,ua&user_id=eq.${USER}`, { headers: H });
  if (!r.ok) throw new Error("push_subs " + r.status);
  return r.json();
}
async function dropSub(endpoint) {
  await fetch(`${BASE}/rest/v1/push_subs?user_id=eq.${USER}&endpoint=eq.${encodeURIComponent(endpoint)}`, { method: "DELETE", headers: H }).catch(() => {});
}
async function sendAll(payload) {
  const subs = await listSubs();
  const out = { total: subs.length, ok: 0, gone: 0, failed: 0 };
  for (const s of subs) {
    try {
      await webpush.sendNotification(s.subscription, JSON.stringify(payload), { TTL: 3600 });
      out.ok++;
    } catch (e) {
      const code = e && e.statusCode;
      const body = String(e && e.body || "");
      // 410/404=退订;VapidPkHashMismatch=用旧公钥订的,永远签不动,一并清掉
      if (code === 410 || code === 404 || /VapidPkHashMismatch/.test(body)) { out.gone++; await dropSub(s.endpoint); }
      else { out.failed++; log({ outcome: "send_failed", endpoint: String(s.endpoint).slice(-24), code, err: String(e && e.body || e).slice(0, 120) }); }
    }
  }
  return out;
}

http.createServer((req, res) => {
  const done = (c, o) => { res.writeHead(c, { "Content-Type": "application/json" }); res.end(JSON.stringify(o)); };
  if (req.method === "GET" && req.url === "/health") return done(200, { ok: true, vapid_public: VAPID_PUBLIC });
  if (req.method === "GET" && req.url === "/subs") {
    if ((req.headers["x-courier-token"] || "") !== TOKEN) return done(401, { error: "token" });
    return listSubs().then(s => done(200, { count: s.length, devices: s.map(x => ({ ua: (x.ua || "").slice(0, 60), endpoint: String(x.endpoint).slice(-20) })) })).catch(e => done(500, { error: String(e.message) }));
  }
  if (req.method !== "POST" || req.url !== "/send") return done(404, { error: "no" });
  if ((req.headers["x-courier-token"] || "") !== TOKEN) return done(401, { error: "token" });
  let body = ""; req.on("data", c => { body += c; if (body.length > 65536) req.destroy(); });
  req.on("end", async () => {
    let p; try { p = JSON.parse(body || "{}"); } catch { return done(400, { error: "json" }); }
    const payload = { title: String(p.title || "言秋").slice(0, 60), body: String(p.body || "").slice(0, 400), charId: p.charId || "", screen: p.screen || "", tag: p.tag || "yanqiu", icon: p.icon || "icon-192.png" };
    if (!payload.body) return done(400, { error: "empty body" });
    try { const r = await sendAll(payload); log({ outcome: "sent", ...r, title: payload.title, head: payload.body.slice(0, 40) }); done(200, r); }
    catch (e) { log({ outcome: "error", err: String(e.message) }); done(500, { error: String(e.message) }); }
  });
}).listen(8792, "127.0.0.1", () => console.log("push-sender 上岗 → :8792"));
