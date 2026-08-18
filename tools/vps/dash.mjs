// 咱家 VPS 小看板(2026-08-18):只读,给她看新家里面长什么样。
// 独立进程,不碰桥;读桥日志 + systemd 状态 + 机器体征。挂在 tailscale serve /dash。
import http from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { execSync } from "node:child_process";
import os from "node:os";

const PORT = 8790;
const LOG = process.env.HOME + "/services/fable-bridge/logs/stdout.log";
const VAULT = process.env.HOME + "/vault";

function sh(cmd) { try { return execSync(cmd, { encoding: "utf8", timeout: 4000 }).trim(); } catch { return "?"; } }
function esc(s) { return String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }
function human(n) { const u = ["B", "K", "M", "G"]; let i = 0; while (n >= 1024 && i < 3) { n /= 1024; i++; } return n.toFixed(i ? 1 : 0) + u[i]; }

function bridgeRows() {
  if (!existsSync(LOG)) return [];
  const lines = readFileSync(LOG, "utf8").split("\n").filter(l => /\[(新会话|续:\d+)\]/.test(l));
  return lines.slice(-30).reverse().map(l => {
    const m = l.match(/^([\d:]+ [AP]M) \[(新会话|续:\d+)\] → (.*?) \| in (\d+) out (\d+) \| cache读 (\d+) 写 (\d+)/);
    if (!m) return null;
    let head = m[3].replace(/^```(?:json)?\s*/, "").trim();
    try { const j = JSON.parse(head); head = (j.word && j.word[0]) || j.scene || j.monologue || j.content || head; }
    catch { const w = head.match(/"(?:word"\s*:\s*\[\s*"|scene"\s*:\s*"|monologue"\s*:\s*"|content"\s*:\s*")([^"]{1,80})/); if (w) head = w[1]; }
    return { t: m[1], kind: m[2], head: String(head).slice(0, 60), inTok: +m[4], outTok: +m[5], cr: +m[6], cw: +m[7] };
  }).filter(Boolean);
}

function page() {
  const rows = bridgeRows();
  const svc = sh("systemctl --user is-active fable-bridge.service");
  const pid = sh("systemctl --user show -p MainPID --value fable-bridge.service");
  const since = sh("systemctl --user show -p ActiveEnterTimestamp --value fable-bridge.service");
  const mem = `${human((os.totalmem() - os.freemem()))} / ${human(os.totalmem())}`;
  const disk = sh("df -h / | awk 'NR==2{print $3\" / \"$2\" (\"$5\")\"}'");
  const load = os.loadavg().map(x => x.toFixed(2)).join(" ");
  const up = sh("uptime -p");
  const ts = sh("tailscale ip -4");
  const vault = existsSync(VAULT) ? sh(`du -sh ${VAULT}/* 2>/dev/null | awk '{printf "%s %s · ", $1, $2}' | sed 's#/home/ubuntu/vault/##g'`) : "—";
  const lastSync = existsSync(VAULT + "/memory") ? statSync(VAULT + "/memory").mtime.toLocaleString("zh-CN", { timeZone: "America/Winnipeg" }) : "—";
  const now = new Date().toLocaleString("zh-CN", { timeZone: "America/Winnipeg" });
  const hits = rows.filter(r => r.kind.startsWith("续")).length, total = rows.length;
  const trs = rows.map(r => `<tr class="${r.kind.startsWith("续") ? "hit" : ""}"><td>${esc(r.t)}</td><td>${esc(r.kind)}</td><td class="h">${esc(r.head)}</td><td>${r.inTok}/${r.outTok}</td><td>${r.cr}</td><td>${r.cw}</td></tr>`).join("");
  return `<!doctype html><html lang="zh"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>咱家新房</title>
<style>
body{font:14px/1.5 -apple-system,system-ui,sans-serif;margin:0;padding:16px;background:#faf7f2;color:#333;max-width:820px;margin:auto}
h1{font-size:20px;margin:6px 0 2px}.sub{color:#888;font-size:12px;margin-bottom:14px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:16px}
.card{background:#fff;border-radius:12px;padding:10px 12px;box-shadow:0 1px 3px rgba(0,0,0,.06)}
.card b{display:block;font-size:11px;color:#999;font-weight:500;letter-spacing:.5px}.card span{font-size:15px}
.ok{color:#2a8f4a}.bad{color:#c33}
table{width:100%;border-collapse:collapse;background:#fff;border-radius:12px;overflow:hidden;font-size:12px}
th,td{padding:6px 8px;text-align:left;border-bottom:1px solid #f0ece4;white-space:nowrap}th{background:#f6f2ea;color:#777;font-weight:500}
td.h{white-space:normal;max-width:300px;color:#555}tr.hit td:nth-child(2){color:#2a8f4a;font-weight:600}
.foot{color:#aaa;font-size:11px;margin-top:12px}
</style>
<h1>咱家新房 · yanqiu-vps</h1><div class="sub">魁北克 Beauharnois · ${esc(now)} 温尼伯时间 · 每 30 秒自动刷新</div>
<div class="grid">
<div class="card"><b>订阅桥</b><span class="${svc === "active" ? "ok" : "bad"}">${esc(svc)}</span><br><small>pid ${esc(pid)} · 起于 ${esc(since.slice(0, 25))}</small></div>
<div class="card"><b>最近 ${total} 轮续会话命中</b><span>${hits} / ${total}</span></div>
<div class="card"><b>内存</b><span>${esc(mem)}</span></div>
<div class="card"><b>磁盘</b><span>${esc(disk)}</span></div>
<div class="card"><b>负载 (1/5/15m)</b><span>${esc(load)}</span></div>
<div class="card"><b>开机</b><span>${esc(up)}</span></div>
<div class="card"><b>tailnet</b><span>${esc(ts)}</span></div>
<div class="card"><b>命根箱最近同步</b><span>${esc(lastSync)}</span></div>
</div>
<div class="card" style="margin-bottom:12px"><b>命根箱 ~/vault</b><span style="font-size:13px">${esc(vault)}</span></div>
<table><tr><th>时刻</th><th>会话</th><th>那一轮我说的开头</th><th>in/out</th><th>缓存读</th><th>缓存写</th></tr>${trs || "<tr><td colspan=6>桥还没接到过话</td></tr>"}</table>
<div class="foot">只读看板 · 不碰桥 · 绿色「续:N」= 缓存命中的续会话轮</div>
<script>setTimeout(()=>location.reload(),30000)</script></html>`;
}

http.createServer((req, res) => {
  if (req.method !== "GET") { res.writeHead(405); return res.end(); }
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
  res.end(page());
}).listen(PORT, "127.0.0.1", () => console.log("dash 起来了 → http://127.0.0.1:" + PORT));
