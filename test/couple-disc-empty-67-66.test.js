// 她 2026-09-12：「进空间时唱片是空的、我自己正放着歌，那种情况下出来我的歌回不来。」
//
// 病根：discEnter 第一行是「没歌就 return」——于是**连她原来放着什么都没记下来**。
// 可空唱片不等于这一趟不会响：她在空间里刻一首、或者在他手机里刷出一张歌单，
// 一放就成了「这一层的歌」；出门那一下 roomMusicLeave 认得出是这一层的，
// 却没有东西可还，只好 stopPlayer()——她自己那首就这么没了。
// 所以【记一份】和【落针】是两件事：没歌可放也要先记。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");

// 抠出共用的那一段【真跑】，跟 couple-disc-restore-60-63 同一个办法
const i = app.indexOf("  const roomMusicRef = useRef(null);");
const j = app.indexOf("  const addNeteaseResult =");
assert.ok(i > 0 && j > i, "抠不出 roomMusicEnter/Leave");
const body = app.slice(i, j);

const mk = state => {
  const log = [];
  const el = { currentTime: state.t || 0, paused: !state.playing, pause() { this.paused = true; log.push("pause"); } };
  const nowRef = { current: state.now };
  const discSongs = state.discSongs || [];
  const listenRef = { current: { nowQueue: state.queue || [], playlists: state.playlists || [] } };
  const fn = new Function("useRef", "playerSongIdRef", "audioElRef", "listenRef", "KEEPALIVE_ID",
    "resolveSong", "discSpinning", "discSongsOf", "discNextId", "discPlay", "stopPlayer", "playSong", "setPlayer",
    body + "\nreturn { discEnter, discLeave, phoneMusicEnter, phoneMusicLeave };")(
      v => ({ current: v }), nowRef, { current: el }, listenRef, "KEEPALIVE",
      id => (id === "KEEPALIVE" || (state.library || []).includes(id)) ? { id } : null,
      () => String(nowRef.current || "").indexOf("sgd_") === 0,
      () => discSongs,
      () => (discSongs[0] || {}).id || null,
      (cid, id) => { nowRef.current = id; el.paused = false; log.push("discPlay"); },
      () => { nowRef.current = null; log.push("stopPlayer"); },
      async (id, q) => { nowRef.current = id; el.paused = false; el.currentTime = 0; log.push("playSong:" + id + "|" + JSON.stringify(q)); },
      () => log.push("setPlayer"));
  // 她在里头刻了一首、放起来了：现在响的就是这一层的歌
  const spinUp = id => { nowRef.current = id; el.paused = false; };
  return { ...fn, log, el, spinUp, now: () => nowRef.current };
};

test("唱片是空的进去，在里头刻了一首放起来 → 出来她原来那首要回得来", async () => {
  const m = mk({ now: "sg_A", queue: ["sg_A", "sg_B"], t: 42, playing: true, library: ["sg_A", "sg_B"], discSongs: [] });
  m.discEnter("cp1");
  assert.equal(m.now(), "sg_A", "唱片空的时候不许落针，她的歌该照放");
  assert.ok(!m.log.includes("discPlay"), "空唱片还是放了");
  m.spinUp("sgd_new");                       // 她刻了一首，放起来了
  await m.discLeave();
  assert.equal(m.now(), "sg_A", "她自己那首没回来——正是她报的那个");
  assert.match(m.log.join(" "), /playSong:sg_A\|\["sg_A","sg_B"\]/, "队列也要一起还");
  assert.equal(m.el.currentTime, 42, "得接着原来那个位置");
});

test("唱片是空的、里头也没放起来 → 什么都别动，她的歌接着放", async () => {
  const m = mk({ now: "sg_A", queue: ["sg_A"], t: 10, playing: true, library: ["sg_A"], discSongs: [] });
  m.discEnter("cp1");
  await m.discLeave();
  assert.equal(m.now(), "sg_A");
  assert.ok(!m.log.includes("stopPlayer"), "她自己的歌被顺手停掉了");
  assert.ok(!m.log.some(x => x.indexOf("playSong") === 0), "没被打断过就不用还，别多放一次");
});

test("进来前本来就没在放 → 出来还是停着，不许凭空给她开一首", async () => {
  const m = mk({ now: null, playing: false, library: [], discSongs: [] });
  m.discEnter("cp1");
  m.spinUp("sgd_new");
  await m.discLeave();
  assert.ok(m.log.includes("stopPlayer"));
  assert.equal(m.now(), null);
});

test("查手机那一处是同一个形状，一起改（他歌单还没刷出来的时候）", async () => {
  const m = mk({ now: "sg_A", queue: ["sg_A"], t: 7, playing: true, library: ["sg_A"], playlists: [] });
  m.phoneMusicEnter("c1");
  assert.equal(m.now(), "sg_A");
  // 她在他手机里刷出一张歌单，点开一首——现在响的是他那张
  m.spinUp("sg_his");
  const m2 = mk({ now: "sg_A", queue: ["sg_A"], t: 7, playing: true, library: ["sg_A"],
    playlists: [{ charId: "c1", songs: [{ id: "sg_his" }] }] });
  m2.phoneMusicEnter("c1");                 // 这一次歌单有歌：落针
  assert.match(m2.log.join(" "), /playSong:sg_his/);
  await m2.phoneMusicLeave("c1");
  assert.equal(m2.now(), "sg_A", "查手机那一处她的歌也要还回来");
});

test("唱片有歌的老路一个字都没变：进来就落针，出去还回去", async () => {
  const m = mk({ now: "sg_A", queue: ["sg_A"], t: 5, playing: true, library: ["sg_A"],
    discSongs: [{ id: "sgd_1" }, { id: "sgd_2" }] });
  m.discEnter("cp1");
  assert.ok(m.log.includes("discPlay"), "有歌却没落针");
  assert.equal(m.now(), "sgd_1");
  await m.discLeave();
  assert.equal(m.now(), "sg_A");
});
