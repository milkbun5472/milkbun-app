// 她 2026-09-11：「还有房间，现在只能默认进已有的房间而不能另开，
//   如果我有好几个房间就选不了了。」
// 原来那一页只在心里算出【最近动过的那一间】，她连看都看不见，更别说挑。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const fic = fs.readFileSync(path.resolve(__dirname, "..", "js/fanfic.js"), "utf8");
const app = fs.readFileSync(path.resolve(__dirname, "..", "js/app.js"), "utf8");
const page = fic.slice(fic.indexOf("function FilePage(props)"), fic.indexOf("  // ---------- 转发选人 sheet ----------"));
assert.ok(page.length > 1500, "没切到 FilePage");

test("他那几间开了「一起写」的房，一间一间摆出来", () => {
  assert.match(page, /const roomsOf = function \(cid\) \{/);
  assert.match(page, /return r && !r\.main && r\.actions && r\.actions\.fanfic;/,
    "把「一起学」那种没开权限的房也列出来＝她会放进一间他写不了文的房");
  assert.match(page, /\.sort\(function \(a, b\) \{ return \(b\.updatedAt \|\| 0\) - \(a\.updatedAt \|\| 0\); \}\)/);
  assert.match(page, /const myRooms = roomsOf\(pick\);/);
  // 三档：跟以前一样（最近那间）／点名某一间／另开一间
  assert.match(page, /\[\{ id: "", name: myRooms\.length \? "最近动过的那一间（" \+ myRooms\[0\]\.name \+ "）" : "给他开一间「一起写」", note: "" \}\]/);
  assert.match(page, /\.concat\(myRooms\.map\(function \(r\) \{ return \{ id: r\.id, name: r\.name, note: "" \}; \}\)\)/);
  assert.match(page, /\.concat\(\[\{ id: "__new", name: "另开一间", note: "" \}\]\)/);
  assert.match(page, /roomId === "__new" \? h\("input", \{ value: newName/, "点了另开却没地方写名字");
});

test("换个人就把房间的选择清掉——那是另一个人的房间", () => {
  assert.match(page, /const pickChar = function \(id2\) \{ setPick\(id2\); setRoomId\(""\); \};/);
  assert.match(page, /onClick: function \(\) \{ pickChar\(c\.id\); \}/);
  assert.ok(page.indexOf("onClick: function () { setPick(c.id); }") < 0, "还有一处换人不清房间");
});

test("挑人和挑房间长一个样：同一页上不许两套规矩", () => {
  // 墨点＋名字，照上面那份名单来（tabs-not-plain-pills 的同一条道理）
  const roomSec = page.slice(page.indexOf('"放进哪一间"'));
  assert.match(roomSec, /width: 7, height: 7, borderRadius: 999, flexShrink: 0, background: on \? t\.ink : "transparent"/);
  assert.match(roomSec, /fontWeight: on \? 600 : 400/, "选中只换了个颜色");
  assert.match(roomSec, /minHeight: 44/, "点不着");
  // 说清楚为什么有的房不在名单里
  assert.match(roomSec, /只列开了「一起写」的那几间。别的房间要放，先去那间房的设置里把「一起写」打开。/);
});

test("选的那一间真的递到了落库那一步", () => {
  assert.match(page, /const roomTarget = function \(\) \{/);
  assert.match(page, /if \(roomId === "__new"\) return \{ id: "", name: String\(newName \|\| ""\)\.trim\(\)\.slice\(0, 20\) \|\| "一起写" \};/,
    "名字空着也得有个默认，不然开出一间没名字的房");
  assert.match(page, /props\.onFile\(picked, false, roomTarget\(\)\)/, "选了却没递过去＝白选");
  assert.match(fic, /onFile: function \(c, noteOnly, roomPick\) \{/);
  assert.match(fic, /props\.onFileChapter\(c\.id, window\.Fanfic\.chapterCard\(f, i, nm, mine, props\.userName\), roomPick,\n\s*\{ ficId: f\.id, ficTitle: f\.title \}\)/);
});

test("落库那一头：点名就进那间，另开就开那间，都没点走老路", () => {
  const seg = app.slice(app.indexOf("onFileChapter: (charId, card, pick, meta) =>"), app.indexOf("onNoteChapter:"));
  assert.ok(seg.length > 300, "没切到 onFileChapter");
  assert.match(seg, /let room = \(pick && pick\.id\) \? rooms\.filter\(r => r\.id === pick\.id\)\[0\] \|\| null : null;/);
  assert.match(seg, /if \(!room && pick && String\(pick\.name \|\| ""\)\.trim\(\)\) room = K\.create\(charId, String\(pick\.name\)\.trim\(\)\.slice\(0, 20\), "focused"\);/);
  // ⚠️老路一个字都不许变：两样都没点时，还是「最近动过的那一间；没有就顺手开一间」
  assert.match(seg, /if \(!room\) room = rooms\.filter\(r => r\.actions && r\.actions\.fanfic\)\.sort\(\(a, b\) => \(b\.updatedAt \|\| 0\) - \(a\.updatedAt \|\| 0\)\)\[0\];/);
  assert.match(seg, /if \(!room\) room = K\.create\(charId, "一起写", "focused"\);/);
  // 顺序要对：点名的排在最前，老路兜在最后
  const i1 = seg.indexOf("pick && pick.id"), i2 = seg.indexOf("pick.name"), i3 = seg.indexOf("r.actions && r.actions.fanfic");
  assert.ok(i1 > 0 && i2 > i1 && i3 > i2, "老路排到了点名前面，她点了也没用");
  // 这一步照旧一分钱不花
  assert.ok(seg.indexOf("callAI") < 0 && seg.indexOf("await") < 0, "归档那条路上打枪了");
});
