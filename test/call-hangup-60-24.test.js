const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const callSend = app.slice(app.indexOf("const callSend"), app.indexOf("const endCall"));
const endCall = app.slice(app.indexOf("const endCall"), app.indexOf("const endCall") + 3000);

// 她 2026-09-02：「然后让他们也可以主动挂电话吧」。
// 原来这通电话只有她挂得掉：角色说什么都行，就是走不了——
// 于是「我这边有事要走」只能是一句空话，说完还得继续待在线上。

test("单人通话的协议里有 hangup 这一栏，而且写清了什么时候才填", () => {
  assert.match(callSend, /\\"hangup\\":null\}/, "输出示例里没有这一栏，模型不会凭空填");
  assert.match(callSend, /这通电话【你也可以自己挂】/);
  assert.match(callSend, /绝大多数回合填 null/, "没有门槛，它会每轮都想挂");
  assert.match(callSend, /别拿它当省事的出口/);
  // ⚠️给的是【判据和维度】，不是几句示范台词（施工规则/prompt-no-content-samples.md）
  assert.ok(!/如「|比如「/.test(callSend.slice(callSend.indexOf("hangup 挂断"), callSend.indexOf("hangup 挂断") + 400)),
    "别在这一栏里举例句——那一句会被每个角色照抄");
});

test("群通话里谁都能挂，挂了就不再往下念别人的台词", () => {
  assert.match(callSend, /【挂断】谁真的要结束这通电话/);
  assert.match(callSend, /markCallBye\(spk\.id, spk\.name, String\(arr\[i\]\.hangup\)\); break;/,
    "有人挂了还接着把后面几条念完，那这通电话就没挂成");
});

test("模型说要挂 → 只立牌子，不当场收线", () => {
  assert.match(app, /const markCallBye = \(byId, byName, reason\) => setCall\(c => \(c && !c\.bye\)/,
    "已经在挂了就别再盖一次");
  assert.match(callSend, /if \(d\.hangup && String\(d\.hangup\)\.toLowerCase\(\) !== "null"\) markCallBye/);
  // 时长只有 CallScreen 数着；App 这边当场 endCall 会把时长写成 0
  assert.ok(!/d\.hangup[\s\S]{0,80}endCall\(/.test(callSend), "别在 App 这边直接收线");
});

test("真正收线在通话页：留一会儿让最后那句看得完", () => {
  const i = comp.indexOf("function CallScreen(");
  const body = comp.slice(i, comp.indexOf("// 懒 TTS 小播放器", i));
  assert.match(body, /const byeRef = useRef\(false\);/, "没有闸，effect 重跑会挂两次");
  assert.match(body, /if \(!bye \|\| byeRef\.current\) return;/);
  assert.match(body, /setTimeout\(\(\) => onHangup\(secRef\.current, "them"\), 1800\)/,
    "话音未落就黑屏，或者根本不收线");
  assert.match(body, /\}, \[!!bye\]\)/, "依赖写成 bye 这个对象，每次 setCall 都会重跑");
  // 他要挂了就别再显示「正在说」——那两层同时出现是自相矛盾的
  assert.match(body, /!bye && sending && h\("div", \{ key: "typing"/);
  assert.match(body, /\(bye\.name \|\| "对方"\) \+ "挂断了"/, "屏幕上得说一声是谁挂的");
});

test("回执要认出「他挂的」和「聊完了」是两件事", () => {
  assert.match(endCall, /const endCall = \(sec, by\) =>/);
  assert.match(endCall, /by === "them" \? \(\(cur\.bye && cur\.bye\.name\)/);
  assert.match(endCall, /byName \? " · " \+ byName \+ "挂断了 · 时长 " : " 已结束 · 时长 "/);
  assert.match(endCall, /endedBy: byName \|\| null/, "回执卡自己也要认得出来，不能只靠那行文案");
  assert.match(comp, /m\.endedBy \? " · " \+ m\.endedBy \+ "挂断了 · 时长 " : " 已结束 · 时长 "/);
  // 挂断键要说明是她挂的，否则每一通都算成「他挂的」
  assert.match(comp, /onHangup\(secRef\.current, "me"\)/);
  assert.match(app, /onHangup: \(sec, by\) => endCall\(sec, by\)/);
});

test("这通电话是他挂的，归档时也该知道", () => {
  assert.match(endCall, /byName \? "\\n（这通电话是 " \+ byName \+ " 主动挂断的）" : ""/);
});
