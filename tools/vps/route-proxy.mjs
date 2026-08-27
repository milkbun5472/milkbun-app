// 手机地图的逐步导航瘦身代理。
// OSRM 的 steps=true 会在每一步附带完整 geometry；跨城响应可达数十万字符，
// iPhone WKWebView 解析时会被系统杀掉。这里只保留 UI 真正使用的字段。
import http from "node:http";

const HOST = process.env.HOST || "127.0.0.1";
const PORT = Number(process.env.PORT || 8796);
const OSRM_BASE = (process.env.OSRM_BASE || "https://router.project-osrm.org").replace(/\/$/, "");
const ALLOWED_ORIGINS = new Set([
  "https://milkbun5472.github.io",
  "http://127.0.0.1:8099",
  "http://localhost:8099"
]);

function cors(req, res) {
  const origin = String(req.headers.origin || "");
  if (ALLOWED_ORIGINS.has(origin)) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
}

function json(req, res, status, body) {
  cors(req, res);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

function validPoint(value) {
  return Array.isArray(value) && value.length === 2 && value.every(Number.isFinite)
    && value[0] >= -90 && value[0] <= 90 && value[1] >= -180 && value[1] <= 180;
}

async function readJson(req, max = 4096) {
  const chunks = []; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > max) throw new Error("body_too_large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

export function slimRoute(payload) {
  const route = payload && payload.routes && payload.routes[0];
  const coords = route && route.geometry && route.geometry.coordinates;
  if (!route || !Array.isArray(coords) || !coords.length) throw new Error("route_empty");
  const steps = [];
  for (const leg of route.legs || []) for (const step of leg.steps || []) {
    const maneuver = step.maneuver || {};
    const loc = maneuver.location;
    steps.push({
      name: String(step.name || "").slice(0, 160),
      distance: Number(step.distance || 0),
      duration: Number(step.duration || 0),
      maneuver: {
        type: String(maneuver.type || "").slice(0, 40),
        modifier: String(maneuver.modifier || "").slice(0, 40),
        exit: Number.isFinite(maneuver.exit) ? maneuver.exit : null,
        location: Array.isArray(loc) && loc.length === 2 ? [Number(loc[0]), Number(loc[1])] : null
      }
    });
  }
  return {
    ok: true,
    distance: Number(route.distance || 0),
    duration: Number(route.duration || 0),
    geometry: coords.map(c => [Number(c[0]), Number(c[1])]),
    steps
  };
}

export function createRouteServer() {
  return http.createServer(async (req, res) => {
    if (req.method === "OPTIONS") { cors(req, res); res.writeHead(204); return res.end(); }
    if (req.method === "GET" && req.url === "/health") return json(req, res, 200, { ok: true, service: "route-proxy" });
    if (req.method !== "POST" || req.url !== "/v1") return json(req, res, 404, { ok: false, error: "not_found" });
    try {
      const body = await readJson(req);
      if (!validPoint(body.from) || !validPoint(body.to)) return json(req, res, 400, { ok: false, error: "invalid_points" });
      const from = `${body.from[1]},${body.from[0]}`, to = `${body.to[1]},${body.to[0]}`;
      const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), 15000);
      let upstream;
      try {
        upstream = await fetch(`${OSRM_BASE}/route/v1/driving/${from};${to}?overview=simplified&geometries=geojson&steps=true`, { signal: ctl.signal });
      } finally { clearTimeout(timer); }
      if (!upstream.ok) throw new Error(`osrm_${upstream.status}`);
      const slim = slimRoute(await upstream.json());
      // 防止异常上游把手机重新喂爆。正常跨城瘦身结果通常只有几 KB。
      if (slim.geometry.length > 2000 || slim.steps.length > 1000) throw new Error("route_too_complex");
      return json(req, res, 200, slim);
    } catch (error) {
      const message = error && error.name === "AbortError" ? "timeout" : String(error && error.message || error);
      return json(req, res, 502, { ok: false, error: message.slice(0, 120) });
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  createRouteServer().listen(PORT, HOST, () => console.log(`route-proxy listening on ${HOST}:${PORT}`));
}
