#!/usr/bin/env node
import { existsSync, readFileSync } from "fs";

const input = await new Promise(resolve => {
  let body = "";
  process.stdin.setEncoding("utf8");
  process.stdin.on("data", chunk => { body += chunk; });
  process.stdin.on("end", () => {
    try { resolve(JSON.parse(body || "{}")); }
    catch { resolve({}); }
  });
});

if (String(input.tool_name || "") !== "ScheduleWakeup") process.exit(0);

const transcriptPath = String(input.transcript_path || "");
if (!transcriptPath || !existsSync(transcriptPath)) process.exit(0);

function blocks(record) {
  const content = record?.message?.content;
  if (Array.isArray(content)) return content;
  if (typeof content === "string") return [{ type: "text", text: content }];
  return [];
}

function isRealUserTurn(record) {
  if (record?.type !== "user" || record?.isMeta === true) return false;
  const content = record?.message?.content;
  if (typeof content === "string") return content.trim().length > 0;
  if (!Array.isArray(content)) return false;
  return content.some(block =>
    block?.type === "text" && String(block.text || "").trim().length > 0
  );
}

let records;
try {
  records = readFileSync(transcriptPath, "utf8")
    .split("\n")
    .filter(Boolean)
    .map(line => JSON.parse(line));
} catch {
  process.exit(0);
}

let turnStart = 0;
for (let index = records.length - 1; index >= 0; index--) {
  if (isRealUserTurn(records[index])) {
    turnStart = index + 1;
    break;
  }
}

const hasVisibleReply = records.slice(turnStart).some(record =>
  record?.type === "assistant" &&
  blocks(record).some(block =>
    block?.type === "text" && String(block.text || "").trim().length >= 2
  )
);

if (!hasVisibleReply) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny"
    },
    systemMessage: "先别拧 ScheduleWakeup：本轮还没有任何真正发给 Lisa 的可见正文，thinking/narration 不算。请先输出自然、完整的用户可见回复；正文送达后再调用 ScheduleWakeup。"
  }));
}
