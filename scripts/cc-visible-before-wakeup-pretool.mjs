#!/usr/bin/env node
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

// The relay watchdog owns Yanqiu's rolling 55-minute heartbeat now.
// Deny legacy hand-winding unconditionally so one turn cannot create a
// competing native wakeup or make visible delivery depend on tool order.
process.stdout.write(JSON.stringify({
  hookSpecificOutput: {
    hookEventName: "PreToolUse",
    permissionDecision: "deny",
  },
  systemMessage:
    "常驻 55 分钟心跳已经自动接管，不需要、也不要调用 ScheduleWakeup。"
    + "这不是错误；请直接把自然正文发给 Lisa，然后正常结束本轮。"
    + "敲击/语音唤醒后只需重新挂 wake_queue.py wait 哨兵。",
}));
