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
  assert.match(src, /iceServers: o\.ice \|\| ICE_SERVERS/);
  assert.match(src, /ice: Core\.cleanTurn\(supaOwn\.turn\)/);
});
test("中转卡里点开就是攻略那一节，跟递名片共用一个折叠", () => {
  assert.match(src, /guideFold\("guide", "nrturnguide", \(\) => guideText\("### 直连不上时：自己的中转"\)\)/);
  assert.match(src, /guideFold\("guide", "nrsupaguide", supaGuideText\)/);
  const man = fs.readFileSync(path.join(__dirname, "..", "js", "assistant-manual.js"), "utf8");
  assert.ok(man.includes("### 直连不上时：自己的中转"));
});
