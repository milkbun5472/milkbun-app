// 联机房间·一起听：歌曲卡只带元数据（没有音频本体），点卡三种情况，正在听是在线状态（不进记录）且进开口的提示词
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const src = read("js/netroom.js"), app = read("js/app.js");
function load() { const w = {}; new Function("window", "loadJSON", "saveJSON", src)(w, () => null, () => {}); return w.NetRoomCore; }
const C = load();

test("歌曲卡白名单：只留歌名、歌手、封面网址、数字编号；音频、本地地址、dataURL 一律不收", () => {
  const x = C.cleanRich("song", { title: "晴天", artist: "某某", cover: "https://p.example/c.jpg", nid: "186016", url: "blob:xx", audio: "data:audio/mp3;base64,AAA", blob: {}, id: "local_1", source: "local" });
  assert.deepStrictEqual(x, { title: "晴天", artist: "某某", cover: "https://p.example/c.jpg", nid: "186016" });
  assert.deepStrictEqual(C.cleanRich("song", { title: "a", cover: "data:image/png;base64,xx", nid: "abc" }), { title: "a", artist: "" });
  assert.strictEqual(C.cleanRich("song", { artist: "无名" }), null);
  const w = C.wireMsg({ id: "m", kind: "user", name: "她", type: "song", x: { title: "晴天", artist: "某某", audio: "x" } });
  assert.ok(!JSON.stringify(w).includes("audio"));
  assert.strictEqual(w.text, "[分享了一首歌] 《晴天》 - 某某");
  // 发卡那头也只拿元数据：本地歌不带编号
  assert.match(src, /const songX = s0 => s0 \? Core\.cleanSong\(\{ title: s0\.title, artist: s0\.artist, cover: s0\.cover, nid: s0\.source === "netease" \? s0\.neteaseId : "" \}\)/);
});

test("点卡三种情况：公开编号直接放 / 本地曲库对上就放她那份 / 都没有提示去搜", () => {
  const link = C.songPlan({ title: "晴天", artist: "某某", nid: "186016" }, [], true);
  assert.strictEqual(link.how, "link"); assert.strictEqual(link.song.neteaseId, "186016"); assert.strictEqual(link.song.source, "netease");
  const lib = [{ id: "l1", source: "local", title: "晴 天", artist: "某某" }];
  const local = C.songPlan({ title: "晴天", artist: "某某", nid: "186016" }, lib, false);
  assert.strictEqual(local.how, "local"); assert.strictEqual(local.song.id, "l1");
  assert.strictEqual(C.songPlan({ title: "晴天", artist: "别人" }, lib, false).how, "miss");
  const miss = C.songPlan({ title: "夜曲", artist: "某某" }, lib, false);
  assert.strictEqual(miss.how, "miss"); assert.strictEqual(miss.query, "夜曲 某某");
  assert.match(src, /这首在发歌的人手机上，你这边没有/);
});

test("正在听：走单独的 np 消息、不进记录；开口时两条路都带上", () => {
  const i = src.indexOf('} else if (e.t === "np") {'), j = src.indexOf("} else if", i + 10);
  const body = src.slice(i, j);
  assert.ok(i > 0);
  assert.doesNotMatch(body, /addMsg|commit\(/);
  assert.deepStrictEqual(C.listenLines({ p1: { who: "小A", title: "晴天", artist: "某某" }, p2: null }), ["小A 在听《晴天》 - 某某"]);
  const room = { myNick: "我", peers: [], myChars: [{ id: "c1", name: "A" }], msgs: [] };
  const one = C.lineInstruction(room, { id: "c1", name: "A" }, { listen: ["小A 在听《晴天》"] });
  assert.ok(one.includes("【房里此刻在放的歌】") && one.includes("小A 在听《晴天》"));
  const two = C.jointInstruction(room, [{ id: "c1", name: "A" }, { id: "c2", name: "B" }], { listen: ["小A 在听《晴天》"] });
  assert.ok(two.includes("小A 在听《晴天》"));
  assert.strictEqual((src.match(/listen: listenNow\(\)/g) || []).length, 2);
});

test("角色也能发歌；＋ 里一键发正在听的，没在放时那颗灰着", () => {
  assert.strictEqual(C.actsOf({ song: "晴天 某某" }, {}).song, "晴天 某某");
  assert.ok(C.actBits({ songOn: true, songs: ["晴天 某某"] }, false).some(b => b.indexOf("\"song\"") === 0 && b.includes("晴天 某某")));
  assert.ok(!C.actBits({}, false).some(b => b.indexOf("\"song\"") === 0));
  assert.match(src, /"data-wk": "nrsongnow", disabled: !cur/);
  assert.match(src, /\["listen", "一起听", "note"\]/);
  assert.match(app, /nowSong: \(\) =>/); assert.match(app, /findSong: async q =>/);
});
