// 群友 2026-10-20：「歌单有歌曲数量限制吗」——「全部」那栏原来 30/40/60 各不一样、满了悄悄挤掉；统一 300，挤掉时说一声
const assert = require("node:assert/strict");
const app = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "app.js"), "utf8");
assert.match(app, /const LISTEN_SONG_CAP = 300;/);
assert.equal((app.match(/songs: capListenSongs\(\[/g) || []).length, 4, "四条往「全部」里加歌的路都要走同一个上限");
const seg = app.slice(app.indexOf("const capListenSongs"), app.indexOf("const addListenSong"));
const toasts = [];
const cap = new Function("LISTEN_SONG_CAP", "toast", "setTimeout", seg + "; return capListenSongs;")(3, m => toasts.push(m), f => f());
assert.deepEqual(cap([1, 2]), [1, 2]);
assert.equal(toasts.length, 0, "没满不该提示");
assert.deepEqual(cap([1, 2, 3, 4]), [1, 2, 3]);
assert.equal(toasts.length, 1, "挤掉了要说一声");
console.log("ok");
