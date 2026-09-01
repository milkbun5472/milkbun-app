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

test("手动更多回复先放出旧队列，把完整旧楼交给模型，并让新批次立即可见", () => {
  const more = between(app, "  const genMoreComments = async post => {", "  // 角色发帖（可被未来");
  const flushAt = more.indexOf("setForumComments(prev =>");
  const callAt = more.indexOf("runProbeRetry(active");
  assert.ok(flushAt >= 0 && callAt > flushAt, "旧队列必须在新调用开始前先落盘并显示");
  assert.match(more, /Number\(f\.visibleAt\) <= requestedAt/);
  assert.match(more, /return \{ \.\.\.f, visibleAt: 0, ts \}/);
  assert.match(more, /existingFloors: existing/);
  assert.match(more, /\.\.\.f, floor: start \+ i, visibleAt: 0, ts: base \+ i/);
  assert.doesNotMatch(more, /forumCommentVisibleAt\(/, "手动批次不能再进入延时队列");
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
