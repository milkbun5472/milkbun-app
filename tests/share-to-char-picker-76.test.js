// 「发给谁」收成一份公共的（2026-10-28）：直播回放、片刻视频、一起听都用 ShareToCharPicker；一起听能把一首歌转进TA的对话框
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const rd = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");

test("公共的选人框在 components.js，三处都用它", () => {
  assert.match(rd("components.js"), /function ShareToCharPicker\(/);
  assert.match(rd("components.js"), /function shareChatKey\(/);
  for (const f of ["live.js", "shua.js", "screens-ui.js"]) assert.match(rd(f), /h\(ShareToCharPicker,/, f);
  assert.doesNotMatch(rd("live.js"), /livesharerow/);
  assert.doesNotMatch(rd("shua.js"), /shuasharerow/);
});

test("一首歌转过去落的是一起听的卡，话里写明是一首歌", () => {
  const src = rd("listen-square.js");
  const win = {};
  global.window = win;
  try { new Function("window", src)(win); } catch (e) {}
  const LQ = win.ListenSquare;
  assert.ok(LQ, "ListenSquare 挂上了");
  const snap = LQ.shareSnap({ song: { title: "晴天", artist: "周杰伦" } });
  assert.equal(snap.id, null);
  assert.match(LQ.shareText(snap), /一首歌.*《晴天》（周杰伦）/);
  const post = LQ.shareSnap({ id: "p1", name: "阿远", text: "好听", song: { title: "晴天" } });
  assert.match(LQ.shareText(post), /广场转来一帖/);
});

test("app 的转发把房间带上", () => {
  assert.match(rd("app.js"), /const shareSquare = \(post, c, roomId\)/);
  assert.match(rd("app.js"), /pChat\(shareChatKey\(c, roomId\)/);
});
