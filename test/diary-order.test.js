const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "..", "js/app.js"), "utf8");

// 她 2026-08-20 报：补齐漏记的日记跑到最上面去了。
// 因为写入是无条件 [新条目, ...旧的]——补的是旧日子，却按"刚写"排。
test("日记按日期倒序，不按写入顺序", () => {
  const grab = name => {
    const i = app.indexOf("  function " + name + "(");
    let d = 0, j = app.indexOf("{", i), started = false;
    for (; j < app.length; j++) {
      if (app[j] === "{") { d++; started = true; }
      else if (app[j] === "}") { d--; if (started && !d) { j++; break; } }
    }
    return app.slice(i, j);
  };
  const m = new Function(grab("sortDiaryList") + grab("sortDiaryBook") +
    "\nreturn { sortDiaryList, sortDiaryBook };")();

  const d = (day, tag) => ({ id: tag, ts: new Date(2026, 7, day).getTime() });
  // 模拟：先自动写了 18、20 两天，然后补齐 19 —— 补的那篇是最后写进去的
  const 补齐后 = [d(19, "补19"), d(20, "自动20"), d(18, "自动18")];
  assert.deepEqual(m.sortDiaryList(补齐后).map(x => x.id), ["自动20", "补19", "自动18"],
    "19 号该排在 20 和 18 中间，而不是因为刚写就跑最上面");

  // 整本重排：老数据一次性理好
  const book = m.sortDiaryBook({ c1: 补齐后, __me: [d(1, "早"), d(9, "晚")] });
  assert.deepEqual(book.c1.map(x => x.id), ["自动20", "补19", "自动18"]);
  assert.deepEqual(book.__me.map(x => x.id), ["晚", "早"]);

  // 缺 ts 的脏数据不能让整个排序崩掉
  assert.equal(m.sortDiaryList([{ id: "没ts" }, d(20, "有ts")])[0].id, "有ts");
  assert.deepEqual(m.sortDiaryList(null), []);
  assert.deepEqual(m.sortDiaryBook(null), {});
});

test("三个入口都走排序：加载、角色日记、我的日记", () => {
  assert.match(app, /setDiaries\(sortDiaryBook\(loadJSON\("x_diaries", \{\}\)\)\);/, "加载时整本重排，修好她现有的乱序");
  assert.match(app, /\[charId\]: sortDiaryList\(\[entry, \.\.\.\(p\[charId\] \|\| \[\]\)\]\)/);
  assert.match(app, /__me: sortDiaryList\(\[entry, \.\.\.\(p\.__me \|\| \[\]\)\]\)/);
  // 不许再有裸的无排序插入
  assert.doesNotMatch(app, /\[charId\]: \[entry, \.\.\./);
  assert.doesNotMatch(app, /__me: \[entry, \.\.\./);
});

// v53.87：显示层兜底。存储顺序对不对都不该影响显示。
test("显示层自己排一次，不依赖存储顺序", () => {
  const screens = fs.readFileSync(path.join(__dirname, "..", "js/screens.js"), "utf8");
  assert.match(screens, /const sortByDay = list => \(list \|\| \[\]\)\.slice\(\)\.sort/);
  assert.match(screens, /const entriesOf = id => sortByDay\(diaries\[id\]\);/);
  assert.doesNotMatch(screens, /const entriesOf = id => diaries\[id\] \|\| \[\];/, "不许再有裸取");
  assert.doesNotMatch(screens, /const list = diaries\[char\.id\] \|\| \[\];/, "翻阅页也要排");
  // 行为：乱序进去，倒序出来
  const m = new Function("const list = arguments[0];" +
    "return (list || []).slice().sort((a, b) => Number((b && b.ts) || 0) - Number((a && a.ts) || 0));");
  const d = (day, tag) => ({ id: tag, ts: new Date(2026, 7, day).getTime() });
  assert.deepEqual(m([d(7, "补7"), d(19, "十九"), d(18, "十八")]).map(x => x.id), ["十九", "十八", "补7"],
    "她截图里那个顺序：8/7 被补在最后写，不该压在 8/19 上面");
});
