// 联机首页排法（2026-11-23 她：「看起来好乱」）：进门的事在上，以前的房间、认识的人其次，递名片折在最底下
const fs = require("fs"), path = require("path"), assert = require("assert"), test = require("node:test");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "netroom.js"), "utf8");
const home = src.slice(src.indexOf('h(Head, { zh: "联机", onBack: props.onBack })'));
test("首页顺序：开房/加入 → 以前的房间 → 认识的人 → 折起来的递名片", () => {
  const at = k => { const i = home.indexOf(k); assert.ok(i > 0, k); return i; };
  assert.ok(at('"nrhost"') < at('"nrhist"'));
  assert.ok(at('"nrhist"') < at('"nrknownopen"'));
  assert.ok(at('"nrknownopen"') < at('"nrsupafold"'));
  assert.match(home, /"nrsupafold", open: \(useSupa/);
});
test("等人那页：按钮名对得上首页，自己 Supabase 开的房让发连接码", () => {
  assert.doesNotMatch(src, /输入房间号加入/);
  assert.match(src, /sig \? "把上面整串连接码发给要来的人" : "把房间号发给要来的人"/);
});
test("自己的中转：地址补成 turn:，接在公共 STUN 后面，没填就不动", () => {
  const i = src.indexOf("function cleanTurn"), j = src.indexOf("const CONNECT_TIMEOUT");
  const f = new Function("ICE_SERVERS", src.slice(i, j) + "; return { cleanTurn, iceFor };")([{ urls: "stun:x" }]);
  assert.equal(f.cleanTurn({ url: "" }), null);
  assert.deepEqual(f.cleanTurn({ url: "a.example:80, turns:b.example:443?transport=tcp", user: " u ", pass: "p" }),
    { urls: ["turn:a.example:80", "turns:b.example:443?transport=tcp"], username: "u", credential: "p" });
  assert.equal(f.iceFor(null).length, 1);
  assert.equal(f.iceFor({ url: "turn:a:3478" }).length, 2);
  assert.match(src, /iceServers: ice \|\| ICE_SERVERS/);
  assert.match(src, /ice: Core\.cleanTurn\(supaOwn\.turn\)/);
});
test("中转卡里点开就是攻略那一节，跟递名片共用一个折叠", () => {
  assert.match(src, /guideFold\("guide", "nrturnguide", \(\) => guideText\("### 直连不上时：自己的中转"\)\)/);
  assert.match(src, /guideFold\("guide", "nrsupaguide", supaGuideText\)/);
  const man = fs.readFileSync(path.join(__dirname, "..", "js", "assistant-manual.js"), "utf8");
  assert.ok(man.includes("### 直连不上时：自己的中转"));
});

test("连不上时说清是谁那边、为什么", () => {
  const i = src.indexOf("function iceKinds"), j = src.indexOf("const diagOf");
  const f = new Function(src.slice(i, j) + "; return { iceKinds, diagnose };")();
  const S = k => k.map(x => "a=candidate:1 1 udp 1 1.2.3.4 9 typ " + x).join("\n");
  assert.equal(f.diagnose({ mine: S(["host", "srflx"]), theirs: null }).who, "她");
  assert.equal(f.diagnose({ mine: S(["host"]), theirs: S(["host", "srflx"]) }).who, "你");
  assert.equal(f.diagnose({ mine: S(["host", "srflx"]), theirs: S(["host"]) }).who, "她");
  assert.equal(f.diagnose({ mine: S(["host", "srflx"]), theirs: S(["srflx"]), turn: true }).why, "你填的中转没接通");
  assert.equal(f.diagnose({ mine: S(["srflx"]), theirs: S(["prflx"]) }).who, "两边");
  assert.match(src, /L\.diag = diagOf\(L\.pc, !!ice\); try \{ L\.pc\.close/);
  assert.match(src, /"data-wk": "nrdiag"/);
});
test("中转借给房里：只沿直连发给连上的那个人，收到的人自己没填才换上，换上就重连失败的线", () => {
  assert.match(src, /send\(\{ t: "turn", ice: c \}, id\)/);
  assert.match(src, /supaOwn\.turnShare !== false && Core\.cleanTurn\(supaOwn\.turn\)/);
  assert.match(src, /setIce\(next\) \{ if \(dead \|\| ice \|\| !next\) return false;/);
  assert.match(src, /"data-wk": "nrturnshare"/);
});
test("连不上自己重试两次，连上清零", () => {
  assert.match(src, /\(tries\[id\] = \(tries\[id\] \|\| 0\) \+ 1\) <= 2/);
  assert.match(src, /tries\[id\] = 0;/);
});
test("首页能测网络，摆在中转卡上面", () => {
  assert.match(src, /async function probeNet\(turn\)/);
  assert.match(src, /probeBox, turnBox, supaBox/);
});
