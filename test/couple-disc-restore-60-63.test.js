const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");

// 她 2026-09-02：「情侣空间点进他们的空间就会播放音乐，出来音乐会停（这个确实要这样）
//                 但是我原来的悬浮播放器也跟着没了嘤」。
// 唱片是【暂借】她的播放器：discEnter 直接 discPlay 盖掉她正在放的歌，
// discLeave 又只会 stopPlayer——借完不还，连她原来那首一起端走了。

// —— 把 discEnter / discLeave 抠出来【真跑】：光看代码看不出还得对不对 ——
const i = app.indexOf("  const discPrevRef = useRef(null);");
const j = app.indexOf("  const addNeteaseResult =");
assert.ok(i > 0 && j > i, "抠不出 discEnter/discLeave");
const body = app.slice(i, j);

const mk = state => {
  const log = [];
  const el = { currentTime: state.t || 0, paused: !state.playing, pause() { this.paused = true; log.push("pause"); } };
  const nowRef = { current: state.now }, listenRef = { current: { nowQueue: state.queue || [] } };
  const fn = new Function("useRef", "playerSongIdRef", "audioElRef", "listenRef", "KEEPALIVE_ID",
    "resolveSong", "discSpinning", "discSongsOf", "discNextId", "discPlay", "stopPlayer", "playSong", "setPlayer",
    body + "\nreturn { discEnter, discLeave };")(
      v => ({ current: v }), nowRef, { current: el }, listenRef, "KEEPALIVE",
      id => (id === "KEEPALIVE" || (state.library || []).includes(id)) ? { id } : null,
      () => String(nowRef.current || "").indexOf("sgd_") === 0,
      () => state.discSongs || [{ id: "sgd_1" }, { id: "sgd_2" }],
      () => "sgd_2",
      (cid, id) => { nowRef.current = id; el.paused = false; log.push("discPlay"); },
      () => { nowRef.current = null; log.push("stopPlayer"); },
      async (id, q) => { nowRef.current = id; el.paused = false; el.currentTime = 0; log.push("playSong:" + id + "|" + JSON.stringify(q)); },
      () => log.push("setPlayer"));
  return { ...fn, log, el, now: () => nowRef.current };
};
const trip = async state => { const m = mk(state); m.discEnter("cp1"); await m.discLeave(); return m; };

test("进来前在放自己的歌 → 出去原样还回去：同一首、同一个队列、同一个位置", async () => {
  const m = await trip({ now: "sg_A", queue: ["sg_A", "sg_B"], t: 73.5, playing: true, library: ["sg_A", "sg_B"] });
  assert.equal(m.now(), "sg_A", "她那首歌没还回来");
  assert.match(m.log.join(" "), /playSong:sg_A\|\["sg_A","sg_B"\]/, "队列也要一起还");
  assert.equal(m.el.currentTime, 73.5, "得接着原来那个位置，不是从头");
  assert.equal(m.el.paused, false);
});

test("进来前是暂停着的 → 还她一个暂停，别自己放起来", async () => {
  const m = await trip({ now: "sg_A", queue: ["sg_A"], t: 12, playing: false, library: ["sg_A"] });
  assert.equal(m.now(), "sg_A");
  assert.equal(m.el.paused, true, "原来暂停着，还回去也该是暂停");
  assert.equal(m.el.currentTime, 12);
});

test("进来前什么都没放 → 出去就该是安静的（她说「这个确实要这样」）", async () => {
  const m = await trip({ now: null, queue: [], t: 0, playing: false, library: [] });
  assert.equal(m.now(), null);
  assert.match(m.log.join(" "), /stopPlayer/);
  assert.ok(!/playSong/.test(m.log.join(" ")), "不许凭空给她开一首");
});

test("原来那首歌已经不在库里了 → 停干净，别去放一首不存在的", async () => {
  const m = await trip({ now: "sg_GONE", queue: ["sg_GONE"], t: 30, playing: true, library: [] });
  assert.equal(m.now(), null);
  assert.match(m.log.join(" "), /stopPlayer/);
});

test("静音保活那首也要还——它占着 iOS 的音频会话", async () => {
  const m = await trip({ now: "KEEPALIVE", queue: [], t: 0, playing: true, library: [] });
  assert.equal(m.now(), "KEEPALIVE", "顺手把保活停了＝后台保活断了");
});

test("这对没有唱片 → 一个音符都别动她的", async () => {
  const m = await trip({ now: "sg_A", queue: ["sg_A"], t: 40, playing: true, library: ["sg_A"], discSongs: [] });
  assert.equal(m.now(), "sg_A");
  assert.equal(m.el.currentTime, 40, "碰都不该碰");
  assert.equal(m.log.length, 0);
});

test("唱片本来就在转 → 不重新记一次针位（否则会把唱片自己记成「她原来的歌」）", async () => {
  const m = await trip({ now: "sgd_9", queue: [], t: 5, playing: true, library: ["sgd_9"] });
  assert.ok(!/discPlay/.test(m.log.join(" ")), "已经在转就别打断它");
  assert.equal(m.now(), null, "走的时候还是只带走自己");
});
