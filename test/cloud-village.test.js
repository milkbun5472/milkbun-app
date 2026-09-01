const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const scr = fs.readFileSync(path.join(__dirname, "..", "js/screens.js"), "utf8");
const seg = scr.slice(scr.indexOf("云村 tab（v54.46 全量返工）"), scr.indexOf("// 底部三 tab"));

// v54.46：她搬到 VPS 后要把网易云"完全搬进"一起听——登录后大致就是网易云本云，
// 而且所有操作（红心/加歌单/建删歌单/FM垃圾桶）都要真实反映回她的网易云账号。
test("云村的读：搜索/日推/FM/排行榜/最近播放/我喜欢的/歌单全都有", () => {
  assert.match(seg, /\/cloudsearch\?keywords=/, "搜索走全库 cloudsearch");
  assert.match(seg, /\/recommend\/songs/);
  assert.match(seg, /\/personal_fm/);
  assert.match(seg, /\/toplist/);
  assert.match(seg, /\/record\/recent\/song\?limit=50/);
  assert.match(seg, /\/song\/detail\?ids=/, "我喜欢的音乐：likelist 只有 id，要补 detail");
  assert.match(seg, /\/playlist\/track\/all\?id=.*limit=200/, "歌单拉 200 首，别只拉一半");
});

test("云村的写：每一条都真实写回她的网易云账号", () => {
  assert.match(seg, /\/playlist\/create\?name=/, "建歌单");
  assert.match(seg, /\/playlist\/delete\?id=/, "删歌单");
  assert.match(seg, /op=del&pid=/, "从自己歌单移歌");
  assert.match(seg, /op=add&pid=/, "加歌进自己歌单（v54.15 就有，不许丢）");
  assert.match(seg, /\/fm_trash\?id=/, "FM 垃圾桶反馈不喜欢");
  assert.match(seg, /\/like\?id=/, "红心");
  // 删除是破坏性操作，必须走 App 自绘确认层（iOS/PWA 可能永久吞掉系统 confirm），
  // 文案也要说清是真删，并且只有确认回调里才请求网易云。
  const del = seg.slice(seg.indexOf("const delRealPl"), seg.indexOf("const cloudRow"));
  assert.match(del, /requestAppConfirm\("删掉网易云歌单「" \+ pl\.name \+ "」？", "会真的从你的网易云账号删除。"/);
  assert.match(del, /async \(\) => \{[\s\S]*await nj\("\/playlist\/delete\?id=" \+ pl\.id\)/);
});

test("播放要 scrobble 进听歌记录，失败无声跳过不打断放歌", () => {
  assert.match(seg, /\/scrobble\?id=/);
  assert.match(seg, /playCloud = \(s, srcId\) => \{ onPlayResult\(s\); try \{ nj\("\/scrobble/, "先放歌再登记");
  assert.match(seg, /\.catch\(\(\) => \{\}\); \} catch \(e\) \{\}/, "scrobble 挂了不能影响播放");
  // 行内的播放入口都要走 playCloud，不再裸调 onPlayResult
  assert.doesNotMatch(seg.slice(seg.indexOf("const cloudRow")), /onClick: \(\) => onPlayResult\(s\)/);
});

test("移歌按钮只出现在她自己建的歌单里；收藏的/榜单没有写权限", () => {
  assert.match(seg, /removable: cv\.open\.mine \? cv\.open : null/);
  assert.match(seg, /pl\.mine \? h\("button", \{ onClick: \(\) => delRealPl\(pl\)/, "删歌单按钮同理只给自己的");
});

test("写回失败都要报出来，不许静默吞掉", () => {
  ["建歌单失败：", "删除失败：", "移除失败：", "写回失败："].forEach(msg =>
    assert.ok(seg.includes(msg), "得有失败回音：" + msg));
});

// v54.52：日推「播放全部」只循环第一首——逐首收库+单放的老路，收库和播放各随机
// 造一个 id，播放器判「不在库里」把队列塌成单曲。改走整列表连播 nowBatch 通道。
test("播放全部走整列表连播，队列不许塌成单曲", () => {
  const app = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "js/app.js"), "utf8");
  assert.match(app, /const playNeteaseList = list => \{/);
  assert.match(app, /id: "sgn_" \+ s\.id/, "按 neteaseId 造稳定 id");
  assert.match(app, /nowBatch: ss/, "整批存 nowBatch，不污染「全部」库");
  assert.match(app, /nowBatch: ss, playMode: "order"/, "播放全部要退出残留的单曲循环模式");
  assert.match(app, /playSong\(ss\[0\], ss\.map\(x => x\.id\)\)/, "显式传整个队列");
  assert.match(app, /\(L\.nowBatch \|\| \[\]\)\.find\(x => x\.id === id\)/, "resolveSong 认得批次里的歌");
  assert.match(seg, /const playAllCloud = \(list, srcId\)/);
  assert.match(seg, /onClick: \(\) => playAllCloud\(cv\.daily\)/, "日推播放全部走新通道");
  assert.doesNotMatch(seg, /forEach\(onAddNeteaseResult\); playCloud\(/, "逐首收库+单放的老路不许再有");
});

test("云村队列写入必须在同一事件内立刻对播放器可见", () => {
  const app = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "js/app.js"), "utf8");
  const saveStart = app.indexOf("const saveListen = updater => {");
  const saveEnd = app.indexOf("const setListenDisc", saveStart);
  assert.ok(saveStart >= 0 && saveEnd > saveStart, "应存在同步 saveListen 实现");
  const saveSeg = app.slice(saveStart, saveEnd);
  assert.match(saveSeg, /const prev = listenRef\.current \|\| listen \|\| \{\}/);
  assert.match(saveSeg, /listenRef\.current = n;\s*setListen\(n\)/, "先同步 ref，再触发 React render");
});

test("自动续播连续两次也必须沿队列前进，不能因 React 状态慢半拍重复预取同一首", () => {
  const app = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "js/app.js"), "utf8");
  assert.match(app, /const playerSongIdRef = useRef\(null\)/, "播放器要有同步当前曲目 ref");
  assert.match(app, /const currentId = playerSongIdRef\.current \|\| player\.songId;[\s\S]{0,900}q\.indexOf\(currentId\)/,
    "下一首必须按同步曲目算，不能等 React render");
  assert.match(app, /const song = nu\.song, songId = nu\.id;\s*playerSongIdRef\.current = songId;/,
    "ended 同步换源时要先同步当前曲目");
  assert.match(app, /const fromId = playerSongIdRef\.current \|\| player\.songId;[\s\S]{0,700}computeNextId\(\) !== id\) return;/,
    "旧曲目的异步预取晚回来不得污染新队列");
});

test("当前队列页面能解析云村临时批次，重开 App 仍从保存的整队列恢复", () => {
  const app = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "js/app.js"), "utf8");
  const screens = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "js/screens.js"), "utf8");
  assert.match(screens, /const batchSong = \(data\.nowBatch \|\| \[\]\)\.find\(x => x\.id === id\)/,
    "队列 UI 必须从 nowBatch 解析整张云歌单");
  assert.match(screens, /\(player && player\.songId\) \|\| data\.nowId \|\|/,
    "audio 尚未恢复时仍显示持久化的当前曲");
  assert.match(app, /const savedQueue = \(L\.nowQueue \|\| \[\]\).*resolveSong\(id\)/,
    "冷启动先恢复仍可解析的持久队列");
  assert.match(app, /playSong\(restoredId, savedQueue\.length \? savedQueue : undefined\)/,
    "重开后的首次播放必须携带整队列，不得塌成单曲");
});
