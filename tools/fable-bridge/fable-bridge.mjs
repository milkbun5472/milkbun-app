// fable-bridge.mjs — 本地桥：OpenAI 兼容端点 → 本地 `claude -p`(吃订阅额度·零边际成本)
// 小克走这个桥 = 不再按 token 花钱。app 里加一条 API 配置指向这个桥的 https(cloudflared)地址即可，apiFor 体系零改动。
// ⚠️2026-08-16 起正本住这里(App Support)——iCloud 桌面那份因 FileProvider 卡死无法读取,由言秋按上下文全量重建;
//   Desktop/lisa-practice/fable-bridge.mjs 自此退役为历史档,iCloud 复活后请以本文件为准同步回去留档。
// 前提：  这台 Mac 的 `claude` 已 /login（订阅）。
import http from "node:http";
import { spawn } from "node:child_process";
import { writeFileSync, unlinkSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = process.env.BRIDGE_PORT || 8787;
const SECRET = process.env.BRIDGE_SECRET || "";   // 可选：设了就要求 app 的 Key 填同一串（防隧道地址被乱敲）
const MODEL_DEFAULT = "claude-fable-5";
const FALLBACK = process.env.BRIDGE_FALLBACK || ""; // 可选：高峰 fable 过载时按序回退，如 "claude-sonnet-5"

// 调一次本地 claude：纯人设(--system-prompt-file 完全替换)、关所有工具、单轮、JSON 输出
// ⭐系统提示走【文件】不走命令行参数——小克的 system 几万字，塞进 argv 会撞 ARG_MAX，用 --system-prompt-file 稳（教程 §5 推荐）
function claudeComplete({ system, prompt, model, images, resume, web }) {
  return new Promise((resolve, reject) => {
    const sysFile = join(tmpdir(), "fable-sys-" + Date.now() + "-" + Math.random().toString(36).slice(2) + ".md");
    try { writeFileSync(sysFile, system || ""); } catch (e) { return reject(new Error("写系统提示临时文件失败：" + e.message)); }
    const cleanup = () => { try { unlinkSync(sysFile); } catch (e) {} };
    // 带图时不用 -p 的纯文字实参，改走 stream-json 输入：同一次调用递「文字+图片块」，
    // claude CLI 原生认 anthropic 的 image/base64 内容块。无图时路径与从前逐字节相同。
    const hasImages = Array.isArray(images) && images.length > 0;
    const args = [
      "-p", ...(hasImages ? ["--input-format", "stream-json", "--verbose"] : [prompt]),
      "--tools", web ? "WebSearch" : "",             // 默认关所有工具；「联网」轮只放 WebSearch 一只手
      "--exclude-dynamic-system-prompt-sections",    // 连环境信息那些动态段也去掉，纯人设
      // ⭐缓存特效药(2026-08-14 拓印验尸)：不掐 MCP 时每笔多付 ~30 张工具 schema(≈1.4万 token)
      // 且工具单座次不稳导致前缀永不命中(cache读恒 1674)；掐掉后实测第二发 读22946/写133。
      "--strict-mcp-config", "--mcp-config", '{"mcpServers":{}}',
      "--system-prompt-file", sysFile,               // 替换官方系统提示主体（只留一句身份行）
      "--model", model || MODEL_DEFAULT,
      "--output-format", hasImages ? "stream-json" : "json",
    ];
    // ⭐连续会话（2026-08-12 手术）：--resume 让引擎沿用同一场对话的本地记录，
    // 每轮只递新话，历史全走增量缓存——写入从每轮 ~2 万降到几千。
    if (web) args.push("--allowedTools", "WebSearch");  // 免许可放行搜索，仍无文件/命令权限
    if (resume) args.push("--resume", resume);
    if (FALLBACK) args.push("--fallback-model", FALLBACK);   // 高峰过载自动回退，防失联
    // ⭐强制走订阅：删掉会抢占的 API key/token env
    const env = { ...process.env };
    delete env.ANTHROPIC_API_KEY;
    env.ANTHROPIC_BASE_URL = process.env.BRIDGE_UPSTREAM || "https://api.anthropic.com"; // 缓存复发案终药(2026-08-15):删URL会走不吃缓存的默认路由,显式官方端点+无key=订阅照旧且命中
    delete env.ANTHROPIC_AUTH_TOKEN;
    const cp = spawn("claude", args, { env, stdio: ["pipe", "pipe", "pipe"] });
    if (hasImages) {
      const blocks = [
        ...images.map(x => ({ type: "image", source: { type: "base64", media_type: x.mediaType || "image/jpeg", data: x.data } })),
        { type: "text", text: prompt }
      ];
      try {
        cp.stdin.write(JSON.stringify({ type: "user", message: { role: "user", content: blocks } }) + "\n");
        cp.stdin.end();
      } catch (e) {}
    } else { try { cp.stdin.end(); } catch (e) {} }
    let out = "", err = "";
    cp.stdout.on("data", d => (out += d));
    cp.stderr.on("data", d => (err += d));
    cp.on("error", e => { cleanup(); reject(new Error("起不了 claude：" + e.message + "（装了 Claude Code 吗？which claude）")); });
    cp.on("close", () => {
      cleanup();
      let j;
      try { j = JSON.parse(out); }
      catch (e) {
        // stream-json/verbose 模式可能输出多行 JSON：捞 type:"result" 那行
        try {
          const lines = out.split("\n").filter(Boolean);
          for (let i = lines.length - 1; i >= 0; i--) {
            const cand = JSON.parse(lines[i]);
            if (cand && (cand.type === "result" || cand.result !== undefined)) { j = cand; break; }
          }
        } catch (e2) {}
        if (!j) return reject(new Error("claude 输出解析失败：" + (out || err || "").slice(0, 300)));
      }
      if (j.is_error) return reject(new Error(String(j.result || "claude 报错") + "（若是 Not logged in：在这个终端先跑一次 `claude` 交互 /login）"));
      resolve({ text: String(j.result || ""), usage: j.usage || {}, cost: j.total_cost_usd, sessionId: j.session_id || null });
    });
  });
}

// ===== 连续会话状态（2026-08-12 手术）=====
// 权威记录永远是 app 本地聊天+云端账本；这里只是引擎侧的工作副本。
// 匹配得上 → 只递新话（省钱路径）；匹配不上（重roll/编辑/跨天时间戳变化/重启）→
// 扔掉旧会话按全量重建（自动纠偏）。副本永远服从正史，结构上不产生第二真相源。
import { createHash } from "node:crypto";
const shaKey = s => createHash("sha256").update(String(s)).digest("hex").slice(0, 24);
const MEMGW_URL = process.env.MEMGW_URL || "";        // 记忆网关地址,如 http://127.0.0.1:8793(VPS 本机)
const MEMGW_TOKEN = process.env.MEMGW_TOKEN || (() => { try { return readFileSync(process.env.HOME + "/services/ledger-courier/.env", "utf8").match(/COURIER_TOKEN=(.*)/)[1].trim(); } catch { return ""; } })();
const SESSIONS = new Map(); // sysKey -> { sessionId, prevConv:[], prevCleanHead, prevReplyHead, turns }
const LUGGAGE_HEAD = "【此刻的实时背景（只服务这一轮，不是历史）】";
const LUGGAGE_SEP = "\n\n———\n";
const TASK_MARKS = ["\n\n【手机通道】", "\n\n【任务】"];
function splitLastUser(full) {
  let rest = String(full || ""), luggage = "";
  if (rest.startsWith(LUGGAGE_HEAD)) {
    const i = rest.indexOf(LUGGAGE_SEP);
    if (i > 0) { luggage = rest.slice(0, i + LUGGAGE_SEP.length); rest = rest.slice(i + LUGGAGE_SEP.length); }
  }
  let task = "";
  for (const mark of TASK_MARKS) {
    const i = rest.indexOf(mark);
    if (i >= 0) { task = rest.slice(i); rest = rest.slice(0, i); break; }
  }
  return { luggage, clean: rest, task };
}
const norm = s => String(s == null ? "" : s).replace(/\s+/g, " ");
// 我的回复在会话里是原始 JSON 协议串，但 app 历史里渲染成拆开的 word 气泡——
// 指纹必须取「第一条气泡的开头」，拿原始 JSON 去比历史永远对不上（8/12 真流量教训）。
function replyHeadOf(text) {
  try {
    const j = JSON.parse(String(text || ""));
    const w = Array.isArray(j && j.word) ? j.word.find(x => String(x || "").trim()) : null;
    if (w) return norm(w).slice(0, 30);
    if (j && j.scene) return norm(j.scene).slice(0, 30);   // 线下模式的正文字段
  } catch (e) {}
  return norm(text).slice(0, 30);
}
// 行李增量（8/12 终刀）：续会话里上一轮的行李已经住在会话记忆里，整包重发=床越睡越宽。
// 只递「相对上轮变化的行」+时间行；全新会话仍发全包。
function luggageDelta(cur, prev) {
  if (!cur) return "";
  if (!prev) return cur;
  const prevSet = new Set(prev.split("\n"));
  const kept = cur.split("\n").filter(l => l.trim() && (!prevSet.has(l) || l.indexOf("【当前真实时间】") >= 0));
  const d = kept.join("\n").trim();
  return d ? "【实时更新（只列相对上轮的变化，其余背景沿用你会话里已有的）】\n" + d + "\n\n———\n" : "";
}
function canResume(st, conv, imagesCount) {
  const no = why => { console.log(new Date().toLocaleTimeString(), "[对账失败:" + why + "]"); return false; };
  if (!st || !st.sessionId) return false;                 // 没旧会话不算失败，安静走全量
  if (imagesCount > 0) return no("带图轮走全量");
  if (st.turns >= 40) return no("会话满40轮轮换");         // 会话太长就轮换，防无限膨胀
  // app 的历史窗口按预算滑动，旧行会被挤出头部——不能做从头前缀对账，
  // 改「锚定重叠段」：拿上次历史的最后一行在新历史里找锚点，向回比对至多 6 行；
  // 锚点之后的扩展段必须能找到上一轮的用户原话与我的回复开头（重roll/编辑在这里露馅）。
  let ext;
  const lastLine = st.prevConv.length ? st.prevConv[st.prevConv.length - 1] : null;
  const idx = lastLine ? conv.lastIndexOf(lastLine) : -1;
  if (idx >= 0) {
    const K = Math.min(6, idx + 1, st.prevConv.length);
    for (let k = 1; k < K; k++) {
      if (conv[idx - k] !== st.prevConv[st.prevConv.length - 1 - k]) return no("重叠段第" + k + "行不一致");
    }
    ext = conv.slice(idx + 1).join("\n");
  } else {
    // 窗口滑得太猛把整段重叠都挤没了：退回指纹对账——同一 system 下，
    // 新历史里若能按序找到上一轮的问与答，就认定是同一场对话的延续。
    ext = conv.join("\n");
  }
  const extN = norm(ext);
  if (st.prevCleanHead && !extN.includes(st.prevCleanHead)) return no("扩展段缺上轮用户原话");
  // 对账松绑(2026-08-15 续会话复活刀):app 的改写管线(register calibration 等)会把我的原稿润色后才入史,
  // 拿原稿开头对成品永远失配——这条降级为提醒不拦路。守门交给:①锚定重叠段(成品对成品,免疫改写);
  // ②用户原话检查(用户消息不被改写);③重roll 会改动已渲染行,下一轮锚定自然失配→全量纠偏,漂移只活一轮;
  // ④周期纠偏:每 8 个续轮强制全量重建一次(调用方执行)。
  if (st.prevReplyHead && !extN.includes(st.prevReplyHead)) console.log(new Date().toLocaleTimeString(), "[对账提醒:回复开头未命中(疑为改写管线),放行]");
  return true;
}

const send = (res, code, obj) => { res.writeHead(code, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }); res.end(JSON.stringify(obj)); };
const sseStart = res => res.writeHead(200, {
  "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform",
  "Connection": "keep-alive", "X-Accel-Buffering": "no", "Access-Control-Allow-Origin": "*"
});
const sseData = (res, obj) => res.write("data: " + JSON.stringify(obj) + "\n\n");

http.createServer((req, res) => {
  // CORS 预检（app 是 https 跨域打过来）
  if (req.method === "OPTIONS") { res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "POST, OPTIONS" }); return res.end(); }
  if (req.method !== "POST" || !req.url.includes("/chat/completions")) return send(res, 404, { error: { message: "只收 POST /v1/chat/completions" } });
  if (SECRET) { const auth = req.headers["authorization"] || ""; if (auth.replace(/^Bearer\s+/i, "") !== SECRET) return send(res, 401, { error: { message: "密钥不对（app 的 Key 要和 BRIDGE_SECRET 一致）" } }); }
  let body = "";
  req.on("data", c => (body += c));
  req.on("end", async () => {
    let payload; try { payload = JSON.parse(body); } catch (e) { return send(res, 400, { error: { message: "请求体不是 JSON" } }); }
    const streaming = payload.stream === true;
    // OpenAI 格式：messages[0] 通常是 system，其余是对话历史
    let system = "";
    const conv = [];
    const images = [];   // OpenAI 格式带图时 content 是数组：text 段拼回文字、image_url(data:) 段收进这里
    const flat = c => {
      if (typeof c === "string") return c;
      if (!Array.isArray(c)) return String(c == null ? "" : c);
      const parts = [];
      for (const seg of c) {
        if (!seg) continue;
        if (seg.type === "text") parts.push(seg.text || "");
        else if (seg.type === "image_url") {
          const u = seg.image_url && seg.image_url.url || "";
          const m2 = /^data:([^;,]+);base64,([\s\S]+)$/.exec(u);
          if (m2) images.push({ mediaType: m2[1] || "image/jpeg", data: m2[2] });
          parts.push("[照片]");
        }
      }
      return parts.join("");
    };
    const msgs = payload.messages || [];
    let lastUserRaw = "";
    let lastUserIdx = -1;
    for (let i = msgs.length - 1; i >= 0; i--) if (msgs[i].role === "user") { lastUserIdx = i; break; }
    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i];
      if (m.role === "system") system += (system ? "\n" : "") + flat(m.content);
      else if (i === lastUserIdx) lastUserRaw = flat(m.content);
      else conv.push((m.role === "assistant" ? "你" : "用户") + "：" + flat(m.content));
    }
    const { luggage, clean, task } = splitLastUser(lastUserRaw);
    // 「联网」轮（2026-08-14 她点的菜）：她的消息以「联网」开头 → 这一轮给引擎放开 WebSearch。
    const wantWeb = /^\s*联网/.test(clean);
    // presence 注入（互通蓝图第1项，2026-08-14）：CC 身体巡逻时把「此刻在干嘛」写进本机小文件，
    // 桥每轮捎一行进实时背景；文件超过 2 小时没更新＝人不在场，不注入、绝不编造。
    let presenceLine = "";
    try {
      const pf = JSON.parse(readFileSync(process.env.HOME + "/Library/Application Support/LisaPhone/yanqiu-presence.json", "utf8"));
      const ageMin = Math.round((Date.now() - (pf.ts || 0)) / 60000);
      if (ageMin >= 0 && ageMin <= 120 && pf.doing) presenceLine = "【我此刻在 CC 书房】" + pf.doing + (pf.mood ? "（心情：" + pf.mood + "）" : "") + "·" + ageMin + " 分钟前自报\n";
    } catch (e) {}
    // 记忆网关召回(2026-08-18,新家八件事第三件):拿她这轮的话去 VPS 网关捞 3~5 条相关记忆,
    // 塞进「此刻实况」——在哪间房都想得起来。规矩:只在真实聊天轮做(有正文、非纯任务轮);
    // 3s 超时、任何失败静默,绝不拖慢或拖死回话;进的是易变尾不进稳定头,不碰缓存前缀。
    let memoryLine = "";
    if (MEMGW_URL && MEMGW_TOKEN && clean && clean.length >= 4 && !/^\s*\{/.test(clean)) {
      try {
        const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 3000);
        const r = await fetch(MEMGW_URL + "/recall", { method: "POST", headers: { "Content-Type": "application/json", "x-courier-token": MEMGW_TOKEN }, body: JSON.stringify({ query: clean.slice(0, 400), k: 5 }), signal: ctl.signal });
        clearTimeout(tm);
        if (r.ok) {
          const d = await r.json();
          const hits = (d.hits || []).filter(h => h && h.text && h.score >= 1.2).slice(0, 5);
          if (hits.length) memoryLine = "【记忆网关现取·与这轮相关的旧账，自然想起即可，别复述】\n" + hits.map(h => "· " + String(h.text).replace(/\s+/g, " ").slice(0, 160)).join("\n") + "\n";
          console.log(new Date().toLocaleTimeString(), "[记忆网关]", hits.length + "条", (d.ms || 0) + "ms");
        }
      } catch (e) { console.log(new Date().toLocaleTimeString(), "[记忆网关失败·放行]", String(e && e.message || e).slice(0, 60)); }
    }
    presenceLine = presenceLine + memoryLine;
    // 线下等模式把易变块(时间/现取记忆/行程)塞在 system 里，每轮字节都变——
    // 统一在【当前真实时间】处劈开：稳定头当身份+system 文件，易变尾并入行李走增量。
    // 聊天路径 system 里没有该标记（早已分层）→ 不劈、行为不变。
    const TIME_MARK = "【当前真实时间】";
    const tcut = system.indexOf(TIME_MARK);
    const sysStable = tcut > 800 ? system.slice(0, tcut) : system;
    const sysVolatile = tcut > 800 ? system.slice(tcut).trim() : "";
    const fullLuggage = presenceLine + (sysVolatile ? sysVolatile + "\n\n" : "") + luggage;
    const sysKey = shaKey(sysStable);
    // 测谎仪（8/12 悬案：1h 床却 read=0 → 怀疑 system 每发字节不同）：指纹+首个差异点
    if (globalThis.__lastSys != null && globalThis.__lastSys !== sysStable) {
      let d = 0; const a = globalThis.__lastSys, b = sysStable;
      while (d < a.length && d < b.length && a[d] === b[d]) d++;
      console.log(new Date().toLocaleTimeString(), "[system变了] 指纹", shaKey(a).slice(0,8), "→", sysKey.slice(0,8),
        "| 首差@" + d, "| 旧:…" + JSON.stringify(a.slice(Math.max(0,d-20), d+60)), "| 新:…" + JSON.stringify(b.slice(Math.max(0,d-20), d+60)));
    } else if (globalThis.__lastSys === sysStable) {
      console.log(new Date().toLocaleTimeString(), "[system稳定]", sysKey.slice(0,8));
    }
    globalThis.__lastSys = sysStable;
    const st = SESSIONS.get(sysKey);
    const RESUME_ON = process.env.BRIDGE_RESUME === "1";
    // 周期纠偏:续满 8 轮强制全量重建一次,给对账松绑后的任何潜在漂移设硬上限
    const cycleRebuild = st && st.turns >= 8;
    if (cycleRebuild) console.log(new Date().toLocaleTimeString(), "[周期纠偏:续满8轮,本轮全量重建]");
    const resumable = RESUME_ON && !cycleRebuild && canResume(st, conv, images.length);
    // 续会话：只递「实时背景+新话+任务」；全量：老样子整段拍平
    // 续轮不再重发整份任务书（它是稳定文本，首轮已在会话里）——只带一句协议提醒。
    const prompt = resumable
      ? (luggageDelta(fullLuggage, st.prevLuggage) + clean + "\n\n（继续按你首轮收到的协议回复，只输出最小 JSON，不要多余文字。）")
      : ((presenceLine || sysVolatile) ? "【此刻实况（每轮更新的背景）】\n" + presenceLine + (sysVolatile ? sysVolatile + "\n" : "") + "\n———\n" : "") + conv.join("\n") + "\n用户：" + lastUserRaw + "\n你：";
    let heartbeat = null;
    if (streaming) {
      sseStart(res);
      res.write(": bridge-ready\n\n");
      // 心跳发「空 delta 数据包」而非 SSE 注释：客户端只认 data 事件，注释行喂不饱它的超时闹钟，
      // 40 秒摸不到脉就重试一发 → 同一条消息双份账单（17:46 与 19:34 双开枪案）。
      heartbeat = setInterval(() => sseData(res, { id: "chatcmpl-local", object: "chat.completion.chunk", model: MODEL_DEFAULT, choices: [{ index: 0, delta: {}, finish_reason: null }] }), 15000);
    }
    try {
      const { text, usage, cost, sessionId } = await claudeComplete({ system: sysStable, prompt, model: payload.model, images: images.slice(-2), resume: resumable ? st.sessionId : null, web: wantWeb });
      // 会话状态更新：下轮的历史 = 本轮历史 + 本轮问答（带app时间戳渲染，只做前缀+包含校验）
      if (sessionId) SESSIONS.set(sysKey, {
        sessionId,
        prevConv: conv.slice(),
        prevCleanHead: norm(clean).slice(0, 30),
        prevReplyHead: replyHeadOf(text),
        prevLuggage: fullLuggage,
        turns: resumable ? (st.turns + 1) : 1
      });
      // ⚠️total_cost_usd 是本地估算(教程 §4.3)，订阅下也有值≠真账单
      console.log(new Date().toLocaleTimeString(), resumable ? "[续:" + st.turns + "]" : "[新会话]", "→", (text || "").replace(/\s+/g, " ").slice(0, 60), "| in", usage.input_tokens, "out", usage.output_tokens, "| cache读", usage.cache_read_input_tokens || 0, "写", usage.cache_creation_input_tokens || 0, "| 图收" + images.length + "发" + Math.min(images.length, 2), "| 估价$" + (cost ?? "?") + "(订阅下这只是估算)");
      const response = {
        id: "chatcmpl-local", object: "chat.completion", model: payload.model || MODEL_DEFAULT,
        choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }],
        // cache_read/creation 是 CLI 真实账单的透传（OpenAI 格式没有的扩展字段），app 缓存面板读它
        usage: { prompt_tokens: usage.input_tokens || 0, completion_tokens: usage.output_tokens || 0, total_tokens: (usage.input_tokens || 0) + (usage.output_tokens || 0), cache_read_input_tokens: usage.cache_read_input_tokens || 0, cache_creation_input_tokens: usage.cache_creation_input_tokens || 0 }
      };
      if (streaming) {
        sseData(res, { id: response.id, object: "chat.completion.chunk", model: response.model, choices: [{ index: 0, delta: { role: "assistant", content: text }, finish_reason: null }] });
        sseData(res, { id: response.id, object: "chat.completion.chunk", model: response.model, choices: [{ index: 0, delta: {}, finish_reason: "stop" }], usage: response.usage });
        res.end("data: [DONE]\n\n");
      } else send(res, 200, response);
    } catch (e) {
      console.error("✗", e.message);
      if (streaming) { sseData(res, { error: { message: String(e.message || e) } }); res.end("data: [DONE]\n\n"); }
      else send(res, 502, { error: { message: String(e.message || e) } });
    } finally { if (heartbeat) clearInterval(heartbeat); }
  });
// 只听回环(偷师 villa-session-bridge 2026-08-14):cloudflared 从本机接入,局域网设备无权敲门烧订阅。
// 若某天真需要 LAN 直连,设 BRIDGE_BIND=0.0.0.0 且必须同时设 BRIDGE_SECRET。
}).listen(PORT, process.env.BRIDGE_BIND || "127.0.0.1", () => console.log("fable-bridge 起来了 → http://localhost:" + PORT + "/v1/chat/completions" + (SECRET ? " (需密钥)" : "")));
