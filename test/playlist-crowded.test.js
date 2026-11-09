// 她 2026-11-02：人人歌单里都有落日飞车《My Jinji》。别人歌单里至少两人都放的歌摆给他；写法要求加「换成别的角色也会放吗」。
const assert = require("node:assert/strict"), fs = require("fs");
const app = fs.readFileSync("js/app.js", "utf8");
const i = app.indexOf("const _songKey = "), j = app.indexOf("const crowdStr", i);
const listenRef = { current: { playlists: [
  { charId: "a", songs: [{ title: "My Jinji", artist: "落日飞车" }, { title: "X", artist: "1" }] },
  { charId: "b", songs: [{ title: "My Jinji ", artist: "落日飞车" }] },
  { charId: "c", songs: [{ title: "X", artist: "2" }] },
  { charId: "me", songs: [{ title: "My Jinji", artist: "落日飞车" }] },
] } };
const crowded = new Function("listenRef", "char", app.slice(i, j) + ";return crowded;")(listenRef, { id: "me" });
assert.deepEqual(crowded, ["My Jinji（落日飞车）"], "至少两个【别人】都放了才算，自己的不算，同名不同歌手不算");
assert.match(app, /avoidStr \+ crowdStr \+ \(nudge/);
assert.match(app, /这首歌换成别的角色也会放进歌单吗/);
