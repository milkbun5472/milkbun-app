// llm-proxy.mjs — 直连版密钥保险柜（不走自建 Supabase 的 Edge Function / Kong）
//
// 为什么另起一份（Lisa 2026-08-24）：
// 原来这条路是 手机 → Kong(:8443) → Edge Function → 中转。Kong 的 proxy_read_timeout
// 默认就是 60 秒，而 Edge Function 里还写着 `new Response(await r.text())`——
// 上游响应要整个读完才往回发。两样叠在一起：gemini-3.1-pro 服务端跑了 68 秒、
// 钱照扣，手机 60 秒判死什么都没拿到。
// 这一版把中间两层都拿掉：Node 直接把上游的字节流原样对接给手机，一段到就一段发，
// 连接一直有数据，读超时永远不触发。改配置只要 systemctl restart，不用重贴函数。
//
// 门禁两道：① 只监听 tailnet（VPS 是 *.ts.net，外网根本连不到）
//          ② x-proxy-secret 必须对上（防同一 tailnet 里的别的设备乱敲）
// 密钥本体只住 systemd 的 Environment，仓库里一个字都没有。
import http from "node:http";

const PORT = Number(process.env.LLM_PROXY_PORT || 8791);
const BIND = process.env.LLM_PROXY_BIND || "0.0.0.0";   // tailnet 内网卡；外网进不来
const SECRET = process.env.LLM_PROXY_SECRET || "";
const ORIGIN = process.env.LLM_PROXY_ORIGIN || "*";      // 允许的网页来源；建议填 GitHub Pages 那个域名

// 路由表：引用名 → 允许的主机 + 钥匙贴法。和 Edge Function 那份保持一致的语义，
// 免得两边行为分叉。hosts 是防钥匙外流的关键：只肯给这些域名贴钥匙。
const ROUTES = {
  DZZI: { hosts: ["api.dzzi.ai"], style: "bearer" },
  ANTHROPIC: { hosts: ["api.anthropic.com"], style: "xapi" },
  SILICONFLOW: { hosts: ["api.siliconflow.cn"], style: "bearer" },
};

const CORS = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers": "content-type, x-proxy-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};
const send = (res, code, obj) =>
  res.writeHead(code, { ...CORS, "Content-Type": "application/json" }).end(JSON.stringify(obj));

const readBody = req => new Promise((resolve, reject) => {
  let n = 0; const parts = [];
  req.on("data", c => {
    n += c.length;
    if (n > 24 * 1024 * 1024) { reject(new Error("请求体过大")); req.destroy(); return; }
    parts.push(c);
  });
  req.on("end", () => resolve(Buffer.concat(parts).toString("utf8")));
  req.on("error", reject);
});

http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return res.writeHead(204, CORS).end();
  if (req.url === "/health") return send(res, 200, { ok: true, routes: Object.keys(ROUTES) });
  if (req.method !== "POST") return send(res, 405, { error: "只收 POST" });
  if (SECRET && req.headers["x-proxy-secret"] !== SECRET) return send(res, 403, { error: "not allowed" });

  let payload;
  try { payload = JSON.parse(await readBody(req)); }
  catch (e) { return send(res, 400, { error: "请求体不是合法 JSON：" + e.message }); }

  const { ref, url, body, extraHeaders } = payload || {};
  const route = ROUTES[ref];
  const key = process.env["KEY_" + ref];
  if (!route) return send(res, 400, { error: "unknown ref: " + ref });
  if (!key) return send(res, 400, { error: "这台机器上没配 KEY_" + ref });

  let u;
  try { u = new URL(url); } catch (e) { return send(res, 400, { error: "url 不合法" }); }
  if (!route.hosts.includes(u.hostname)) return send(res, 400, { error: "host not allowed for " + ref });

  const headers = { "Content-Type": "application/json", ...(extraHeaders || {}) };
  if (route.style === "bearer") headers["Authorization"] = "Bearer " + key;
  if (route.style === "xapi") {
    headers["x-api-key"] = key;
    headers["anthropic-version"] = headers["anthropic-version"] || "2023-06-01";
  }
  if (route.style === "query") u.searchParams.set("key", key);

  let up;
  try {
    up = await fetch(u.toString(), { method: "POST", headers, body: JSON.stringify(body) });
  } catch (e) {
    return send(res, 502, { error: "上游连不上：" + (e && e.message || e) });
  }

  // ⭐一段到就一段发。绝不 await up.text()——那正是原来那版把 68 秒憋成 0 字节的做法。
  // X-Accel-Buffering: no 是给可能存在的反代看的，别让它替我们又攒一遍。
  res.writeHead(up.status, {
    ...CORS,
    "Content-Type": up.headers.get("content-type") || "application/json",
    "Cache-Control": "no-cache, no-transform",
    "X-Accel-Buffering": "no",
  });
  if (!up.body) return res.end();
  try {
    for await (const chunk of up.body) {
      res.write(chunk);
      // Node 的 http 默认会攒小包；每块显式 flush，SSE 才是真的一段一段到
      if (typeof res.flush === "function") res.flush();
    }
  } catch (e) {
    // 中途断了就断了：已经发出去的字节是有效的，别再往里塞 JSON 错误体污染流
  }
  res.end();
}).listen(PORT, BIND, () => {
  console.log("[llm-proxy] " + BIND + ":" + PORT + " routes=" + Object.keys(ROUTES).join(",")
    + (SECRET ? " secret=on" : " ⚠️secret=off"));
});
