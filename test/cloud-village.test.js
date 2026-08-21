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
  // 删除是破坏性操作，必须先 confirm，文案要说清是真删
  assert.match(seg, /confirm\("删掉网易云歌单「" \+ pl\.name \+ "」？会真的从你账号删除。"\)/);
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
