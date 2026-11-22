// 「♥ 和 X 在一起」只此一份（她 2026-11-22「不能搞成公共的？之前测试又没找到」）：
//   她的日历、他手机里的日历各拼各的，修了一处漏一处。现在只许 engine.js 的 togetherTitle 拼这一句，别处要显示就调 togetherTitleNow。
const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs"); const path = require("path");
const dir = path.join(__dirname, "..", "js");
test("「♥ 和 … 在一起」只在 engine.js 那一份里拼", () => {
  const bad = [];
  for (const f of fs.readdirSync(dir).filter(x => x.endsWith(".js") && !/^(assistant-manual|changelog-data)\.js$/.test(x))) {
    fs.readFileSync(path.join(dir, f), "utf8").split("\n").forEach((ln, i) => {
      if (/^\s*\/\//.test(ln)) return;
      if (/"♥ 和 "|♥ 和 \.\+ 在一起/.test(ln) && !(f === "engine.js" && /function (togetherTitle|isTogetherEvent)\b/.test(ln))) bad.push(f + ":" + (i + 1));
    });
  }
  assert.deepStrictEqual(bad, [], "别处又自己拼了「♥ 和 … 在一起」，改成调 togetherTitle / togetherTitleNow");
});
test("显示时换成此刻的名字，别的事件原样", () => {
  const src = fs.readFileSync(path.join(dir, "engine.js"), "utf8");
  const i = src.indexOf('const TOGETHER_NOTE'), j = src.indexOf('function samePlacePresence');
  const f = new Function(src.slice(i, j) + "\nreturn { togetherTitle, togetherTitleNow };")();
  assert.strictEqual(f.togetherTitleNow({ note: "情侣纪念日", title: f.togetherTitle("主面具") }, "小号"), "♥ 和 小号 在一起");
  assert.strictEqual(f.togetherTitleNow({ note: "别的", title: "♥ 和 主面具 在一起" }, "小号"), "♥ 和 主面具 在一起");
  assert.strictEqual(f.togetherTitleNow({ note: "情侣纪念日", title: "一周年" }, "小号"), "一周年");
});
