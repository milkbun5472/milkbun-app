#!/usr/bin/env node
import {
  inspectPreTool,
  inspectWithRetry,
  logGateDiagnostic,
} from "./cc-visible-gate-lib.mjs";

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
if (!transcriptPath) process.exit(0);

// Claude 可能先触发 PreToolUse，再把同一轮刚输出的 text 刷进 transcript。
// 短暂重读只解决这个落盘竞态；thinking 仍永远不算正文。
const result = await inspectWithRetry(transcriptPath, inspectPreTool);
logGateDiagnostic("pretool", result);

if (!result.visible) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
    },
    systemMessage: `先别拧 ScheduleWakeup：本轮还没有任何真正发给 Lisa 的可见正文（诊断：${result.reason}）。thinking/narration 不算。请先输出自然、完整的用户可见回复；正文送达后再调用 ScheduleWakeup。`,
  }));
}
