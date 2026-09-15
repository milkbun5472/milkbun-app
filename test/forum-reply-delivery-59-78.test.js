const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js", "app.js"), "utf8");
const screens = fs.readFileSync(path.join(root, "js", "screens.js"), "utf8");

const between = (src, start, end) => {
  const a = src.indexOf(start);
  const b = src.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, "missing source block: " + start);
  return src.slice(a, b);
};

test("自动首批仍是一轮调用整批生成，再由 visibleAt 分批露出", () => {
  const load = between(app, "  const loadForumComments = async post => {", "  // 更多回复（第二轮起");
  assert.equal((load.match(/runProbeRetry\(/g) || []).length, 1);
  assert.match(load, /forumCommentProbe\(post, "12-18"\)/);
  assert.match(load, /visibleAt: forumCommentVisibleAt\(base, i, salt\)/);
});

// ⚠️v68.47 这条整个翻过来了，翻的是她自己的决定，不是我改坏了：
//   v59.78 当时的做法是「点更多回复＝旧队列全放出 + 新批次立即可见」，
//   她 2026-09-15 报「刷一次全看完，我只是想要一部分按顺序来」。
//   所以现在两头都排队；别照着旧标题把它「修回去」。
test("手动更多回复只放出队首那几条，新批次接在旧队列后面继续排", () => {
  const more = between(app, "  const genMoreComments = async post => {", "  // 角色发帖（可被未来");
  const flushAt = more.indexOf("setForumComments(prev =>");
  const callAt = more.indexOf("runProbeRetry(active");
  assert.ok(flushAt >= 0 && callAt > flushAt, "先放出来的那几条必须在新调用开始前就落盘");
  // 放出来的是【该轮到的那几条】，不是全部
  assert.match(more, /queued\.slice\(0, FORUM_MORE_RELEASE\)/);
  assert.match(more, /return \{ \.\.\.f, visibleAt: 0, ts \}/);
  // 完整旧楼照旧交给模型（这一条没变：它决定新回复接不接得上）
  assert.match(more, /existingFloors: existing/);
  // 新批次不再立即可见
  assert.doesNotMatch(more, /\.\.\.f, floor: start \+ i, visibleAt: 0, ts: base \+ i/, "新批次又变成立即可见了");
  assert.match(more, /forumCommentVisibleAt\(base, i - shortfall \+ 3, moreSalt\)/, "新批次没进延时队列");
});

test("主页把全站新回复定位到具体帖子，帖子和楼层作者行对长名字做截断", () => {
  assert.match(screens, /const forumUnreadRows =/);
  assert.match(screens, /"新回复在这里"/);
  assert.match(screens, /onClick: \(\) => openPost\(x\.post\)/);
  assert.match(screens, /x\.post\.board/);

  const postRow = between(screens, "  function postRow(p, showBoard) {", "  // ---- 楼层");
  const floorRow = between(screens, "  function floorRow(post, cm, i) {", "  const sendReply =");
  const detail = between(screens, "  function detail() {", "  // ---- 角色/我 主页");
  for (const block of [postRow, floorRow]) {
    assert.match(block, /gridTemplateColumns: "minmax\(0,1fr\) auto"/);
    assert.match(block, /textOverflow: "ellipsis"/);
    assert.match(block, /whiteSpace: "nowrap"/);
  }
  assert.match(detail, /textOverflow: "ellipsis"/);
  assert.match(detail, /whiteSpace: "nowrap"/);
});

test("首批尚在生成时不能并发点更多，已有等待楼时按钮会说清楚动作", () => {
  assert.match(screens, /disabled: moreC \|\| loadingC/);
  assert.match(screens, /"↻ 放出旧楼并生成"/);
  assert.match(screens, /"旧楼已放出 · 生成中…"/);
});
