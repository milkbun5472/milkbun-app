const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const screens = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");

const seg = screens.slice(screens.indexOf("const forumFloorArrivedAt"), screens.indexOf("function fmtNum"));
const { forumFloorOrder } = new Function(seg + "\nreturn { forumFloorOrder };")();

// 她 2026-08-25 截图：9 楼下面直接冒出 16 楼，中间 10-15 全不见。
// 楼号是生成那一刻按数组下标发死的，可楼层是按 visibleAt 分批解锁的——
// 排在几小时后的 10-15 楼占着号，随后一波「现在就发生」的回帖拿到 16 号却立刻可见。
const STEPS = [8, 18, 35, 55, 80, 110, 145, 185, 230, 280, 335, 395, 460, 530, 605];
const stagger = (base, i) => (i < 3 ? base : base + STEPS[Math.min(i - 3, STEPS.length - 1)] * 60000);

test("已经露面的楼，楼号必须连着，中间不许有空号", () => {
  const base = 1e9;
  const now = base + 190 * 60000;
  const stored = [];
  for (let i = 0; i < 14; i++) stored.push({ id: "f" + i, floor: i + 2, visibleAt: stagger(base, i), ts: stagger(base, i) });
  stored.push({ id: "wave", floor: 16, visibleAt: now, ts: now }); // 旧代码：existing.length + 2

  const shownBefore = stored.filter(f => f.visibleAt <= now).map(f => f.floor);
  const gapBefore = shownBefore.some((n, i) => i > 0 && n !== shownBefore[i - 1] + 1);
  assert.ok(gapBefore, "先复现她看到的那一跳：" + shownBefore.join(","));
  assert.ok(shownBefore.includes(16), "跳出来的正是那个大号楼层");

  const shown = forumFloorOrder(stored).filter(f => f.visibleAt <= now).map(f => f.floor);
  assert.deepEqual(shown, shown.map((_, i) => i + 2), "修好之后 2,3,4… 一路连到底");
});

test("还没到点的楼排在所有已露面的楼后面，号也在后面", () => {
  const base = 1e9;
  const now = base + 190 * 60000;
  const stored = [];
  for (let i = 0; i < 14; i++) stored.push({ id: "f" + i, floor: i + 2, visibleAt: stagger(base, i), ts: stagger(base, i) });
  stored.push({ id: "wave", floor: 16, visibleAt: now, ts: now });

  const ordered = forumFloorOrder(stored);
  const maxShown = Math.max(...ordered.filter(f => f.visibleAt <= now).map(f => f.floor));
  const minQueued = Math.min(...ordered.filter(f => f.visibleAt > now).map(f => f.floor));
  assert.ok(minQueued > maxShown, "排队的楼不许插到已看过的楼中间");
  assert.equal(ordered.find(f => f.id === "wave").floor, maxShown, "刚发生的那一波就是当下最新的一楼");
});

test("已经看过的楼永远不会被重新编号", () => {
  const base = 1e9;
  const stored = [];
  for (let i = 0; i < 6; i++) stored.push({ id: "f" + i, floor: i + 2, visibleAt: stagger(base, i), ts: stagger(base, i) });
  const t1 = base + 60 * 60000;
  const before = forumFloorOrder(stored).filter(f => f.visibleAt <= t1).map(f => f.id + "=" + f.floor);
  const t2 = t1 + 60000;
  const after = forumFloorOrder([...stored, { id: "wave", floor: 99, visibleAt: t2, ts: t2 }])
    .filter(f => f.visibleAt <= t1).map(f => f.id + "=" + f.floor);
  assert.deepEqual(after, before);
});

test("旧数据没有 visibleAt 时按 ts 排，顺序不乱", () => {
  const ordered = forumFloorOrder([
    { id: "a", floor: 2, ts: 100 }, { id: "b", floor: 3, ts: 200 }, { id: "c", floor: 4, ts: 300 }
  ]);
  assert.deepEqual(ordered.map(f => f.id + ":" + f.floor), ["a:2", "b:3", "c:4"]);
});

// 所有往 x_forumComments 里塞楼层的路子都得过这一道，否则存下来的号又会长歪。
test("每条写入新楼的路径都走 forumFloorOrder", () => {
  const lines = app.split("\n");
  // 只挂楼中楼的写入（replies 追加）不发新楼号，不在这条规矩里
  const sites = lines.map((l, i) => ({ l, i }))
    .filter(x => x.l.includes('saveJSON("x_forumComments"'))
    .filter(x => /\[(post\.id|hitId)\]\s*:/.test(lines.slice(Math.max(0, x.i - 3), x.i + 1).join("\n")))
    .filter(x => !lines.slice(Math.max(0, x.i - 3), x.i + 1).join("\n").includes("f.id === floorId"));
  assert.ok(sites.length >= 4, "至少四条新楼写入路径，实际 " + sites.length);
  sites.forEach(x => {
    const win = lines.slice(Math.max(0, x.i - 3), x.i + 1).join("\n");
    assert.match(win, /forumFloorOrder\(/, "这条写入没重排楼号（第 " + (x.i + 1) + " 行）：" + x.l.trim().slice(0, 80));
  });
});

// 自动活动波不能接用户还没看见的空气；但用户手动点「更多回复」会先把旧队列全部放出，
// 所以手动新一轮必须吃到完整旧楼，免得忘掉刚刚被 push 出来的内容。
test("自动波只读已露面楼，手动更多则先放出并读取完整旧楼", () => {
  const manual = app.slice(app.indexOf("const genMoreComments = async post =>"), app.indexOf("// 角色发帖（可被未来"));
  assert.match(manual, /return \{ \.\.\.f, visibleAt: 0, ts \}/);
  assert.match(manual, /existingFloors:\s*existing/);

  const auto = app.slice(app.indexOf("const forumMineTick = async () =>"), app.indexOf("const forumMineBumpSocial"));
  assert.match(auto, /const shownFloors = existing\.filter\(f => !f\.visibleAt \|\| Number\(f\.visibleAt\) <= Date\.now\(\)\)/);
  assert.match(auto, /existingFloors:\s*shownFloors/);
});
