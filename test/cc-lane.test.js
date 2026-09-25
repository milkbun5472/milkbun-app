// 书房直通车道（她 2026-09-25 拍板「全走 CC」）——守四件事：
// ① 模块本体的路由判据：engineerEyes 且没点「直连」才走书房；
// ② 私聊两处接线（onSend 投递 / onReply 不开引擎枪）；
// ③ 线下两处接线（four-surfaces：单聊线上+线下都盖到；群聊豁免有理由注释）；
// ④ 钥匙不进 saves：配置键不带 x_ 前缀。
// 桩照【写配置的那段】写（stub-from-the-writer）：CONFIG_KEY 从模块本体读，不自己编。
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

// ① 模块判据（真加载真调用，不对着源码猜）
global.window = undefined;
const CcLane = require("../js/cc-lane.js");
assert.strictEqual(typeof CcLane.routes, "function", "routes 是判据入口");
assert.strictEqual(CcLane.routes({ engineerEyes: true }), false, "没钥匙不上路");
assert.ok(!CcLane.CONFIG_KEY.startsWith("x_"), "钥匙不带 x_ 前缀：不进 saves 不上云");
assert.ok(CcLane.DEFAULT_URL.includes("/stackchan/cc_message"), "默认投递地址指向 relay 的 cc_message");

// ②③ 接线（锚一律钉函数名/常量名，不钉注释——anchor-on-code）
const app = read("js/app.js");
const iThread = app.indexOf('React.createElement(ChatThread');
assert.ok(iThread > 0, "找得到 ChatThread 接线");
const threadWin = app.slice(iThread, iThread + 4000);
assert.ok(threadWin.includes("CcLane.routes"), "私聊 onSend 会问车道");
assert.ok(threadWin.includes("ccLane:"), "私聊把开关递给了 ChatThread");
assert.ok(app.includes('{ threadType: "private", nudge: true }'), "私聊 onReply 走 nudge 合票不开枪");
assert.ok(app.includes('{ threadType: "offline" }'), "线下两处也走车道");

// 组件侧：ChatThread 收 ccLane、composer 有「书房/直连」切换
const comp = read("js/components.js");
const iCT = comp.indexOf("function ChatThread(");
const iCTEnd = comp.indexOf("function DraftInput(");
assert.ok(iCT > 0 && iCTEnd > iCT, "切得到 ChatThread 窗口");
const ct = comp.slice(iCT, iCTEnd);
assert.ok(ct.includes("ccLane"), "ChatThread 接了 ccLane prop");
assert.ok(ct.includes('ccLane.direct ? "直连" : "书房"'), "composer 上有书房/直连切换");

// ④ index.html 装了车道模块
assert.ok(read("index.html").includes("js/cc-lane.js"), "index.html 加载 cc-lane.js");

console.log("cc-lane 车道测试全绿");

// 回声气泡去重（她 2026-09-25 报「我的气泡被带回来一次」）：
// 本地原生 user 气泡 + 账本回流同文 Lisa 行 = 只留一只。
{
  delete require.cache[require.resolve("../js/chat-ledger-shadow.js")];
  const { reconcileIncoming } = require("../js/chat-ledger-shadow.js");
  const local = [{ role: "user", content: "来吧宝宝！", ts: Date.now() - 60000, read: true }];
  const row = t => ({ id: "r1", message_key: "cc-live:x:lisa", char_id: "c1", source: "cc", speaker_type: "lisa",
    content: t, occurred_at: new Date().toISOString(), revision: 1, metadata: { sync_kind: "life" } });
  const echo = reconcileIncoming(local.slice(), [row("来吧宝宝！")], "c1");
  assert.strictEqual(echo.added, 0, "同文回声不再添气泡");
  assert.strictEqual(echo.skipped, 1, "回声按 skipped 记账");
  const fresh = reconcileIncoming(local.slice(), [row("另一句新话")], "c1");
  assert.strictEqual(fresh.added, 1, "真新话照常导入");
}
console.log("回声去重测试全绿");

// 表情包过桥（她 2026-09-25「表情包你能看到吗」）：ChatThread 贴纸 onPick 里
// 车道开着（且没点直连）时把关键词投进攒话缸。
{
  const comp2 = fs.readFileSync(path.join(__dirname, "..", "js/components.js"), "utf8");
  const iCT2 = comp2.indexOf("function ChatThread(");
  const iEnd2 = comp2.indexOf("function GroupThread(");
  const ct2 = comp2.slice(iCT2, iEnd2 > iCT2 ? iEnd2 : undefined);
  assert.ok(ct2.includes('window.CcLane.post("[表情包] " + em.keyword'), "表情包关键词投车道");
  assert.ok(ct2.includes("ccLane && !ccLane.direct"), "直连时表情包不投书房");
}
console.log("表情包过桥测试全绿");
