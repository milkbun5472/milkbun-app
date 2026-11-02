// 她 2026-11-02：放着 A 歌单的歌、进 A 的手机再出来，歌和悬浮窗一起没了（进 B 的没事）。
//   进门时就在放这一层的歌，要记一笔 keep，出门原样接着放。
const assert = require("node:assert/strict"), fs = require("fs");
const app = fs.readFileSync("js/app.js", "utf8");
const a = app.indexOf("const roomMusicEnter = "), b = app.indexOf("const discEnter = ");
const seg = app.slice(a, b);
let stopped = 0;
const env = { roomMusicRef: { current: null }, playerSongIdRef: { current: "s1" }, audioElRef: { current: null }, listenRef: { current: {} },
  resolveSong: () => ({ id: "s1" }), stopPlayer: () => { stopped++; }, playSong: async () => {}, setPlayer: () => {}, userPauseRef: { current: false } };
const F = new Function(...Object.keys(env), seg + ";return {roomMusicEnter, roomMusicLeave};")(...Object.values(env));
(async () => {
  F.roomMusicEnter(() => true, null, true);
  await F.roomMusicLeave(() => true);
  assert.equal(stopped, 0, "进门前就在放 A 的歌：出来不许停");
  env.roomMusicRef.current = null;
  F.roomMusicEnter(() => true, null);
  await F.roomMusicLeave(() => true);
  assert.equal(stopped, 1, "情侣唱片已经在转：走的时候照旧只带走自己");
  assert.match(app, /roomMusicEnter\(phoneMusicMine\(cid\), [^\n]*, true\);/);
})().catch(e => { console.error(e); process.exit(1); });
