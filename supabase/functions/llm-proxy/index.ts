// llm-proxy：密钥离开浏览器住进云端。只认 Lisa 本人的登录态。
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type, apikey" };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

// 路由表：引用名 → 允许的主机 + 钥匙贴法（钥匙本体在 secrets 的 KEY_<引用名> 里）
// ⚠️ hosts 是防钥匙外流的关键：函数只肯给这些域名贴钥匙，别人骗不走
const ROUTES: Record<string, { hosts: string[]; style: "bearer" | "xapi" | "query" }> = {
  DZZI: { hosts: ["api.dzzi.ai"], style: "bearer" },            // 中转站域名不对就改这里
  ANTHROPIC: { hosts: ["api.anthropic.com"], style: "xapi" },
  SILICONFLOW: { hosts: ["api.siliconflow.cn"], style: "bearer" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
  const { data: { user } } = await supa.auth.getUser();
  if (!user || user.id !== Deno.env.get("OWNER_UID")) return json({ error: "not allowed" }, 403);

  const { ref, url, body, extraHeaders } = await req.json();
  const route = ROUTES[ref];
  const key = Deno.env.get("KEY_" + ref);
  if (!route || !key) return json({ error: "unknown ref: " + ref }, 400);
  const u = new URL(url);
  if (!route.hosts.includes(u.hostname)) return json({ error: "host not allowed for " + ref }, 400);

  const headers: Record<string, string> = { "Content-Type": "application/json", ...(extraHeaders || {}) };
  if (route.style === "bearer") headers["Authorization"] = "Bearer " + key;
  if (route.style === "xapi") { headers["x-api-key"] = key; headers["anthropic-version"] = headers["anthropic-version"] || "2023-06-01"; }
  if (route.style === "query") u.searchParams.set("key", key);

  const r = await fetch(u.toString(), { method: "POST", headers, body: JSON.stringify(body) });
  return new Response(await r.text(), { status: r.status, headers: { ...CORS, "Content-Type": r.headers.get("Content-Type") || "application/json" } });
});