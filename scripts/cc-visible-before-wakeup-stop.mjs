#!/usr/bin/env node
import {
  inspectStop,
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

// Stop hook 被自己拦下后可能再跑一次，绝不能制造循环。
if (input.stop_hook_active) process.exit(0);
const transcriptPath = String(input.transcript_path || "");
if (!transcriptPath) process.exit(0);

const result = await inspectWithRetry(transcriptPath, inspectStop);
logGateDiagnostic("stop", result);
if (result.relevant === false) process.exit(0);

if (!result.visible) {
  process.stdout.write(JSON.stringify({
    decision: "block",
    reason: `你刚调用了 ScheduleWakeup，但本轮在它之前没有任何真正发给 Lisa 的可见正文（诊断：${result.reason}）。thinking/narration 不算正文。现在不要再调用工具，只输出一段自然、完整、用户可见的回复，然后结束本轮。`,
  }));
}
