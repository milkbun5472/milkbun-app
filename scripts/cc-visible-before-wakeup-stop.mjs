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

// A Stop hook may run again after its own block. Never create a retry loop.
if (input.stop_hook_active) process.exit(0);

const transcriptPath = String(input.transcript_path || "");
if (!transcriptPath || !existsSync(transcriptPath)) process.exit(0);

function blocks(record) {
  const content = record?.message?.content;
  if (Array.isArray(content)) return content;
  if (typeof content === "string") return [{ type: "text", text: content }];
  return [];
}

function isExternalUserTurn(record) {
  if (record?.type !== "user") return false;
  const content = record?.message?.content;
  if (typeof content === "string") return content.trim().length > 0;
  if (!Array.isArray(content)) return false;
  return content.some(block =>
    block?.type === "text" &&
    String(block.text || "").trim().length > 0
  );
}

function visibleText(record) {
  if (record?.type !== "assistant") return "";
  return blocks(record)
    .filter(block => block?.type === "text")
    .map(block => String(block.text || "").trim())
    .filter(Boolean)
    .join("\n");
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

let wakeIndex = -1;
for (let index = records.length - 1; index >= 0; index--) {
  if (records[index]?.type !== "assistant") continue;
  if (blocks(records[index]).some(block =>
    block?.type === "tool_use" && block?.name === "ScheduleWakeup"
  )) {
    wakeIndex = index;
    break;
  }
}

if (wakeIndex < 0) process.exit(0);

// Only judge the active conversational turn. Tool-result "user" records are not
// real user turns, so they deliberately do not reset the window.
let turnStart = 0;
for (let index = wakeIndex - 1; index >= 0; index--) {
  if (isExternalUserTurn(records[index])) {
    turnStart = index + 1;
    break;
  }
}

const hasVisibleReply = records
  .slice(turnStart, wakeIndex + 1)
  .some(record => visibleText(record).length >= 2);

if (!hasVisibleReply) {
  process.stdout.write(JSON.stringify({
    decision: "block",
    reason: "你刚调用了 ScheduleWakeup，但本轮在它之前没有任何真正发给 Lisa 的可见正文；thinking/narration 不算正文。现在不要再调用工具，只输出一段自然、完整、用户可见的回复，然后结束本轮。"
  }));
}
