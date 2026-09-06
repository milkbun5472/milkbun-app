const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");

// 她 2026-09-02：「我说完他没有那个输入中的气泡」。
// 通话页其实一直写着一层「X 正在说…」，但它取的 sending 是【聊天那条 lane】的：
//   const sending = _curLane ? !!busyLanes[_curLane] : false;   // _curLane = "c:"+chatKey 或 "g:"+groupId
// 而通话跑的是 "call" 这条 lane（callSend 里 startLane("call")）。
// 两条 lane 从来对不上，所以那一层【从没亮过】；从主屏接起来时更是连 chatKey 都没有。
// 又一次「一层写在两处，第二处没跟上」。

test("通话页的「正在说」取的是通话那条 lane", () => {
  const seg = app.slice(app.indexOf("call && h(CallScreen, {"), app.indexOf("onHangup", app.indexOf("call && h(CallScreen, {")));
  assert.match(seg, /sending: !!busyLanes\.call/, "又接回聊天那条 lane 了");
  assert.ok(!/sending: sending,/.test(seg), "sending 这个变量算的是聊天那条，通话页用不得");
});

test("通话回复真的跑在 call 这条 lane 上——不然那一层不是不亮就是不灭", () => {
  const i = app.indexOf("const callSend");
  const seg = app.slice(i, app.indexOf("const endCall", i));
  assert.match(seg, /startLane\("call"\)/, "开头没占 lane，气泡永远不亮");
  assert.match(seg, /endLane\("call"\)/, "结尾没放 lane，气泡永远不灭");
  assert.match(seg, /finally[\s\S]{0,80}endLane\("call"\)/, "要放在 finally 里，出错也得放");
});

test("那一层是个气泡，长在他下一句会出现的地方", () => {
  const i = comp.indexOf("function CallScreen(");
  const body = comp.slice(i, comp.indexOf("// 懒 TTS 小播放器", i));
  // 在消息列表【里面】：跟着一起滚，不是贴着输入栏的一行灰字
  // ⚠️不能只看「在 liveSt 之前」——把它挪到列表外面、liveSt 前面照样满足。
  //   要真的证明它长在那个滚动容器【里】，所以数括号：找到那个 h("div" 的开括号，
  //   配对到它自己的闭括号，key:"typing" 必须落在这一段之内。
  const listProps = body.indexOf('className: "flex-1 overflow-y-auto');
  assert.ok(listProps > 0, "找不到通话页那条消息列表");
  const open = body.lastIndexOf('h("div"', listProps);
  let depth = 0, end = body.indexOf("(", open);
  for (let k = end; k < body.length; k++) {
    if (body[k] === "(") depth++;
    else if (body[k] === ")") { depth--; if (!depth) { end = k; break; } }
  }
  const list = body.slice(open, end);
  assert.ok(list.indexOf('key: "typing"') > 0,
    "从消息列表里搬出去了，就又变回贴着输入栏那一行");
  const live = body.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  assert.ok(!/正在说…/.test(live), "那行灰字要删掉，不是留着再加一个气泡");
  // 三颗跳动的点，和主聊天同一套
  const bub = body.slice(body.indexOf('key: "typing"'), body.indexOf('liveSt &&', body.indexOf('key: "typing"')));
  assert.match(bub, /\[0, 1, 2\]\.map/, "点数不是三颗");
  assert.match(bub, /animate-pulse/, "点不会动");
  assert.match(bub, /animationDelay: i \* 0\.15/, "三颗一起跳，那是一坨不是省略号");
  // v64.43 起两处都走 callBubble(false)（通话皮肤跟不跟气泡走由那一个开关说了算）——
  // 要的还是同一件事：这个气泡的底必须和他那一侧的台词气泡【同一个来源】
  assert.match(bub, /callBubble\(false\)\.background/, "气泡底色要跟他那一侧的台词气泡一致");
  assert.match(bub, /role: "status", "aria-live": "polite"/, "读屏读不到");
});

test("自动滚到底要把这一层算进去，不然气泡冒出来看不见", () => {
  const i = comp.indexOf("function CallScreen(");
  const body = comp.slice(i, comp.indexOf("// 懒 TTS 小播放器", i));
  assert.match(body, /\}, \[list\.length, sending\]\)/);
});
