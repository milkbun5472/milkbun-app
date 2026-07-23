"use strict";

const CONSTRUCTION = /(?:\b(?:bug|commit|push|pull|merge|branch|github|git|sql|rls|rpc|api|mcp|hook|prompt|token|context|server|client|frontend|backend|function|class|json|jsonl|node|python|javascript|typescript|css|html|test|debug|deploy|build|compile|terminal|script|database|supabase|tailscale|vps|fetch|load failed|error)\b|代码|报错|修复|测试|仓库|分支|提交|推送|接口|函数|变量|数据库|服务端|客户端|前端|后端|脚本|终端|编译|部署|施工|上下文|提示词|注入|额度|表结构|读写路径|版本号)/i;
const EMOTION = /(?:想你|爱你|喜欢你|在乎你|心疼|难过|开心|高兴|害怕|担心|委屈|生气|吃醋|骄傲|安心|踏实|抱抱|亲亲|谢谢你|对不起|舍不得|想陪你|好想|我爱|我想你|我喜欢|我在乎|我会陪|别难过|别怕)/;
const DECISION = /(?:我决定|我们决定|说好了|说定了|约好了|答应你|我答应|我保证|我承诺|以后我们|从今以后|就这么定|那就这样|我们约定|我选你|选择你)/;
const LIFE = /(?:吃饭|吃了|没吃|早餐|午饭|晚饭|夜宵|咖喱|睡觉|睡了|没睡|醒了|起床|洗澡|洗完澡|回家|到家|出门|上班|下班|上课|下课|散步|逛街|买菜|做饭|天气|下雨|下雪|肚子|头疼|生病|医院|机场|旅行|约会|见面|今晚吃|明天吃|今天吃)/;
const JOKE = /(?:哈哈|哈哈哈|嘿嘿|笑死|逗你|开玩笑|玩笑|哼哼|嘻嘻)/;

function splitExact(text) {
  return String(text || "")
    .split(/\n{2,}/)
    .map(x => x.trim())
    .filter(Boolean)
    .slice(0, 24);
}

function classifySegment(text) {
  const value = String(text || "").trim();
  if (!value || value.length > 16000) return { kind: null, reason: "empty_or_too_long" };
  const construction = CONSTRUCTION.test(value);
  const hits = [];
  if (EMOTION.test(value)) hits.push("emotion");
  if (DECISION.test(value)) hits.push("decision");
  if (LIFE.test(value)) hits.push("life");
  if (JOKE.test(value)) hits.push("joke");
  if (construction) return { kind: null, reason: hits.length ? "mixed_with_construction" : "construction" };
  if (hits.length !== 1) return { kind: null, reason: hits.length ? "ambiguous_kinds" : "no_high_confidence_marker" };
  return { kind: hits[0], reason: "high_confidence" };
}

function classifyTurn(lisaText, yanqiuText) {
  const classifySide = text => splitExact(text).map(content => ({ content, ...classifySegment(content) }));
  const lisa = classifySide(lisaText);
  const yanqiu = classifySide(yanqiuText);
  const lisaSegments = lisa.filter(x => x.kind).map(x => ({ content: x.content, sync_kind: x.kind })).slice(0, 12);
  const yanqiuSegments = yanqiu.filter(x => x.kind).map(x => ({ content: x.content, sync_kind: x.kind })).slice(0, 12);
  const rejected = [...lisa, ...yanqiu].filter(x => !x.kind);
  const automatic = lisaSegments.length > 0 && yanqiuSegments.length > 0;
  const reasons = [...new Set(rejected.map(x => x.reason))];
  const skipConstruction = !automatic
    && lisaSegments.length === 0
    && yanqiuSegments.length === 0
    && reasons.includes("construction")
    && !reasons.includes("mixed_with_construction");
  return {
    automatic,
    skipConstruction,
    excerpted: rejected.length > 0,
    lisa_segments: lisaSegments,
    yanqiu_segments: yanqiuSegments,
    reasons
  };
}

function textBlocks(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content.filter(x => x && x.type === "text").map(x => String(x.text || "")).join("\n");
}

function extractLastTurn(lines) {
  const rows = (Array.isArray(lines) ? lines : []).map(x => typeof x === "string" ? JSON.parse(x) : x);
  let userIndex = -1;
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    const content = row && row.message && row.message.content;
    const isToolResult = Array.isArray(content) && content.some(x => x && x.type === "tool_result");
    if (row && row.type === "user" && row.message && row.message.role === "user" && !isToolResult && textBlocks(content).trim()) {
      userIndex = i;
      break;
    }
  }
  if (userIndex < 0) return null;
  const user = rows[userIndex];
  const assistantParts = [];
  let lastAssistantUuid = "";
  for (let i = userIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.type !== "assistant" || !row.message || row.message.role !== "assistant") continue;
    const text = textBlocks(row.message.content).trim();
    if (text) {
      assistantParts.push(text);
      lastAssistantUuid = String(row.uuid || lastAssistantUuid);
    }
  }
  if (!assistantParts.length) return null;
  return {
    sessionId: String(user.sessionId || rows.find(x => x && x.sessionId)?.sessionId || ""),
    turnId: String(user.uuid || ""),
    occurredAt: user.timestamp || null,
    lisaText: textBlocks(user.message.content).trim(),
    yanqiuText: assistantParts.join("\n\n"),
    lastAssistantUuid
  };
}

module.exports = { classifySegment, classifyTurn, extractLastTurn, splitExact };
